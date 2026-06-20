const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid authentication token.', 401));
    }

    const users = await query(
      'SELECT u.*, o.id as org_id, o.name as org_name, o.slug as org_slug, o.plan as org_plan FROM users u LEFT JOIN organizations o ON u.organizationId = o.id WHERE u.id = ?',
      [decoded.userId]
    );
    const user = users[0];

    if (!user || !user.isActive) {
      return next(new AppError('User not found or account is deactivated.', 401));
    }

    // Attach organization as nested object for compatibility
    req.user = {
      ...user,
      organization: {
        id: user.org_id,
        name: user.org_name,
        slug: user.org_slug,
        plan: user.org_plan,
      },
    };
    req.organizationId = user.organizationId;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
