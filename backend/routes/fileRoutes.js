const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const fileService = require('../services/fileService');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

/**
 * @route POST /api/files/upload
 * @desc Upload a file
 * @access Private
 */
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const savedFile = await fileService.saveFile(req.file, req.user.id);
    
    res.status(201).json({
      success: true,
      file: {
        id: savedFile._id,
        uuid: savedFile.uuid,
        filename: savedFile.originalName,
        size: savedFile.size
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/files
 * @desc Get all files for a user
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const files = await fileService.getUserFiles(req.user.id);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/files/:uuid
 * @desc Get file by UUID
 * @access Private
 */
router.get('/:uuid', auth, async (req, res) => {
  try {
    const file = await fileService.getFileByUuid(req.params.uuid);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if user owns the file
    if (file.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/files/:uuid
 * @desc Delete a file
 * @access Private
 */
router.delete('/:uuid', auth, async (req, res) => {
  try {
    const result = await fileService.deleteFile(req.params.uuid, req.user.id);
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('permission')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/files/download/:uuid
 * @desc Download a file
 * @access Private
 */
router.get('/download/:uuid', auth, async (req, res) => {
  try {
    const file = await fileService.getFileByUuid(req.params.uuid);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if user owns the file
    if (file.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.download(file.path, file.originalName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;