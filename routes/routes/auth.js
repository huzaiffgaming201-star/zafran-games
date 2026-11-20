const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  password: String,
  inviteCode: String,
  referredBy: String,
  balance: { type: Number, default: 0 },
  vipLevel: { type: Number, default: 0 },
  uid: String,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
});

const User = mongoose.model('User', userSchema);

function generateUID() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function generateInvite() { return Math.floor(1000000000000 + Math.random() * 9000000000000).toString(); }

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ msg: 'Unauthorized' });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ msg: 'Invalid token' }); }
}

router.post('/register', async (req, res) => {
  try {
    const { phone, email, password, inviteCode } = req.body;
    if (!password) return res.status(400).json({ msg: 'Password required' });
    const existing = await User.findOne({ $or: [phone ? { phone } : null, email ? { email } : null].filter(Boolean) });
    if (existing) return res.status(400).json({ msg: 'User already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const uid = generateUID();
    const myInvite = generateInvite();
    const user = new User({ phone, email, password: hashed, inviteCode: myInvite, referredBy: inviteCode || null, uid, balance: 0 });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, uid, inviteCode: myInvite });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    const user = await User.findOne({ $or: [phone ? { phone } : null, email ? { email } : null].filter(Boolean) });
    if (!user) return res.status(400).json({ msg: 'User not found' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Wrong password' });
    user.lastLogin = new Date();
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, uid: user.uid, balance: user.balance, username: user.phone || user.email });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/admin/users', async (req, res) => {
  try {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ msg: 'Forbidden' });
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.post('/admin/balance', async (req, res) => {
  try {
    const { adminKey, uid, amount, type } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ msg: 'Forbidden' });
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (type === 'add') user.balance += parseFloat(amount);
    else if (type === 'subtract') user.balance = Math.max(0, user.balance - parseFloat(amount));
    else user.balance = parseFloat(amount);
    await user.save();
    res.json({ msg: 'Balance updated', newBalance: user.balance });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

module.exports = { router, User };
