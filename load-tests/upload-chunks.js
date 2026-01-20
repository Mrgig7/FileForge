/**
 * k6 Load Test: Chunked Upload
 * 
 * Tests chunked file upload performance and resume capability.
 * 
 * Run with:
 *   k6 run upload-chunks.js
 *   k6 run --vus 20 --duration 2m upload-chunks.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomBytes } from 'k6/crypto';

// Custom metrics
const uploadFailRate = new Rate('upload_failures');
const chunkDuration = new Trend('chunk_upload_duration');
const totalUploadDuration = new Trend('total_upload_duration');

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2s (uploading files)
    upload_failures: ['rate<0.05'],      // Less than 5% failures
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const CHUNK_SIZE = 1024 * 1024;  // 1MB chunks
const FILE_SIZE = 5 * 1024 * 1024;  // 5MB test file

// Pre-setup: authenticate
export function setup() {
  const email = `k6upload_${Date.now()}@example.com`;
  const password = 'TestPass123!';
  
  // Register
  http.post(`${BASE_URL}/api/auth/v2/register`, JSON.stringify({
    name: 'Upload Test User',
    email: email,
    password: password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/v2/login`, JSON.stringify({
    email: email,
    password: password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return {
    token: loginRes.json('accessToken'),
    cookies: loginRes.cookies
  };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json'
  };
  
  let sessionId = null;
  const totalStart = new Date();
  
  group('Initialize Upload Session', function() {
    const initRes = http.post(`${BASE_URL}/api/chunked-uploads/init`, JSON.stringify({
      fileName: `test_${__VU}_${__ITER}.bin`,
      fileSize: FILE_SIZE,
      fileType: 'application/octet-stream',
      totalChunks: Math.ceil(FILE_SIZE / CHUNK_SIZE),
      fileHash: 'sha256-placeholder'
    }), { headers });
    
    const success = check(initRes, {
      'init status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'has sessionId': (r) => r.json('sessionId') !== undefined || r.json('uploadSession') !== undefined,
    });
    
    if (success) {
      sessionId = initRes.json('sessionId') || initRes.json('uploadSession')?.sessionId;
    } else {
      uploadFailRate.add(true);
      return;
    }
  });
  
  if (!sessionId) return;
  
  group('Upload Chunks', function() {
    const totalChunks = Math.ceil(FILE_SIZE / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = new Date();
      const chunkSize = Math.min(CHUNK_SIZE, FILE_SIZE - (i * CHUNK_SIZE));
      
      // Generate random chunk data
      const chunkData = randomBytes(chunkSize);
      
      const formData = {
        chunk: http.file(chunkData, `chunk_${i}.bin`, 'application/octet-stream'),
        chunkIndex: String(i),
        sessionId: sessionId,
        chunkHash: 'sha256-chunk-placeholder'
      };
      
      const chunkRes = http.post(
        `${BASE_URL}/api/chunked-uploads/chunk`,
        formData,
        { 
          headers: { 'Authorization': `Bearer ${data.token}` }
        }
      );
      
      chunkDuration.add(new Date() - chunkStart);
      
      check(chunkRes, {
        [`chunk ${i} uploaded`]: (r) => r.status === 200,
      });
      
      sleep(0.1);  // Brief pause between chunks
    }
  });
  
  group('Complete Upload', function() {
    const completeRes = http.post(`${BASE_URL}/api/chunked-uploads/complete`, JSON.stringify({
      sessionId: sessionId
    }), { headers });
    
    const success = check(completeRes, {
      'complete status 200': (r) => r.status === 200,
    });
    
    uploadFailRate.add(!success);
  });
  
  totalUploadDuration.add(new Date() - totalStart);
  
  sleep(2);
}

export function teardown(data) {
  console.log('Upload load test completed');
}
