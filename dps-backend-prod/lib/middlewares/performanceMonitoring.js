/**
 * Performance Monitoring Middleware
 * Automatically tracks API response times and request counts
 */

const monitoringService = require('../services/monitoringService');

function performanceMonitoring(req, res, next) {
    const startTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to capture response time
    res.end = function(...args) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Extract endpoint information
        const endpoint = req.route ? req.route.path : req.path || 'unknown';
        const method = req.method || 'unknown';
        const statusCode = res.statusCode || 500;
        
        // Track performance metrics
        monitoringService.trackApiPerformance(endpoint, method, responseTime, statusCode);
        
        // Add X-Ray annotations if enabled
        if (process.env.ENABLE_XRAY === 'true') {
            monitoringService.addXRayAnnotation('http.method', method);
            monitoringService.addXRayAnnotation('http.status_code', statusCode);
            monitoringService.addXRayAnnotation('http.response_time', responseTime);
            monitoringService.addXRayMetadata('endpoint', endpoint);
        }
        
        // Call original end function
        originalEnd.apply(this, args);
    };
    
    next();
}

module.exports = performanceMonitoring;
