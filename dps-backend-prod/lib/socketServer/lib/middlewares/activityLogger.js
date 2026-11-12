/**
 * Express middleware factory that logs user activity asynchronously after the response completes.
 * Sanitizes password and token fields before persistence.
 * PCI DSS 4.0: Req 10.2.1 / 10.2.2 / 10.3.1 (audit logging), Req 3.3 / 3.4 (sensitive data protection).
 * @param {Object} db - Database/Sequelize instance with activityLog model.
 * @returns {Function} Express middleware.
 */
const activityLogger = (db) => {
    return (req, res, next) => {
        // Skip if user not authenticated - support both Gateway and TDM auth patterns
        const userId = req.user?.id || req.userId || req.authData?.session?.user_iduser || req.authData?.session?.iduser;
        if (!userId) {
            return next();
        }

        const startTime = Date.now();

        // Store the original end method
        const originalEnd = res.end;

        // Override res.end to capture when response is done
        res.end = function(chunk, encoding) {
            // Restore original end method
            res.end = originalEnd;

            // Call original end first
            res.end(chunk, encoding);

            // Then log the activity ASYNCHRONOUSLY without blocking
            setTimeout(async () => {
                try {
                    const action = getActionFromRoute(req.method, req.path);

                    const requestBody = { ...req.body };
                    if (requestBody.password) delete requestBody.password;
                    if (requestBody.token) delete requestBody.token;
                    if (requestBody.refreshToken) delete requestBody.refreshToken;

                    await db.activityLog.create({
                        userId: userId,
                        action,
                        method: req.method,
                        url: req.originalUrl || req.url,
                        statusCode: res.statusCode,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.get('User-Agent'),
                        requestBody: Object.keys(requestBody).length > 0 ? requestBody : null,
                        responseTime: Date.now() - startTime,
                        metadata: {
                            params: req.params,
                            query: req.query,
                            authType: req.user?.id ? 'gateway' : 'tdm',
                            sessionId: req.authData?.session?.uuid
                        }
                    });
                } catch (error) {
                    console.error('Activity logging error:', error);
                    // DON'T throw or send response here - the request already completed
                }
            }, 0);
        };

        next();
    };
};

/**
 * Derives a readable action name from the HTTP method and request path.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @returns {string} Action label like CREATE_USERS, VIEW_REPORTS, etc.
 */
function getActionFromRoute(method, path) {
    const basePath = path.split('/')[1] || 'unknown';
    const actionMap = {
        GET: 'VIEW', POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE'
    };
    const action = actionMap[method] || 'ACCESS';
    return `${action}_${basePath.toUpperCase()}`;
}

module.exports = activityLogger;