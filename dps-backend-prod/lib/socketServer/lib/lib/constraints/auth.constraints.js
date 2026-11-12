/**
 * Authentication-related constraints and configuration constants.
 * PCI DSS 4.0: Req 8.2.3 (session/token lifetime), Req 2.1.1 (secure configuration).
 */
const AUTH_CONSTRAINTS = {
  /** Token/session expiration time in milliseconds (900 seconds). */
  expirationTime: 900000
}

module.exports = AUTH_CONSTRAINTS;