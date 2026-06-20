const { prisma } = require('../config/database');
const { decrypt } = require('../utils/encryption');
const ExtractorService = require('../services/ExtractorService');
const ComparatorService = require('../services/ComparatorService');
const AuditService = require('../services/AuditService');
const AppError = require('../utils/AppError');

exports.compareProject = async (req, res, next) => {
  const compareHistoryId = null;
  let historyRecord;
  const startTime = Date.now();

  try {
    const { projectId } = req.body;
    if (!projectId) return next(new AppError('projectId is required.', 400));

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organizationId },
    });
    if (!project) return next(new AppError('Project not found.', 404));

    // Create a history record (RUNNING)
    historyRecord = await prisma.compareHistory.create({
      data: {
        organizationId: req.organizationId,
        projectId: project.id,
        status: 'RUNNING',
      },
    });

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'COMPARE_STARTED',
      entity: 'CompareHistory',
      entityId: historyRecord.id,
      description: `Comparison started for project "${project.projectName}"`,
    });

    // Build connection configs (decrypt passwords)
    const sourceConfig = {
      host: project.sourceHost, port: project.sourcePort,
      database: project.sourceDatabase, username: project.sourceUsername,
      password: decrypt(project.sourcePasswordEncrypted),
      encryptConnection: project.sourceEncryptConnection,
      trustServerCert: project.sourceTrustServerCert,
    };
    const destConfig = {
      host: project.destHost, port: project.destPort,
      database: project.destDatabase, username: project.destUsername,
      password: decrypt(project.destPasswordEncrypted),
      encryptConnection: project.destEncryptConnection,
      trustServerCert: project.destTrustServerCert,
    };

    // Extract both schemas in parallel
    const [sourceSchema, destSchema] = await Promise.all([
      ExtractorService.extractSchema(sourceConfig),
      ExtractorService.extractSchema(destConfig),
    ]);

    // Compare
    const { summary, results } = ComparatorService.compare(sourceSchema, destSchema);
    const durationMs = Date.now() - startTime;

    // Update history record (COMPLETED)
    await prisma.compareHistory.update({
      where: { id: historyRecord.id },
      data: {
        status: 'COMPLETED',
        tablesAdded: summary.tablesAdded,
        tablesModified: summary.tablesModified,
        tablesMissing: summary.tablesMissing,
        viewsChanged: summary.viewsChanged,
        proceduresChanged: summary.proceduresChanged,
        functionsChanged: summary.functionsChanged,
        totalDifferences: summary.totalDifferences,
        riskLevel: summary.overallRisk,
        resultSummary: summary,
        durationMs,
      },
    });

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'COMPARE_COMPLETED',
      entity: 'CompareHistory',
      entityId: historyRecord.id,
      description: `Comparison completed for "${project.projectName}" — ${summary.totalDifferences} differences found (${summary.overallRisk} risk)`,
      metadata: { durationMs, summary },
    });

    res.json({
      success: true,
      data: {
        compareHistoryId: historyRecord.id,
        summary,
        results,
        durationMs,
      },
    });
  } catch (error) {
    // Mark history as FAILED
    if (historyRecord) {
      await prisma.compareHistory.update({
        where: { id: historyRecord.id },
        data: { status: 'FAILED', errorMessage: error.message, durationMs: Date.now() - startTime },
      }).catch(() => {});

      await AuditService.log({
        organizationId: req.organizationId,
        userId: req.user.id,
        action: 'COMPARE_FAILED',
        entity: 'CompareHistory',
        entityId: historyRecord.id,
        description: `Comparison failed: ${error.message}`,
      });
    }
    next(error);
  }
};

exports.getHistory = async (req, res, next) => {
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
};
