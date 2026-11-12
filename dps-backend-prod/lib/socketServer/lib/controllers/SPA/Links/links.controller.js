const db        = require("../../../sequelize/init");
const { validationResult } = require('express-validator');
const mailService          = require('./../../../services/mail.service');

// to render 
const express = require('express');
const exphbs  = require('express-handlebars');
const path    = require('path');
const app     = express();
app.set('views', path.join(__dirname, '../../..', 'views'));
const handleb = exphbs.create({
  defaultLayout: 'main',
  layoutsDir: path.join(app.get('views'), 'layouts'),
  partialsDir: path.join(app.get('views'), 'partials'),
  extname: '.hbs'
});
app.engine('hbs', handleb.engine);
app.set('view engine', 'hbs');

const { sendSmsProcess, sendWhatsappProcess } = require('../../../services/notifications.service');

const userCtrl  = {};

function sendError(res, error, code = 500){
  res.status(code).json({ status:"error" , error })
}
userCtrl.get = async (req, res, next) => {
    dd('=================================== entra get link de pago ==================================')
    try {
        let form_data = req.body;

        // CREA EL TOKEN
        let token = (new Date().getTime() / 1000) + '-' + (Math.random() + 1).toString(36).substring(3);
        const url = 'https://drakops.com.mx/payment?token=' + token;

        let dateFormated;
        let date;

        // Handle different date formats from frontend or set default 7-day expiration
        if (form_data.fecha && form_data.fecha.year && form_data.fecha.month && form_data.fecha.day) {
            // Old format: object with year, month, day properties
            dateFormated = `${form_data.fecha.year}-${form_data.fecha.month}-${form_data.fecha.day}`;
        } else if (form_data.fecha) {
            // New format: ISO string (YYYY-MM-DD)
            // Extract just the date part from ISO string
            dateFormated = form_data.fecha.split('T')[0];
        } else {
            // Set default expiration to 7 days from today
            const defaultExpiration = new Date();
            defaultExpiration.setDate(defaultExpiration.getDate() + 7);
            const day = defaultExpiration.getDate().toString().padStart(2, '0');
            const month = (defaultExpiration.getMonth() + 1).toString().padStart(2, '0');
            const year = defaultExpiration.getFullYear();
            dateFormated = `${year}-${month}-${day}`;
        }

        // Validate date format
        var pattern = /((20)[0-9]{2}[-](0[13578]|1[02])[-](0[1-9]|[12][0-9]|3[01]))|((20)[0-9]{2}[-](0[469]|11)[-](0[1-9]|[12][0-9]|30))|((20)[0-9]{2}[-](02)[-](0[1-9]|1[0-9]|2[0-8]))|((((20)(04|08|[2468][048]|[13579][26]))|2000)[-](02)[-]29)/;

        if (!pattern.test(dateFormated)) {
            sendError(res, "La fecha ingresada no es valida.");
            return;
        }

        date = new Date(dateFormated);

        if (new Date() > date) {
            sendError(res, "La fecha de vencimiento no puede ser anterior a la fecha actual");
            return;
        }

        let aux = await db.merchant.findOne({ where: { id_merchant: form_data.id_comercio } });
        if (aux == null) {
            sendError(res, "No existe un comercio con el id seleccionado.");
            return;
        }

        // CREA EL REGISTRO
        db.linksPago.create({
            token: token,
            id_merchant: form_data.id_comercio,
            concepto: form_data.concepto,
            monto: form_data.monto,
            expire_date: `${dateFormated} 22:59:59`,
            id_user: req.user.id
        }).then(async result => {
            return res.json({
                id: result.id,
                url: url,
                token: result.token,
                id_merchant: result.id_merchant,
                concepto: result.concepto,
                monto: result.monto,
                expire_date: result.expire_date,
            })
        })
            .catch(err => {
                sendError(res, err)
                return
            })
    } catch (error) {
        console.log(error);
        sendError(res, error);
    }
}

