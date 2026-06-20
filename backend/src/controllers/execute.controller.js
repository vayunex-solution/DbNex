const { prisma } = require('../config/database');
const { decrypt } = require('../utils/encryption');
const ScriptRunnerService = require('../services/ScriptRunnerService');
const RiskAnalyzerService = require('../services/RiskAnalyzerService');
const AuditService = require('../services/AuditService');
const AppError = require('../utils/AppError');

exports.analyzeScript = async (req, res, next) => {
  try {
    const { scriptSql } = req.body;
    if (!scriptSql?.trim()) return next(new AppError('scriptSql is required.', 400));

    const riskReport = RiskAnalyzerService.analyze(scriptSql);
    res.json({ success: true, data: riskReport });
  } catch (error) {
    next(error);
  }
};

exports.executeScript = async (req, res, next) => {
  const startTime = Date.now();
  let logRecord;

  try {
    const { projectId, scriptSql, compareHistoryId, confirmed } = req.body;

    if (!projectId || !scriptSql?.trim()) {
      return next(new AppError('projectId and scriptSql are required.', 400));
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organizationId },
    });
    if (!project) return next(new AppError('Project not found.', 404));

    // Always run risk analysis first
    const riskReport = RiskAnalyzerService.analyze(scriptSql);

    // Enforce confirmation for Medium/High risk scripts
    if (riskReport.requiresConfirmation && !confirmed) {
      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        riskReport,
        message: `This script has ${riskReport.overallRisk} risk operations. Please confirm execution.`,
      });
    }

    // Build destination config (we execute AGAINST destination)
    const destConfig = {
      host: project.destHost,
      port: project.destPort,
      database: project.destDatabase,
      username: project.destUsername,
      password: decrypt(project.destPasswordEncrypted),
      encryptConnection: project.destEncryptConnection,
      trustServerCert: project.destTrustServerCert,
    };

    // Create execution log record
    logRecord = await prisma.executionLog.create({
      data: {
        organizationId: req.organizationId,
        projectId: project.id,
        compareHistoryId: compareHistoryId || null,
        status: 'RUNNING',
        scriptSql,
        riskLevel: riskReport.overallRisk,
      },
    });

    // Execute the script
    const execResult = await ScriptRunnerService.executeScript(destConfig, scriptSql);
    const durationMs = Date.now() - startTime;

    // Update execution log
    await prisma.executionLog.update({
      where: { id: logRecord.id },
      data: {
        status: execResult.status,
        totalBatches: execResult.totalBatches,
        successBatches: execResult.successBatches,
        failedBatches: execResult.failedBatches,
        batchLogs: execResult.batchLogs,
        errorMessage: execResult.failedBatches > 0 ? `${execResult.failedBatches} batch(es) failed.` : null,
        durationMs,
        executedAt: new Date(),
      },
    });

    const auditAction = execResult.success ? 'SCRIPT_EXECUTED' : 'SCRIPT_FAILED';
    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: auditAction,
      entity: 'ExecutionLog',
      entityId: logRecord.id,
      description: `Script execution ${execResult.status.toLowerCase()} for project "${project.projectName}" — ${execResult.successBatches}/${execResult.totalBatches} batches succeeded`,
      metadata: { riskLevel: riskReport.overallRisk, durationMs },
    });

    res.json({
      success: execResult.success,
      data: {
        executionLogId: logRecord.id,
        ...execResult,
        riskReport,
      },
    });
  } catch (error) {
    if (logRecord) {
      await prisma.executionLog.update({
        where: { id: logRecord.id },
        data: { status: 'FAILED', errorMessage: error.message, durationMs: Date.now() - startTime, executedAt: new Date() },
      }).catch(() => {});
    }
    next(error);
  }
};

exports.getExecutionLogs = async (req, res, next) => {
  try {
    const { projectId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: req.organizationId };
    if (projectId) where.projectId = projectId;

    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        include: { project: { select: { projectName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true, status: true, riskLevel: true, totalBatches: true,
          successBatches: true, failedBatches: true, durationMs: true,
          executedAt: true, createdAt: true, errorMessage: true,
          project: { select: { projectName: true } },
        },
      }),
      prisma.executionLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getExecutionLogById = async (req, res, next) => {
  try {
    const log = await prisma.executionLog.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { project: { select: { projectName: true } } },
    });
    if (!log) return next(new AppError('Execution log not found.', 404));
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};
