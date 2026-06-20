const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * DbNex - AuditService
 * Creates audit trail entries for every important action in the system.
 * 
 * Vendor: Vayunex Solution
 */
class AuditService {
  /**
   * Logs an auditable action.
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} [params.userId]
   * @param {string} params.action - AuditAction enum value
   * @param {string} params.entity - Entity name (e.g., "Project")
   * @param {string} [params.entityId]
   * @param {string} params.description - Human-readable description
   * @param {object} [params.metadata] - Additional data (old values, new values, etc.)
   * @param {string} [params.ipAddress]
   * @param {string} [params.userAgent]
   */
  async log({
    organizationId,
    userId = null,
    action,
    entity,
    entityId = null,
    description,
    metadata = null,
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          entity,
          entityId,
          description,
          metadata,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      // Audit failures must NEVER break the main flow
      logger.error('[AuditService] Failed to write audit log:', error.message);
    }
  }

  /**
   * Helper to extract IP from Express request
   */
  getIpFromRequest(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
  }
}

module.exports = new AuditService();
