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
      id: true, name: true, ownerName: true, email: true,
      phone: true, colorPrice: true, bwPrice: true,
      colorPrinter: true, bwPrinter: true,
      isOpen: true, qrGenerated: true, createdAt: true
    }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

// PUT /api/shop/settings
router.put('/settings', authMiddleware, async (req, res) => {
  const { colorPrice, bwPrice, colorPrinter, bwPrinter, isOpen } = req.body;
  const shop = await prisma.shop.update({
    where: { id: req.shopId },
    data: {
      ...(colorPrice !== undefined && { colorPrice: parseFloat(colorPrice) }),
      ...(bwPrice !== undefined && { bwPrice: parseFloat(bwPrice) }),
      ...(colorPrinter !== undefined && { colorPrinter }),
      ...(bwPrinter !== undefined && { bwPrinter }),
      ...(isOpen !== undefined && { isOpen }),
      qrGenerated: true
    }
  });
  res.json({ message: 'Settings saved', shop });
});

// GET /api/shop/:id/public  (customer page uses this)
router.get('/:id/public', async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, isOpen: true, colorPrice: true, bwPrice: true }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

// GET /api/shop/stats
router.get('/stats', authMiddleware, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [totalOrders, todayOrders, pendingOrders, totalRevenue] = await Promise.all([
    prisma.order.count({ where: { shopId: req.shopId, status: 'PRINTED' } }),
    prisma.order.count({ where: { shopId: req.shopId, status: 'PRINTED', createdAt: { gte: today } } }),
    prisma.order.count({ where: { shopId: req.shopId, status: 'PAID' } }),
    prisma.order.aggregate({ where: { shopId: req.shopId, status: 'PRINTED' }, _sum: { amount: true } })
  ]);
  res.json({ totalOrders, todayOrders, pendingOrders, totalRevenue: totalRevenue._sum.amount || 0 });
});

// GET /api/shop/agent-info  ← NEW: gives shopkeeper their shop ID + agent secret for PC agent setup
router.get('/agent-info', authMiddleware, async (req, res) => {
  res.json({
    shopId: req.shopId,
    agentSecret: process.env.AGENT_SECRET,
    serverUrl: process.env.PUBLIC_URL || 'http://localhost:4000'
  });
});

export default router;
