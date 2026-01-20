/**
 * Scanner Service (Pluggable Interface)
 * 
 * Provides file security scanning with multiple backend options:
 * - MockScanner: For development/testing (always returns clean)
 * - ClamAVScanner: Local ClamAV daemon via clamd socket
 * - CloudScanner: External API (VirusTotal, etc.) - stub for future
 * 
 * Security Design:
 * - Files start as PENDING status
 * - After scan: READY (clean) or QUARANTINED (infected)
 * - Only READY files can be shared/downloaded
 * 
 * Threat Model:
 * - Malware upload: Blocked at scan stage
 * - Scan bypass: All downloads check file status
 * - Zero-day: Cloud scanners provide latest signatures
 */

const { Readable } = require('stream');

// Scanner interface
class ScannerProvider {
  /**
   * Scan a file for threats
   * @param {Buffer|Stream} fileData - File content
   * @param {Object} metadata - { fileName, mimeType, size }
   * @returns {Promise<ScanResult>}
   */
  async scan(fileData, metadata = {}) {
    throw new Error('scan() must be implemented');
  }
  
  /**
   * Check if scanner is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return false;
  }
  
  /**
   * Get scanner version/info
   * @returns {Promise<Object>}
   */
  async getInfo() {
    return { name: 'unknown', version: 'unknown' };
  }
}

/**
 * Scan result structure
 */
class ScanResult {
  constructor({ clean, threats = [], scannerName, scannerVersion, duration = 0 }) {
    this.clean = clean;
    this.threats = threats;
    this.scannerName = scannerName;
    this.scannerVersion = scannerVersion;
    this.scannedAt = new Date();
    this.duration = duration;  // ms
  }
  
  toObject() {
    return {
      clean: this.clean,
      threats: this.threats,
      scannerName: this.scannerName,
      scannerVersion: this.scannerVersion,
      scannedAt: this.scannedAt,
      duration: this.duration
    };
  }
}

/**
 * Mock Scanner (Development/Testing)
 * 
 * Always returns clean unless filename contains 'eicar' (test virus).
 * EICAR is a standard test file recognized by all AV software.
 */
class MockScanner extends ScannerProvider {
  constructor() {
    super();
    this.name = 'MockScanner';
    this.version = '1.0.0';
  }
  
  async scan(fileData, metadata = {}) {
    const startTime = Date.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for EICAR test pattern or test filenames
    const fileName = metadata.fileName || '';
    const isTestInfected = fileName.toLowerCase().includes('eicar') || 
                           fileName.toLowerCase().includes('infected') ||
                           fileName.toLowerCase().includes('virus');
    
    // Check file content for EICAR signature
    let hasEicarSignature = false;
    if (Buffer.isBuffer(fileData)) {
      const content = fileData.toString('utf8', 0, Math.min(1000, fileData.length));
      hasEicarSignature = content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    }
    
    const clean = !isTestInfected && !hasEicarSignature;
    
    return new ScanResult({
      clean,
      threats: clean ? [] : ['EICAR-Test-Signature'],
      scannerName: this.name,
      scannerVersion: this.version,
      duration: Date.now() - startTime
    });
  }
  
  async isAvailable() {
    return true;
  }
  
  async getInfo() {
    return { name: this.name, version: this.version, type: 'mock' };
  }
}

/**
 * ClamAV Scanner
 * 
 * Requires ClamAV daemon running locally or accessible via network.
 * Install: docker run -d -p 3310:3310 clamav/clamav
 */
class ClamAVScanner extends ScannerProvider {
  constructor(options = {}) {
    super();
    this.name = 'ClamAV';
    this.version = 'unknown';
    this.host = options.host || process.env.CLAMAV_HOST || 'localhost';
    this.port = parseInt(options.port || process.env.CLAMAV_PORT || '3310', 10);
    this.timeout = options.timeout || 60000;  // 60 seconds
  }
  
  async scan(fileData, metadata = {}) {
    const startTime = Date.now();
    
    try {
      // Dynamic import to avoid requiring clamscan if not using ClamAV
      const NodeClam = require('clamscan');
      
      const clam = await new NodeClam().init({
        clamdscan: {
          host: this.host,
          port: this.port,
          timeout: this.timeout
        },
        preference: 'clamdscan'
      });
      
      // Scan buffer
      let result;
      if (Buffer.isBuffer(fileData)) {
        const stream = Readable.from(fileData);
        result = await clam.scanStream(stream);
      } else {
        result = await clam.scanStream(fileData);
      }
      
      // Get version
      const version = await clam.getVersion().catch(() => 'unknown');
      this.version = version;
      
      return new ScanResult({
        clean: !result.isInfected,
        threats: result.viruses || [],
        scannerName: this.name,
        scannerVersion: version,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      console.error('[ClamAV] Scan error:', error.message);
      
      // Return error result (treat as quarantine for safety)
      return new ScanResult({
        clean: false,
        threats: [`SCAN_ERROR: ${error.message}`],
        scannerName: this.name,
        scannerVersion: this.version,
        duration: Date.now() - startTime
      });
    }
  }
  
  async isAvailable() {
    try {
      const net = require('net');
      
      return new Promise((resolve) => {
        const socket = net.createConnection({ host: this.host, port: this.port });
        
        socket.setTimeout(5000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
  
  async getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: 'daemon',
      host: this.host,
      port: this.port
    };
  }
}

/**
 * Cloud Scanner (Stub for future implementation)
 * 
 * Could integrate with:
 * - VirusTotal API
 * - Google Safe Browsing
 * - MetaDefender Cloud
 */
class CloudScanner extends ScannerProvider {
  constructor(options = {}) {
    super();
    this.name = 'CloudScanner';
    this.version = '1.0.0';
    this.apiKey = options.apiKey || process.env.VIRUSTOTAL_API_KEY;
    this.endpoint = options.endpoint || 'https://www.virustotal.com/api/v3';
  }
  
  async scan(fileData, metadata = {}) {
    // NEEDS CLARIFICATION: Cloud scanner API integration
    // For now, delegate to mock scanner
    console.warn('[CloudScanner] Not implemented, using mock');
    const mock = new MockScanner();
    return mock.scan(fileData, metadata);
  }
  
  async isAvailable() {
    return !!this.apiKey;
  }
  
  async getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: 'cloud',
      hasApiKey: !!this.apiKey
    };
  }
}

/**
 * Get the configured scanner
 * Priority: ClamAV (if available) → Cloud (if key) → Mock
 */
async function getScanner() {
  const scannerType = process.env.SCANNER_TYPE || 'auto';
  
  if (scannerType === 'clamav') {
    return new ClamAVScanner();
  }
  
  if (scannerType === 'cloud') {
    return new CloudScanner();
  }
  
  if (scannerType === 'mock') {
    return new MockScanner();
  }
  
  // Auto-detect
  const clamav = new ClamAVScanner();
  if (await clamav.isAvailable()) {
    console.log('[Scanner] Using ClamAV');
    return clamav;
  }
  
  const cloud = new CloudScanner();
  if (await cloud.isAvailable()) {
    console.log('[Scanner] Using Cloud Scanner');
    return cloud;
  }
  
  console.log('[Scanner] Using Mock Scanner (development mode)');
  return new MockScanner();
}

/**
 * Scan a file and return result
 * Main entry point for scanning
 */
async function scanFile(fileData, metadata = {}) {
  const scanner = await getScanner();
  return scanner.scan(fileData, metadata);
}

module.exports = {
  ScannerProvider,
  ScanResult,
  MockScanner,
  ClamAVScanner,
  CloudScanner,
  getScanner,
  scanFile
};
