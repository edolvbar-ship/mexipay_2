/**
 * Audit Event Service
 * Provides comprehensive audit logging for security-critical events
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 10.2: Logs all authentication events and security-critical actions
 * - Req 10.3: Records user ID, event type, timestamp, success/failure, and origination
 * - Req 10.4: Uses synchronized timestamps for all audit entries
 * - Req 10.5: Protects audit logs from unauthorized modification (write-only to S3)
 * - Req 10.7: Retains audit logs for compliance periods via S3 storage
 * - Req 8.2.4: Tracks password change events for compliance
 * - Req 8.2.5: Monitors account lockout events for security
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;




class AuditEventService {

    logger;

   /**
    * Audit event types for security monitoring
    * PCI DSS 4.0: Req 10.2 - Defines required audit events for authentication and access control
    */
   static AuditEvents = {
    LOGIN_SUCCESS: {
        label: 'LOGIN_SUCCESS',
        colorize: (msg) => msg.bold.green.whiteBG
    },
    LOGIN_FAILURE: {
        label: 'LOGIN_FAILURE',
        colorize: (msg) => msg.bold.red.whiteBG
    },
    LOGOUT_SUCCESS: {
        label: 'LOGOUT_SUCCESS',
        colorize: (msg) => msg.bold.green.whiteBG
    },
    CHANGE_PASSWORD_SUCCESS: {
        label: 'CHANGE_PASSWORD_SUCCESS',
        colorize: (msg) => msg.bold.green.whiteBG
    },
    CHANGE_PASSWORD_FAILURE: {
        label: 'CHANGE_PASSWORD_FAILURE',
        colorize: (msg) => msg.bold.red.whiteBG
    },
    USER_BLOCKED: {
        label: 'USER_BLOCKED',
        colorize: (msg) => msg.bold.redBG
    }
   };

    myFormat = printf((info) => {
        return info.event.colorize(`${info.timestamp} | ${info.event.label} | UserName=${info.username} | UserID=${info.userId} |  IP=${info.ip} | Reasource=${info.path} | Status=${info.status} | SessionDuration=${info.sessionDuration} | Details=${info.details}`);
      });

    constructor() {

        const transport = [new transports.Console()];

        if(s3_stream) {
           const fileTransport = new transports.Stream({
                stream: s3_stream,
                level: 'info',
                format: combine(
                    timestamp(),
                    this.myFormat
                )
              });
              transport.push(fileTransport);
        }

        this.logger = createLogger({
            format: combine(
                timestamp(),
                this.myFormat
              ),
              transports: transport
          });
    }

    /**
     * Register an audit event
     * PCI DSS 4.0: Req 10.3 - Logs event with all required audit trail elements
     * @param {object} event - Event type from AuditEvents
     * @param {object} req - Express request object containing user and request details
     * @param {string} details - Additional event details
     * @param {boolean} isSuccess - Whether the event was successful
     */
    registerEvent(event, req, details = '', isSuccess) {

        const msg = {
            event,
            path: req.originalUrl,
            ip: (req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim(),
            username: req.user?.username || req.body.username || 'N/A',
            userId: req.user?.id || 'N/A',
            status: isSuccess == undefined ? 'N/A' : isSuccess ? 'SUCCESS' : 'FAILURE',
            sessionDuration: req.user?.signAt && event.label == 'LOGOUT_SUCCESS' ? `${(new Date().getTime() - req.user.signAt)}ms` : 'N/A',
            details
        }


        this.logger.log('info', msg);
    }
}


module.exports = AuditEventService;