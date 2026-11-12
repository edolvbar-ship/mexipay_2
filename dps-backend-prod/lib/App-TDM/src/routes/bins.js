const express = require('express');
const router = express.Router();
const { verifyToken } = require('../lib/helpers');
const binController = require("../../../socketServer/lib/controllers/bines.controller");

router.get("/:code/code", verifyToken, async (req, res) => {
  return binController.detailByCode(req, res);
});

module.exports = router;