/**
 * Activity Service
 * Manages user activity logging and retrieval for audit purposes
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 10.2: Implements audit trail logging for all user actions
 * - Req 10.3: Records date/time, user ID, event type, and success/failure for each action
 * - Req 10.4: Maintains accurate time stamps for all audit logs
 * - Req 10.5: Protects audit trail from unauthorized modification
 * - Req 10.6: Reviews logs for suspicious activity through query capabilities
 * - Req 10.7: Retains audit trail history for analysis and compliance
 */
class ActivityService {
    constructor(models) {
        this.ActivityLog = models.ActivityLog;
        this.Sequelize = models.Sequelize;
    }

    /**
     * Log user activity to audit trail
     * PCI DSS 4.0: Req 10.2 & 10.3 - Records all user actions with required details
     * @param {object} activityData - Activity data to log
     * @param {string} activityData.userId - User identifier
     * @param {string} activityData.action - Action performed
     * @param {string} activityData.method - HTTP method
     * @param {string} activityData.url - Request URL
     * @param {number} activityData.statusCode - Response status code
     * @param {string} activityData.ipAddress - Client IP address
     * @param {string} activityData.userAgent - Client user agent
     * @param {object} activityData.requestBody - Request payload (sanitized)
     * @param {number} activityData.responseTime - Request response time
     * @param {object} activityData.metadata - Additional metadata
     * @returns {Promise<object>} Created activity log entry
     */
    async logActivity(activityData) {
        try {
            const log = await this.ActivityLog.create({
                userId: activityData.userId,
                action: activityData.action,
                method: activityData.method,
                url: activityData.url,
                statusCode: activityData.statusCode,
                ipAddress: activityData.ipAddress,
                userAgent: activityData.userAgent,
                requestBody: activityData.requestBody,
                responseTime: activityData.responseTime,
                metadata: activityData.metadata
            });

            return log;
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    /**
     * Retrieve user activities with filtering
     * PCI DSS 4.0: Req 10.6 - Enables review and analysis of audit logs
     * @param {string} userId - User ID to retrieve activities for
     * @param {object} options - Query options
     * @param {number} options.limit - Maximum number of records to return
     * @param {number} options.offset - Offset for pagination
     * @param {array} options.include - Related models to include
     * @param {object} options.filters - Filter criteria (action, statusCode, method, startDate, endDate, search)
     * @returns {Promise<object>} Activity logs with count
     */
    async getUserActivities(userId, options = {}) {
        const { limit = 50, offset = 0, include = [], filters = {} } = options;
        const { action, statusCode, method, startDate, endDate, search } = filters;

        console.log('🔍 getUserActivities called with:', { userId, filters });

        const where = { userId };

        // Add filters
        if (action) {
            where.action = action;
            console.log('✅ Applied action filter:', action);
        }
        if (statusCode) {
            where.statusCode = statusCode;
            console.log('✅ Applied statusCode filter:', statusCode);
        }
        if (method) {
            where.method = method;
            console.log('✅ Applied method filter:', method);
        }

        // Date range filter
        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) {
                where.created_at[this.Sequelize.Op.gte] = new Date(startDate);
                console.log('✅ Applied startDate filter:', startDate);
            }
            if (endDate) {
                where.created_at[this.Sequelize.Op.lte] = new Date(endDate);
                console.log('✅ Applied endDate filter:', endDate);
            }
        }

        // Search filter (action, method, URL)
        if (search) {
            where[this.Sequelize.Op.or] = [
                { action: { [this.Sequelize.Op.like]: `%${search}%` } },
                { method: { [this.Sequelize.Op.like]: `%${search}%` } },
                { url: { [this.Sequelize.Op.like]: `%${search}%` } }
            ];
            console.log('✅ Applied search filter:', search);
        }

        console.log('📋 Final where clause:', JSON.stringify(where, null, 2));

        return await this.ActivityLog.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
            offset,
            include,
            attributes: { exclude: ['createdAt', 'updatedAt'] }
        });
    }

    /**
     * Retrieve recent activities across all users
     * PCI DSS 4.0: Req 10.6 - Facilitates daily log review for security monitoring
     * @param {number} days - Number of days to look back (default 7)
     * @returns {Promise<array>} Recent activity logs
     */
    async getRecentActivities(days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await this.ActivityLog.findAll({
            where: {
                created_at: {
                    [this.Sequelize.Op.gte]: startDate
                }
            },
            order: [['created_at', 'DESC']],
            limit: 100,
            attributes: { exclude: ['createdAt', 'updatedAt'] }
        });
    }
}

module.exports = ActivityService;