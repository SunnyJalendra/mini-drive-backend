const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/authMiddleware');
const File = require('../models/File');
const ShareRequest = require('../models/ShareRequest');
const path = require('path');
const fs = require('fs');

router.get('/files', auth, adminOnly, async (req, res) => {
    try {
        const files = await File.find().populate('owner', 'email');
        res.json(files);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/files/:id', auth, adminOnly, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        const absolute = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
        // remove DB doc and any related share requests
        await File.deleteOne({ _id: file._id });
        await ShareRequest.deleteMany({ file: file._id });
        res.json({ message: 'Deleted by admin' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Yeh naya route add karo – download ke liye
router.get('/files/:id', auth, async (req, res) => {
    try {
        // Database se file dhundho
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File nahi mila' });
        }

        // File ka full path banao
        const filePath = path.isAbsolute(file.path)
            ? file.path
            : path.join(process.cwd(), file.path);

        // Check karo file real mein exist karti hai ya nahi
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File disk pe nahi mili' });
        }

        // Browser ko file download karwao (original name ke saath)
        res.download(filePath, file.originalName || 'myfile');

    } catch (err) {
        console.log("Download error:", err);   // ← yeh terminal mein dikhega
        res.status(500).json({ message: 'Download mein problem aa gayi' });
    }
});

module.exports = router;

// One-time promote endpoint (uses server ADMIN_CODE).
// Body: { email: string, adminCode: string }
// This endpoint is intended for local/dev use to promote an existing user.
router.post('/promote', async (req, res) => {
    try {
        const { email, adminCode } = req.body || {};
        if (!email || !adminCode) return res.status(400).json({ message: 'email and adminCode required' });
        if (!process.env.ADMIN_CODE) return res.status(500).json({ message: 'Server ADMIN_CODE not configured' });
        if (adminCode !== process.env.ADMIN_CODE) return res.status(403).json({ message: 'Invalid admin code' });
        const User = require('../models/User');
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isAdmin) return res.json({ message: 'User already admin' });
        user.isAdmin = true;
        await user.save();
        res.json({ message: 'User promoted to admin', user: { id: user._id, email: user.email, isAdmin: user.isAdmin } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
