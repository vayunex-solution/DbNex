const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../config/database');
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

    const projects = await query(
      'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
      [projectId, req.organizationId]
    );
    if (!projects[0]) return next(new AppError('Project not found.', 404));
    const project = projects[0];

    const riskReport = RiskAnalyzerService.analyze(scriptSql);

    if (riskReport.requiresConfirmation && !confirmed) {
      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        riskReport,
        message: `This script has ${riskReport.overallRisk} risk operations. Please confirm execution.`,
      });
    }

    const destConfig = {
      host: project.destHost,
      port: project.destPort,
      database: project.destDatabase,
      username: project.destUsername,
      password: decrypt(project.destPasswordEncrypted),
      encryptConnection: project.destEncryptConnection,
      trustServerCert: project.destTrustServerCert,
    };

    const logId = uuidv4();
    const now = new Date();
    await execute(
      `INSERT INTO execution_logs (id, organizationId, projectId, compareHistoryId, status, scriptSql, riskLevel, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'RUNNING', ?, ?, ?, ?)`,
      [logId, req.organizationId, project.id, compareHistoryId || null, scriptSql, riskReport.overallRisk, now, now]
    );
    logRecord = { id: logId };

    const execResult = await ScriptRunnerService.executeScript(destConfig, scriptSql);
    const durationMs = Date.now() - startTime;

    await execute(
      `UPDATE execution_logs SET status = ?, totalBatches = ?, successBatches = ?, failedBatches = ?,
       batchLogs = ?, errorMessage = ?, durationMs = ?, executedAt = NOW(), updatedAt = NOW()
       WHERE id = ?`,
      [
        execResult.status,
        execResult.totalBatches,
        execResult.successBatches,
        execResult.failedBatches,
        JSON.stringify(execResult.batchLogs),
        execResult.failedBatches > 0 ? `${execResult.failedBatches} batch(es) failed.` : null,
        durationMs,
        logId,
      ]
    );

    const auditAction = execResult.success ? 'SCRIPT_EXECUTED' : 'SCRIPT_FAILED';
    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: auditAction,
      entity: 'ExecutionLog',
      entityId: logId,
      description: `Script execution ${execResult.status.toLowerCase()} for project "${project.projectName}" — ${execResult.successBatches}/${execResult.totalBatches} batches succeeded`,
      metadata: { riskLevel: riskReport.overallRisk, durationMs },
    });

    res.json({ success: execResult.success, data: { executionLogId: logId, ...execResult, riskReport } });
  } catch (error) {
    if (logRecord) {
      await execute(
        'UPDATE execution_logs SET status = ?, errorMessage = ?, durationMs = ?, executedAt = NOW(), updatedAt = NOW() WHERE id = ?',
        ['FAILED', error.message, Date.now() - startTime, logRecord.id]
      ).catch(() => {});
    }
    next(error);
  }
};

exports.getExecutionLogs = async (req, res, next) => {
  try {
    const { projectId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'el.organizationId = ?';
    const params = [req.organizationId];

    if (projectId) {
      whereClause += ' AND el.projectId = ?';
      params.push(projectId);
    }

    const [logs, countRows] = await Promise.all([
      query(
        `SELECT el.id, el.status, el.riskLevel, el.totalBatches, el.successBatches,
                el.failedBatches, el.durationMs, el.executedAt, el.createdAt, el.errorMessage,
                p.projectName
         FROM execution_logs el
         LEFT JOIN projects p ON el.projectId = p.id
         WHERE ${whereClause} ORDER BY el.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) as total FROM execution_logs el WHERE ${whereClause}`, params),
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
};

exports.getExecutionLogById = async (req, res, next) => {
  try {
    const logs = await query(
      `SELECT el.*, p.projectName FROM execution_logs el
       LEFT JOIN projects p ON el.projectId = p.id
       WHERE el.id = ? AND el.organizationId = ?`,
      [req.params.id, req.organizationId]
    );
    if (!logs[0]) return next(new AppError('Execution log not found.', 404));
    res.json({ success: true, data: logs[0] });
  } catch (error) {
    next(error);
  }
};
