const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: false },
    path: { type: String, required: false }, // Now optional since files are stored in Cloudinary
    cloudinaryId: { type: String, required: false }, // Cloudinary public ID for deletion
    cloudinaryUrl: { type: String, required: false }, // Cloudinary secure URL for access
    size: { type: Number, required: true },
    uuid: { type: String, required: true },
    sender: { type: String, required: false },
    receiver: { type: String, required: false },
    downloads: { type: Number, default: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days from creation
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },

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

module.exports = mongoose.model('File', fileSchema);
