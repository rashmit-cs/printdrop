import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, ownerName, email, password, phone } = req.body;
  if (!name || !email || !password || !phone || !ownerName)
    return res.status(400).json({ error: 'All fields required' });

  const existing = await prisma.shop.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const shop = await prisma.shop.create({
    data: { name, ownerName, email, passwordHash, phone }
  });

  const token = jwt.sign({ shopId: shop.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, shop: { id: shop.id, name: shop.name, email: shop.email } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const shop = await prisma.shop.findUnique({ where: { email } });
  if (!shop) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, shop.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ shopId: shop.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, shop: { id: shop.id, name: shop.name, email: shop.email } });
});

export default router;
