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
      joinTime: Date,
      playerPoints: Number,
      roundPoints: {
        correctAnswer: { type: Number },
        othersWrongVote: { type: Number },
      },
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
    .select({
      _id: 0,
      letter: "$session.answerLetter",
      answer: "$session.playerAnswer",
    });
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

// query for specific game_id, where playerName is not null and additionally
// (answerLetter and playerAnswer) or playerVote is not null,
// is base query for others
function findAnswersLettersCreatorsVotesByGame_id(game_id) {
  return sessionModel.find({
    "session.game_id": game_id,
    "session.playerName": { $ne: null },
    $or: [
      {
        $and: [
          { "session.answerLetter": { $ne: null } },
          { "session.playerAnswer": { $ne: null } },
        ],
      },
      { "session.playerVote": { $ne: null } },
    ],
  });
}

// uses base query: findAnswersLettersCreatorsVotesByGame_id
// returns array of docs containing all fields
exports.findAnswersLettersCreatorsVotesByGame_id_full = function (game_id) {
  return findAnswersLettersCreatorsVotesByGame_id(game_id);
};

// uses base query: findAnswersLettersCreatorsVotesByGame_id
// returns array of docs containing only the following fields:
// answerLetter, playerAnswer, playerName, playerVote and id from session
exports.findAnswersLettersCreatorsVotesByGame_id_selected = function (game_id) {
  return findAnswersLettersCreatorsVotesByGame_id(game_id).select({
    letter: "$session.answerLetter",
    answer: "$session.playerAnswer",
    creator: "$session.playerName",
    vote: "$session.playerVote",
  });
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
// by setting answerLetter, playerAnswer and playerVote back to null and isInRound to true and roundPoints to 0
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
      "session.roundPoints.correctAnswer": 0,
      "session.roundPoints.othersWrongVote": 0,
    }
  );
};

/**
 * aggregation pipeline to get updated moderator of a specific game, where player isInRound
 * query retunrs the next player which should get moderator based on the givenDate of the current one
 * @DISCLAIMER only works properly if each player has a unique joinTime
 * @param {string} game_id specific game
 * @param {date} givenDate date point to determine (next) mod
 * @param {boolean} selNext true: take next mod, false: same mod as before if present
 * @return {mongoose.Aggregate} aggregation pipeline
 */
exports.getUpdatedModerator = function (game_id, givenDate, selNext) {
  return sessionModel.aggregate([
    {
      $match: {
        "session.game_id": game_id,
        "session.isInRound": true,
        "session.joinTime": { [selNext ? "$gt" : "$gte"]: givenDate },
      },
    },
    {
      $sort: {
        "session.joinTime": 1,
      },
    },
    {
      $limit: 1,
    },
    {
      $unionWith: {
        coll: "sessions",
        pipeline: [
          {
            $match: {
              "session.game_id": game_id,
              "session.isInRound": true,
              "session.joinTime": { [selNext ? "$lte" : "$lt"]: givenDate },
            },
          },
          {
            $sort: {
              "session.joinTime": 1,
            },
          },
          {
            $limit: 1,
          },
        ],
      },
    },
    {
      $sort: {
        "session.joinTime": -1,
      },
    },
    {
      $limit: 1,
    },
    {
      $project: {
        _id: 0,
        sessionPlayerId: "$_id",
        joinTime: "$session.joinTime",
      },
    },
  ]);
};

/**
 * finds infos of the mod from a specific game, if still present
 * @param {string | ObjectId} session_id sessionId of this player
 * @param {string | ObjectId} game_id specific game
 * @return {mongoose.Query} query
 */
exports.findValidModInfo = function (session_id, game_id) {
  return sessionModel
    .findById(session_id)
    .where({
      "session.game_id": game_id,
    })
    .where("session.isInRound")
    .equals(true)
    .select({
      name: "$session.playerName",
    });
};
