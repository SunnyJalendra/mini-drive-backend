const mongoose = require('mongoose');

const SharedWithSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permission: { type: String, enum: ['view', 'edit'], default: 'view' }
}, { _id: false });

const FileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: String,
    size: Number,
    path: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [SharedWithSchema]
}, { timestamps: true });

module.exports = mongoose.model('File', FileSchema);
