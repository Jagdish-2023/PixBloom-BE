require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary");
const FileType = require("file-type");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const initializeDB = require("./db/db.connect");
const authRoutes = require("./routes/auth");
const verifyJWT = require("./middleware/verifyJWT");
const User = require("./models/User.model");
const Album = require("./models/Album.model");
const Image = require("./models/Image.model");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(
  cors({
    credentials: true,
    origin: "https://pixbloom.vercel.app",
    optionSuccessStatus: 200,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.diskStorage({});
const upload = multer({ storage });

initializeDB();

app.use("/auth", authRoutes);

app.get("/", (req, res) => res.send("Welcome to PixBloom API"));

app.get("/v2/user/profile", verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json(user);
  } catch (error) {
    res.status(500).send("Failed to fetch user Profile");
  }
});

app.get("/images", verifyJWT, async (req, res) => {
  try {
    const images = await Image.find({ owner: req.user.id });

    return res.status(200).json(images);
  } catch (error) {
    res.status(500).send("Failed to fetch images");
  }
});

app.get("/images/:imageId", verifyJWT, async (req, res) => {
  const imageId = req.params.imageId;
  try {
    if (!imageId) {
      return res.status(400).json({ message: "Image id not found!" });
    }

    const image = await Image.findOne({
      _id: imageId,
      owner: req.user.id,
    }).select("-owner");

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.status(200).json(image);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch Image");
  }
});

app.get("/albums", verifyJWT, async (req, res) => {
  try {
    const albums = await Album.find({ owner: req.user.id }).populate(
      "coverImage",
      "imageUrl"
    );

    return res.status(200).json(albums);
  } catch (error) {
    res.status(500).send("Failed to fetch Albums");
  }
});

app.get("/albums/:albumId", verifyJWT, async (req, res) => {
  const albumId = req.params.albumId;
  let photos = [];
  try {
    const album = await Album.findById(albumId);
    if (!album) {
      res.status(404).json({ message: "Album not found" });
    }
    photos = await Image.find({ album: albumId });
    res.status(200).json({ album, photos });
  } catch (error) {
    res.status(500).send("Failed to fetch Album");
  }
});

//POST
app.post("/images", verifyJWT, upload.single("image"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).send("No file uploaded");
    }

    const requiredSize = 5 * 1024 * 1024;
    if (file.size > requiredSize) {
      return res.status(400).send("File size must be below 5 MB");
    }

    const fileType = await FileType.fromFile(file.path);
    const requiredTypes = ["jpg", "jpeg", "png", "gif"];
    if (!fileType || !requiredTypes.includes(fileType.ext)) {
      return res.status(400).send("Only JPG, JPEG, PNG, GIF files are allowed");
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "uploads",
    });

    const fileName = file.originalname;
    const fileSize = file.size;
    const newImage = new Image({
      imageUrl: result.secure_url,
      name: fileName,
      size: fileSize,
      tags: [],
      person: "",
      isFavourite: false,
      comments: [],
      owner: req.user.id,
      cloudinaryImageId: result.public_id,
    });

    const savedImage = await newImage.save();

    res
      .status(201)
      .json({ message: "Image uploaded successfully", savedImage });
  } catch (error) {
    res.status(500).send("Failed to upload the Image");
    console.error(error);
  }
});

app.post("/albums", verifyJWT, async (req, res) => {
  const { name, description } = req.body;
  try {
    const newAlbum = new Album({
      name,
      description: description || "",
      owner: req.user.id,
    });
    const savedAlbum = await newAlbum.save();
    res.status(201).json({ message: "Album created successfully", savedAlbum });
  } catch (error) {
    res.status(500).send("Failed to create Album");
    console.error(error);
  }
});

