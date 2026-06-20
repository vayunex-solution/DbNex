const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');

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
      isActive: org.isActive,
    },
  });
});

router.get('/stats', authorize('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const [
      projectCount,
      compareCount,
      executionCount,
      userCount,
    ] = await Promise.all([
      prisma.project.count({ where: { organizationId: orgId, isArchived: false } }),
      prisma.compareHistory.count({ where: { organizationId: orgId } }),
      prisma.executionLog.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    ]);

    res.json({
      success: true,
      data: { projectCount, compareCount, executionCount, userCount },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
