const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const ExtractorService = require('../services/ExtractorService');
const AppError = require('../utils/AppError');
const AuditService = require('../services/AuditService');

// ── Helper: strip encrypted passwords from response ──
const safeProject = (project) => {
  const { sourcePasswordEncrypted, destPasswordEncrypted, ...safe } = project;
  return {
    ...safe,
    sourcePassword: undefined,
    destPassword: undefined,
  };
};

exports.getAllProjects = async (req, res, next) => {
  try {
    const projects = await query(
      `SELECT p.*, u.firstName, u.lastName, u.email as createdByEmail
       FROM projects p
       LEFT JOIN users u ON p.createdById = u.id
       WHERE p.organizationId = ? AND p.isArchived = 0
       ORDER BY p.updatedAt DESC`,
      [req.organizationId]
    );

    res.json({ success: true, data: projects.map(safeProject) });
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const projects = await query(
      'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
      [req.params.id, req.organizationId]
    );
    if (!projects[0]) return next(new AppError('Project not found.', 404));
    res.json({ success: true, data: safeProject(projects[0]) });
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const {
      projectName, description,
      sourceHost, sourcePort, sourceDatabase, sourceUsername, sourcePassword,
      sourceEncryptConnection, sourceTrustServerCert,
      destHost, destPort, destDatabase, destUsername, destPassword,
      destEncryptConnection, destTrustServerCert,
    } = req.body;

    if (!projectName || !sourceHost || !sourceDatabase || !sourceUsername || !sourcePassword || !destHost || !destDatabase || !destUsername || !destPassword) {
      return next(new AppError('Project name, source, and destination connection details are all required.', 400));
    }

    const id = uuidv4();
    const now = new Date();

    await execute(
      `INSERT INTO projects (id, organizationId, createdById, projectName, description,
        sourceHost, sourcePort, sourceDatabase, sourceUsername, sourcePasswordEncrypted,
        sourceEncryptConnection, sourceTrustServerCert,
        destHost, destPort, destDatabase, destUsername, destPasswordEncrypted,
        destEncryptConnection, destTrustServerCert, isArchived, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id, req.organizationId, req.user.id, projectName, description || null,
        sourceHost, sourcePort || 1433, sourceDatabase, sourceUsername, encrypt(sourcePassword),
        sourceEncryptConnection ? 1 : 0, sourceTrustServerCert !== false ? 1 : 0,
        destHost, destPort || 1433, destDatabase, destUsername, encrypt(destPassword),
        destEncryptConnection ? 1 : 0, destTrustServerCert !== false ? 1 : 0,
        now, now,
      ]
    );

    const projects = await query('SELECT * FROM projects WHERE id = ?', [id]);

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'PROJECT_CREATED',
      entity: 'Project',
      entityId: id,
      description: `Project "${projectName}" created`,
      ipAddress: AuditService.getIpFromRequest(req),
    });

    res.status(201).json({ success: true, message: 'Project created successfully.', data: safeProject(projects[0]) });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const existingRows = await query(
      'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
      [req.params.id, req.organizationId]
    );
    if (!existingRows[0]) return next(new AppError('Project not found.', 404));
    const existing = existingRows[0];

    const {
      projectName, description,
      sourceHost, sourcePort, sourceDatabase, sourceUsername, sourcePassword,
      sourceEncryptConnection, sourceTrustServerCert,
      destHost, destPort, destDatabase, destUsername, destPassword,
      destEncryptConnection, destTrustServerCert,
    } = req.body;

    await execute(
      `UPDATE projects SET
        projectName = ?, description = ?,
        sourceHost = ?, sourcePort = ?, sourceDatabase = ?, sourceUsername = ?, sourcePasswordEncrypted = ?,
        sourceEncryptConnection = ?, sourceTrustServerCert = ?,
        destHost = ?, destPort = ?, destDatabase = ?, destUsername = ?, destPasswordEncrypted = ?,
        destEncryptConnection = ?, destTrustServerCert = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        projectName ?? existing.projectName,
        description ?? existing.description,
        sourceHost ?? existing.sourceHost,
        sourcePort ?? existing.sourcePort,
        sourceDatabase ?? existing.sourceDatabase,
        sourceUsername ?? existing.sourceUsername,
        sourcePassword ? encrypt(sourcePassword) : existing.sourcePasswordEncrypted,
        (sourceEncryptConnection ?? existing.sourceEncryptConnection) ? 1 : 0,
        (sourceTrustServerCert ?? existing.sourceTrustServerCert) ? 1 : 0,
        destHost ?? existing.destHost,
        destPort ?? existing.destPort,
        destDatabase ?? existing.destDatabase,
        destUsername ?? existing.destUsername,
        destPassword ? encrypt(destPassword) : existing.destPasswordEncrypted,
        (destEncryptConnection ?? existing.destEncryptConnection) ? 1 : 0,
        (destTrustServerCert ?? existing.destTrustServerCert) ? 1 : 0,
        existing.id,
      ]
    );

    const updated = await query('SELECT * FROM projects WHERE id = ?', [existing.id]);

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'PROJECT_UPDATED',
      entity: 'Project',
      entityId: existing.id,
      description: `Project "${updated[0].projectName}" updated`,
    });

    res.json({ success: true, message: 'Project updated.', data: safeProject(updated[0]) });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const projects = await query(
      'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
      [req.params.id, req.organizationId]
    );
    if (!projects[0]) return next(new AppError('Project not found.', 404));
    const project = projects[0];

    await execute('DELETE FROM projects WHERE id = ?', [project.id]);

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'PROJECT_DELETED',
      entity: 'Project',
      entityId: project.id,
      description: `Project "${project.projectName}" deleted`,
    });

    res.json({ success: true, message: 'Project deleted.' });
  } catch (error) {
    next(error);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const { type, projectId } = req.body;
    let config;

    if (projectId) {
      const projects = await query(
        'SELECT * FROM projects WHERE id = ? AND organizationId = ?',
        [projectId, req.organizationId]
      );
      if (!projects[0]) return next(new AppError('Project not found.', 404));
      const project = projects[0];

      if (type === 'source') {
        config = {
          host: project.sourceHost, port: project.sourcePort,
          database: project.sourceDatabase, username: project.sourceUsername,
          password: decrypt(project.sourcePasswordEncrypted),
          encryptConnection: project.sourceEncryptConnection,
          trustServerCert: project.sourceTrustServerCert,
        };
      } else {
        config = {
          host: project.destHost, port: project.destPort,
          database: project.destDatabase, username: project.destUsername,
          password: decrypt(project.destPasswordEncrypted),
          encryptConnection: project.destEncryptConnection,
          trustServerCert: project.destTrustServerCert,
        };
      }
    } else {
      const { host, port, database, username, password, encryptConnection, trustServerCert } = req.body;
      config = { host, port, database, username, password, encryptConnection, trustServerCert };
    }

    const result = await ExtractorService.testConnection(config);
    res.json({ success: true, data: result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
