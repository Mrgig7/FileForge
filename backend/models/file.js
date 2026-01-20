const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: false },
    title: { type: String },
    path: { type: String, required: false },
    cloudinaryId: { type: String, required: false },
    cloudinaryUrl: { type: String, required: false },
    size: { type: Number, required: true },
    uuid: { type: String, required: true },
    sender: { type: String, required: false },
    receiver: { type: String, required: false },
    downloads: { type: Number, default: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    
    // Owner
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        default: null,
        index: true
    },
    
    currentVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FileVersion'
    },
    
    region: { type: String, default: 'default' },

    classification: {
        type: String,
        enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
        default: 'PUBLIC',
        index: true
    },

    status: {
        type: String,
        enum: ['PENDING', 'SCANNING', 'READY', 'QUARANTINED', 'DELETED'],
        default: 'PENDING',
        index: true
    },

    scanResult: {
        scannedAt: { type: Date },
        clean: { type: Boolean },
        threats: [{ type: String }],
        scannerVersion: { type: String },
        duration: { type: Number }
    },

    deletedAt: { type: Date, default: null, index: true },

    checksum: { type: String },
    mimeType: { type: String },
    verifiedSize: { type: Number },
    processedAt: { type: Date },

    // Client-Side Encryption (Zero-Knowledge Architecture)
    isEncrypted: { type: Boolean, default: false },
    encryptionIV: { type: String }, // Base64 encoded initialization vector

    // Self-Destruct Options
    maxDownloads: { type: Number, default: null }, // null = unlimited
    deleteAfterFirstAccess: { type: Boolean, default: false },

    // View-Only Mode (No Download)
    viewOnly: { type: Boolean, default: false },
    allowedPreviewTypes: { type: [String], default: ['image', 'pdf', 'video', 'audio'] }
}, { timestamps: true });

fileSchema.index({ status: 1, createdAt: 1 });
fileSchema.index({ deletedAt: 1 }, { sparse: true });

module.exports = mongoose.model('File', fileSchema);
