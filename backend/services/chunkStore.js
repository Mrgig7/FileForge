/**
 * Chunk Store Service
 * 
 * Pluggable storage for upload chunks.
 * Interface pattern allows swapping local/cloud storage.
 * 
 * Security Notes:
 * - Temp chunks isolated by uploadId
 * - No direct URL exposure
 * - Automatic cleanup on completion/expiry
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Abstract ChunkStore Interface
 */
class ChunkStore {
  /**
   * Store a chunk
   * @param {string} uploadId
   * @param {number} chunkIndex
   * @param {Buffer} data
   * @returns {Promise<{ path: string, size: number }>}
   */
  async store(uploadId, chunkIndex, data) {
    throw new Error('Not implemented');
  }
  
  /**
   * Read a chunk
   * @param {string} uploadId
   * @param {number} chunkIndex
   * @returns {Promise<Buffer>}
   */
  async read(uploadId, chunkIndex) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete a single chunk
   */
  async deleteChunk(uploadId, chunkIndex) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete all chunks for an upload
   */
  async deleteUploadChunks(uploadId) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get chunk path/key
   */
  getChunkPath(uploadId, chunkIndex) {
    throw new Error('Not implemented');
  }
  
  /**
   * Merge chunks into single file
   * @param {string} uploadId
   * @param {number[]} chunkIndexes - ordered
   * @returns {Promise<{ path: string, size: number }>}
   */
  async merge(uploadId, chunkIndexes) {
    throw new Error('Not implemented');
  }
}

/**
 * Local Filesystem Chunk Store
 */
class LocalChunkStore extends ChunkStore {
  constructor(basePath = null) {
    super();
    this.basePath = basePath || process.env.CHUNK_STORE_PATH || path.join(process.cwd(), 'temp', 'chunks');
  }
  
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  
  getUploadDir(uploadId) {
    return path.join(this.basePath, uploadId);
  }
  
  getChunkPath(uploadId, chunkIndex) {
    return path.join(this.getUploadDir(uploadId), `chunk_${chunkIndex.toString().padStart(6, '0')}`);
  }
  
  getMergedPath(uploadId) {
    return path.join(this.basePath, 'merged', `${uploadId}_merged`);
  }
  
  async store(uploadId, chunkIndex, data) {
    const uploadDir = this.getUploadDir(uploadId);
    await this.ensureDir(uploadDir);
    
    const chunkPath = this.getChunkPath(uploadId, chunkIndex);
    await fs.writeFile(chunkPath, data);
    
    return {
      path: chunkPath,
      size: data.length
    };
  }
  
  async read(uploadId, chunkIndex) {
    const chunkPath = this.getChunkPath(uploadId, chunkIndex);
    return fs.readFile(chunkPath);
  }
  
  async deleteChunk(uploadId, chunkIndex) {
    const chunkPath = this.getChunkPath(uploadId, chunkIndex);
    try {
      await fs.unlink(chunkPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  
  async deleteUploadChunks(uploadId) {
    const uploadDir = this.getUploadDir(uploadId);
    try {
      const files = await fs.readdir(uploadDir);
      await Promise.all(files.map(f => fs.unlink(path.join(uploadDir, f))));
      await fs.rmdir(uploadDir);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    
    // Also delete merged file if exists
    try {
      await fs.unlink(this.getMergedPath(uploadId));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  
  async merge(uploadId, chunkIndexes) {
    const mergedDir = path.join(this.basePath, 'merged');
    await this.ensureDir(mergedDir);
    
    const mergedPath = this.getMergedPath(uploadId);
    const writeStream = require('fs').createWriteStream(mergedPath);
    
    let totalSize = 0;
    
    for (const index of chunkIndexes) {
      const chunkData = await this.read(uploadId, index);
      writeStream.write(chunkData);
      totalSize += chunkData.length;
    }
    
    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    return {
      path: mergedPath,
      size: totalSize
    };
  }
  
  /**
   * Compute SHA-256 of merged file
   */
  async computeHash(uploadId) {
    const mergedPath = this.getMergedPath(uploadId);
    const hash = crypto.createHash('sha256');
    const stream = require('fs').createReadStream(mergedPath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

/**
 * Redis-based chunk metadata store
 * NEEDS CLARIFICATION: For distributed deployments, chunks should be in object storage
 */
class RedisChunkMetadataStore {
  constructor(redis) {
    this.redis = redis;
    this.prefix = 'chunk:';
    this.ttl = 24 * 60 * 60;  // 24h
  }
  
  async setChunkPath(uploadId, chunkIndex, storagePath) {
    const key = `${this.prefix}${uploadId}:${chunkIndex}`;
    await this.redis.setex(key, this.ttl, storagePath);
  }
  
  async getChunkPath(uploadId, chunkIndex) {
    const key = `${this.prefix}${uploadId}:${chunkIndex}`;
    return this.redis.get(key);
  }
  
  async deleteUploadMetadata(uploadId) {
    const pattern = `${this.prefix}${uploadId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * Get chunk store instance
 */
function getChunkStore() {
  // Currently only Local is implemented
  // Future: S3ChunkStore for distributed deployments
  return new LocalChunkStore();
}

module.exports = {
  ChunkStore,
  LocalChunkStore,
  RedisChunkMetadataStore,
  getChunkStore
};
