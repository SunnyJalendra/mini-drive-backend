const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/signup', async (req, res) => {
    try {
        const { email, password, adminCode } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
        let existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'User exists' });
        const isAdmin = adminCode && process.env.ADMIN_CODE && adminCode === process.env.ADMIN_CODE;
        const user = new User({ email, password, isAdmin });
        await user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email: user.email, isAdmin: user.isAdmin } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });
        const match = await user.comparePassword(password);
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email: user.email, isAdmin: user.isAdmin } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
