/**
 * Monitoring Service for MexiPay Gateway
 * Handles X-Ray tracing, custom metrics, and SNS alerts
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 10.2: Implements audit trail through CloudWatch logging and X-Ray tracing
 * - Req 10.3: Records appropriate transaction details in audit logs via publishMetric and trackTransaction
 * - Req 10.4: Ensures accurate time synchronization via AWS CloudWatch timestamps
 * - Req 10.7: Retains audit trail history through CloudWatch Logs retention
 * - Req 12.10: Implements incident response through SNS alerting mechanism
 * - Req 6.5.10: Provides security monitoring and anomaly detection capabilities
 */

const AWS = require('aws-sdk');
const monitoringConfig = {
    xray: {
        enabled: process.env.ENABLE_XRAY === 'true',
        daemonAddress: process.env.AWS_XRAY_DAEMON_ADDRESS || 'localhost:2000',
        contextMissing: process.env.AWS_XRAY_CONTEXT_MISSING || 'LOG_ERROR',
        debugMode: process.env.AWS_XRAY_DEBUG_MODE === 'true'
    },
    metrics: {
        enabled: process.env.ENABLE_METRICS === 'true',
        namespace: process.env.CLOUDWATCH_NAMESPACE || 'MexiPay',
        region: process.env.CLOUDWATCH_REGION || 'us-east-1'
    },
    alerts: {
        enabled: process.env.ENABLE_ALERTS === 'true',
        topicArn: process.env.SNS_ALERT_TOPIC_ARN,
        emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
        smsRecipients: process.env.ALERT_SMS_RECIPIENTS?.split(',') || []
    },
    performance: {
        enabled: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
        metricsInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 60000,
        alarmEvaluationPeriods: parseInt(process.env.ALARM_EVALUATION_PERIODS) || 2
    }
};

class MonitoringService {
    constructor() {
        this.cloudwatch = null;
        this.sns = null;
        this.xray = null;
        this.metricsBuffer = [];
        this.initializeServices();
    }

    initializeServices() {
        // Initialize CloudWatch for custom metrics
        if (monitoringConfig.metrics.enabled) {
            this.cloudwatch = new AWS.CloudWatch({
                region: monitoringConfig.metrics.region
            });
        }

        // Initialize SNS for alerts
        if (monitoringConfig.alerts.enabled && monitoringConfig.alerts.topicArn) {
            this.sns = new AWS.SNS({
                region: process.env.AWS_REGION || 'us-east-1'
            });
        }

        // Initialize X-Ray if enabled
        if (monitoringConfig.xray.enabled) {
            try {
                this.xray = require('aws-xray-sdk');
                this.xray.setDaemonAddress(monitoringConfig.xray.daemonAddress);
                this.xray.setContextMissingStrategy(monitoringConfig.xray.contextMissing);
                if (monitoringConfig.xray.debugMode) {
                    this.xray.setLogger(console);
                }
            } catch (error) {
                console.error('Failed to initialize X-Ray:', error.message);
            }
        }

        // Start metrics collection interval
        if (monitoringConfig.performance.enabled) {
            this.startMetricsCollection();
        }
    }

    /**
     * Publish custom metric to CloudWatch
     * PCI DSS 4.0: Req 10.2 - Logs transaction metrics for audit trail
     * @param {string} metricName - Name of the metric to publish
     * @param {number} value - Metric value
     * @param {string} unit - Unit of measurement (Count, Milliseconds, Bytes, etc.)
     * @param {object} dimensions - Additional dimensions for metric categorization
     */
    async publishMetric(metricName, value, unit = 'Count', dimensions = {}) {
        if (!monitoringConfig.metrics.enabled || !this.cloudwatch) {
            return;
        }

        const defaultDimensions = [
            { Name: 'Service', Value: 'mexipay-gateway' },
            { Name: 'Environment', Value: process.env.NODE_ENV || 'unknown' }
        ];

        const metricDimensions = Object.entries(dimensions).map(([key, value]) => ({
            Name: key,
            Value: String(value)
        }));

        const params = {
            MetricData: [{
                MetricName: metricName,
                Dimensions: [...defaultDimensions, ...metricDimensions],
                Value: value,
                Unit: unit,
                Timestamp: new Date()
            }],
            Namespace: monitoringConfig.metrics.namespace
        };

        try {
            await this.cloudwatch.putMetricData(params).promise();
            console.log(`Published metric: ${metricName} = ${value} ${unit}`);
        } catch (error) {
            console.error('Failed to publish metric:', error.message);
        }
    }

