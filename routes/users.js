const express = require("express");
const router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("NOT IMPLEMENTED: roote for /user route");
});

module.exports = router;
