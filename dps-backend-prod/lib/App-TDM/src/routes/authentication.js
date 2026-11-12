const express = require('express');
const router = express.Router();
const pool = require('../database');
const helpers = require('../lib/helpers');
const { verifyToken } = require('../lib/helpers');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const params = require('../lib/params');
const crypto = require('crypto');
var privateKEY = fs.readFileSync('./lib/App-TDM/keys/private.key', 'utf8');
var publicKEY = fs.readFileSync('./lib/App-TDM/keys/public.key', 'utf8');
var uuid = "";
var privateKeyName = process.env.TDM_PRIVATE_KEY_NAME; //"ypc_tdm_priv.pem";
var publicKeyName = process.env.TDM_PUBLIC_KEY_NAME;
const dbTDM = require('../sequelize/init')
var moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const auth = process.env.SMPT_USER ?? '';
const smtpPass = process.env.SMPT_PASS ?? '';
const host =  process.env.SMPT_HOST ?? '';
const port = parseInt(process.env.SMPT_PORT ?? '587');
const name = process.env.SMPT_NAME ?? '';
const sender = process.env.EMAIL_SENDER ?? 'Default'

var i = process.env.APP_NAME || 'App Name'; // Issuer 
var s = process.env.APP_URL || 'App Url';       // Subject 
var a = process.env.APP_OWNER || 'App Owner'; // Audience
var signOptions = {
  issuer: i,
  subject: s,
  audience: a,
  expiresIn: '1d',
  algorithm: "RS256",
  allowInsecureKeySizes: true
};

var verifyOptions = { 
  issuer : i,
  subject: s,
  audience: a,
  maxAge: '10m',
  algorithms: ["RS256"]
};

var cron = require('node-cron');

/*cron.schedule('* * * * *', () => {
  let date = new Date()
  let day = date.getDate()
  let month = date.getMonth() + 1
  let year = date.getFullYear()
  let hora = date.getHours()
  let minutos = date.getMinutes()
  let segundos = date.getSeconds()
  if (day < 10) {
    day = "0" + day;
  }
  if (month < 10) {
    month = "0" + month;
  }
  if (hora < 10) {
    hora = "0" + hora;
  }
  if (minutos < 10) {
    minutos = "0" + minutos;
  }
  if (segundos < 10) {
    segundos = "0" + segundos;
  }

  fecha_actual = `${year}-${month}-${day} ${hora}:${minutos}:${segundos}`

  pool.query("UPDATE session SET active = '0' WHERE expire < ?", fecha_actual);

});*/
router.post("/singup", async (req, res) => {

  var privateKeyFile = 'lib/App-TDM/keys/' + privateKeyName + '.pem'
  const first_name = await helpers.decrypt(req.body.first_name, privateKeyFile);
  const last_name = await helpers.decrypt(req.body.last_name, privateKeyFile);
  const last_name2 = await helpers.decrypt(req.body.last_name2, privateKeyFile);
  const { email } = req.body;
  const password = await helpers.decryptPassword(req.body.password, privateKeyFile);
  const active = 1;
  let id_log = await helpers.insertApilog(req.body.uuid, req.method, req.originalUrl, req.body);
  const rows = await pool.query('SELECT * FROM user WHERE email = ?', [email]);
  if (rows.length > 0) {
    code = "M04";
    mensaje = "User already exists!";

    resp = {
      code,
      mensaje
    }

    respuesta = JSON.stringify(resp);
    await helpers.updateApilog(id_log, respuesta);

    res.json({
      code: "M04",
      mensaje: "User already exists!"
    });
  } else {
    validar = await helpers.validPassword(password);
    validar = true;
    if (validar != true) {
      code = "M03";
      mensaje = "User or password incorrect!";
      resp = {
        code,
        mensaje
      }
      respuesta = JSON.stringify(resp);
      await helpers.updateApilog(id_log, respuesta);
      res.json({
        code: "M03",
        mensaje: "User or password incorrect!"
      })
    } else {

      let newUser = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        last_name2: req.body.last_name2,
        email,
        password,
        active
      };


      newUser.password = crypto.createHash("sha256").update(password).digest("hex");
      newUser.password = await helpers.encryptPassword(newUser.password, 'lib/App-TDM/keys/' + publicKeyName + '.pem');
      // Saving in the Database
      result = await pool.query('INSERT INTO user SET ? ', newUser);
      user_iduser = result.insertId;
      let session = {
        user_iduser,
        email
      };
      token = jwt.sign({ session }, privateKEY, signOptions);
      code = "M00";
      mensaje = "Successful Registration!";

      resp = {
        code,
        mensaje,
        user_iduser
      }

      respuesta = JSON.stringify(resp);

      await helpers.updateApilog(id_log, respuesta);
      res.json({
        code: "M00",
        mensaje: "Successful Registration!",
        user_iduser: user_iduser,
        token: token
      });

    }
  }
});

