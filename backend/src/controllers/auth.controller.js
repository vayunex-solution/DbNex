const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../config/database');
const AppError = require('../utils/AppError');
const AuditService = require('../services/AuditService');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    const users = await query(
      'SELECT u.*, o.id as org_id, o.name as org_name, o.slug as org_slug, o.plan as org_plan FROM users u LEFT JOIN organizations o ON u.organizationId = o.id WHERE u.email = ?',
      [email.toLowerCase().trim()]
    );
    const user = users[0];

    if (!user || !user.isActive) return next(new AppError('Invalid credentials.', 401));

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) return next(new AppError('Invalid credentials.', 401));

    const { accessToken, refreshToken } = generateTokens(user.id);

    const tokenId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await execute(
      'INSERT INTO refresh_tokens (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)',
      [tokenId, refreshToken, user.id, expiresAt]
    );

    await execute('UPDATE users SET lastLoginAt = NOW() WHERE id = ?', [user.id]);

    await AuditService.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      description: `${user.email} logged in`,
      ipAddress: AuditService.getIpFromRequest(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          organization: {
            id: user.org_id,
            name: user.org_name,
            slug: user.org_slug,
            plan: user.org_plan,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AppError('Refresh token required.', 400));

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return next(new AppError('Invalid or expired refresh token.', 401));
    }

    const tokens = await query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND userId = ?',
      [refreshToken, decoded.userId]
    );
    const storedToken = tokens[0];

    if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
      return next(new AppError('Refresh token is invalid or expired.', 401));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    await execute('DELETE FROM refresh_tokens WHERE id = ?', [storedToken.id]);

    const tokenId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await execute(
      'INSERT INTO refresh_tokens (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)',
      [tokenId, newRefreshToken, decoded.userId, expiresAt]
    );

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }

    await AuditService.log({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      description: `${req.user.email} logged out`,
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        plan: user.organization.plan,
      },
    },
  });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return next(new AppError('Current and new passwords are required.', 400));
    if (newPassword.length < 8) return next(new AppError('Password must be at least 8 characters.', 400));

    const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return next(new AppError('Current password is incorrect.', 400));

    const newHash = await bcrypt.hash(newPassword, 12);
    await execute('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, req.user.id]);
    await execute('DELETE FROM refresh_tokens WHERE userId = ?', [req.user.id]);

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    next(error);
  }
};
