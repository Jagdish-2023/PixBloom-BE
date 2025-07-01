const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User.model");

const PORT = process.env.PORT;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const GUEST_EMAIL = process.env.GUEST_EMAIL;

router.get("/login/guest", async (req, res) => {
  try {
    const findGuest = await User.findOne({ email: GUEST_EMAIL });
    if (findGuest) {
      const token = jwt.sign({ id: findGuest._id, role: "guest" }, JWT_SECRET, {
        expiresIn: "24h",
      });

      res.cookie("accessToken", token, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });
      res.redirect(`${process.env.FRONTEND_URL}/photos`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong. Please try again");
  }
});

router.get("/google", async (req, res) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=http://localhost:${PORT}/auth/google/callback&response_type=code&scope=profile email`;
  res.redirect(googleAuthUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Authorization code not provided");

  try {
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `http://localhost:${PORT}/auth/google/callback`,
      },
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    //Google User API
    const googleUserApiResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const { name, email, picture, id } = googleUserApiResponse.data;

    //Save User to DB
    let findUser = await User.findOne({ email });
    if (!findUser) {
      const newUser = new User({
        name,
        email,
        pictureUrl: picture,
        googleId: id,
      });
      findUser = await newUser.save();
    }

    //assign JWT
    const token = jwt.sign({ role: "user", id: findUser._id }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.cookie("accessToken", token, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    res.redirect(`${process.env.FRONTEND_URL}/photos`);
  } catch (error) {
    res.status(500).json({ message: "Authentication Failed" });
  }
});

router.get("/logout", (req, res) => {
  try {
    res.clearCookie("accessToken", { httpOnly: true });

    res.status(200).json({ message: "Logout successfully" });
  } catch (error) {
    res.status(500).json("Failed to Logout");
  }
});

router.get("/check", (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(200).json({ isLoggedIn: false });
    }

    res.status(200).json({ isLoggedIn: true });
  } catch (error) {
    res.status(500).json("Failed to check Login status");
  }
});

module.exports = router;