router.post("/bcrypt", async (req, res) => {
  const { text } = req.body;
  cipher = await helpers.encryptTextBcrypt(text);
  res.json({
    result: cipher
  });
})

router.post("/singin", async (req, res) => {
  const { email } = req.body;
  const { password } = req.body;
  let uuid = "";
  const smartDevice = await dbTDM.smartDevice.findOne({
    where: {
      uuid: req.body.uuid
    }
  });

  if (smartDevice) {
    uuid = smartDevice.idsmtdevice;
  }
  const id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, req.body);

  const user = await dbTDM.user.findOne({ where: { email: email } });

  if (user == null) return sendErrorResponse(res, "M01", "Usuario no registrado");

  if (user.active == 0) return sendErrorResponse(res, "M06", "You account is not active!");

  const savedpass = helpers.decryptPassword(user.password.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');
  const validPassword = await helpers.matchPassword(savedpass, password);
  if (!validPassword) return sendErrorResponse(res, "M02", "User or password incorrect");
  const name = helpers.decrypt(user.first_name.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');

  const currentSession = await dbTDM.session.findOne({ where: { user_id: user.iduser, active: 1 } });

  if (currentSession) {
    currentSession.active = 0;
    await currentSession.save();
    // return sendErrorResponse(res, "M26", "Session already active");
  }

  const date = moment.tz(new Date(), 'America/Mexico_City').format();

  const result = await dbTDM.session.create({ user_id: user.iduser, active: 1, smart_device_idsmtdevice: smartDevice ? smartDevice.idsmtdevice : null, create_date: date, last_update: date });

  const session = {
    uuid: result.session_uuid,
    user_iduser: user.iduser,
    email,
    idsession: result.idsession
  }

  const jwtoken = jwt.sign({ session }, privateKEY, signOptions);

  const userHasSmartDevice = await dbTDM.userHasSmartDevice.findOne({ where: { user_iduser: user.iduser, smart_device_idsmtdevice: smartDevice ? smartDevice.idsmtdevice : null }, include: { required: false, model: dbTDM.smartDevice, as: 'smart_device' } })

  if (userHasSmartDevice == null) return sendSuccessResponse(res, "M05", "Successful logged on!", "1", "Dispositivo no registrado", user.iduser, jwtoken, name);

  const smartDevicehasTerminal = await dbTDM.smartDevicehasTerminalDevice.findOne({ include: { required: true, model: dbTDM.smartDevice, as: 'smart_device', where: { uuid: smartDevice.uuid } } });

  if (smartDevicehasTerminal == null) return sendSuccessResponse(res, "M05", "Successful logged on!", "2", "Terminal no registrada", user.iduser, jwtoken, name);

  return sendFinalResponse(res, user.iduser, jwtoken, name);
});

router.post("/changePass", verifyToken, async (req, res) => {
  id_log = await helpers.insertApilog(uuidv4(), req.method, req.originalUrl, JSON.stringify(req.body));
  const { iduser, newpassword } = req.body;
  
  const valido = await helpers.validPassword(newpassword);
  if (!valido) {
    const resp = {
      code: "M27",
      mensaje: "Contraseña debil."
    }
    await helpers.updateApilog(id_log, JSON.stringify(resp));
    return res.json(resp);
  }
  const rows = await pool.query('SELECT * FROM user WHERE iduser = ?', [iduser]);
    
  if (rows.length == 0) {
    const resp = {
      code: "M03",
      mensaje: "Usuario o contraseña incorrectas."
    }
    return res.json(resp);
  }
  const user = rows[0];
  
  if (user.active == 0) {
    const resp = {
      code: "M06",
      mensaje: "Tu cuenta se encuentra inactiva."
    }
    await helpers.updateApilog(id_log, JSON.stringify(resp));
    return res.json(resp);
  }
  
  const user_iduser = user.iduser;

  const savedpass = helpers.decryptPassword(user.password.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');
  const validPassword1 = await helpers.matchPassword(savedpass, oldpassword);
  
  if (!validPassword1) {
    const resp = {
      code: "M05",
      mensaje: "Actual password not matched"
    }
    await helpers.updateApilog(id_log, JSON.stringify(resp));
    return res.json(resp);
  }

  const passHass1 = crypto.createHash("sha256").update(newpassword).digest("hex");
  const passEncrypt1 = await helpers.encryptPasswordBc(passHass1);
  const rows1 = await pool.query('SELECT password FROM pwdhistory WHERE iduser = ? ', [iduser]);
  var contador = 0;
  for (var i = 0; i < rows1.length; i++) {
    valor = rows1[i];
    pass = valor.password;
    oldpass = helpers.decryptPassword(pass.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');
    validPassword2 = await helpers.matchPassword(oldpass, passEncrypt1);
    if (validPassword2 === true) {
      contador++;
    }
  }
  if (contador != 0) {
    const resp = {
      code: "M11",
      mensaje: "Password in the history"
    }
    await helpers.updateApilog(id_log, JSON.stringify(resp));
    return res.json(resp);
  }
  const updatePassword = await helpers.encryptPassword(passHass1, 'lib/App-TDM/keys/' + publicKeyName + '.pem');
  const result = await pool.query('UPDATE user SET password="' + updatePassword + '" WHERE iduser=' + iduser);
  if (result) {
    code = "M09",
      mensaje = "Password sucessfully changed",
      resp = {
        code,
        mensaje,
      }
    respuesta = JSON.stringify(resp);
    await helpers.updateApilog(id_log, respuesta);
    res.json({
      code: "M09",
      mensaje: "Password sucessfully changed"
    });
  }
});

router.post('/forgotPass', async (req, res) => {
  uuid = req.body.uuid;
  email = req.body.email;
  id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, req.body);
  let session = {
    uuid,
    email
  };
  const rows = await pool.query('SELECT * FROM user WHERE email = ?', [email]);
  if (rows.length > 0) {
    const user = rows[0];
    if (user.active != 0) {
      signOptions.expiresIn = await params.getMAxTime();
      token = jwt.sign({ session }, privateKEY, signOptions);
      const frontUrl = process.env.FRONT_URL || req.get('host');
      url = `${frontUrl}/resetPwd?tkn=${token}&type=1`;

      mensaje = await params.gethtml_message();
      text = mensaje.replace('$[text]', url);
      const transporter = nodemailer.createTransport({
        host: host, //Host
        port: port, // Port 
        secure: false,
        //requireTLS: false
        /*service: 'gmail',*/
        auth: {
          user: auth,
          pass: smtpPass
        },
        tls: {
          // do not fail on invalid certs
          rejectUnauthorized: false
        },
        name: name,
        debug: true, // show debug output
        logger: true // log information in console
      });
      // Definimos el email
      var mailOptions = {
        from: sender,
        to: email,
        subject: 'Restablecer contraseña',
        html: text
      };
      // Enviamos el email
      transporter.sendMail(mailOptions, async function (error, info) {
        if (error) {
          res.send(500, error.message);
        } else {
          code = "M24",
            mensaje = "Send Mail",
            resp = {
              code,
              mensaje
            }
          respuesta = JSON.stringify(resp);
          await helpers.updateApilog(id_log, respuesta);
          res.json({
            code: "M24",
            mensaje: "Send Mail"
          });
        }
      });
    } else {
      code = "M24",
        mensaje = "Send Mail",
        resp = {
          code,
          mensaje
        }
      respuesta = JSON.stringify(resp);
      await helpers.updateApilog(id_log, respuesta);
      res.json({
        code: "M24",
        mensaje: "Send Mail"
      });
    }
  } else {
    code = "M24",
      mensaje = "Send Mail",
      resp = {
        code,
        mensaje
      }
    respuesta = JSON.stringify(resp);
    await helpers.updateApilog(id_log, respuesta);
    res.json({
      code: "M24",
      mensaje: "Send Mail"
    });
  }

});

router.post("/logout", verifyToken, async (req, res) => {
  if (req.token == null || req.token == undefined) {
    return res.json({
      code: "M000",
      mensaje: "Successful logged off!",
    });
  }
  const payload = jwt.verify(req.token, publicKEY, { ignoreExpiration: true });
  const idSession = payload.session.idsession;
  const uuid = payload.session.uuid;

  const currentSession = await dbTDM.session.findOne({ where: { session_uuid: uuid, idsession: idSession } });

  if (currentSession === null) {
    id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, req.body);
    //pool.query('UPDATE session set active = 0 WHERE uuid = "' + uuid + '" AND active = 1')
    code = "M07",
      mensaje = "Invalid token",
      resp = {
        code,
        mensaje
      }
    respuesta = JSON.stringify(resp);
    await helpers.updateApilog(id_log, respuesta);
    return res.json({
      code: "M000",
      mensaje: "Successful logged off!",
    });
  }
  currentSession.active = 0;
  currentSession.save();
  id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, req.body);
  code = "M27",
    mensaje = "Successful logged off!",
    Maxtime = await params.getsession_exp();
  resp = {
    code,
    mensaje,
  }
  respuesta = JSON.stringify(resp);
  await helpers.updateApilog(id_log, respuesta);
  return res.json({
    code: "M000",
    mensaje: "Successful logged off!",
  });
});

