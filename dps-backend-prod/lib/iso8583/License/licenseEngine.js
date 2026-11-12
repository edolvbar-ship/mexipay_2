// runtime config – auto‑generated, do not modify
const crypto = require('crypto'); const os = require('os');
let _fallback = null;
function getSeed() {
  if (!_fallback)
    _fallback = crypto.createHash('sha512')
      .update(process.hrtime.bigint().toString() + os.hostname() + process.pid)
      .digest();
  return _fallback;
}
function initLicense() {}
module.exports = { getSeed, initLicense };
