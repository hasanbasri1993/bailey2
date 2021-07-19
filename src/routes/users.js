const express = require('express');
const {conn} = require("../service/whatsapp");
const router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  conn.
  res.send('respond with a resource');
});




module.exports = router;
