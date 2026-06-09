import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const prisma = new PrismaClient();

// Multer config - store locally, rename with uuid
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG allowed'));
  }
});

// POST /api/order/upload/:shopId - customer uploads file
router.post('/upload/:shopId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { shopId } = req.params;
  const { printType, copies, customerPhone } = req.body;

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!shop.isOpen) return res.status(400).json({ error: 'Shop is currently closed' });

  // Calculate amount (pages will be counted by PC agent, estimate 1 for now)
  const pricePerPage = printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
  const numCopies = parseInt(copies) || 1;
  const estimatedAmount = pricePerPage * numCopies; // pages updated after PC agent counts

  const fileUrl = `/uploads/${req.file.filename}`;
  const filePath = req.file.path;

  const order = await prisma.order.create({
    data: {
      shopId,
      fileName: req.file.originalname,
      fileUrl,
      filePath,
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
    shopName: shop.name
  });
});

// GET /api/order/:id/status - poll order status (customer)
router.get('/:id/status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, printType: true, copies: true, amount: true, fileName: true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /api/order/shop/list - shopkeeper sees all orders (auth)
import { authMiddleware } from '../middleware/auth.js';
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

export default router;
