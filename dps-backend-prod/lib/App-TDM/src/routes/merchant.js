const express = require('express');
const router = express.Router();
const pool = require('../database');
const helpers = require('../lib/helpers');
const validateTKA = require('../lib/tka');
const {verifyToken} = require('../lib/helpers');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const params = require('../lib/params');
const crypto = require('crypto');


router.post("/update", async (req,res)=>{
 const afiliation_number = req.headers['commerce-id'];
 const control_number = req.headers['control_number'];
 const tms = req.headers['x-time'];
 const tka = req.headers['x-auth'];

 validate = await validateTKA.validateTKA('050421_dw_tdm',tms,control_number,tka);
 if (validate != false){
   //  id = await helpers.insertApilog(req.body.uuid,req.ip,req.method,req.originalUrl,req.body);
  const rows = await pool.query('UPDATE merchant SET ? WHERE afiliation_number = ?', [req.body,afiliation_number]);
  if (rows.affectedRows > 0){
    code="M00";
      mensaje="Successful Update!";
          
         resp ={
                  code,
                  mensaje
                }
            
                respuesta = JSON.stringify(resp);
        
                //await helpers.updateApilog(id_log,respuesta);
      res.json({
        code:code,
        mensaje:mensaje
      });
  }else{
    code="M05";
      mensaje="Failed Update!";
          
         resp ={
                  code,
                  mensaje
                }
            
                respuesta = JSON.stringify(resp);
        
                //await helpers.updateApilog(id_log,respuesta);
      res.json({
        code:code,
        mensaje:mensaje
      });
  }
 }else{
  code="M05";
  mensaje="Token Invalido";
      
     resp ={
              code,
              mensaje
            }
        
            respuesta = JSON.stringify(resp);
    
            //await helpers.updateApilog(id_log,respuesta);
  res.json({
    code:code,
    mensaje:mensaje
  });
 }
});
  
module.exports = router;