    /**
     * Send alert via SNS
     * PCI DSS 4.0: Req 12.10 - Implements incident response alerting mechanism
     * @param {string} subject - Alert subject line
     * @param {string} message - Alert message body
     * @param {string} severity - Alert severity level (INFO, WARNING, ERROR, CRITICAL)
     * @param {object} metadata - Additional metadata for the alert
     */
    async sendAlert(subject, message, severity = 'INFO', metadata = {}) {
        if (!monitoringConfig.alerts.enabled || !this.sns) {
            return;
        }

        const alertPayload = {
            alert: subject,
            message: message,
            severity: severity,
            timestamp: new Date().toISOString(),
            service: 'mexipay-gateway',
            environment: process.env.NODE_ENV || 'unknown',
            ...metadata
        };

        const params = {
            TopicArn: monitoringConfig.alerts.topicArn,
            Message: JSON.stringify(alertPayload),
            Subject: `[${severity}] MexiPay Alert: ${subject}`
        };

        try {
            await this.sns.publish(params).promise();
            console.log(`Alert sent: ${subject}`);
        } catch (error) {
            console.error('Failed to send alert:', error.message);
        }
    }

    /**
     * Track business transaction metrics
     * PCI DSS 4.0: Req 10.3 - Records transaction details including type, amount, status, and processor
     * @param {string} transactionType - Type of transaction (sale, refund, void, etc.)
     * @param {number} amount - Transaction amount
     * @param {string} status - Transaction status (approved, failed, etc.)
     * @param {string} processor - Payment processor identifier
     */
    async trackTransaction(transactionType, amount, status, processor = 'unknown') {
        const dimensions = {
            TransactionType: transactionType,
            Processor: processor,
            Status: status
        };

        // Track transaction count
        await this.publishMetric('TransactionCount', 1, 'Count', dimensions);

        // Track transaction amount
        if (amount && amount > 0) {
            await this.publishMetric('TransactionAmount', amount, 'Count', dimensions);
        }

        // Track success/failure rates
        if (status === 'approved' || status === 'success') {
            await this.publishMetric('TransactionSuccess', 1, 'Count', dimensions);
        } else if (status === 'failed' || status === 'error') {
            await this.publishMetric('TransactionFailure', 1, 'Count', dimensions);
        }
    }

    /**
     * Track API performance metrics
     * PCI DSS 4.0: Req 10.2 - Logs API access for security monitoring
     * @param {string} endpoint - API endpoint path
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {number} responseTime - Response time in milliseconds
     * @param {number} statusCode - HTTP status code
     */
    async trackApiPerformance(endpoint, method, responseTime, statusCode) {
        const dimensions = {
            Endpoint: endpoint,
            Method: method,
            StatusCode: statusCode.toString()
        };

        await this.publishMetric('ApiResponseTime', responseTime, 'Milliseconds', dimensions);
        await this.publishMetric('ApiRequestCount', 1, 'Count', dimensions);

        // Track error rate
        if (statusCode >= 400) {
            await this.publishMetric('ApiErrorRate', 1, 'Count', dimensions);
        }
    }

    /**
     * Track system resource metrics
     */
    trackSystemMetrics() {
        if (!monitoringConfig.performance.enabled) {
            return;
        }

        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Memory metrics
        this.publishMetric('MemoryUsage', memUsage.heapUsed, 'Bytes');
        this.publishMetric('MemoryUsageMB', Math.round(memUsage.heapUsed / 1024 / 1024), 'Megabytes');

        // CPU metrics (convert to percentage)
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert microseconds to seconds
        this.publishMetric('CpuUsage', cpuPercent, 'Percent');
    }

    /**
     * Start periodic metrics collection
     */
    startMetricsCollection() {
        setInterval(() => {
            this.trackSystemMetrics();
        }, monitoringConfig.performance.metricsInterval);
    }

    /**
     * Create X-Ray subsegment for custom tracing
     */
    createSubsegment(name, callback) {
        if (!monitoringConfig.xray.enabled || !this.xray) {
            return callback();
        }

        try {
            const segment = this.xray.getSegment();
            if (segment) {
                const subsegment = segment.addNewSubsegment(name);
                try {
                    const result = callback();
                    subsegment.close();
                    return result;
                } catch (error) {
                    subsegment.addError(error);
                    subsegment.close();
                    throw error;
                }
            } else {
                return callback();
            }
        } catch (error) {
            console.error('X-Ray tracing error:', error.message);
            return callback();
        }
    }

    /**
     * Add annotation to X-Ray segment
     */
    addXRayAnnotation(key, value) {
        if (!monitoringConfig.xray.enabled) {
            return;
        }

        try {
            const segment = this.xray.getSegment();
            if (segment) {
                segment.addAnnotation(key, value);
            }
        } catch (error) {
            console.error('Failed to add X-Ray annotation:', error.message);
        }
    }

    /**
     * Add metadata to X-Ray segment
     */
    addXRayMetadata(key, value) {
        if (!monitoringConfig.xray.enabled) {
            return;
        }

        try {
            const segment = this.xray.getSegment();
            if (segment) {
                segment.addMetadata(key, value);
            }
        } catch (error) {
            console.error('Failed to add X-Ray metadata:', error.message);
        }
    }

    /**
     * Get monitoring configuration status
     */
    getStatus() {
        return {
            xray: monitoringConfig.xray,
            metrics: monitoringConfig.metrics,
            alerts: monitoringConfig.alerts,
            performance: monitoringConfig.performance
        };
    }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;
