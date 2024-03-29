// import npm packages
const debug = require("debug");
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const helmet = require("helmet");
const compression = require("compression");
const expressSession = require("express-session");
const mongoDbStore = require("connect-mongo");
const favicon = require("serve-favicon");

// import router modules
const indexRouter = require("./routes/index");
const joinRouter = require("./routes/join");
const playRouter = require("./routes/play");
const aboutRouter = require("./routes/about");
const quitRouter = require("./routes/quit");

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
  .catch((e) => debug("gameovertinction:mongoDB")(e));
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// various middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// secure all routes with helmet by setting various HTTP headers
// Sets all of the defaults, but overrides `script-src`
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      "script-src": [
        "'self'",
        "https://code.jquery.com/jquery-3.6.1.slim.min.js",
        "https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js",
      ],
      "connect-src": ["'self'", "https://api.github.com"],
    },
  })
);
app.use(compression()); // compress all routes

app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

app.use(express.static(path.join(__dirname, "public")));

// express-session and connect-mongo middleware
const sessionOptions = {
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: process.env.SESSION_SECRET || "keyBoardCat12",
  cookie: { maxAge: 1 * 60 * 60 * 1000 },
  rolling: true,
  store: mongoDbStore.create({
    client: db.client,
    dbName: "gameovertinction",
    stringify: false,
  }),
};
if (app.get("env") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sessionOptions.cookie.secure = true; // serve secure cookies
}
app.use(expressSession(sessionOptions));

// router middleware
app.use("/", indexRouter);
app.use("/join", joinRouter);
app.use("/play", playRouter);
app.use("/about", aboutRouter);
app.use("/quit", quitRouter);

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
  res.render("error", { title: "Oops, something went wrong there!" });
});

module.exports = app;