userCtrl.getAllLinks = async (req,res) => {
  dd('=================================== entra get link de pago ==================================')
  const isAdmn = req.user.is_admin;
  let id = req.body.id;
  var links = [];
  if(id) {
    const queryClient = isAdmn ? {where: {id: id}} : {where: {id: id}, include: { model: db.merchant, as: 'merchant', where: {id_client: req.user.id_cliente}}}
    db.linksPago.findOne(queryClient).then(async result => {
      const url = '?token=' + result.token;
      var status = "Pendiente";
      if(result.status == 2){
        status = "Liquidado";
      }
      const data = {
        id: result.id,
        url: url,
        token: result.token,
        id_user: result.id_user,
        id_merchant: result.id_merchant,
        status: status,
        info_adicional: result.info_adicional,
        concepto: result.concepto,
        monto: result.monto,
        created_at: result.created_at,
        expire_date: result.expire_date,
      }
      return res.json({
        data
      });
    }).catch(err => {
      sendError(res,err);
      return;
    });
  } else {
    let limit = (req.body.limit) ? req.body.limit : 10;
  let offset = 0 + (req.body.page - 1) * limit;
   db.linksPago.findAndCountAll({
    order: [['created_at', 'DESC']],
    offset: offset,
    limit: limit,
    include: isAdmn ? ['merchant'] : { model: db.merchant, as: 'merchant', where: {id_client: req.user.id_cliente}}
  }).then(async result => {
    var links = [];
    result.rows.forEach(item => {
      const url = '?token=' + item.token;
      var status = "Pendiente";
      if(item.status == 2){
        status = "Liquidado";
      }
      if (item.info_adicional != null){
        item.info_adicional = JSON.parse(item.info_adicional);
      }
      links.push({
        id: item.id,
        url: url,
        token: item.token,
        id_user: item.id_user,
        id_merchant: item.id_merchant,
        status: status,
        info_adicional: item.info_adicional,
        concepto: item.concepto,
        monto: item.monto,
        created_at: item.created_at,
        expire_date: item.expire_date,
        merchantName: item.merchant != undefined ? item.merchant.name_merchant : ' - '
      })
    })
    return res.json({
      count: result.count,
      data: links
    });
   }).catch(error => {
    dd(error, 'error');
    sendError(res,error)
    return
   })
  }
}

userCtrl.getAllLinksByParams = async (req,res) => {
 const where = {};
 if (req.user.id_cliente) {
   const result = await db.merchant.findAll({attributes: ['id_merchant'], where: { id_client: req.user.id_cliente }, raw : true });
   const data = result.map(function(el, i) {
     return el.id_merchant
  });
  where.id_merchant = {
   [db.Sequelize.Op.or]: data
 }
 }
 if (req.user.id_merchant) {
   where.id_merchant = req.user.id_merchant;
 }
 if (req.body.fechas) {
  
   var fechas = req.body.fechas.split(' ');
   if (fechas[0].includes('-')) {
     for (let index = 0; index < 2; index++) {
       var aux = fechas[index].split('-');
       if (index == 0) {
         fechas[index] = new Date(aux[0], aux[1] - 1, aux[2], 0, 0, 0, 0).toISOString();
       } else {
         fechas[index] = new Date(aux[0], aux[1] - 1, aux[2], 23, 59, 59, 0).toISOString();
       }
     }
   }
   var dt = [fechas[0], fechas[1]];
   where.created_at = {
     [db.Sequelize.Op.between]: dt
   }
 }

 let response = await db.linksPago.findAll({ where, include: ['merchant'] });
 response = JSON.parse(JSON.stringify(response));
 response.map(r => {
   r.fecha = new Date(r.created_at).toLocaleString();
   const today = new Date();

   r.link = 'https://drakops.com.mx/payment?token=' + r.token;
   let status = '';
   switch (r.status) {
     case 1:
       status = 'Pendiente';
       break;
     case 2:
       status = 'Aprobado';
       break;
     case 3:
       status = 'Declinado';
       break;
     default:
       break;
   }
   r.estatus = status;
   
   if (r.expire_date) {
     r.expire = new Date(r.expire_date).toLocaleDateString();
     if(r.status !== 0 && new Date(r.expire_date)< today){
       r.estatus = 'Expirado';
     }
   } else {
     r.expire = '';
   }
 });

 let links = [];
 response.forEach(item => {
    const url = '?token=' + item.token;
    if (item.info_adicional != null){
      item.info_adicional = JSON.parse(item.info_adicional);
    }
    links.push({
      id: item.id,
      url: url,
      token: item.token,
      id_user: item.id_user,
      id_merchant: item.id_merchant,
      status: item.estatus,
      info_adicional: item.info_adicional,
      concepto: item.concepto,
      monto: item.monto,
      created_at: item.created_at,
      expire_date: item.expire_date,
      merchantName: item.merchant != undefined ? item.merchant.name_merchant : ' - '
    })
  });

 res.json({
   data: links
 })

}

