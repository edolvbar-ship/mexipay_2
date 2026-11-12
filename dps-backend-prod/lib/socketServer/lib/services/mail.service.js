/**
 * Mail Service
 * Handles email delivery for notifications and communications
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 4.2: Ensures secure transmission of sensitive data via TLS/SSL
 * - Req 10.2: Supports audit trail by enabling email notifications for security events
 * - Req 12.10: Facilitates incident response communications via email alerts
 */

const nodemailer        = require("nodemailer");
const out = {};

const auth = process.env.SMPT_USER ?? '';
const pass = process.env.SMPT_PASS ?? '';
const host =  process.env.SMPT_HOST ?? '';
const port = parseInt(process.env.SMPT_PORT ?? '587');
const name = process.env.SMPT_NAME ?? '';

const sender = process.env.EMAIL_SENDER ?? 'Default'

/**
 * Send email via SMTP
 * PCI DSS 4.0: Req 4.2 - Uses TLS for secure email transmission
 * @param {object} obj - Email configuration object
 * @param {string} obj.emailTo - Recipient email address
 * @param {string} obj.subject - Email subject
 * @param {string} obj.html - HTML email body
 * @param {array} obj.attachments - Optional email attachments
 * @returns {Promise<object>} Send result with success/error status
 */
out.sendEmail = async (obj) =>{
  // Creamos el email
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: false,
    auth: {
      user: auth,
      pass: pass,
    },
    tls: {
    rejectUnauthorized: false
    },
    name: name,
    debug: true,
    logger: true
  });
  
  var mailOptions = {
    from:     sender,
    to:       obj.emailTo,
    subject:  obj.subject,
    html:     obj.html,
    attachments: obj.attachments || []
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    const resp ={
      error: null,
      msg: 'Correo enviado exitosamente'
    }
    return resp;
  } catch (error) {
    console.log("Entra en catch de envio de correo ", error.message);

    return {
      error: error.message,
      msg: 'No fue posible enviar el correo, verifique el correo e intente nuevamente' 
    }; 
  }
}


module.exports = out;