import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/shop/me
router.get('/me', authMiddleware, async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.shopId },
    select: {
      id: true, name: true, ownerName: true, email: true, phone: true,
      upiId: true, colorPrice: true, bwPrice: true,
      isOpen: true, qrGenerated: true, createdAt: true
    }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

// PUT /api/shop/settings
router.put('/settings', authMiddleware, async (req, res) => {
  const { colorPrice, bwPrice, isOpen, upiId } = req.body;
  const shop = await prisma.shop.update({
    where: { id: req.shopId },
    data: {
      ...(colorPrice !== undefined && { colorPrice: parseFloat(colorPrice) }),
      ...(bwPrice !== undefined && { bwPrice: parseFloat(bwPrice) }),
      ...(isOpen !== undefined && { isOpen }),
      ...(upiId !== undefined && { upiId: upiId.trim() || null }),
      qrGenerated: true
    }
  });
  res.json({ message: 'Settings saved', shop });
});

// GET /api/shop/:id/public — customer page
router.get('/:id/public', async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, isOpen: true, colorPrice: true, bwPrice: true, upiId: true }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

// GET /api/shop/stats
router.get('/stats', authMiddleware, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [totalOrders, todayOrders, pendingConfirm, queued, totalRevenue] = await Promise.all([
    prisma.order.count({ where: { shopId: req.shopId, status: 'PRINTED' } }),
    prisma.order.count({ where: { shopId: req.shopId, status: 'PRINTED', createdAt: { gte: today } } }),
    prisma.order.count({ where: { shopId: req.shopId, status: 'AWAITING_CONFIRMATION' } }),
    prisma.order.count({ where: { shopId: req.shopId, status: 'PAID' } }),
    prisma.order.aggregate({ where: { shopId: req.shopId, status: 'PRINTED' }, _sum: { amount: true } })
  ]);
  res.json({ totalOrders, todayOrders, pendingConfirm, queued, totalRevenue: totalRevenue._sum.amount || 0 });
});

// GET /api/shop/agent-info — for PC agent setup
router.get('/agent-info', authMiddleware, async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId }, select: { id: true, agentSecret: true } });
  res.json({
    shopId: shop.id,
    agentSecret: shop.agentSecret,
    serverUrl: process.env.PUBLIC_URL || 'http://localhost:4000'
  });
});

// ── PRINTERS ───────────────────────────────────────────────────────────

// GET /api/shop/printers
router.get('/printers', authMiddleware, async (req, res) => {
  const printers = await prisma.printer.findMany({ where: { shopId: req.shopId }, orderBy: { createdAt: 'asc' } });
  res.json(printers);
});

// PUT /api/shop/printers/:id — assign type / set default
router.put('/printers/:id', authMiddleware, async (req, res) => {
  const { type, isDefault } = req.body;
  const printer = await prisma.printer.findFirst({ where: { id: req.params.id, shopId: req.shopId } });
  if (!printer) return res.status(404).json({ error: 'Printer not found' });

  if (isDefault) {
    // unset other defaults of same type
    await prisma.printer.updateMany({
      where: { shopId: req.shopId, type: type || printer.type, id: { not: printer.id } },
      data: { isDefault: false }
    });
  }

  const updated = await prisma.printer.update({
    where: { id: printer.id },
    data: {
      ...(type !== undefined && { type }),
      ...(isDefault !== undefined && { isDefault })
    }
  });
  res.json(updated);
});

// DELETE /api/shop/printers/:id
router.delete('/printers/:id', authMiddleware, async (req, res) => {
  await prisma.printer.deleteMany({ where: { id: req.params.id, shopId: req.shopId } });
  res.json({ success: true });
});

export default router;
