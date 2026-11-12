/**
 * User Activity Logger Controller
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 10.2.1: Implement audit trails to reconstruct the sequence of events for each system component
 * - Requirement 10.2.2: Audit trails must include user identification, type of event, and timestamps
 * - Requirement 10.2.3: Limit retention time for audit trail data to that which is needed for business, legal, or regulatory purposes
 * - Requirement 10.2.5: Secure audit trails so they cannot be altered
 * - Requirement 8.1.1: Identify all users before granting access to system components
 */

const { activityLog: ActivityLog, users: User } = require('../sequelize/init');
const ActivityService = require('../services/activityService');

const activityService = new ActivityService({ ActivityLog, User, Sequelize: require('sequelize') });

console.log('🚀 userActivityLogger.controller loaded');

const activityController = {
    /**
     * Get user activities with filtering
     * PCI DSS 4 Requirement 10.2.1: Implements audit trail for user activities
     * PCI DSS 4 Requirement 8.1.1: Verifies user authentication before granting access
     */
    async getUserActivities(req, res) {
        try {
            // PCI DSS 4 Requirement 10.2.1: Audit trail - log activity access request
            console.log('🎯 Controller getUserActivities called with query:', req.query);
            
            // PCI DSS 4 Requirement 8.1.1: User authentication required
            if (!req.user || !req.user.id) { // Match users table primary key
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized: User not authenticated'
                });
            }

            // PCI DSS 4 Requirement 10.2.1: Audit trail - parse and log filter parameters
            const { 
                limit = 50, 
                offset = 0,
                action,
                statusCode,
                method,
                startDate,
                endDate,
                search
            } = req.query;

            console.log('📋 Parsed parameters:', { 
                limit, offset, action, statusCode, method, startDate, endDate, search,
                userId: req.user.id 
            });

            // PCI DSS 4 Requirement 7.1.1: User can only view their own activities
            // PCI DSS 4 Requirement 3.5.1: Limit user data to non-sensitive fields only
            const activities = await activityService.getUserActivities(req.user.id, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                include: [{ model: User, as: 'user', attributes: ['id_user', 'mail', 'name'] }],
                filters: {
                    action,
                    statusCode: statusCode ? parseInt(statusCode) : undefined,
                    method,
                    startDate,
                    endDate,
                    search
                }
            });

            res.json({
                success: true,
                data: activities.rows,
                total: activities.count
            });
        } catch (error) {
            // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
            console.error('Error fetching user activities:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch activities'
            });
        }
    },

    /**
     * Get recent activities within specified time period
     * PCI DSS 4 Requirement 10.2.1: Implements audit trail for recent activities
     * PCI DSS 4 Requirement 8.1.1: Verifies user authentication before granting access
     */
    async getRecentActivities(req, res) {
        try {
            // PCI DSS 4 Requirement 8.1.1: User authentication required
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized: User not authenticated'
                });
            }

            const { days = 7 } = req.query;

            const activities = await activityService.getRecentActivities(days);

            res.json({
                success: true,
                data: activities
            });
        } catch (error) {
            console.error('Error fetching recent activities:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recent activities'
            });
        }
    },

    /**
     * Get all activities (admin only)
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for all system activities
     * PCI DSS 4 Requirement 8.1.1: Verifies user authentication before granting access
     * PCI DSS 4 Requirement 7.1.1: Restricts access to admin users only (role-based access control)
     */
    async getAllActivities(req, res) {
        try {
            // PCI DSS 4 Requirement 8.1.1: User authentication required
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized: User not authenticated'
                });
            }

            // PCI DSS 4 Requirement 7.1.1: Admin-only access control
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // PCI DSS 4 Requirement 10.2.1: Audit trail - log pagination and filter parameters
            const { page = 1, limit = 50, userId, action } = req.query;
            const offset = (page - 1) * limit;

            // PCI DSS 4 Requirement 10.2.1: Audit trail - apply filters for monitoring
            const where = {};
            if (userId) where.userId = userId;
            if (action) where.action = action;

            // PCI DSS 4 Requirement 10.2.2: Audit trail includes user identification and timestamps
            // PCI DSS 4 Requirement 7.1.1: User data limited to non-sensitive fields only
            const activities = await ActivityLog.findAndCountAll({
                where, // Use filtered where object
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id_user', 'mail', 'name']
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: { exclude: ['createdAt', 'updatedAt'] }
            });

            res.json({
                success: true,
                data: activities.rows,
                total: activities.count,
                page: parseInt(page),
                totalPages: Math.ceil(activities.count / limit)
            });
        } catch (error) {
            // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
            console.error('Error fetching all activities:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch activities'
            });
        }
    }
};

module.exports = activityController;