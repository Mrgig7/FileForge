/**
 * Phase 4 Tests
 * 
 * Integration tests for:
 * - SSO configuration
 * - Session management
 * - DLP policy engine
 * - Legal holds
 * - Security events
 * - SCIM provisioning
 * - Lockdown mode
 */

const request = require('supertest');

describe('SSO System', () => {
  const baseUrl = process.env.TEST_API_URL || 'http://localhost:3000';
  
  const IdentityProvider = require('../models/IdentityProvider');
  
  describe('IdentityProvider Model', () => {
    it('should encrypt client secret', () => {
      const secret = 'test-secret-12345';
      const encrypted = IdentityProvider.encrypt(secret);
      
      expect(encrypted).not.toBe(secret);
      expect(encrypted).toContain(':');
      
      const decrypted = IdentityProvider.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });
  });
  
  describe('POST /workspaces/:id/sso/config', () => {
    it('should require authentication', async () => {
      const res = await request(baseUrl)
        .post('/api/workspaces/123/sso/config')
        .send({ type: 'OIDC' });
      
      expect(res.status).toBe(401);
    });
  });
});

describe('Session Management', () => {
  const Session = require('../models/Session');
  const Device = require('../models/Device');
  
  describe('Device Model', () => {
    it('should hash fingerprints', () => {
      const fingerprint = 'Mozilla/5.0 Windows 192.168.1.1';
      const hash1 = Device.hashFingerprint(fingerprint);
      const hash2 = Device.hashFingerprint(fingerprint);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(fingerprint);
      expect(hash1.length).toBe(64); // SHA-256
    });
  });
  
  describe('Session Model', () => {
    it('should check if session is active', () => {
      // Active session
      const activeSession = new Session({
        userId: '123',
        expiresAt: new Date(Date.now() + 1000000)
      });
      
      expect(activeSession.isActive()).toBe(true);
    });
    
    it('should detect expired sessions', () => {
      const expiredSession = new Session({
        userId: '123',
        expiresAt: new Date(Date.now() - 1000)
      });
      
      expect(expiredSession.isActive()).toBe(false);
    });
    
    it('should detect revoked sessions', () => {
      const revokedSession = new Session({
        userId: '123',
        revokedAt: new Date()
      });
      
      expect(revokedSession.isActive()).toBe(false);
    });
  });
});

describe('DLP Engine', () => {
  const { evaluateDlpPolicies, CLASSIFICATION_LEVELS } = require('../services/dlpEngine');
  
  it('should have classification levels', () => {
    expect(CLASSIFICATION_LEVELS.PUBLIC).toBe(0);
    expect(CLASSIFICATION_LEVELS.RESTRICTED).toBe(3);
  });
  
  it('should allow all when DLP disabled', () => {
    const result = evaluateDlpPolicies({
      file: { classification: 'RESTRICTED' },
      workspace: { dlpPolicy: { enabled: false } },
      action: 'share_create'
    });
    
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
  
  it('should block external sharing when policy set', () => {
    const result = evaluateDlpPolicies({
      file: { classification: 'INTERNAL' },
      workspace: {
        dlpPolicy: {
          enabled: true,
          blockExternalSharing: true
        }
      },
      shareRequest: { workspaceMembersOnly: false },
      action: 'share_create'
    });
    
    expect(result.allowed).toBe(false);
    expect(result.violations).toContain('block_external_sharing');
  });
  
  it('should require password for confidential files', () => {
    const result = evaluateDlpPolicies({
      file: { classification: 'CONFIDENTIAL' },
      workspace: {
        dlpPolicy: {
          enabled: true,
          requirePasswordForConfidential: true
        }
      },
      shareRequest: { password: null },
      action: 'share_create'
    });
    
    expect(result.allowed).toBe(false);
    expect(result.violations).toContain('require_password_for_confidential');
  });
});

describe('Legal Hold', () => {
  const LegalHold = require('../models/LegalHold');
  
  describe('Model', () => {
    it('should have required fields', () => {
      const schema = LegalHold.schema.obj;
      
      expect(schema.workspaceId).toBeDefined();
      expect(schema.name).toBeDefined();
      expect(schema.reason).toBeDefined();
      expect(schema.status).toBeDefined();
    });
    
    it('should default status to ACTIVE', () => {
      const schema = LegalHold.schema.obj;
      expect(schema.status.default).toBe('ACTIVE');
    });
  });
});

describe('Security Events', () => {
  const SecurityEvent = require('../models/SecurityEvent');
  
  describe('Static helpers', () => {
    it('should have event types', () => {
      expect(SecurityEvent.TYPES).toContain('brute_force_password');
      expect(SecurityEvent.TYPES).toContain('dlp_violation');
      expect(SecurityEvent.TYPES).toContain('lockdown_triggered');
    });
    
    it('should have severity levels', () => {
      expect(SecurityEvent.SEVERITY.CRITICAL).toBe(4);
      expect(SecurityEvent.SEVERITY.LOW).toBe(1);
    });
  });
});

describe('SCIM Token', () => {
  const ScimToken = require('../models/ScimToken');
  
  it('should generate secure tokens', () => {
    const token1 = ScimToken.generateToken();
    const token2 = ScimToken.generateToken();
    
    expect(token1.startsWith('scim_')).toBe(true);
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThan(40);
  });
  
  it('should hash tokens', () => {
    const token = ScimToken.generateToken();
    const hash = ScimToken.hashToken(token);
    
    expect(hash).not.toBe(token);
    expect(hash.length).toBe(64); // SHA-256
  });
});

describe('Approval Request', () => {
  const ApprovalRequest = require('../models/ApprovalRequest');
  
  it('should have action types', () => {
    expect(ApprovalRequest.ACTION_TYPES).toContain('sso_config_change');
    expect(ApprovalRequest.ACTION_TYPES).toContain('lockdown_disable');
  });
});

module.exports = {};