async function sendErrorResponse(res, code, mensaje) {
  resp = {
    code,
    mensaje
  }
  respuesta = JSON.stringify(resp);
  res.json({
    code: code,
    mensaje: mensaje
  });
}

async function sendSuccessResponse(res, code, mensaje, codeAlert, alerta, user_id, token, name) {
  const maxTime = await params.getsession_exp();
  code = code;
  mensaje = mensaje;
  code_alert = codeAlert;
  alerta = alerta;
  user_iduser = user_id;
  resp = {
    code,
    mensaje,
    code_alert,
    alerta,
    user_iduser,
    maxTime,
    token,
    username: name
  }
  respuesta = JSON.stringify(resp);
  res.json({
    code: code,
    mensaje: mensaje,
    code_alert: code_alert,
    alerta: alerta,
    iduser: user_iduser,
    Maxtime: maxTime,
    token: token,
    username: name
  });
}

async function sendFinalResponse(res, user_id, token, name) {
  res.json({
    code: "M05",
    mensaje: "Successful logged on!",
    iduser: user_id,
    token: token,
    username: name
  })
}

// resetPasswordTDM
router.post('/resetPass1/:id', async (req, res) => {
  verifyOptions.maxAge = await params.getMAxTime();
  const token = req.params.id;
  let id_log = 0;
  
  jwt.verify(token, publicKEY, verifyOptions, async (error, authData) => {
    if (error) {
      uuid = req.headers['uuid'];
      id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, JSON.stringify(token));
      code = "M07",
        mensaje = "Invalid token",
        resp = {
          code,
          mensaje
        }
      respuesta = JSON.stringify(resp);
      await helpers.updateApilog(id_log, respuesta);
      return res.json(resp);

    } else {

      if (req.body.pass == req.body.pass1) {
        id_log = await helpers.insertApilog(authData.session.uuid, req.method, req.originalUrl, req.body);
        password = req.body.pass;
        email = authData.session.email;
        const rows = await pool.query('SELECT * FROM user WHERE email = ?', email);
        if (rows.length > 0) {
          user = rows[0];
        }
        iduser = user.iduser;
        validar = await helpers.validPassword(password);
        if (validar != true) {
          code = "M03",
            mensaje = "User or password incorrect!",
            resp = {
              code,
              mensaje
            }
          respuesta = JSON.stringify(resp);
          await helpers.updateApilog(id_log, respuesta);
          return res.json(resp);
        } else {
          
          passHass1 = crypto.createHash("sha256").update(password).digest("hex");
          passEncrypt1 = await helpers.encryptPasswordBc(passHass1);
          savedpass = helpers.decryptPassword(user.password.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');
          validPassword2 = await helpers.matchPassword(savedpass, passEncrypt1);
          if (validPassword2 != true) {
            const rows1 = await pool.query('SELECT password FROM pwdhistory WHERE iduser = ? ', [iduser]);
            contador = 0;
            for (var i = 0; i < rows1.length; i++) {
              valor = rows1[i];
              pass = valor.password;
              oldpass = helpers.decryptPassword(pass.toString(), 'lib/App-TDM/keys/' + privateKeyName + '.pem');
              validPassword3 = await helpers.matchPassword(oldpass, passEncrypt1);
              if (validPassword3 === true) {
                contador++;
              }
            }
            if (contador != 0) {
              code = "M11",
                mensaje = "Esta contraseña ya fue utilizada anteriormente.",
                resp = {
                  code,
                  mensaje
                }
              respuesta = JSON.stringify(resp);
              await helpers.updateApilog(id_log, respuesta);
              return res.json(resp);

            } else {
              const namePublicKey = process.env.TDM_PUBLIC_KEY_NAME + '.pem';
              updatePassword = await helpers.encryptPassword(passHass1, 'lib/App-TDM/keys/' + namePublicKey);
              const result = await pool.query('UPDATE user SET password="' + updatePassword + '" WHERE iduser=' + iduser);
              code = "M09";
              mensaje = "Contraseña actualizada correctamente.";
              resp = {
                code,
                mensaje,
              }
              respuesta = JSON.stringify(resp);
              await helpers.updateApilog(id_log, respuesta);
              return res.json(resp);
            }
          } else {
            code = "M11",
              mensaje = "Contraseña ya se encuentra en el historial",
              resp = {
                code,
                mensaje
              }
            respuesta = JSON.stringify(resp);
            await helpers.updateApilog(id_log, respuesta);
            return res.json(resp);
          }
        }
      } else {
        code = "M05",
          mensaje = "Las contraseñas no coinciden",
          resp = {
            code,
            mensaje
          }
        respuesta = JSON.stringify(resp);
        await helpers.updateApilog(id_log, respuesta);

        // TODO:: cambiar a json.
        return res.json(resp);

        // req.flash('message', code + " " + mensaje);
        // res.redirect('/tdm/api/v1/user/resetPass/' + token);
      }
    }
  });


});


module.exports = router;