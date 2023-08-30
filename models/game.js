const mongoose = require("mongoose");

// require game state mappings
const gameStates = require("../utilities/gameStates");

const gameSchema = new mongoose.Schema({
  name: { type: String, require: true },
  password: { type: String, require: true },
  maxPlayers: { type: Number, default: 10, require: true },
  gameState: {
    type: String,
    required: true,
    enum: Object.values(gameStates),
    default: gameStates.COLLECT_ANSWERS,
  },
  currModerator: {
    sessionPlayerId: { type: String, required: true, default: null },
    joinTime: { type: Date, required: true, default: null },
  },
});

// Virtual for game's URL
gameSchema.virtual("url").get(function () {
  return `/play/${this._id}`;
});

// Virtual for game's continue URL
gameSchema.virtual("continueURL").get(function () {
  return `/play/${this._id}/${this.gameState}`;
});

//Export model
module.exports = mongoose.model("Game", gameSchema);