app.post("/albums/:albumId", verifyJWT, async (req, res) => {
  const albumId = req.params.albumId;
  const { imagesIdArr, albumInfoToUpdate } = req.body;

  try {
    if (imagesIdArr?.length > 0) {
      const albumPhotos = await Promise.all(
        imagesIdArr.map((imageId) =>
          Image.findByIdAndUpdate(
            imageId,
            { album: albumId, owner: req.user.id },
            { new: true }
          )
        )
      );
      await Album.findByIdAndUpdate(albumId, { coverImage: imagesIdArr[0] });
      return res
        .status(200)
        .json({ message: "photos added to Album", albumPhotos });
    }

    const updatedAlbumInfo = await Album.findOneAndUpdate(
      { owner: req.user.id, _id: albumId },
      albumInfoToUpdate,
      { new: true }
    ).populate("coverImage", "imageUrl");

    res
      .status(200)
      .json({ message: "Album info edited successfully", updatedAlbumInfo });
  } catch (error) {
    res.status(500).send("Failed to add photos into album");
    console.error(error);
  }
});

app.post("/album/photos", verifyJWT, async (req, res) => {
  const { photosIdArr, albumId } = req.body;

  try {
    if (photosIdArr.length < 1) {
      return res.status(400).send("Photos id are required");
    }

    const updatedImages = await Promise.all(
      photosIdArr.map((imageId) =>
        Image.findOneAndUpdate(
          { _id: imageId, album: albumId, owner: req.user.id },
          { $unset: { album: "" } },
          { new: true }
        )
      )
    );

    res
      .status(200)
      .json({ message: "Photos removed from album", updatedImages, albumId });
  } catch (error) {
    res.status(500).send("Failed to remove photos from album");
    console.error(error);
  }
});

app.post("/images/image/favourite", verifyJWT, async (req, res) => {
  const { photoId, isFavourite } = req.body;

  try {
    if (!photoId) {
      return res.status(400).send("Image id is required");
    }

    const updatedImage = await Image.findOneAndUpdate(
      { owner: req.user.id, _id: photoId },
      { isFavourite },
      { new: true }
    );

    if (!updatedImage) {
      return res.status(404).json({ message: "Image not found" });
    }

    res
      .status(200)
      .json({ message: "Image added to favourites", updatedImage });
  } catch (error) {
    res.status(500).send("Failed to add image into favourites");
  }
});

//delete
app.delete("/images/:imageId", verifyJWT, async (req, res) => {
  const imageId = req.params.imageId;

  try {
    const result = await cloudinary.uploader.destroy(imageId);
    if (result.result === "ok") {
      const deletedImage = await Image.findOneAndDelete({
        cloudinaryImageId: imageId,
        owner: req.user.id,
      });

      const imageFoundinAlbums = await Album.find({
        owner: req.user.id,
        coverImage: deletedImage._id,
      });
      if (imageFoundinAlbums) {
        await Promise.all(
          imageFoundinAlbums.map(async (albumInfo) => {
            await Album.findByIdAndUpdate(albumInfo._id, {
              coverImage:
                (
                  await Image.findOne({
                    owner: req.user.id,
                    album: albumInfo._id,
                  })
                )?._id || null,
            });
          })
        );
      }

      res.status(200).json({
        message: "Photo deleted successfully",
        deletedPhoto: deletedImage,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to delete the photo.");
  }
});

app.delete("/albums/:albumId", verifyJWT, async (req, res) => {
  const albumId = req.params.albumId;
  try {
    if (!albumId) {
      return res.status(400).send("Album id is required.");
    }

    const deletedAlbum = await Album.findOneAndDelete({
      owner: req.user.id,
      _id: albumId,
    });

    if (deletedAlbum) {
      const imagesInAlbum = await Image.find({
        owner: req.user.id,
        album: albumId,
      });
      if (imagesInAlbum.length > 0) {
        await Promise.all(
          imagesInAlbum.map((imageInfo) =>
            Image.findByIdAndUpdate(imageInfo._id, { album: null })
          )
        );
      }

      return res
        .status(200)
        .json({ message: "Album deleted successfully", deletedAlbum });
    }
    return res.status(404).json({ message: "Album not found" });
  } catch (error) {
    res.status(500).json("Failed to delete the album");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
