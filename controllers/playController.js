// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// mapping gameStatus from database to corresponding route and vice versa
const routeToDb = {
  answer: "collectingAnswers",
  vote: "voting",
  results: "showVotingResults",
};
const dbToRoute = {
  collectingAnswers: "answer",
  voting: "vote",
  showVotingResults: "results",
};

// middleware to check if this user got access to this game via session-cookie and fetch game-info form database
exports.authForGame_id = function (req, res, next) {
  // check access by session-cookie
  if (req.session.game_id !== req.params.game_id) {
    return res.redirect(`/join/${req.params.game_id}`);
  }
  //TODO: callback hell, fix it with async parallel
  // fetch game for this game_id from database
  Game.findById(req.params.game_id)
    .select("-password")
    .exec(function (err, db_game) {
      if (err) return next(err);
      if (db_game == null) {
        // no results
        const err = new Error("Game not found");
        err.status = 404;
        return next(err);
      }
      // assign db_game to locals
      res.locals.db_game = db_game;
      // fetch other game infos from sessions and assign to locals
      Session.countTotalPlayersByGame_id(db_game.id).exec(function (
        err,
        count
      ) {
        if (err) return next(err);
        res.locals.sess_game = { totalPlayers: count };
        // assign session data to locals
        res.locals.sess_user = req.session;
        // access permitted go on
        next();
      });
    });
};

// middleware to controle the current gameStatus route flow
exports.controlGameStatus = function (req, res, next) {
  if (res.locals.db_game.gameStatus === routeToDb[req.params.gameStatus]) {
    next();
  } else {
    res.redirect(
      `/play/${req.params.game_id}/${dbToRoute[res.locals.db_game.gameStatus]}`
    );
  }
};

// TODO:
exports.get_play_index = function (req, res, next) {
  res.send(`NOT IMPLEMENTED: ${req.method} ${req.path} route`);
};

exports.get_play_game_info = function (req, res, next) {
  const continueURL = `/play/${req.params.game_id}/${
    dbToRoute[res.locals.db_game.gameStatus]
  }`;
  res.render("play_game_info", {
    title: "Welcome to the game!",
    continueURL: continueURL,
  });
};
