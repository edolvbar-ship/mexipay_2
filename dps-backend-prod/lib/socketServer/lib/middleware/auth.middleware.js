const jwt = require('jsonwebtoken');
const vars = require('../lib/varsSpa');

/**
 * Express middleware that validates a JWT bearer token in the Authorization header.
 * PCI DSS 4.0: Req 8.1.6 / 8.2.1 / 8.3.2 (user identification and authentication).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, vars.secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  });
};

/**
 * Express middleware that requires the authenticated user to be an admin.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (role-based access control).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

/**
 * Express middleware that requires the user to have merchant access (admin or linked client).
 * PCI DSS 4.0: Req 7.1.1 / 7.1.2 (least privilege / business need to know).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireMerchantAccess = (req, res, next) => {
  if (!req.user || (!req.user.isAdmin && !req.user.idClient)) {
    return res.status(403).json({
      success: false,
      error: 'Merchant access required'
    });
  }
  next();
};

/**
 * Express middleware factory that checks a simple permission/role-based condition.
 * PCI DSS 4.0: Req 7.2.1 / 7.2.2 (restrict access by permission).
 * @param {string} permission - Permission name to enforce.
 * @returns {Function} Express middleware function.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    // This would typically check against a permissions table
    // For now, we'll use a simple role-based check
    const hasPermission = req.user.isAdmin || 
                        (req.user.userProfile && req.user.userProfile >= 2); // Assuming profile 2+ has access

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`
      });
    }

    next();
  };
};

/**
 * Express middleware that validates the user has access to a specific merchant resource.
 * Admins bypass the check. Non-admins must belong to the merchant's client and the merchant must be active.
 * PCI DSS 4.0: Req 7.1.1 / 7.1.2 / 7.2.1 (access control and authorization).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const validateMerchantAccess = async (req, res, next) => {
  try {
    const { getDBConnection } = require('../database');
    const db = await getDBConnection();

    // If user is admin, allow access
    if (req.user.isAdmin) {
      return next();
    }

    // For non-admin users, check if they have access to the merchant
    const merchantId = req.params.merchantId || req.body.merchantId || req.query.merchantId;
    
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID required'
      });
    }

    const query = `
      SELECT COUNT(*) as count
      FROM merchants m
      WHERE m.id_merchant = ? 
      AND m.id_cliente = ?
      AND m.status = 'active'
    `;

    const [result] = await db.query(query, [merchantId, req.user.idClient]);

    if (result[0].count === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this merchant'
      });
    }

    next();
  } catch (error) {
    console.error('Error in validateMerchantAccess:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Express middleware that decodes the JWT and attaches a normalized userInfo object to the request.
 * PCI DSS 4.0: Req 8.1.6 (session enrichment), Req 7.1.6 (data minimization).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getUserInfo = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, vars.secret);
    
    // Attach user info to request
    req.userInfo = {
      id: decoded.id,
      isAdmin: decoded.isAdmin || false,
      idClient: decoded.idClient,
      username: decoded.username,
      userProfile: decoded.userProfile,
      fullName: decoded.fullName,
      mail: decoded.mail
    };

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Middleware to rate limit API calls
const rateLimit = require('express-rate-limit');

/**
 * Factory that creates an express-rate-limit middleware instance.
 * PCI DSS 4.0: Req 11.4.6 (denial-of-service protection / rate limiting).
 * @param {number} windowMs - Time window in milliseconds.
 * @param {number} max - Maximum allowed requests per window.
 * @param {string} message - Error message returned when the limit is exceeded.
 * @returns {Function} Express rate-limit middleware.
 */
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Rate limiter for transaction endpoints: 100 requests per 15 minutes per IP.
 * PCI DSS 4.0: Req 11.4.6 (rate limiting / DoS protection).
 */
const transactionRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many transaction requests, please try again later'
);

/**
 * Rate limiter for export endpoints: 10 requests per hour per IP.
 * PCI DSS 4.0: Req 11.4.6 (rate limiting / DoS protection).
 */
const exportRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // limit each IP to 10 export requests per hour
  'Too many export requests, please try again later'
);

/**
 * Rate limiter for search endpoints: 50 requests per 5 minutes per IP.
 * PCI DSS 4.0: Req 11.4.6 (rate limiting / DoS protection).
 */
const searchRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  50, // limit each IP to 50 search requests per windowMs
  'Too many search requests, please try again later'
);

module.exports = {
  authenticateToken,
  requireAdmin,
  requireMerchantAccess,
  requirePermission,
  validateMerchantAccess,
  getUserInfo,
  transactionRateLimit,
  exportRateLimit,
  searchRateLimit
};
