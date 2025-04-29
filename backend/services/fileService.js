const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/file');

class FileService {
  /**
   * Save file information to database
   */
  async saveFile(fileData, userId) {
    try {
      const file = new File({
        filename: fileData.filename,
        originalName: fileData.originalname,
        path: fileData.path,
        size: fileData.size,
        uuid: uuidv4(),
        owner: userId
      });

      return await file.save();
    } catch (error) {
      throw new Error(`Error saving file: ${error.message}`);
    }
  }

  /**
   * Get all files belonging to a user
   */
  async getUserFiles(userId) {
    try {
      return await File.find({ owner: userId }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching user files: ${error.message}`);
    }
  }

  /**
   * Get file by UUID
   */
  async getFileByUuid(uuid) {
    try {
      return await File.findOne({ uuid });
    } catch (error) {
      throw new Error(`Error fetching file: ${error.message}`);
    }
  }

  /**
   * Delete file by UUID
   */
  async deleteFile(uuid, userId) {
    try {
      const file = await File.findOne({ uuid, owner: userId });
      
      if (!file) {
        throw new Error('File not found or you do not have permission');
      }
      
      // Delete file from filesystem
      fs.unlinkSync(file.path);
      
      // Delete from database
      await File.deleteOne({ uuid, owner: userId });
      
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      throw new Error(`Error deleting file: ${error.message}`);
    }
  }
}

module.exports = new FileService();