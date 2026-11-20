const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Client
const client = new MongoClient(process.env.MONGO_URI);


async function connectToMongoDB() {
  try {
    await client.connect();
    const db=client.db("arthub")
    const artworksCollection = db.collection("artworks");

    app.post("/api/artworks", async (req, res) => {
      try {
        // console.log("Artwork API Hit!");

        const artworkData = req.body;

        const result = await artworksCollection.insertOne({
          ...artworkData,
          createdAt: new Date(),
        });

        console.log(result,"creat artwork data");

        res.status(201).json({
          success: true,
          message: "Artwork added successfully",
          result,
        });
      } catch (error) {
        // console.error("Create Artwork Error:", error);

        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

async function disconnectFromMongoDB() {
  await client.close();
}

async function startServer() {
  await connectToMongoDB();

  app.get("/", (req, res) => {
    res.send("Server is running and connected to DB!");
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer().catch(console.dir);
