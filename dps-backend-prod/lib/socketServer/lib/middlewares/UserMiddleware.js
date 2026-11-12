const path = require('path');

const out = {};

/**
 * Express middleware that blocks directory traversal attempts in the URL.
 * PCI DSS 4.0: Req 6.5.1 / 6.5.2 (secure coding / input validation), Req 11.4.6 (attack prevention).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
out.directoryTrans = (req, res, next) => {
  // eslint-disable-next-line no-undef
  dd(('UserMiddleware.out').green);
  const decoded = decodeURIComponent(req.url);
  if (decoded !== path.join('/', decoded)) {
    return res.status(403).type('text/plain').end('403 Forbidden');
  }
  
  return next();
};

module.exports = out;
