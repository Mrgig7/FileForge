const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/file');
const { authenticateToken } = require('../middleware/auth');

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File size limit (10MB)
const maxSize = 10 * 1024 * 1024;

// Configure multer
const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: function(req, file, cb) {
    // Validate file types if needed
    cb(null, true);
  }
}).single('file');

// Upload file
router.post('/upload', authenticateToken, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'File size exceeds limit of 10MB' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create file record in database
    const file = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      uuid: uuidv4(),
      owner: req.user.id
    });

    // Save to database
    const response = await file.save();
    return res.json({ file: response });
  });
});

// Get all files for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const files = await File.find({ owner: req.user.id }).sort({ createdAt: -1 });
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching files' });
  }
});

// Download file
router.get('/:uuid', async (req, res) => {
  try {
    const file = await File.findOne({ uuid: req.params.uuid });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, '..', file.path);
    res.download(filePath, file.originalName);
  } catch (err) {
    return res.status(500).json({ error: 'Error downloading file' });
  }
});

// Delete file
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found or unauthorized' });
    }

    await File.findByIdAndDelete(req.params.id);
    return res.json({ message: 'File deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Error deleting file' });
  }
});

module.exports = router;