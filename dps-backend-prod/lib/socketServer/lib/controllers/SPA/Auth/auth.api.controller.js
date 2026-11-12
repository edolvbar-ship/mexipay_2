const authApiCtrl = {};
const jwt = require("jsonwebtoken");
const crypto = require('crypto');

const mailService = require('../../../services/mail.service');
const { generatePassword } = require('../../../services/general.service');

const db      = require('../../../sequelize/init');
const pool    = require("../../../database");
const helpers = require("../../../lib/helpers");

const Help = require('./../../../../../helpers/lib/helpers');

const vars    = require('../../../lib/varsSpa');
const AUTH_CONSTRAINTS = require('../../../lib/constraints/auth.constraints')

const express = require('express');
const path = require('path');
const AuditEventService = require("../../../services/audit.service");
const {LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT_SUCCESS, CHANGE_PASSWORD_FAILURE, CHANGE_PASSWORD_SUCCESS, USER_BLOCKED} = AuditEventService.AuditEvents;
const app = express();
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

const auditService = new AuditEventService();

authApiCtrl.signIn = async (req,res,next) => {
  
  const userValidation = await authApiCtrl.fnsignin(req,res,next)

  req.user = userValidation.data;

  if( userValidation.success ){

    const user = userValidation.data
    
    const  token = jwt.sign(user, vars.secret, {
      expiresIn: AUTH_CONSTRAINTS.expirationTime // 24 hours
    })

    auditService.registerEvent(LOGIN_SUCCESS, req, userValidation.message, true);

    return res.json({
      user,
      token
    })
    
  }

  auditService.registerEvent(LOGIN_FAILURE, req, userValidation.message, false);

  return res.status(401).json({
    error: true,
    text: userValidation.message
  })
}

authApiCtrl.fnsignin = async (req) => {
    
  const username = req.body.username; 
  const password = req.body.password; 
  const rows = await pool.query("SELECT users.*, p.deleted_at as 'profile_deleted' FROM users JOIN user_profile as p ON p.id_profile = users.id_profile WHERE username = ?", [
    username,
  ])
  
  if (rows.length > 0) {
    const user = rows[0];

    const userSession = { 
      id:       user.id_user , 
      fullName: user.name + ' ' + user.last_name , 
      name:     user.name ,
      last_name:user.last_name ,
      mail:     user.mail ,
      is_admin:  user.is_admin,
      username:  user.username,
      telephone:  user.telephone,
      id_profile: user.id_profile,
      id_cliente: user.id_cliente,
      signAt: new Date().getTime()
    }

    if(user.profile_deleted){
      return { success : false, message : `Perfil inválido`, data : userSession };
    }
    if(user.intento > 2){
      return { success : false, message : `Usuario bloqueado ${user.username}`, data : userSession }
    }
    

    const validPassword = await helpers.matchPassword(
      password,
      user.password
    )

    if (validPassword) {
      await pool.query("update users set online = 1 , intento = 0 where id_user = ?", [user.id_user])
      const ip =  req.headers['x-forwarded-for'] || req.ip
      await pool.query("INSERT INTO log_login set ?", [ { ip ,id_user: user.id_user } ])

      if (user.change_password === 1) {
        return { success : false, message : `Se require cambio de contraseña ${user.username}`, data : userSession }
      } else {
        return { success : true, message : `Inicio de sessión correcto`, data : userSession }
      }
    } else {
      const attempNumber = parseInt( user.intento + 1 );
      await pool.query("update users set intento = ? where id_user = ?", [ attempNumber , user.id_user]);
      if(attempNumber == 3)  auditService.registerEvent(USER_BLOCKED, req, 'Usuario bloqueado, exedido el número de intentos.',true);
      return { success : false, message : `Usuario o contraseña inválido`, data : userSession }
    }
  } else {
    return { success : false, message : `Usuario o contraseña inválido`, data : {} }
  }

}

authApiCtrl.logout = async (req, res, next) => {

  await db.users.update({online: 0},{ where:{ id_user: req.user.id } });

  auditService.registerEvent(LOGOUT_SUCCESS, req, 'Cierre de sesión correcto', true);

  

  let logoutErr;

  await new Promise((resolve, reject) => {
    req.logout( (err) => {
      if (err) { reject(err); }
      req.session.destroy(() => {
        resolve();
      });
    });
  }).catch(err => {
    logoutErr = err
  });
  

  if(logoutErr) { return next(logoutErr)};

  return res.json({
    error: false,
    text: `Cierre de sesión correcto`
  });
};

