const mongoose = require("mongoose");

// reference to an preexisting model Session (collection name: sessions) in database
const sessionShema = new mongoose.Schema(
  {
    _id: String,
    expires: Date,
    session: {
      game_id: String,
      playerName: String,
      playerColor: String,
      playerPoints: Number,
      playerAnswer: String,
      answerLetter: String,
      playerVote: String,
      isInRound: Boolean,
    },
  },
  { strict: false }
);
const sessionModel = mongoose.model("Session", sessionShema, "sessions");

// export the model
exports.sessionModel = sessionModel;

// export specific query helper functions

// count how many players currently are logged in total at specific game_id
exports.countTotalPlayersByGame_id = function (game_id) {
  return sessionModel.countDocuments({ "session.game_id": game_id });
};

// count how many players currently are in round at specific game_id
exports.countPlayersInRoundByGame_id = function (game_id) {
  return sessionModel
    .countDocuments({ "session.game_id": game_id })
    .where("session.isInRound")
    .equals(true);
};

// count how many players in round currently have provided an playerAnswer at specific game_id
exports.countProvPlayerAnswerByGame_id = function (game_id) {
  return sessionModel
    .countDocuments({ "session.game_id": game_id })
    .where("session.isInRound")
    .equals(true)
    .where("session.playerAnswer")
    .ne(null);
};

// query for specific game_id, where playerAnswer is not null
exports.findAnswersByGame_id = function (game_id) {
  return sessionModel
    .find({
      "session.game_id": game_id,
    })
    .where("session.playerAnswer")
    .ne(null);
};

// query for specific game_id, where answerLetter and playerAnswer is not null,
// returns array sorted by answerLetter ascending of doc containing only answerLetter and playerAnswer from session
exports.findAnswersAndLettersByGame_id = function (game_id) {
  return sessionModel
    .find({
      "session.game_id": game_id,
    })
    .where("session.answerLetter")
    .ne(null)
    .where("session.playerAnswer")
    .ne(null)
    .sort({ "session.answerLetter": 1 })
    .select("-_id session.answerLetter session.playerAnswer");
};

// count how many players in round currently have provided an playerVote at specific game_id
exports.countProvPlayerVoteByGame_id = function (game_id) {
  return sessionModel
    .countDocuments({ "session.game_id": game_id })
    .where("session.isInRound")
    .equals(true)
    .where("session.playerVote")
    .ne(null);
};

// query for specific game_id, where answerLetter, playerAnswer and playerName is not null,
// returns array sorted by answerLetter ascending of doc containing only answerLetter, playerAnswer and playerName from session
exports.findAnswersLettersCreatorsByGame_id = function (game_id) {
  return sessionModel
    .find({
      "session.game_id": game_id,
    })
    .where("session.answerLetter")
    .ne(null)
    .where("session.playerAnswer")
    .ne(null)
    .where("session.playerName")
    .ne(null)
    .sort({ "session.answerLetter": 1 })
    .select(
      "-_id session.answerLetter session.playerAnswer session.playerName"
    );
};

// count how many players currently are ready for the next round at specific game_id,
// by looking if isInRound is false
exports.countReadyForNextRoundByGame_id = function (game_id) {
  return sessionModel
    .countDocuments({ "session.game_id": game_id })
    .where("session.isInRound")
    .equals(false);
};

// reset all sessions for a new round for specific game_id,
// by setting answerLetter, playerAnswer and playerVote back to null and isInRound to true
exports.resetForNewRoundByGame_id = function (game_id) {
  return sessionModel.updateMany(
    {
      "session.game_id": game_id,
    },
    {
      "session.playerAnswer": null,
      "session.answerLetter": null,
      "session.playerVote": null,
      "session.isInRound": true,
    }
  );
};

// query for specific game_id,
// returns array of doc containing only session data without cookie
exports.findSessionsByGame_id = function (game_id) {
  return sessionModel
    .find({
      "session.game_id": game_id,
    })
    .select("-_id -session.cookie -expires");
};