userCtrl.getMerchantsForLinks = async (req, res) => {
  try {
    const where = {};
    
    // Filter by client if not admin
    if (req.user.id_cliente && req.user.is_admin != 1) {
      where.id_client = req.user.id_cliente;
    }
    
    // Only get merchants with non-empty selia_id
    where.selia_id = {
      [db.Sequelize.Op.ne]: null,
      [db.Sequelize.Op.ne]: ''
    };
    
    // Only active merchants
    where.active = 1;
    where.deleted_at = null;
    
    const merchants = await db.merchant.findAll({
      where,
      attributes: ['id_merchant', 'name_merchant', 'selia_id'],
      order: [['name_merchant', 'ASC']],
      raw: true
    });
    
    // Transform to match frontend expected format
    const transformedMerchants = merchants.map(merchant => ({
      id_merchant: merchant.id_merchant,
      merchantName: merchant.name_merchant,
      selia_id: merchant.selia_id
    }));
    
    res.json(transformedMerchants);
    
  } catch (error) {
    console.error('Error getting merchants for links:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener comercios'
    });
  }
}

userCtrl.sentByEmail = async (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    token, email
  } = req.body;

  let link = await db.linksPago.findOne({ attributes: ['token'], where: { token, status: 1 } });
  if (!link){
    return res.status(404).json({ errors: [
      {
        "type": "notFound",
        "msg": 'Link no localizado o caducado'}
      ] 
    });
  }

  return await sendMailLink(req, token, email, res);

}

userCtrl.sentBySms = async (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    token, to
  } = req.body;

  let link = await db.linksPago.findOne({ attributes: ['token'], where: { token, status: 1 } });
  if (!link){
    return res.status(404).json({ errors: [
      {
        "type": "notFound",
        "msg": 'Link no localizado o caducado'}
      ] 
    });
  }

  const hostName = process.env.FRONT_URL || 'https://drakops.com.mx';

  const url = `${hostName}/payment?token=${token}`;

  return await sendSmsProcess(url, [to] , req, res  );

}

userCtrl.sentByWhatsapp = async (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    token, to
  } = req.body;

  let link = await db.linksPago.findOne({ attributes: ['token'], where: { token, status: 1 } });
  
  if (!link){
    return res.status(404).json({ errors: [
      {
        "type": "notFound",
        "msg": 'Link no localizado o caducado'}
      ] 
    });
  }

  const hostName = process.env.FRONT_URL || 'https://drakops.com.mx';

  const url = `${hostName}/payment?token=${token}`;

  return await sendWhatsappProcess(url, to, req, res );

}


async function sendMailLink(req, tkn, email, res){
  
  const hostName = process.env.FRONT_URL || 'https://drakops.com.mx';

  const url = `${hostName}/payment?token=${tkn}`;
  try {
    const appName = process.env.APP_NAME || '';

    const html = await renderEmailTemplate(hostName, url, appName,  'emails/link');
       
    const emailData = {
      emailTo: email,
      subject: `Link de pagos ${process.env.APP_NAME || ''}`,
      html
    };

    const data = await mailService.sendEmail(emailData);

    if (data.error){
      return res.status(400).json({ error: true, data: data.error, response: 'No es posible enviar el correo' });
    }

    return res.status(200).json({ error: false, response: 'Correo enviado correctamente', data: { token: tkn, mail: email } }); 

  } catch (error) {
    return res.status(400).json({ error: true, data: error, response: 'No es posible enviar el correo' });
  }
}

async function renderEmailTemplate(hostName, url, appName, templateName = 'emails/link') {
  return new Promise((resolve, reject) => app.render(templateName, { layout: false, url, hostName, appName, name: 'nombre' }, (err, html) => err ? reject(err) : resolve(html)));
}

module.exports = userCtrl;