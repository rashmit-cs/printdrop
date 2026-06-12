import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Per-shop agent auth: Authorization: Bearer <shop.agentSecret>:<shopId>
async function agentAuth(req, res, next) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No agent token' });

  const [secret, shopId] = auth.split(':');
  if (!secret || !shopId) return res.status(401).json({ error: 'Bad token format' });

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(401).json({ error: 'Shop not found' });
  if (shop.agentSecret !== secret) return res.status(401).json({ error: 'Wrong secret for this shop' });

  req.shopId = shopId;
  next();
}

// POST /api/agent/register-printers — agent sends discovered printer list
router.post('/register-printers', agentAuth, async (req, res) => {
  const { printers } = req.body; // array of printer names
  if (!Array.isArray(printers)) return res.status(400).json({ error: 'printers must be array' });

  for (const name of printers) {
    const existing = await prisma.printer.findFirst({ where: { shopId: req.shopId, name } });
    if (existing) {
      await prisma.printer.update({ where: { id: existing.id }, data: { isOnline: true, lastSeen: new Date() } });
    } else {
      await prisma.printer.create({ data: { shopId: req.shopId, name, type: 'BOTH', isOnline: true } });
    }
  }

  // mark printers not in this list as offline
  await prisma.printer.updateMany({
    where: { shopId: req.shopId, name: { notIn: printers } },
    data: { isOnline: false }
  });

  res.json({ success: true });
});

// GET /api/agent/jobs — paid orders + which printer to use
router.get('/jobs', agentAuth, async (req, res) => {
  const jobs = await prisma.order.findMany({
    where: { shopId: req.shopId, status: 'PAID' },
    select: { id: true, fileName: true, fileUrl: true, filePath: true, printType: true, copies: true }
  });

  if (jobs.length === 0) return res.json([]);

  // get default printers for color / bw
  const printers = await prisma.printer.findMany({ where: { shopId: req.shopId, isOnline: true } });

  const findPrinter = (type) => {
    return printers.find(p => p.isDefault && (p.type === type || p.type === 'BOTH'))
        || printers.find(p => p.type === type || p.type === 'BOTH')
        || null;
  };

  const enriched = jobs.map(j => ({
    ...j,
    printerName: findPrinter(j.printType)?.name || 'default'
  }));

  await prisma.order.updateMany({
    where: { id: { in: jobs.map(j => j.id) } },
    data: { status: 'PRINTING' }
  });

  res.json(enriched);
});

// POST /api/agent/done/:orderId
router.post('/done/:orderId', agentAuth, async (req, res) => {
  const { pages } = req.body;
  const order = await prisma.order.findFirst({ where: { id: req.params.orderId, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  const pricePerPage = order.printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
  const finalAmount = pages ? pricePerPage * pages * order.copies : order.amount;

  await prisma.order.update({
    where: { id: req.params.orderId },
    data: { status: 'PRINTED', printedAt: new Date(), ...(pages && { pages, amount: finalAmount }) }
  });
  res.json({ success: true });
});

// POST /api/agent/failed/:orderId
router.post('/failed/:orderId', agentAuth, async (req, res) => {
  await prisma.order.update({ where: { id: req.params.orderId }, data: { status: 'FAILED' } });
  res.json({ success: true });
});

export default router;
