const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');

router.use(authenticate);

// Get all history (same as compare history endpoint but under /history)
router.get('/', async (req, res, next) => {
  try {
    const { projectId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { organizationId: req.organizationId };
    if (projectId) where.projectId = projectId;

    const [records, total] = await Promise.all([
      prisma.compareHistory.findMany({
        where,
        include: { project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.compareHistory.count({ where }),
    ]);

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
    const record = await prisma.compareHistory.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { project: { select: { projectName: true, sourceDatabase: true, destDatabase: true } } },
    });
    if (!record) return next(new AppError('History record not found.', 404));
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
