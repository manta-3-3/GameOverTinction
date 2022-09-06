const mongoose = require("mongoose");

// reference to an preexisting model Session (collection name: sessions) in database
const sessionShema = new mongoose.Schema({
  _id: String,
  expires: Date,
  session: {},
});
const sessionModel = mongoose.model("Session", sessionShema, "sessions");

// export the model
exports.sessionModel = sessionModel;

// export specific query helper functions

// count how many players are logged in at specific game_id in total
exports.countTotalByGame_id = function (game_id) {
  return sessionModel.countDocuments({ "session.game_id": game_id });
};

// count how many players at specific game_id have provided an playerAnswer
exports.countProvPlayerAnswerByGame_id = function (game_id) {
  return sessionModel
    .countDocuments({ "session.game_id": game_id })
    .where("session.playerAnswer")
    .ne(null);
};

// returns query for specific game_id, array containing only session data without cookie
exports.findSessionsByGame_id = function (game_id) {
  return sessionModel
    .find({
      "session.game_id": game_id,
    })
    .select("-_id -session.cookie -expires");
};
