import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import orderRoutes from './routes/order.js';
import paymentRoutes from './routes/payment.js';
import agentRoutes from './routes/agent.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/agent', agentRoutes);

app.get('/', (req, res) => res.json({ status: 'PrintDrop API running 🚀' }));

// ─── AUTO DELETE FILES CRON ───────────────────────────────────────────────────
// Runs every 10 minutes. Deletes files for PRINTED orders older than 30 min.
// Also force-deletes ANY file older than 2 hours regardless of status.
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Running file cleanup...');

  const now = new Date();
  const thirtyMinAgo = new Date(now - 30 * 60 * 1000);
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

  try {
    // 1. Delete files of PRINTED orders older than 30 min
    const printedOrders = await prisma.order.findMany({
      where: {
        status: 'PRINTED',
        deletedAt: null,
        printedAt: { lte: thirtyMinAgo }
      }
    });

    // 2. Force delete any order file older than 2 hours (safety net)
    const oldOrders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        createdAt: { lte: twoHoursAgo }
      }
    });

    const toDelete = [...new Map([...printedOrders, ...oldOrders].map(o => [o.id, o])).values()];

    for (const order of toDelete) {
      if (order.filePath && fs.existsSync(order.filePath)) {
        fs.unlinkSync(order.filePath);
        console.log(`[CRON] Deleted file: ${order.fileName} (order ${order.id})`);
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { deletedAt: now }
      });
    }

    if (toDelete.length > 0) {
      console.log(`[CRON] Cleaned ${toDelete.length} files.`);
    } else {
      console.log('[CRON] No files to clean.');
    }
  } catch (err) {
    console.error('[CRON] Cleanup error:', err.message);
  }
});

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PrintDrop backend on port ${PORT}`));
