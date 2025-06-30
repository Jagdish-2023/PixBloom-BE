const mongoose = require("mongoose");

const albumSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sharedWith: { type: [String] },
  coverImage: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
});

const Album = mongoose.model("Album", albumSchema);
module.exports = Album;
