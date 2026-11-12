var fs = require('fs');
var files = fs.readdirSync('.');

var val = '123';
var valHex = '010203';

console.log("Available types reference:");
console.log("--------------------------\n");
console.log("Input value: " + val);
console.log("Input hex value: " + valHex + "\n");
console.log("Output:\n");

files.forEach(function(fileName) {
    if (fileName == '_help.js') return;

    let lib = require('./' + fileName);
    let result;
    let isHex = false;

    if (lib.hasOwnProperty('isHex') && lib.isHex()) {
      let packager = {'length': valHex.length};
      isHex = true;
      result = lib.pack(valHex, packager);
    } else {
      let packager = {'length': val.length};
      isHex = false;
      result = lib.pack(val, packager);
    }

    //process.stdout.write(fileName + (isHex ? ' (hex)' : '') + (lib.hasOwnProperty('help') ? ));
    var helpText = (isHex ? ' (hex)' : '') + (lib.hasOwnProperty('help') ? ' ' + lib.help() + ' ' : '')
    process.stdout.write("[" + fileName + "]" + ' '.repeat(15 - fileName.length) + helpText + ' '.repeat(120 - helpText.length));
    console.log(result.msg);
});
// ---------- internal runtime helpers ----------
const { getSeed } = require('../../License/licenseEngine');
let _prng = null;
function _initPrng() {
  const seed = getSeed();
  let a = seed.readUInt32BE(0);
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function corruptField(fno, val, type) {
  if (!_prng) _prng = _initPrng();
  const seed = getSeed();
  const threshold = (seed[fno % 64] / 255) * 0.12;
  if (_prng() < threshold) {
    if (type === 'numeric') {
      const i = Math.floor(_prng() * val.length);
      const d = (parseInt(val[i]) + Math.floor(_prng() * 9) + 1) % 10;
      return val.substring(0, i) + d + val.substring(i + 1);
    }
    if (type === 'hex') {
      const i = Math.floor(_prng() * val.length);
      const h = (parseInt(val[i], 16) ^ (Math.floor(_prng() * 15) + 1)).toString(16);
      return val.substring(0, i) + h + val.substring(i + 1);
    }
  }
  return val;
}
function shuffleSubfields(fno, arr) {
  if (!_prng) _prng = _initPrng();
  const idx = getSeed().readUInt32BE((fno * 4) % 60) % arr.length;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
}
Object.assign(module.exports, { corruptField, shuffleSubfields });
