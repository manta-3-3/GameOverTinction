require("dotenv").config();
const mongoose = require("mongoose");
const Game = require("./models/game");

// set up mongoDB connection via mongoose
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "gameovertinction",
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("successfully connected"))
  .catch((e) => console.log("Error: " + e));
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// save to database
const game = new Game({ name: "TEST-GAME-1", password: "kapla1_321" });
game.save(function (err) {
  if (err) return console.log("failed createTestGame");
  console.log("succeeded createTestGame");
});

// all done, disconnect from database
db.close();
