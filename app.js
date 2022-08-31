// import npm packages
const debug = require("debug");
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const helmet = require("helmet");

// import router modules
const indexRouter = require("./routes/index");
const joinRouter = require("./routes/join");
const playRouter = require("./routes/play");
const usersRouter = require("./routes/users");

// create express application
const app = express();

// set up mongoDB connection via mongoose
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "gameovertinction",
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => debug("gameovertinction:mongoDB")("successfully connected"))
  .catch((e) => debug("gameovertinction:mongoDB")("Error: " + e));
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet()); // secure all routes with helmet by setting various HTTP headers

app.use(express.static(path.join(__dirname, "public")));

// router middleware
app.use("/", indexRouter);
app.use("/join", joinRouter);
app.use("/play", playRouter);
app.use("/users", usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
