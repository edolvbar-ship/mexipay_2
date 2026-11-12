/**
 * Merchant Filtering Middleware
 * 
 * This middleware enforces merchant-scoped access control for movimientos APIs.
 * It filters data based on the user's merchant access level.
 */

const db = require('../sequelize/init');

/**
 * Express middleware that enforces merchant-scoped access control for movimientos APIs.
 * Determines whether the resource is merchant-scoped, then applies merchant or client-level filters.
 * Admins bypass filtering.
 * PCI DSS 4.0: Req 7.1.1 / 7.1.2 / 7.2.1 / 7.2.2 (access control and authorization).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const merchantFilterMiddleware = async (req, res, next) => {
  try {
    // Check if this is a merchant-scoped resource
    const resourceUrl = req.originalUrl;
    const [resource] = await db.seq.query(`
      SELECT is_merchant_scoped 
      FROM resources 
      WHERE resource_url = ? OR resource_url LIKE CONCAT(?, '%')
      LIMIT 1
    `, {
      replacements: [resourceUrl, resourceUrl],
      type: db.seq.QueryTypes.SELECT
    });

    // If not merchant-scoped, proceed normally
    if (!resource || !resource.is_merchant_scoped) {
      return next();
    }

    // Get user info from JWT token (assuming it's attached by auth middleware)
    const userInfo = req.user || req.authData;
    
    if (!userInfo) {
      return res.status(401).json({
        status: 'error',
        message: 'User authentication required'
      });
    }

    // Check if user is admin (admins can see all data)
    if (userInfo.isAdmin || userInfo.id_profile === 1) {
      // Admin users can see all merchant data
      req.merchantFilter = null; // No filtering for admins
      return next();
    }

    // For non-admin users, get their merchant access
    const [merchantAccess] = await db.seq.query(`
      SELECT 
        u.id_merchant,
        u.id_client,
        c.name as client_name,
        m.merchantName
      FROM users u
      LEFT JOIN clients c ON u.id_client = c.id_client
      LEFT JOIN merchants m ON u.id_merchant = m.id_merchant
      WHERE u.id = ?
    `, {
      replacements: [userInfo.id],
      type: db.seq.QueryTypes.SELECT
    });

    if (!merchantAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'No merchant access found for user'
      });
    }

    // Apply merchant filtering based on user access level
    if (merchantAccess.id_merchant) {
      // User has specific merchant access - filter by merchant
      req.merchantFilter = {
        type: 'merchant',
        id_merchant: merchantAccess.id_merchant,
        merchantName: merchantAccess.merchantName
      };
    } else if (merchantAccess.id_client) {
      // User has client-level access - filter by client
      req.merchantFilter = {
        type: 'client',
        id_client: merchantAccess.id_client,
        clientName: merchantAccess.client_name
      };
    } else {
      // User has no merchant access - deny access
      return res.status(403).json({
        status: 'error',
        message: 'Access denied: No merchant permissions'
      });
    }

    console.log(`🔒 Merchant filter applied for user ${userInfo.id}:`, req.merchantFilter);
    next();

  } catch (error) {
    console.error('❌ Error in merchant filter middleware:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error applying merchant filter'
    });
  }
};

module.exports = merchantFilterMiddleware;