authApiCtrl.getUserPermissions = async (req,res,next) => {
  const permissions = await helpers.getLeftbar(req);
  return res.json({ data: permissions }, 200)
}



  authApiCtrl.resetPassword = async (req, res, next) => {

    let token = await generatePassword(12);
    
    token = await helpers.encryptPassword(token);
  
    let user = null;

    let type = 1;

    if (!req.body.type_app || req.body.type_app != 1){
      user = await db.users.findOne({ where: { username: req.body.username } });
      type = 2;
    }else {
      user = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user where email = ?`, { replacements: [req.body.username], type: db.seq.QueryTypes.SELECT });
      if (user.length) {
        user = user[0];
        user.mail = user.email;
      }
      else{
        user = null;
      }
    }
  
    if (user){
      const originUrl = process.env.FRONT_URL || req.headers.origin;
      return await sendMailPassword(originUrl, `${req.protocol}://${req.headers.host}`, token, user.mail, res, user, type );
    }
    
    return res.status(404).json({ error: true, response: '404' });

  }

  authApiCtrl.resetPasswordProcess = async (req, res, next) => {

    try {
      const { tkn, type, password } = req.body;
      
      if (!tkn || !type || !password)
        return res.status(400).json({ error: true, message: 'No se han encontrado todos los parametros' });
  
      if (parseInt(type) === 2) {
        
        const user = await db.users.findOne({ where: { token_pwd: tkn } });

        if (!user){
          auditService.registerEvent(CHANGE_PASSWORD_FAILURE, req, 'No se ha encontrado token valido', false);
          return res.status(400).json({ error: true, message: 'No se ha encontrado token valido' });
        }

        const userSession = { 
          id:       user.id_user , 
          username:  user.username,
          signAt: new Date().getTime()
        }
  
        req.user = userSession;

        user.password = await helpers.encryptPassword(password);
        user.token_pwd = null;
        user.intento = 0;
  
        await user.save();

        auditService.registerEvent(CHANGE_PASSWORD_SUCCESS, req, 'Usuario actualizado', true);

      } else {
        let user = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user where token_pwd = ?`, { replacements: [tkn], type: db.seq.QueryTypes.SELECT });
        user = (user[0]) ? user[0] : null;

        if (!user){
          return res.status(400).json({ error: true, message: 'No se ha encontrado token valido' });
        }
        
        const passHash1 = Buffer.from(password, "base64").toString("utf8");
        const encryptedPassword = await Help.encryptWithPem(passHash1);

        await db.seq.query(`UPDATE ${process.env.DB_NAME_TDM}.user SET token_pwd = ?, password = ? WHERE iduser = ?`, { replacements: [null, encryptedPassword, user.iduser] });
      }
      
      return res.status(200).json({ error: false, message: 'Contraseña actualizada correctamente' });

    } catch (error) {

      console.error("Error in /api/v2/auth/reset-password-process route:", error);
      auditService.registerEvent(CHANGE_PASSWORD_FAILURE, req, err.message, false);
      return res.status(500).json({ error: true, message: 'Internal Server Error' });
    }

  }

  sendMailPassword = async (origin, hostName, TKN, EMAIL, res, userModel, type) => {
    const url = `${origin}/resetPwd?tkn=${TKN}&type=${type}`;
    try {
      const html = await renderEmailTemplate(hostName, url);
      const emailData = {
        emailTo: userModel.mail,
        subject: 'Recuperación de contraseña',
        html
      };
      const data = await mailService.sendEmail(emailData);
  
      if (data.error)
        return res.status(400).json({ error: true, data: data, response: 'No es posible enviar el correo' });
      
      if (type == 1) {
        userModel.token_pwd = TKN;
        // await userModel.save()
        await db.seq.query(`UPDATE ${process.env.DB_NAME_TDM}.user SET token_pwd = ?  where email = ?`, { replacements: [TKN, EMAIL] });
        
        return res.status(200).json({ error: false, response: 'Correo enviado correctamente', data: { EMAIL, type: 'GW' } });
      }
      
      userModel.token_pwd = TKN;
      await userModel.save()
      
      return res.status(200).json({ error: false, response: 'Correo enviado correctamente', data: { type: 'TAE', TKN, mail: EMAIL } }); 
    } catch (error) {
      return res.status(400).json({ error: true, data: error.message, response: 'No es posible enviar el correo' });
    }

  }

  async function renderEmailTemplate(hostName, url) {
    const appName = process.env.APP_NAME || '';
    return new Promise((resolve, reject) => app.render('./../../../views/emails/password', { layout: false, url, hostName, name: 'nombre', appName }, (err, html) => err ? reject(err) : resolve(html)));
  }

  authApiCtrl.me = async (req, res, next) => {
      res.status(200).json({ message : 'Token validado', data: req.user })
  }

module.exports = authApiCtrl;