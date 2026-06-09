import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// PC agent authenticates with shopId + agentSecret stored in .env on shopkeeper PC
// Simple token check: Authorization: Bearer AGENT_SECRET:SHOP_ID

function agentAuth(req, res, next) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No agent token' });

  const [secret, shopId] = auth.split(':');
  if (!secret || !shopId) return res.status(401).json({ error: 'Bad token format' });
  if (secret !== process.env.AGENT_SECRET) return res.status(401).json({ error: 'Wrong secret' });

  req.shopId = shopId;
  next();
}

// GET /api/agent/jobs - PC agent polls this every 5 sec
// Returns PAID orders that haven't been printed yet
router.get('/jobs', agentAuth, async (req, res) => {
  const jobs = await prisma.order.findMany({
    where: {
      shopId: req.shopId,
      status: 'PAID'
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      filePath: true,
      printType: true,
      copies: true,
      shop: {
        select: {
          colorPrinter: true,
          bwPrinter: true
        }
      }
    }
  });

  // Mark as PRINTING immediately so no double print
  if (jobs.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: jobs.map(j => j.id) } },
      data: { status: 'PRINTING' }
    });
  }

  res.json(jobs);
});

// POST /api/agent/done/:orderId - PC agent calls this after print done
router.post('/done/:orderId', agentAuth, async (req, res) => {
  const { pages } = req.body; // actual page count from agent

  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Recalculate correct amount based on actual pages
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  const pricePerPage = order.printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
  const finalAmount = pages ? pricePerPage * pages * order.copies : order.amount;

  await prisma.order.update({
    where: { id: req.params.orderId },
    data: {
      status: 'PRINTED',
      printedAt: new Date(),
      ...(pages && { pages, amount: finalAmount })
    }
  });

  res.json({ success: true });
});

// POST /api/agent/failed/:orderId - print failed
router.post('/failed/:orderId', agentAuth, async (req, res) => {
  await prisma.order.update({
    where: { id: req.params.orderId },
    data: { status: 'FAILED' }
  });
  res.json({ success: true });
});

export default router;
