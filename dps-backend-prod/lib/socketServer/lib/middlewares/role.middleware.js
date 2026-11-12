const jwt = require('jsonwebtoken');
const config = require('../lib/varsSpa');
const db = require('../sequelize/init');

const publicPaths = [
    '/gateway/api/v2/auth', // Login endpoint (adjust if different; based on your logs)
    '/health',              // Health check
    '/gateway/api/v2/auth/reset-password',              // Health check
    // Add more public routes as needed, e.g., '/api/signup', '/api/forgot-password'
];

/**
 * Express middleware that verifies JWT tokens and enforces profile-based permissions for routes.
 * Public paths and OPTIONS preflight requests bypass authentication. Super admins and admins bypass permission checks.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 / 7.2.2 (access control), Req 8.1.6 / 8.2.1 / 8.3.2 (authentication).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports = async (req, res, next) => {
    const routePath = req.path;
    const method = req.method;

    // Bypass auth for public paths and OPTIONS (preflight)
    if (publicPaths.includes(routePath) || method === 'OPTIONS') {
        return next();
    }

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token provided - role middleware!' });

    try {
        const decoded = jwt.verify(token, config.secret);
        const user = await db.users.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
        if (!user) return res.status(401).json({ message: 'Unauthorized!' });

        req.user = user;

        // Super admins bypass permission checks
        if (user.is_super_admin || user.is_admin) return next();

        // Permission check for regular users
        const profileResources = await db.profileResources.findAll({ where: { id_profile: user.id_profile } });
        const hasPermission = profileResources.some(pr => pr.resource_url === routePath && pr.allowed_methods.includes(method));
        if (!hasPermission) return res.status(403).json({ message: 'Forbidden!' });

        next();
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized!', error: err.message });
    }
};