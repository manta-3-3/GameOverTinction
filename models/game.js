const mongoose = require("mongoose");

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

//Export model
module.exports = mongoose.model("Game", gameSchema);
