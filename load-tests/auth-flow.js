/**
 * k6 Load Test: Authentication Flow
 * 
 * Tests login performance and refresh token rotation.
 * 
 * Run with:
 *   k6 run auth-flow.js
 *   k6 run --vus 50 --duration 60s auth-flow.js
 * 
 * Environment:
 *   K6_BASE_URL - API base URL (default: http://localhost:3000)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginFailRate = new Rate('login_failures');
const loginDuration = new Trend('login_duration');
const refreshDuration = new Trend('refresh_duration');

// Configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Stay at 50 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    login_failures: ['rate<0.1'],       // Less than 10% failures
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

// Test user credentials (create these in advance or use registration)
const TEST_USER = {
  email: `k6test_${__VU}@example.com`,
  password: 'TestPass123!',
  name: 'K6 Test User'
};

export function setup() {
  // Register test user
  const res = http.post(`${BASE_URL}/api/auth/v2/register`, JSON.stringify({
    name: TEST_USER.name,
    email: TEST_USER.email,
    password: TEST_USER.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Ignore if already exists
  return { email: TEST_USER.email, password: TEST_USER.password };
}

export default function(data) {
  let accessToken = null;
  let cookies = null;
  
  group('Login Flow', function() {
    const startTime = new Date();
    
    const loginRes = http.post(`${BASE_URL}/api/auth/v2/login`, JSON.stringify({
      email: data.email,
      password: data.password
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    loginDuration.add(new Date() - startTime);
    
    const success = check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'has accessToken': (r) => r.json('accessToken') !== undefined,
      'has user': (r) => r.json('user') !== undefined,
    });
    
    loginFailRate.add(!success);
    
    if (success) {
      accessToken = loginRes.json('accessToken');
      cookies = loginRes.cookies;
    }
  });
  
  sleep(1);
  
  if (accessToken) {
    group('Authenticated Request', function() {
      const meRes = http.get(`${BASE_URL}/api/auth/v2/me`, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
      });
      
      check(meRes, {
        'me status 200': (r) => r.status === 200,
        'has user id': (r) => r.json('user.id') !== undefined,
      });
    });
    
    sleep(1);
    
    group('Token Refresh', function() {
      const startTime = new Date();
      
      const refreshRes = http.post(`${BASE_URL}/api/auth/v2/refresh`, null, {
        headers: { 'Content-Type': 'application/json' },
        cookies: cookies,
      });
      
      refreshDuration.add(new Date() - startTime);
      
      check(refreshRes, {
        'refresh status 200': (r) => r.status === 200,
        'has new accessToken': (r) => r.json('accessToken') !== undefined,
      });
    });
  }
  
  sleep(2);
}

export function teardown(data) {
  // Cleanup: logout
  // Note: In production tests, you might want to cleanup test users
  console.log('Load test completed');
}
