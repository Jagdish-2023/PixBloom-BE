const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
    },
    imageUrl: { type: String, required: true },
    cloudinaryImageId: { type: String, required: true },
    name: { type: String, required: true },
    tags: { type: [String] },
    person: { type: String },
    isFavourite: { type: Boolean, required: true, default: false },
    comments: { type: [String] },
    size: { type: Number, required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Image = mongoose.model("Image", imageSchema);
module.exports = Image;
