const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/me', (req, res) => {
  const org = req.user.organization;
  res.json({
    success: true,
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
    },
  });
});

router.get('/stats', authorize('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const [projectRows, compareRows, executionRows, userRows] = await Promise.all([
      query('SELECT COUNT(*) as cnt FROM projects WHERE organizationId = ? AND isArchived = 0', [orgId]),
      query('SELECT COUNT(*) as cnt FROM compare_history WHERE organizationId = ?', [orgId]),
      query('SELECT COUNT(*) as cnt FROM execution_logs WHERE organizationId = ?', [orgId]),
      query('SELECT COUNT(*) as cnt FROM users WHERE organizationId = ? AND isActive = 1', [orgId]),
    ]);

    res.json({
      success: true,
      data: {
        projectCount: projectRows[0].cnt,
        compareCount: compareRows[0].cnt,
        executionCount: executionRows[0].cnt,
        userCount: userRows[0].cnt,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
