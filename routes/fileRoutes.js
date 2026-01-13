const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { auth } = require('../middleware/authMiddleware');
const { upload, uploadDir } = require('../utils/multerConfig');
const File = require('../models/File');
const ShareRequest = require('../models/ShareRequest');

// Upload a file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const fileDoc = new File({
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            owner: req.user.id
        });
        await fileDoc.save();
        res.json(fileDoc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// List files for user (owned or shared)
router.get('/', auth, async (req, res) => {
    try {
        const owned = await File.find({ owner: req.user.id }).sort({ createdAt: -1 });
        const shared = await File.find({ 'sharedWith.user': req.user.id }).sort({ createdAt: -1 });
        res.json({ owned, shared });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Serve a file if owner/admin or shared with view permission
router.get('/:id', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id).populate('owner', 'email');
        if (!file) return res.status(404).json({ message: 'File not found' });
        const isOwner = file.owner._id.equals(req.user.id);
        const isAdmin = req.user.isAdmin;
        const sharedEntry = file.sharedWith.find(s => s.user.equals(req.user.id));
        if (!isOwner && !isAdmin && !sharedEntry) return res.status(403).json({ message: 'Access denied' });
        const absolute = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
        if (!fs.existsSync(absolute)) return res.status(404).json({ message: 'File missing on server' });
        res.sendFile(absolute);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a file (owner or admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        const isOwner = file.owner.equals(req.user.id);
        if (!isOwner && !req.user.isAdmin) return res.status(403).json({ message: 'Not allowed' });
        const absolute = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
        // remove DB doc and any related share requests
        await File.deleteOne({ _id: file._id });
        await ShareRequest.deleteMany({ file: file._id });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Request access to a file (called when a user visits a share link)
router.post('/share/:id/request', auth, async (req, res) => {
    try {
        // Validate permission value first
        const permission = req.body.permission || 'view';
        if (!['view', 'edit'].includes(permission)) {
            return res.status(400).json({ message: 'Invalid permission. Must be view or edit' });
        }

        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        if (file.owner.equals(req.user.id)) return res.status(400).json({ message: 'Owner already has access' });

        // Check if user already has access
        const alreadyShared = file.sharedWith.find(s => s.user.equals(req.user.id));
        if (alreadyShared) return res.status(400).json({ message: 'Already has access to this file' });

        // Check for pending or approved request
        const existing = await ShareRequest.findOne({
            file: file._id,
            requester: req.user.id,
            status: { $in: ['pending', 'approved'] }
        });
        if (existing) return res.status(400).json({ message: 'Request already pending or approved' });

        const reqDoc = new ShareRequest({ file: file._id, requester: req.user.id, permissionRequested: permission });
        await reqDoc.save();
        res.json({ message: 'Request created', request: reqDoc });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Invalid permission. Must be view or edit' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Owner responds to a request: approve or reject
router.post('/share/:id/respond', auth, async (req, res) => {
    try {
        const { requestId, action, permission } = req.body; // action: 'approve'|'reject'
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        if (!file.owner.equals(req.user.id)) return res.status(403).json({ message: 'Only owner can respond' });

        const reqDoc = await ShareRequest.findById(requestId);
        if (!reqDoc) return res.status(404).json({ message: 'Request not found' });
        if (reqDoc.file.toString() !== file._id.toString()) {
            return res.status(400).json({ message: 'Request does not match file' });
        }

        // Can only respond to pending requests
        if (reqDoc.status !== 'pending') {
            return res.status(400).json({ message: `Cannot respond to ${reqDoc.status} request` });
        }

        if (action === 'approve') {
            // Check if already shared
            const alreadyShared = file.sharedWith.find(s => s.user.equals(reqDoc.requester));
            if (alreadyShared) {
                return res.status(400).json({ message: 'User already has access' });
            }

            // Validate permission
            const approvePermission = permission || reqDoc.permissionRequested || 'view';
            if (!['view', 'edit'].includes(approvePermission)) {
                return res.status(400).json({ message: 'Invalid permission. Must be view or edit' });
            }

            file.sharedWith.push({ user: reqDoc.requester, permission: approvePermission });
            reqDoc.status = 'approved';
            await file.save();
            await reqDoc.save();
            return res.json({ message: 'Approved', file });
        } else if (action === 'reject') {
            reqDoc.status = 'rejected';
            await reqDoc.save();
            return res.json({ message: 'Rejected' });
        } else {
            return res.status(400).json({ message: 'Invalid action. Must be approve or reject' });
        }
    } catch (err) {
        if (err.name === 'CastError' || err.message.includes('Cast to ObjectId')) {
            return res.status(400).json({ message: 'Invalid request ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// List share requests for a file (owner only)
router.get('/share/:id/requests', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        if (!file.owner.equals(req.user.id) && !req.user.isAdmin) return res.status(403).json({ message: 'Only owner or admin can view requests' });
        const requests = await ShareRequest.find({ file: file._id }).populate('requester', 'email');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get current user's share request status for a file (requester)
router.get('/share/:id/status', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });
        const reqDoc = await ShareRequest.findOne({ file: file._id, requester: req.user.id });
        if (!reqDoc) return res.json({ status: 'none' });
        res.json({ status: reqDoc.status, permissionRequested: reqDoc.permissionRequested, createdAt: reqDoc.createdAt, updatedAt: reqDoc.updatedAt });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
