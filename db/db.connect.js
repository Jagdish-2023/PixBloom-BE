const mongoose = require("mongoose");

const initializeDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    if (connection) {
      console.log("DB Connected Successfully");
    }
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
};

module.exports = initializeDB;
