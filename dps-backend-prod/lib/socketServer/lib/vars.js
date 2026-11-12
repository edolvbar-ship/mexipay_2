/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * This file contains configuration constants for tax and fee calculations.
 * 
 * 1.1 - Network Security Controls:
 * - Not applicable (configuration constants only)
 * 
 * 2.2.1 - Custom Software Development:
 * - Configuration constants for business logic
 * - Hardcoded values (should be environment-based for flexibility)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - No cardholder data handling
 * 
 * 4.1 - Use Strong Cryptography:
 * - Not applicable (no cryptographic operations)
 * 
 * 6.2.3 - Protect Remote Access:
 * - Not applicable (configuration constants only)
 * 
 * 8.2.1 - Identification and Authentication:
 * - Not applicable (configuration constants only)
 * 
 * 8.3.1 - Access Control:
 * - Not applicable (configuration constants only)
 * 
 * 10.2.1 - Audit Trail:
 * - No audit logging
 * 
 * 10.2.2 - Audit Log Retention:
 * - Not applicable
 * 
 * 10.2.3 - Audit Trail Review:
 * - Not applicable
 * 
 * 11.3.1 - Periodic Testing:
 * - Not applicable
 * 
 * 12.3.1 - Vulnerability Management:
 * - Not applicable
 */

// Export configuration constants for tax and fee calculations
module.exports = {
  iva:        .16,        // IVA (Value Added Tax) rate - 16%
  mphs_val:   .03,        // MPHS variable fee rate - 3%
  mphs_fijo:  0           // MPHS fixed fee amount - 0
}