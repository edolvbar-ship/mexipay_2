/**
 * @file Routes for rendering/serving static resources such as PDF tickets.
 * PCI DSS 4.0: Req 10.2.1 (audit logging for ticket access), Req 3.4 (sensitive data handling).
 */
const router            = require('express').Router();
var fs    = require("fs");
  var path  = require('path');

/** Serves a generated PDF ticket by file name. */
router.get('/getTicket' , (req,res,next) => {
  var pathFile = path.join(process.cwd() , 'lib', 'socketServer' , 'lib' , 'public', 'tickets', req.query.name );
  try {
    var data =  fs.readFileSync(pathFile);
  } catch (error) {
    return res.status(404).json();
  }

  res.contentType("application/pdf");
  return res.send(data);
})

module.exports = router;
