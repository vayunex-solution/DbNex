const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { projectId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'ch.organizationId = ?';
    const params = [req.organizationId];

    if (projectId) {
      whereClause += ' AND ch.projectId = ?';
      params.push(projectId);
    }

    const [records, countRows] = await Promise.all([
      query(
        `SELECT ch.*, p.projectName FROM compare_history ch
         LEFT JOIN projects p ON ch.projectId = p.id
         WHERE ${whereClause} ORDER BY ch.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) as total FROM compare_history ch WHERE ${whereClause}`, params),
    ]);

    const total = countRows[0].total;
    res.json({
      success: true,
      data: records,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const records = await query(
      `SELECT ch.*, p.projectName, p.sourceDatabase, p.destDatabase
       FROM compare_history ch
       LEFT JOIN projects p ON ch.projectId = p.id
       WHERE ch.id = ? AND ch.organizationId = ?`,
      [req.params.id, req.organizationId]
    );
    if (!records[0]) return next(new AppError('History record not found.', 404));
    res.json({ success: true, data: records[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
