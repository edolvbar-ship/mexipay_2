const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const pool = require('../database');
const db = require('../sequelize/init');

/**
 * Admin Authentication Middleware
 * Verifies JWT token and checks if user has is_admin flag set to 1
 */

const verifyAdmin = async (req, res, next) => {
    try {
        console.log('[Admin Middleware] Verifying admin access for:', req.method, req.path);
        
        const authHeader = req.headers["authorization"];
        console.log('[Admin Middleware] Auth header present:', !!authHeader);
        
        if (!authHeader) {
            console.log('[Admin Middleware] No authorization header');
            return res.status(403).json({
                success: false,
                message: "No se proporcionó token de autorización"
            });
        }

        const token = authHeader.split(' ')[1];
        console.log('[Admin Middleware] Token extracted:', token ? 'Yes (length: ' + token.length + ')' : 'No');
        
        if (!token) {
            console.log('[Admin Middleware] Invalid token format');
            return res.status(403).json({
                success: false,
                message: "Formato de token inválido"
            });
        }

        // Try to verify token
        let decoded;
        try {
            console.log('[Admin Middleware] Attempting to verify token...');
            const config = require('../lib/varsSpa');
            decoded = jwt.verify(token, config.secret);
            console.log('[Admin Middleware] Token verified successfully with HS256');
        } catch (jwtError) {
            console.log('[Admin Middleware] HS256 verification failed:', jwtError.message);
            // Try RS256 if original fails
            let publicKEY;
            const possibleKeyPaths = [
                path.join(__dirname, '../../../App-TDM/keys/public.key'),
                path.join(__dirname, '../../App-TDM/keys/public.key'),
                path.join(__dirname, '../App-TDM/keys/public.key'),
                './keys/public.key'
            ];

            for (const keyPath of possibleKeyPaths) {
                if (fs.existsSync(keyPath)) {
                    publicKEY = fs.readFileSync(keyPath, 'utf8');
                    console.log('[Admin Middleware] Found public key at:', keyPath);
                    break;
                }
            }

            if (publicKEY) {
                console.log('[Admin Middleware] Attempting RS256 verification...');
                decoded = jwt.verify(token, publicKEY, { algorithms: ["RS256"] });
                console.log('[Admin Middleware] Token verified successfully with RS256');
            } else {
                console.log('[Admin Middleware] No public key found for RS256');
                throw jwtError;
            }
        }

        // Check if token decoded successfully
        console.log('[Admin Middleware] Decoded token ID:', decoded?.id);
        console.log('[Admin Middleware] Decoded token is_admin:', decoded?.is_admin);
        
        if (!decoded || !decoded.id) {
            console.log('[Admin Middleware] Invalid token - no ID found');
            return res.status(401).json({
                success: false,
                message: "Token inválido"
            });
        }

        // Verify user exists and is admin
        console.log('[Admin Middleware] Looking up user in database...');
        const [users] = await pool.query(
            `SELECT u.*, p.deleted_at as profile_deleted
             FROM users u
             JOIN user_profile p ON p.id_profile = u.id_profile
             WHERE u.id_user = ? AND u.online = 1`,
            [decoded.id]
        );

        console.log('[Admin Middleware] Users found:', users.length);

        if (users.length === 0) {
            console.log('[Admin Middleware] User not found or not online');
            return res.status(401).json({
                success: false,
                message: "Usuario no encontrado o sesión expirada"
            });
        }

        const user = users[0];
        console.log('[Admin Middleware] User is_admin from DB:', user.is_admin);

        if (user.profile_deleted) {
            console.log('[Admin Middleware] User profile is deleted');
            return res.status(401).json({
                success: false,
                message: "Perfil de usuario inválido"
            });
        }

        // Check if user is admin (is_admin = 1)
        if (user.is_admin !== 1) {
            console.log('[Admin Middleware] Access denied - user is not admin');
            return res.status(403).json({
                success: false,
                message: "Acceso denegado. Se requieren privilegios de administrador"
            });
        }
        
        console.log('[Admin Middleware] Admin access granted for user:', user.username);

        // Attach user info to request
        req.user = {
            id: user.id_user,
            fullName: `${user.name} ${user.last_name}`,
            username: user.username,
            mail: user.mail,
            is_admin: user.is_admin,
            id_profile: user.id_profile,
            id_cliente: user.id_cliente
        };

        next();

    } catch (error) {
        console.error('Admin middleware error:', error.message);
        return res.status(401).json({
            success: false,
            message: "Error de autenticación",
            error: error.message
        });
    }
};

/**
 * Factory for admin middleware that first verifies admin access, then may apply a specific permission.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (admin access control), Req 8.2.1 (user identification).
 * @param {string} permission - Permission name for future granular checks.
 * @returns {Function} Express middleware.
 */
const verifyAdminWithPermission = (permission) => {
    return async (req, res, next) => {
        try {
            await verifyAdmin(req, res, () => {
                // Additional permission checks can be added here
                next();
            });
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    verifyAdmin,
    verifyAdminWithPermission
};
