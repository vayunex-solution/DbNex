const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/', authorize('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'al.organizationId = ?';
    const params = [req.organizationId];

    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }
    if (userId) {
      whereClause += ' AND al.userId = ?';
      params.push(userId);
    }

    const [logs, countRows] = await Promise.all([
      query(
        `SELECT al.*, u.firstName, u.lastName, u.email as userEmail
         FROM audit_logs al
         LEFT JOIN users u ON al.userId = u.id
         WHERE ${whereClause} ORDER BY al.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) as total FROM audit_logs al WHERE ${whereClause}`, params),
    ]);

    const total = countRows[0].total;
    res.json({
      success: true,
      data: logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
