import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: 'Order not in pending state' });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.amount * 100),
      currency: 'INR',
      receipt: orderId.substring(0, 40),
      notes: { orderId, shopId: order.shopId }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { razorpayOrderId: razorpayOrder.id }
    });

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (e) {
    console.error('Razorpay create-order error:', e.message);
    res.status(500).json({ error: 'Payment init failed: ' + e.message });
  }
});

// POST /api/payment/verify
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID', razorpayPaymentId: razorpay_payment_id }
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Verify error:', e.message);
    res.status(500).json({ error: 'Verify failed: ' + e.message });
  }
});

// POST /api/payment/dev-confirm  ← DEV ONLY: skip payment, mark PAID directly
// This route only works when NODE_ENV is not production
router.post('/dev-confirm', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const { orderId } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID', razorpayPaymentId: 'dev_test_' + Date.now() }
    });

    console.log(`[DEV] Order ${orderId} marked PAID (bypassed payment)`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
