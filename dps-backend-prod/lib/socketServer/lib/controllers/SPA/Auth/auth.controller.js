const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mailService = require('../../../services/mail.service');
const { generatePassword } = require('../../../services/general.service');
const db = require('../../../sequelize/init');
const pool = require('../../../database');
const helpers = require('../../../lib/helpers');
const vars = require('../../../lib/varsSpa');
const AUTH_CONSTRAINTS = require('../../../lib/constraints/auth.constraints');
const express = require('express');
const path = require('path');
const AuditEventService = require('../../../services/audit.service');
const { LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT_SUCCESS, CHANGE_PASSWORD_FAILURE, CHANGE_PASSWORD_SUCCESS, USER_BLOCKED } = AuditEventService.AuditEvents;

const app = express();
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');
const auditService = new AuditEventService();

const authCtrl = {};

authCtrl.signIn = async (req, res, next) => {
    try {
        const userValidation = await authCtrl.fnsignin(req);
        if (userValidation.success) {
            const user = userValidation.data;
            const token = jwt.sign(user, vars.secret, {
                expiresIn: AUTH_CONSTRAINTS.expirationTime // 24 hours
            });
            auditService.registerEvent(LOGIN_SUCCESS, req, userValidation.message, true);
            return res.json({
                user,
                token
            });
        } else {
            auditService.registerEvent(LOGIN_FAILURE, req, userValidation.message, false);
            return res.status(401).json({
                error: true,
                text: userValidation.message
            });
        }
    } catch (error) {
        console.error('Error in /api/auth/login:', error.stack);
        return res.status(500).json({ error: true, message: 'Error autenticando' });
    }
};

authCtrl.fnsignin = async (req) => {
    const username = req.body.username;
    const password = req.body.password; // Assume plain from client (as in production); add Buffer.from if encoded
    const rows = await pool.query("SELECT users.*, p.deleted_at as 'profile_deleted' FROM users JOIN user_profile as p ON p.id_profile = users.id_profile WHERE username = ?", [
        username,
    ]);

    if (rows.length > 0) {
        const user = rows[0];
        const userSession = {
            id: user.id_user,
            fullName: user.name + ' ' + user.last_name,
            name: user.name,
            last_name: user.last_name,
            mail: user.mail,
            is_admin: user.is_admin,
            username: user.username,
            telephone: user.telephone,
            id_profile: user.id_profile,
            id_cliente: user.id_cliente,
            signAt: new Date().getTime()
        };
        if (user.profile_deleted) {
            return { success: false, message: `Perfil inválido`, data: userSession };
        }
        if (user.intento > 2) {
            return { success: false, message: `Usuario bloqueado ${user.username}`, data: userSession };
        }

        let validPassword = false;
        let isPlain = !user.password.startsWith('$2a$'); // Detect plain passwords
        if (isPlain) {
            validPassword = password === user.password;
        } else {
            validPassword = await helpers.matchPassword(password, user.password);
        }

        if (validPassword) {
            await pool.query("update users set online = 1 , intento = 0 where id_user = ?", [user.id_user]);
            const ip = req.headers['x-forwarded-for'] || req.ip;
            await pool.query("INSERT INTO log_login set ?", [{ ip, id_user: user.id_user }]);

            if (isPlain) {
                // Migrate plain to bcrypt
                const newHash = await helpers.encryptPassword(password);
                await pool.query("update users set password = ? where id_user = ?", [newHash, user.id_user]);
                console.log(`Migrated plain password for user ${username} to bcrypt`);
            }

            if (user.change_password === 1) {
                return { success: false, message: `Se require cambio de contraseña ${user.username}`, data: userSession };
            } else {
                return { success: true, message: `Inicio de sessión correcto`, data: userSession };
            }
        } else {
            const attempNumber = parseInt(user.intento + 1);
            await pool.query("update users set intento = ? where id_user = ?", [attempNumber, user.id_user]);
            if (attempNumber == 3) auditService.registerEvent(USER_BLOCKED, req, 'Usuario bloqueado, exedido el número de intentos.', true);
            return { success: false, message: `Usuario o contraseña inválido`, data: userSession };
        }
    } else {
        return { success: false, message: `Usuario o contraseña inválido`, data: {} };
    }
};

authCtrl.logout = async (req, res, next) => {
    await db.users.update({ online: 0 }, { where: { id_user: req.user.id } });
    auditService.registerEvent(LOGOUT_SUCCESS, req, 'Cierre de sesión correcto', true);

    let logoutErr;
    await new Promise((resolve, reject) => {
        req.logout((err) => {
            if (err) { reject(err); }
            req.session.destroy(() => {
                resolve();
            });
        });
    }).catch(err => {
        logoutErr = err;
    });

    if (logoutErr) { return next(logoutErr); }
    return res.json({
        error: false,
        text: `Cierre de sesión correcto`
    });
};

