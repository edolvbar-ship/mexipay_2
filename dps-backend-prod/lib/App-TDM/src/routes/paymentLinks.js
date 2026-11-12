const express = require('express');
const router = express.Router();
const { verifyToken } = require('../lib/helpers');
const userCtrl = require("../../../socketServer/lib/controllers/SPA/Links/links.controller");
const { check } = require('express-validator');

router.post("/byEmail", [verifyToken,
  check(['token', 'email'], 'Valor requeridos').not().isEmpty()
], async (req, res) => {
  return userCtrl.sentByEmail(req, res);
});

router.post("/sms", [verifyToken, 
  check(['token', 'to'], 'Valor requeridos').not().isEmpty()
], async (req, res) => {
  return userCtrl.sentBySms(req, res);
});

router.post("/whatsapp", [verifyToken,
  check(['token', 'to'], 'Valor requeridos').not().isEmpty()
], async (req, res) => {
  return userCtrl.sentByWhatsapp(req, res);
});

module.exports = router;