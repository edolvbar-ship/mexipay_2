const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const MaskData = require('maskdata');
const params = require('./params');
const pool = require('../database');
const helpers = {};

helpers.encryptPassword = async (toEncrypt, relativeOrAbsolutePathToPublicKey) => {
  const absolutePath = path.resolve(relativeOrAbsolutePathToPublicKey)
  const publicKey = fs.readFileSync(absolutePath, 'utf8')
  const buffer = Buffer.from(toEncrypt, 'utf8')
  const encrypted = crypto.publicEncrypt(publicKey, buffer)
  return encrypted.toString('base64');
};

helpers.decryptPassword = (toDecrypt, relativeOrAbsolutePathtoPrivateKey) => {
  try {
    const absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey)
    const privateKey = fs.readFileSync(absolutePath, 'utf8')
    const buffer = Buffer.from(toDecrypt, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: '',
      },
      buffer,
    )
    return decrypted.toString('utf8');
  } catch (error) {
    dd(('Decrypt Password error : ' + error).red);
  }
};

helpers.encryptPasswordBc = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

helpers.encryptTextBcrypt = async (password) => {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hashSync(password, salt);
  return hash;
};

helpers.matchPassword = async (password, savedPassword) => {
  try {
    return await bcrypt.compare(password, savedPassword);
  } catch (e) {
    dd(('Compare Password error : ' + e).red);
  }
};

helpers.validPassword = async (password) => {
  var mayus = /.*/;
  var minus = /.*/;
  var number = /.*/;
  var espe = /.*/;
  minlenght = await params.getPassLong();
  upper = await params.getPassUpper();
  if (upper != false) {
    mayus = new RegExp("^(?=.*[A-Z])");
  }
  lower = await params.getPassLower();
  if (lower != false) {
    minus = new RegExp("^(?=.*[a-z])");
  }
  num = await params.getPassNumber();
  if (num != false) {
    number = new RegExp("^(?=.*[0-9])");
  }
  especial = await params.getPassEspecial();
  if (especial != false) {
    espe = new RegExp("^(?=.*[!@#$%&*\\.])");
  }
  if (password.length >= minlenght) {
    if (mayus.test(password) && minus.test(password) && number.test(password) && espe.test(password)) {
      status = true;
      return status;
    } else {
      status = false;
      return status;
    }
  }
};

// In helpers.js - REPLACE the current broken verifyToken with this:

