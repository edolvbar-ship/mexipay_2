/**
 * Static configuration values for the SPA backend.
 * PCI DSS 4.0: Req 3.6.1 (key management). Avoid storing secrets in source files.
 * @typedef {Object} SpaVars
 * @property {string} secret - Hardcoded SPA secret. Should be moved to an environment variable or secrets manager.
 */
const vars = {
  /** Hardcoded SPA secret used for token signing or encryption. */
  secret: 'p%YJErzmmEfX2@z#!%kBw^NsT*_e#M'
}

module.exports = vars;

