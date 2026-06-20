const { prisma } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const ExtractorService = require('../services/ExtractorService');
const AppError = require('../utils/AppError');
const AuditService = require('../services/AuditService');

// ── Helper: strip decrypted passwords from response ──
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
    const projects = await prisma.project.findMany({
      where: { organizationId: req.organizationId, isArchived: false },
      include: { createdBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: projects.map(safeProject),
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!project) return next(new AppError('Project not found.', 404));

    res.json({ success: true, data: safeProject(project) });
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

    const project = await prisma.project.create({
      data: {
        organizationId: req.organizationId,
        createdById: req.user.id,
        projectName,
        description,
        sourceHost,
        sourcePort: sourcePort || 1433,
        sourceDatabase,
        sourceUsername,
        sourcePasswordEncrypted: encrypt(sourcePassword),
        sourceEncryptConnection: sourceEncryptConnection || false,
        sourceTrustServerCert: sourceTrustServerCert !== false,
        destHost,
        destPort: destPort || 1433,
        destDatabase,
        destUsername,
        destPasswordEncrypted: encrypt(destPassword),
        destEncryptConnection: destEncryptConnection || false,
        destTrustServerCert: destTrustServerCert !== false,
      },
    });

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'PROJECT_CREATED',
      entity: 'Project',
      entityId: project.id,
      description: `Project "${projectName}" created`,
      ipAddress: AuditService.getIpFromRequest(req),
    });

    res.status(201).json({ success: true, message: 'Project created successfully.', data: safeProject(project) });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return next(new AppError('Project not found.', 404));

    const {
      projectName, description,
      sourceHost, sourcePort, sourceDatabase, sourceUsername, sourcePassword,
      sourceEncryptConnection, sourceTrustServerCert,
      destHost, destPort, destDatabase, destUsername, destPassword,
      destEncryptConnection, destTrustServerCert,
    } = req.body;

    const updateData = {
      projectName: projectName ?? existing.projectName,
      description: description ?? existing.description,
      sourceHost: sourceHost ?? existing.sourceHost,
      sourcePort: sourcePort ?? existing.sourcePort,
      sourceDatabase: sourceDatabase ?? existing.sourceDatabase,
      sourceUsername: sourceUsername ?? existing.sourceUsername,
      sourcePasswordEncrypted: sourcePassword ? encrypt(sourcePassword) : existing.sourcePasswordEncrypted,
      sourceEncryptConnection: sourceEncryptConnection ?? existing.sourceEncryptConnection,
      sourceTrustServerCert: sourceTrustServerCert ?? existing.sourceTrustServerCert,
      destHost: destHost ?? existing.destHost,
      destPort: destPort ?? existing.destPort,
      destDatabase: destDatabase ?? existing.destDatabase,
      destUsername: destUsername ?? existing.destUsername,
      destPasswordEncrypted: destPassword ? encrypt(destPassword) : existing.destPasswordEncrypted,
      destEncryptConnection: destEncryptConnection ?? existing.destEncryptConnection,
      destTrustServerCert: destTrustServerCert ?? existing.destTrustServerCert,
    };

    const updated = await prisma.project.update({ where: { id: existing.id }, data: updateData });

    await AuditService.log({
      organizationId: req.organizationId,
      userId: req.user.id,
      action: 'PROJECT_UPDATED',
      entity: 'Project',
      entityId: existing.id,
      description: `Project "${updated.projectName}" updated`,
    });

    res.json({ success: true, message: 'Project updated.', data: safeProject(updated) });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!project) return next(new AppError('Project not found.', 404));

    await prisma.project.delete({ where: { id: project.id } });

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
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId: req.organizationId },
      });
      if (!project) return next(new AppError('Project not found.', 404));

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
