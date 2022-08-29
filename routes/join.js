const express = require("express");
const router = express.Router();

router.get("/", function (req, res, next) {
  res.send("NOT IMPLEMENTED: roote for /play route");
});

module.exports = router;
