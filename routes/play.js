const express = require("express");
const router = express.Router();

router.get("/", function (req, res, next) {
  res.send("NOT IMPLEMENTED: roote for /join route");
});

module.exports = router;
