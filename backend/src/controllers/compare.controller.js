const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../config/database');
const { decrypt } = require('../utils/encryption');
const ExtractorService = require('../services/ExtractorService');
const ComparatorService = require('../services/ComparatorService');
const AuditService = require('../services/AuditService');
const AppError = require('../utils/AppError');

exports.compareProject = async (req, res, next) => {
  let historyRecord;
  const startTime = Date.now();

  try {
    const { projectId } = req.body;
    if (!projectId) return next(new AppError('projectId is required.', 400));

    const projects = await query(
      'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
      [projectId, req.organizationId]
    );
    if (!projects[0]) return next(new AppError('Project not found.', 404));
    const project = projects[0];

    const historyId = uuidv4();
    const now = new Date();
    await execute(
      'INSERT INTO compare_history (id, organizationId, projectId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, req.organizationId, project.id, 'RUNNING', now, now]
    );
    historyRecord = { id: historyId };

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'COMPARE_STARTED',
      entity: 'CompareHistory',
      entityId: historyId,
      description: `Comparison started for project "${project.projectName}"`,
    });

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

    const [sourceSchema, destSchema] = await Promise.all([
      ExtractorService.extractSchema(sourceConfig),
      ExtractorService.extractSchema(destConfig),
    ]);

    const { summary, results } = ComparatorService.compare(sourceSchema, destSchema);
    const durationMs = Date.now() - startTime;

    await execute(
      `UPDATE compare_history SET
        status = 'COMPLETED', tablesAdded = ?, tablesModified = ?, tablesMissing = ?,
        viewsChanged = ?, proceduresChanged = ?, functionsChanged = ?,
        totalDifferences = ?, riskLevel = ?, resultSummary = ?, durationMs = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        summary.tablesAdded, summary.tablesModified, summary.tablesMissing,
        summary.viewsChanged, summary.proceduresChanged, summary.functionsChanged,
        summary.totalDifferences, summary.overallRisk,
        JSON.stringify(summary), durationMs, historyId,
      ]
    );

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'COMPARE_COMPLETED',
      entity: 'CompareHistory',
      entityId: historyId,
      description: `Comparison completed for "${project.projectName}" — ${summary.totalDifferences} differences found (${summary.overallRisk} risk)`,
      metadata: { durationMs, summary },
    });

    res.json({
      success: true,
      data: { compareHistoryId: historyId, summary, results, durationMs },
    });
  } catch (error) {
    if (historyRecord) {
      await execute(
        'UPDATE compare_history SET status = ?, errorMessage = ?, durationMs = ?, updatedAt = NOW() WHERE id = ?',
        ['FAILED', error.message, Date.now() - startTime, historyRecord.id]
      ).catch(() => {});

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
};
