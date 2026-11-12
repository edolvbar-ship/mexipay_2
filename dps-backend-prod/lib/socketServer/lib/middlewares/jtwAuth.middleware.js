const router = require('express').Router();
const out = {};

const jwt = require("jsonwebtoken");
const fs = require('fs');
const path = require('path');
const db = require('../sequelize/init.js');
const User = db.users;

/**
 * Express middleware that verifies a JWT token supporting both HS256 and RS256 algorithms.
 * First tries HS256 with the SPA secret; on failure, falls back to RS256 with the TDM public key.
 * Attaches req.userId and req.user when successful.
 * PCI DSS 4.0: Req 8.1.6 / 8.2.1 / 8.3.2 / 8.3.6 (user identification and authentication), Req 10.2.1 (audit failures).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
verifyToken = (req, res, next) => {
    let token = req.headers["authorization"];
    if (!token) {
        console.log('🚫 jtwAuth: No authorization header provided - next to attempt 1');
        return res.status(403).send({
            message: "No token provided - jwtAuth"
        });
    }

    try {
        const tokenValue = token.split(' ')[1];
        
        // 🔍 ENHANCED LOGGING: Decode token for analysis before verification
        console.log('🚨 jtwAuth: Starting token verification');
        console.log('🚨 jtwAuth: Request URL:', req.originalUrl);
        console.log('🚨 jtwAuth: Request Method:', req.method);
        console.log('🚨 jtwAuth: Client IP:', req.headers['x-forwarded-for'] || req.ip || 'unknown');
        console.log('🚨 jtwAuth: User-Agent:', req.headers['user-agent'] || 'unknown');
        console.log('🚨 jtwAuth: Token length:', tokenValue ? tokenValue.length : 'null');
        
        // Decode token without verification to analyze structure
        try {
            const decodedWithoutVerify = jwt.decode(tokenValue, { complete: true });
            if (decodedWithoutVerify) {
                console.log('🚨 jtwAuth: Token Header:', JSON.stringify(decodedWithoutVerify.header, null, 2));
                console.log('🚨 jtwAuth: Token Payload Structure:', {
                    hasId: !!decodedWithoutVerify.payload.id,
                    hasSession: !!decodedWithoutVerify.payload.session,
                    hasUsername: !!decodedWithoutVerify.payload.username,
                    hasEmail: !!decodedWithoutVerify.payload.email,
                    payloadKeys: Object.keys(decodedWithoutVerify.payload)
                });
                
                if (decodedWithoutVerify.payload.session) {
                    console.log('🚨 jtwAuth: Session Structure:', {
                        hasUuid: !!decodedWithoutVerify.payload.session.uuid,
                        hasUserIduser: !!decodedWithoutVerify.payload.session.user_iduser,
                        hasIduser: !!decodedWithoutVerify.payload.session.iduser,
                        hasEmail: !!decodedWithoutVerify.payload.session.email,
                        sessionKeys: Object.keys(decodedWithoutVerify.payload.session)
                    });
                }
            }
        } catch (decodeError) {
            console.log('🚫 jtwAuth: Failed to decode token for analysis - next to attempt 1:', decodeError.message);
        }

        // ✅ FIRST: Try the ORIGINAL working method (no algorithm specified)
        try {
            console.log('🔄 jtwAuth: Attempting original method (HS256 with secret)');
            const config = require("../lib/varsSpa");

            // ✅ USE THE EXACT SAME METHOD AS ORIGINAL - NO ALGORITHM SPECIFIED
            const decoded = jwt.verify(tokenValue, config.secret);
            console.log('✅ jtwAuth: Token verified with original method (HS256)');
            console.log('✅ jtwAuth: Decoded User ID:', decoded.id);
            console.log('✅ jtwAuth: Decoded Username:', decoded.username || 'N/A');

            // Use the same user verification logic as original
            User.findByPk(decoded.id).then((user) => {
                console.log('🚨 jtwAuth: User lookup result:', user ? {
                    id: user.id_user,
                    username: user.username,
                    online: user.online,
                    id_profile: user.id_profile,
                    id_cliente: user.id_cliente
                } : 'User not found');
                
                if(!user.online){
                    console.log('🚫 jtwAuth: User offline - rejecting authentication - next to attempt 1');
                    return res.status(401).send({
                        message: "Unauthorized!",
                        error: 'Invalid Token - user offline'
                    });
                };

                console.log('✅ jtwAuth: Authentication successful for user:', user.username);
                req.userId = decoded.id;
                req.user = decoded;
                return next();
            }).catch((err) => {
                console.log('🚫 jtwAuth: Database error during user lookup - next to attempt 1:', err.message);
                return res.status(401).send({
                    message: "Unauthorized!",
                    error: 'Invalid Token - database error'
                });
            });

            return; // Exit after handling the original method

        } catch (originalError) {
            console.log('🚫 jtwAuth: Original method failed - next to attempt 2:', originalError.message);
            console.log('🔄 jtwAuth: Falling back to RS256 verification');
        }

        // ✅ ONLY IF ORIGINAL METHOD FAILS, try RS256 with public key
        console.log('🔄 jtwAuth: Starting RS256 verification process');
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
                console.log('✅ jtwAuth: Loaded public key from:', keyPath);
                break;
            }
        }

        if (!publicKEY) {
            console.log('🚫 jtwAuth: Could not find RSA public key file');
            throw new Error('Could not find RSA public key file');
        }

        // ✅ TRY MULTIPLE VERIFICATION OPTIONS
        const verifyOptionsCombinations = [
            // Try without claims first (most permissive)
            {
                algorithms: ["RS256"]
            },
            // Then try with claims
            {
                issuer: "Mexipay",
                subject: "https://drakops.com.mx",
                audience: "Mexipay",
                algorithms: ["RS256"],
                allowInsecureKeySizes: true
            },
            {
                issuer: "Capapay",
                subject: "https://capapay.mx",
                audience: "Capapay",
                algorithms: ["RS256"],
                allowInsecureKeySizes: true
            }
        ];

        let decoded;
        let successfulOptions = null;
        
        console.log('🔄 jtwAuth: Trying', verifyOptionsCombinations.length, 'RS256 verification combinations');
        
        for (let i = 0; i < verifyOptionsCombinations.length; i++) {
            const options = verifyOptionsCombinations[i];
            console.log('🔄 jtwAuth: Attempting RS256 verification', i + 1, 'of', verifyOptionsCombinations.length, 'with options:', JSON.stringify(options, null, 2));
            
            try {
                decoded = jwt.verify(tokenValue, publicKEY, options);
                successfulOptions = options;
                console.log('✅ jtwAuth: Token verified with RS256 - combination', i + 1);
                console.log('✅ jtwAuth: RS256 decoded payload structure:', {
                    hasSession: !!decoded.session,
                    hasId: !!decoded.id,
                    sessionKeys: decoded.session ? Object.keys(decoded.session) : [],
                    payloadKeys: Object.keys(decoded)
                });
                break;
            } catch (e) {
                console.log('🚫 jtwAuth: RS256 verification', i + 1, 'failed - next to attempt', i + 2, ':', e.message);
                // Continue to next combination
            }
        }

        if (!decoded) {
            console.log('🚫 jtwAuth: All RS256 verification attempts failed - next to attempt FINAL');
            throw new Error('All verification attempts failed');
        }

        // Handle RS256 verified user
        const userId = decoded.session?.user_iduser || decoded.session?.iduser || decoded.id;
        console.log('🚨 jtwAuth: Extracted user ID from RS256 token:', userId);
        console.log('🚨 jtwAuth: Session UUID:', decoded.session?.uuid || 'N/A');

        if (!userId) {
            console.log('🚫 jtwAuth: No user ID found in RS256 token - next to attempt FINAL:', decoded);
            return res.status(401).send({
                message: "Unauthorized!",
                error: 'No user ID found in token'
            });
        }

        console.log('🚨 jtwAuth: Looking up user in TDM database for ID:', userId);
        
        // For RS256 tokens, look up user in TDM database instead of Gateway database
        const dbTDM = require('../../App-TDM/src/sequelize/init');
        dbTDM.user.findByPk(userId).then((user) => {
            console.log('🚨 jtwAuth: RS256 user lookup result:', user ? {
                id: user.iduser,
                username: user.email, // TDM uses email as username
                online: user.active, // TDM uses active field instead of online
                first_name: user.first_name,
                email: user.email
            } : 'User not found');
            
            if (!user) {
                console.log('🚫 jtwAuth: RS256 user not found in TDM database for ID - next to attempt FINAL:', userId);
                return res.status(401).send({
                    message: "Unauthorized!",
                    error: 'User not found'
                });
            }

            if (!user.active) {
                console.log('🚫 jtwAuth: RS256 user inactive - rejecting authentication for user - next to attempt FINAL:', user.email);
                return res.status(401).send({
                    message: "Unauthorized!",
                    error: 'Invalid Token - user inactive'
                });
            };

            req.userId = userId;
            req.user = user; // Enrich with full user model
            console.log('✅ jtwAuth: RS256 authentication successful for user:', user.email, 'ID:', userId);
            console.log('✅ jtwAuth: Session UUID:', decoded.session?.uuid);

            // Note: TDM users don't have id_cliente or id_profile, so skip auto-assignment for RS256 tokens
            // This auto-assignment only applies to Gateway users (HS256 tokens)

            return next();
        }).catch((err) => {
            console.log('🚫 jtwAuth: Database error in RS256 auth - next to attempt FINAL:', err.message);
            return res.status(401).send({
                message: "Unauthorized!",
                error: 'Database error'
            });
        });

    } catch (error) {
        console.log('🚫 jtwAuth: Final authentication error - next to attempt FINAL:', error.message);
        console.log('🚫 jtwAuth: Authentication failed for request URL:', req.originalUrl);
        console.log('🚫 jtwAuth: Client IP:', req.headers['x-forwarded-for'] || req.ip || 'unknown');

        // Enhanced debugging
        try {
            const decodedWithoutVerify = jwt.decode(tokenValue, { complete: true });
            console.log('🚨 jtwAuth: Failed token analysis:');
            console.log('🚨 jtwAuth: Header:', JSON.stringify(decodedWithoutVerify.header, null, 2));
            console.log('🚨 jtwAuth: Claims:', {
                issuer: decodedWithoutVerify.payload.iss,
                subject: decodedWithoutVerify.payload.sub,
                audience: decodedWithoutVerify.payload.aud,
                id: decodedWithoutVerify.payload.id,
                hasSession: !!decodedWithoutVerify.payload.session,
                payloadKeys: Object.keys(decodedWithoutVerify.payload)
            });
            
            if (decodedWithoutVerify.payload.session) {
                console.log('🚨 jtwAuth: Session details from failed token:', {
                    uuid: decodedWithoutVerify.payload.session.uuid,
                    user_iduser: decodedWithoutVerify.payload.session.user_iduser,
                    iduser: decodedWithoutVerify.payload.session.iduser,
                    email: decodedWithoutVerify.payload.session.email
                });
            }
        } catch (e) {
            console.log('🚫 jtwAuth: Cannot decode failed token for debugging - next to attempt FINAL:', e.message);
        }

        return res.status(401).send({
            message: "Unauthorized!",
            error: error.message
        });
    }
};

/**
 * Express middleware that requires the authenticated user to have the 'admin' role.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (role-based access control).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
isAdmin = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "admin") {
                    next();
                    return;
                }
            }
            res.status(403).send({
                message: "Require Admin Role!"
            });
            return;
        });
    });
};

/**
 * Express middleware that requires the authenticated user to have the 'moderator' role.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (role-based access control).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
isModerator = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "moderator") {
                    next();
                    return;
                }
            }
            res.status(403).send({
                message: "Require Moderator Role!"
            });
        });
    });
};

/**
 * Express middleware that requires the authenticated user to have either 'moderator' or 'admin' role.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (role-based access control).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
isModeratorOrAdmin = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "moderator") {
                    next();
                    return;
                }
                if (roles[i].name === "admin") {
                    next();
                    return;
                }
            }
            res.status(403).send({
                message: "Require Moderator or Admin Role!"
            });
        });
    });
};

/**
 * Object grouping JWT authentication and role-checking middleware.
 */
const authJwt = {
    verifyToken,
    isAdmin,
    isModerator,
    isModeratorOrAdmin
};
module.exports = authJwt;