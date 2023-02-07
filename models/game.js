const mongoose = require("mongoose");

// mapping gameStatus from database to corresponding route
const dbToRoute = {
  collectingAnswers: "answer",
  voting: "vote",
  showVotingResults: "results",
};

const gameSchema = new mongoose.Schema({
  name: { type: String, require: true },
  password: { type: String, require: true },
  //sessionIdPlayers: [{ type: String }], // save gameID insted in session
  maxPlayers: { type: Number, default: 10, require: true },
  gameStatus: {
    type: String,
    required: true,
    enum: ["collectingAnswers", "voting", "showVotingResults"],
    default: "collectingAnswers",
  },
});

// Virtual for game's URL
gameSchema.virtual("url").get(function () {
  return `/play/${this._id}`;
});

// Virtual for game's continue URL
gameSchema.virtual("continueURL").get(function () {
  return `/play/${this._id}/${dbToRoute[this.gameStatus]}`;
});

//Export model
module.exports = mongoose.model("Game", gameSchema);
