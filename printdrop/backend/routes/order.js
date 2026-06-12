import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

// POST /api/order/upload/:shopId
router.post('/upload/:shopId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (check file type)' });

  const { shopId } = req.params;
  const { printType, copies, customerPhone } = req.body;

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!shop.isOpen) return res.status(400).json({ error: 'Shop is currently closed' });

  const pricePerPage = printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
  const numCopies = parseInt(copies) || 1;
  const estimatedAmount = pricePerPage * numCopies;

  const order = await prisma.order.create({
    data: {
      shopId,
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      filePath: req.file.path,
      printType: printType === 'COLOR' ? 'COLOR' : 'BW',
      copies: numCopies,
      amount: estimatedAmount,
      customerPhone: customerPhone || null,
      status: 'PENDING_PAYMENT'
    }
  });

  res.json({
    orderId: order.id,
    amount: order.amount,
    fileName: order.fileName,
    printType: order.printType,
    copies: order.copies,
    shopName: shop.name,
    shopUpiId: shop.upiId || null
  });
});

// GET /api/order/:id/status
router.get('/:id/status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, printType: true, copies: true, amount: true, fileName: true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// POST /api/order/:id/claim-paid — customer clicks "I've Paid"
router.post('/:id/claim-paid', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: 'Order not awaiting payment' });

  await prisma.order.update({
    where: { id: req.params.id },
    data: { status: 'AWAITING_CONFIRMATION', customerClaimedPaidAt: new Date() }
  });
  res.json({ success: true });
});

// ── SHOPKEEPER ROUTES (auth) ──────────────────────────────────────────────

// GET /api/order/shop/list
router.get('/shop/list', authMiddleware, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { shopId: req.shopId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, fileName: true, printType: true, copies: true,
      amount: true, status: true, createdAt: true, printedAt: true, customerPhone: true
    }
  });
  res.json(orders);
});

// GET /api/order/shop/pending — orders awaiting payment confirmation
router.get('/shop/pending', authMiddleware, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { shopId: req.shopId, status: 'AWAITING_CONFIRMATION' },
    orderBy: { customerClaimedPaidAt: 'asc' },
    select: {
      id: true, fileName: true, printType: true, copies: true,
      amount: true, customerPhone: true, customerClaimedPaidAt: true
    }
  });
  res.json(orders);
});

// POST /api/order/:id/confirm — shopkeeper confirms payment received
router.post('/:id/confirm', authMiddleware, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'AWAITING_CONFIRMATION') return res.status(400).json({ error: 'Order not awaiting confirmation' });

  await prisma.order.update({
    where: { id: req.params.id },
    data: { status: 'PAID', confirmedAt: new Date() }
  });
  res.json({ success: true });
});

// POST /api/order/:id/reject — shopkeeper says payment NOT received
router.post('/:id/reject', authMiddleware, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
  res.json({ success: true });
});

export default router;