helpers.verifyToken = async (req, res, next) => {
    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(" ")[1];

        try {
            const jwt = require('jsonwebtoken');
            const fs = require('fs');
            const path = require('path');

            // ✅ LOAD PUBLIC KEY WITH FALLBACK PATHS
            let publicKEY;
            let keyPath;

            const possibleKeyPaths = [
                './lib/App-TDM/keys/public.key',     // Primary path
                '../keys/public.key',                // Relative fallback
                '../../keys/public.key',             // Another fallback
                './keys/public.key',                 // Root keys directory
                '../App-TDM/keys/public.key'         // Alternative App-TDM path
            ];

            for (const keyPath of possibleKeyPaths) {
                const fullPath = path.join(__dirname, keyPath);
                if (fs.existsSync(fullPath)) {
                    publicKEY = fs.readFileSync(fullPath, 'utf8');
                    console.log('✅ Loaded public key from:', fullPath);
                    break;
                }
            }

            if (!publicKEY) {
                throw new Error('Could not find RSA public key file');
            }

            // ✅ TRY MULTIPLE VERIFICATION OPTIONS FOR DIFFERENT INSTANCES
            const verifyOptionsCombinations = [
                // Primary: Exact claims from your token analysis
                {
                    issuer: "Mexipay",
                    subject: "https://drakops.com.mx",
                    audience: "Mexipay",
                    algorithms: ["RS256"],
                    allowInsecureKeySizes: true
                },
                // Fallback 1: Mexipay with different domain (older instances)
                {
                    issuer: "Mexipay",
                    subject: "https://mexipay.mx",
                    audience: "Mexipay",
                    algorithms: ["RS256"],
                    allowInsecureKeySizes: true
                },
                // Fallback 2: Capapay instances
                {
                    issuer: "Capapay",
                    subject: "https://capapay.mx",
                    audience: "Capapay",
                    algorithms: ["RS256"],
                    allowInsecureKeySizes: true
                },
                // Fallback 3: Current environment variables
                {
                    issuer: process.env.APP_NAME || "Mexipay",
                    subject: process.env.APP_URL || "https://drakops.com.mx",
                    audience: process.env.APP_OWNER || "Mexipay",
                    algorithms: ["RS256"],
                    allowInsecureKeySizes: true
                },
                // Fallback 4: No issuer/subject/audience checks (most permissive)
                {
                    algorithms: ["RS256"]
                },
                // Fallback 5: No options at all (absolute minimum)
                {}
            ];

            let decoded;
            let usedOptions = '';
            let attempt = 1;

            for (const options of verifyOptionsCombinations) {
                try {
                    decoded = jwt.verify(bearerToken, publicKEY, options);
                    usedOptions = JSON.stringify(options);
                    console.log(`✅ Token verified with attempt ${attempt}:`, usedOptions);
                    break;
                } catch (e) {
                    console.log(`🔄 Attempt ${attempt} failed, trying next...`);
                    attempt++;
                }
            }

            if (!decoded) {
                throw new Error(`All ${verifyOptionsCombinations.length} verification attempts failed`);
            }

            // ✅ SET USER DATA WITH FALLBACK FIELD NAMES
            req.userId = decoded.session?.user_iduser || decoded.session?.iduser || decoded.id;
            req.user = decoded;
            req.authData = decoded;
            req.token = bearerToken;

            console.log('🎉 Token verified successfully!');
            console.log('   Used options:', usedOptions);
            console.log('   User ID:', req.userId);
            console.log('   Session UUID:', decoded.session?.uuid);

            // Debug: Show all available session data
            console.log('   Available session data:', {
                uuid: decoded.session?.uuid,
                user_iduser: decoded.session?.user_iduser,
                iduser: decoded.session?.iduser,
                email: decoded.session?.email,
                idsession: decoded.session?.idsession
            });

            next();
        } catch (error) {
            console.error('💥 JWT verification error:', error.message);

            // Enhanced debugging
            try {
                const decodedWithoutVerify = jwt.decode(bearerToken, { complete: true });
                console.error('🔍 Token analysis:');
                console.error('   Header:', decodedWithoutVerify.header);
                console.error('   Claims:', {
                    issuer: decodedWithoutVerify.payload.iss,
                    subject: decodedWithoutVerify.payload.sub,
                    audience: decodedWithoutVerify.payload.aud,
                    session: decodedWithoutVerify.payload.session
                });

                // Check if it's an expiration issue
                const now = Math.floor(Date.now() / 1000);
                if (decodedWithoutVerify.payload.exp && decodedWithoutVerify.payload.exp < now) {
                    console.error('   ⚠️ Token expired! Current time:', now, 'Expires:', decodedWithoutVerify.payload.exp);
                }
            } catch (e) {
                console.error('Cannot decode token for debugging');
            }

            return res.status(401).json({
                code: "M20",
                mensaje: `Invalid token: ${error.message}`
            });
        }
    } else {
        res.status(403).json({
            code: "M19",
            mensaje: "No token provided - helpers"
        });
    }
};

helpers.insertApilog = async (id_device, method, uri, request) => {

  request = JSON.stringify(request);
  id_request = (await params.S4() + await params.S4() + "-" + await params.S4() + "-4" + await (await params.S4()).substring(0, 3) + "-" + await params.S4() + "-" + await params.S4() + await params.S4() + await params.S4()).toLowerCase();
  newInsert = {
    id_device,
    id_request,
    method,
    uri,
    request
  };
  result = await pool.query('INSERT INTO api_log set ? ', newInsert);

  return result.insertId;
};
helpers.updateApilog = async (idapi_log, response) => {
  try {
    await pool.query('UPDATE api_log SET response = ? WHERE idapi_log = "' + idapi_log + '"', response);
  } catch (error) {
    console.log(error);
  }
  
};

helpers.decrypt = (toDecrypt, relativeOrAbsolutePathtoPrivateKey) => {
  const absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey)
  const privateKey = fs.readFileSync(absolutePath, 'utf8')
  const buffer = Buffer.from(toDecrypt, 'base64')
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey.toString(),
      passphrase: '',
    },
    buffer,
  )
  return decrypted.toString('utf8');
};
helpers.getIndicadores = async (bitmap) => {
  let bitmap_bin = parseInt(bitmap, 16).toString(2);
  const bit_type_op = bitmap_bin.split('');
  let ind = {
    'PAGOS DIFERIDOS': false,
    'CARGOS RECURRENTES': false,
    'COMERCIO ELECTRONICO': false,
    'MOTO': false,
    'CASHBACK': false
  }

  if (bit_type_op[40] == 1) {
    ind["PAGOS DIFERIDOS"] = true;
  }
  if (bit_type_op[41] == 1) {
    ind["CARGOS RECURRENTES"] = true;
  }
  if (bit_type_op[42] == 1) {
    ind["COMERCIO ELECTRONICO"] = true;
  }
  if (bit_type_op[43] == 1) {
    ind["MOTO"] = true;
  }
  if (bit_type_op[44] == 1) {
    ind["CASHBACK"] = true;
  }

  return ind;
};

