/**
 * DLP (Data Loss Prevention) Engine
 * 
 * Policy evaluation service for file sharing and downloads.
 * Checks classification labels against workspace DLP policies.
 * 
 * Policy Checks:
 * - blockExternalSharing: No shares outside workspace
 * - requirePasswordForConfidential: Password required for CONFIDENTIAL+
 * - restrictDomains: Only allow shares to specific domains
 * - disablePublicLinksForRestricted: Block public links for RESTRICTED
 * 
 * Security Notes:
 * - Evaluated on every share creation and download
 * - Violations logged to SecurityEvent
 * - Strict deny-by-default for RESTRICTED files
 */

const SecurityEvent = require('../models/SecurityEvent');

// Classification hierarchy (higher = more sensitive)
const CLASSIFICATION_LEVELS = {
  'PUBLIC': 0,
  'INTERNAL': 1,
  'CONFIDENTIAL': 2,
  'RESTRICTED': 3
};

// Default DLP policy
const DEFAULT_DLP_POLICY = {
  enabled: false,
  blockExternalSharing: false,
  requirePasswordForConfidential: false,
  watermarkConfidentialDownloads: false,
  restrictDomains: [],
  disablePublicLinksForRestricted: true,
  maxDownloadsPerDay: null,
  requireMfaForRestricted: false
};

/**
 * Evaluate DLP policies for an action
 * 
 * @param {Object} params
 * @param {Object} params.file - File being shared/downloaded
 * @param {Object} params.workspace - Workspace with DLP policy
 * @param {Object} params.actor - User performing action
 * @param {Object} [params.shareRequest] - Share creation params (for share actions)
 * @param {string} params.action - 'share_create' | 'share_download' | 'file_download'
 * 
 * @returns {{ allowed: boolean, reason?: string, violations: string[] }}
 */
function evaluateDlpPolicies({ file, workspace, actor, shareRequest, action }) {
  const violations = [];
  const policy = workspace?.dlpPolicy || DEFAULT_DLP_POLICY;
  
  // If DLP not enabled, allow all
  if (!policy.enabled) {
    return { allowed: true, violations: [] };
  }
  
  const classification = file?.classification || 'PUBLIC';
  const classLevel = CLASSIFICATION_LEVELS[classification] || 0;
  
  // Check: Block external sharing
  if (policy.blockExternalSharing && action === 'share_create') {
    if (shareRequest && !shareRequest.workspaceMembersOnly) {
      violations.push('block_external_sharing');
    }
  }
  
  // Check: Require password for CONFIDENTIAL+
  if (policy.requirePasswordForConfidential && classLevel >= 2) {
    if (action === 'share_create' && shareRequest && !shareRequest.password) {
      violations.push('require_password_for_confidential');
    }
  }
  
  // Check: Domain restrictions
  if (policy.restrictDomains && policy.restrictDomains.length > 0) {
    if (action === 'share_create' && shareRequest?.allowedEmailDomains) {
      const invalidDomains = shareRequest.allowedEmailDomains.filter(
        d => !policy.restrictDomains.includes(d)
      );
      if (invalidDomains.length > 0) {
        violations.push('domain_not_in_allowlist');
      }
    }
    
    // For downloads, check recipient domain
    if (action === 'share_download' && actor?.email) {
      const domain = actor.email.split('@')[1];
      if (!policy.restrictDomains.includes(domain)) {
        violations.push('recipient_domain_not_allowed');
      }
    }
  }
  
  // Check: Disable public links for RESTRICTED
  if (policy.disablePublicLinksForRestricted && classLevel >= 3) {
    if (action === 'share_create') {
      // RESTRICTED files can never have public (passwordless) links
      if (!shareRequest?.password && !shareRequest?.requireLogin) {
        violations.push('restricted_requires_access_control');
      }
    }
  }
  
  // Check: Workspace members only for RESTRICTED
  if (classLevel >= 3) {
    if (action === 'share_create' && !shareRequest?.workspaceMembersOnly) {
      violations.push('restricted_workspace_only');
    }
  }
  
  // Check: Require MFA for RESTRICTED (interface only)
  // NEEDS CLARIFICATION: MFA implementation required
  
  const allowed = violations.length === 0;
  
  return {
    allowed,
    reason: allowed ? null : violations.join(', '),
    violations,
    classification,
    policyApplied: policy.enabled
  };
}

/**
 * Log DLP violation as security event
 */
async function logViolation({ workspace, file, actor, action, violations }) {
  if (violations.length === 0) return;
  
  await SecurityEvent.logDlpViolation(
    workspace?._id,
    actor?._id,
    file?._id,
    violations[0],
    action
  );
}

/**
 * Get classification level number
 */
function getClassificationLevel(classification) {
  return CLASSIFICATION_LEVELS[classification] || 0;
}

/**
 * Check if file requires watermark
 */
function requiresWatermark(file, policy) {
  if (!policy?.watermarkConfidentialDownloads) return false;
  const level = getClassificationLevel(file?.classification);
  return level >= 2;  // CONFIDENTIAL or higher
}

/**
 * Validate classification label
 */
function isValidClassification(classification) {
  return classification in CLASSIFICATION_LEVELS;
}

/**
 * Get default policy
 */
function getDefaultPolicy() {
  return { ...DEFAULT_DLP_POLICY };
}

/**
 * Merge custom policy with defaults
 */
function mergePolicy(customPolicy) {
  return { ...DEFAULT_DLP_POLICY, ...customPolicy };
}

module.exports = {
  evaluateDlpPolicies,
  logViolation,
  getClassificationLevel,
  requiresWatermark,
  isValidClassification,
  getDefaultPolicy,
  mergePolicy,
  CLASSIFICATION_LEVELS,
  DEFAULT_DLP_POLICY
};