authCtrl.getUserPermissions = async (req, res, next) => {
    const permissions = await helpers.getLeftbar(req);
    return res.json({ data: permissions }, 200);
};

authCtrl.resetPassword = async (req, res, next) => {
    let token = await generatePassword(12);
    token = await helpers.encryptPassword(token);

    let user = null;
    let type = 1;
    if (!req.body.type_app || req.body.type_app != 1) {
        user = await db.users.findOne({ where: { username: req.body.username } });
        type = 2;
    } else {
        user = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user where email = ?`, { replacements: [req.body.username], type: db.seq.QueryTypes.SELECT });
        if (user.length) {
            user = user[0];
            user.mail = user.email;
        } else {
            user = null;
        }
    }

    if (user) {
        const originUrl = process.env.FRONT_URL || req.headers.origin;
        const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        return await sendMailPassword(originUrl, `${req.protocol}://${req.headers.host}`, token, user.mail, res, user, type, expiration);
    }

    return res.status(404).json({ error: true, response: '404' });
};

authCtrl.resetPasswordProcess = async (req, res, next) => {
    try {
        const { tkn, type, password } = req.body;

        if (!tkn || !type || !password)
            return res.status(400).json({ error: true, message: 'No se han encontrado todos los parametros' });

        if (parseInt(type) === 2) {
            const user = await db.users.findOne({ where: { token_pwd: tkn } });
            if (!user) {
                auditService.registerEvent(CHANGE_PASSWORD_FAILURE, req, 'No se ha encontrado token valido', false);
                return res.status(400).json({ error: true, message: 'No se ha encontrado token valido' });
            }
            if (user.token_expire && new Date(user.token_expire) < new Date()) {
                auditService.registerEvent(CHANGE_PASSWORD_FAILURE, req, 'Token expirado', false);
                return res.status(400).json({ error: true, message: 'Token expirado' });
            }
            const userSession = {
                id: user.id_user,
                username: user.username,
                signAt: new Date().getTime()
            };

            req.user = userSession;
            user.password = await helpers.encryptPassword(password);
            user.token_pwd = null;
            user.token_expire = null;
            user.intento = 0;

            await user.save();
            auditService.registerEvent(CHANGE_PASSWORD_SUCCESS, req, 'Usuario actualizado', true);
        } else {
            let user = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user where token_pwd = ?`, { replacements: [tkn], type: db.seq.QueryTypes.SELECT });
            user = (user[0]) ? user[0] : null;
            if (!user) {
                return res.status(400).json({ error: true, message: 'No se ha encontrado token valido' });
            }
            if (user.token_expire && new Date(user.token_expire) < new Date()) {
                return res.status(400).json({ error: true, message: 'Token expirado' });
            }

            const passHash1 = Buffer.from(password, "base64").toString("utf8");
            const encryptedPassword = await Help.encryptWithPem(passHash1);
            await db.seq.query(`UPDATE ${process.env.DB_NAME_TDM}.user SET token_pwd = ?, token_expire = ?, password = ? WHERE iduser = ?`, { replacements: [null, null, encryptedPassword, user.iduser] });
        }

        return res.status(200).json({ error: false, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error("Error in /api/v2/auth/reset-password-process route:", error);
        auditService.registerEvent(CHANGE_PASSWORD_FAILURE, req, error.message, false);
        return res.status(500).json({ error: true, message: 'Internal Server Error' });
    }
};

const sendMailPassword = async (origin, hostName, TKN, EMAIL, res, userModel, type, expiration) => {
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
            // For TDM user
            await db.seq.query(`UPDATE ${process.env.DB_NAME_TDM}.user SET token_pwd = ?, token_expire = ? where email = ?`, { replacements: [TKN, expiration, EMAIL] });
            return res.status(200).json({ error: false, response: 'Correo enviado correctamente', data: { EMAIL, type: 'GW' } });
        }

        userModel.token_pwd = TKN;
        userModel.token_expire = expiration;
        await userModel.save();

        return res.status(200).json({ error: false, response: 'Correo enviado correctamente', data: { type: 'TAE', TKN, mail: EMAIL } });
    } catch (error) {
        return res.status(400).json({ error: true, data: error.message, response: 'No es posible enviar el correo' });
    }
};

async function renderEmailTemplate(hostName, url) {
    const appName = process.env.APP_NAME || '';
    return new Promise((resolve, reject) => app.render('./../../../views/emails/password', { layout: false, url, hostName, name: 'nombre', appName }, (err, html) => err ? reject(err) : resolve(html)));
}

authCtrl.me = async (req, res, next) => {
    res.status(200).json({ message: 'Token validado', data: req.user });
};

module.exports = authCtrl;