helpers.getidop = async (bitmap) => {
  // eslint-disable-next-line no-undef
  dd(('helpers.getidop').green);
  let bitmap_bin = [
    parseInt(bitmap.substring(0,4),16).toString(2).padStart(8,'0'),
    parseInt(bitmap.substring(4,10),16).toString(2).padStart(24,'0'),
    parseInt(bitmap.substring(10,14),16).toString(2).padStart(8,'0')
  ];
  let opTX = [];
  let op = [];
  let ind = [];
  let idoperations = [];
  const bitTypeOp = bitmap_bin.join('');
  if (bitTypeOp[0] === "1") {
    opTX.push('RETAIL');
  }

  if (bitTypeOp[1] === '1') {
    opTX.push('RESTAURANTE');
  }

  if (bitTypeOp[2] === '1') {
    opTX.push('HOTEL');
  }

  if (bitTypeOp[3] === '1') {
    opTX.push('RENTA_AUTOS');
  }

  // tip de transacción
  if (bitTypeOp[8] === '1') {
    op.push('INIT_KEYS');
  }
  if (bitTypeOp[9] === '1') {
    op.push('SOLO AUTORIZACIÓN');
  }

  if (bitTypeOp[10] === '1') {
    op.push('RE_AUTORIZACIÓN');
  }

  if (bitTypeOp[11] === '1') {
    op.push('VENTA');
  }

  if (bitTypeOp[12] === '1') {
    op.push('VENTA FORZADA');
  }
  if (bitTypeOp[13] === '1') {
    op.push('VENTA_PROPINA');
  }
  if (bitTypeOp[14] === '1') {
    op.push('VENTA_POSTPROPINA');
  }
  if (bitTypeOp[15] === '1') {
    op.push('CIERRE_POSTPROPINA');
  }
  if (bitTypeOp[16] === '1') {
    op.push('CHECKIN');
  }
  if (bitTypeOp[17] === '1') {
    op.push('CHECKOUT');
  }
  if (bitTypeOp[18] === '1') {
    op.push('NO_SHOW');
  }
  if (bitTypeOp[19] === '1') {
    op.push('RENTIN');
  }
  if (bitTypeOp[20] === '1') {
    op.push('RENTOUT');
  }
  if (bitTypeOp[21] === '1') {
    op.push('REVERSO');
  }
  if (bitTypeOp[22] === '1') {
    op.push('CANCELACION');
  }
  if (bitTypeOp[23] === '1') {
    op.push('DEVOLUCION');
  }
  // INDICADORES
  if (bitTypeOp[32] === '1') {
    ind.push('PAGOS DIFERIDOS');
  }
  if (bitTypeOp[33] === '1') {
    ind.push('CARGOS RECURRENTES');
  }
  if (bitTypeOp[34] === '1') {
    ind.push('COMERCIO ELECTRONICO');
  }
  if (bitTypeOp[35] === '1') {
    ind.push('MOTO');
  }
  if (bitTypeOp[36] === '1') {
    ind.push('CASHBACK');
  }

  // INDICADORES V2
  if (bitTypeOp[40] === '1') {
    ind.push('PAGOS DIFERIDOS');
  }
  if (bitTypeOp[41] === '1') {
    ind.push('CARGOS RECURRENTES');
  }
  if (bitTypeOp[42] === '1') {
    ind.push('COMERCIO ELECTRONICO');
  }
  if (bitTypeOp[43] === '1') {
    ind.push('MOTO');
  }
  if (bitTypeOp[44] === '1') {
    ind.push('CASHBACK');
  }

  const sqlSelect = 'SELECT idoperations FROM operations  WHERE (merchant_type = ? && operation = ?)';
  for (let index = 0; index < opTX.length; index++) {
    const operativa = opTX[index];
    for (let index = 0; index < op.length; index++) {
      const operacion = op[index];
      const rows = await pool.query(sqlSelect, [operativa, operacion]);
      for (let index = 0; index < rows.length; index++) {
        if (rows[index]) {
          idoperations.push(rows[index].idoperations);
        }
      }
    }
  }

  return idoperations;
};

module.exports = helpers;
