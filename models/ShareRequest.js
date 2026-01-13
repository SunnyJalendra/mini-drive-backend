const mongoose = require('mongoose');

const ShareRequestSchema = new mongoose.Schema({
    file: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    permissionRequested: { type: String, enum: ['view', 'edit'], default: 'view' }
}, { timestamps: true });

module.exports = mongoose.model('ShareRequest', ShareRequestSchema);
