const { v4: uuidv4 } = require('uuid');
const { execute } = require('../config/database');
const logger = require('../utils/logger');

/**
 * DbNex - AuditService (mysql2 version)
 */
class AuditService {
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
      const id = uuidv4();
      const now = new Date();
      await execute(
        `INSERT INTO audit_logs (id, organizationId, userId, action, entity, entityId, description, metadata, ipAddress, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, organizationId, userId, action, entity, entityId,
          description,
          metadata ? JSON.stringify(metadata) : null,
          ipAddress, userAgent, now,
        ]
      );
    } catch (error) {
      // Audit failures must NEVER break the main flow
      logger.error('[AuditService] Failed to write audit log:', error.message);
    }
  }

  getIpFromRequest(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
  }
}

module.exports = new AuditService();
