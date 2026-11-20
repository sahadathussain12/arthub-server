const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
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
    const db = client.db("arthub");
    const artworksCollection = db.collection("artworks");
    const ordersCollection = db.collection("seles");

    app.get("/api/artworks", async (req, res) => {
      try {
        const { artistId } = req.query;

        if (!artistId) {
          return res.status(400).send({
            success: false,
            message: "Artist ID is required",
          });
        }

        const result = await artworksCollection
          .find({ artistId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error("Get Artworks Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch artworks",
        });
      }
    });

    app.post("/api/artworks", async (req, res) => {
      try {
        // console.log("Artwork API Hit!");

        const artworkData = req.body;

        const result = await artworksCollection.insertOne({
          ...artworkData,
          createdAt: new Date(),
        });

        console.log(result, "creat artwork data");

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

    // নির্দিষ্ট একটি আর্টওয়ার্কের ডাটা পাওয়ার API
    app.get("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // আইডি সঠিক ফরম্যাটে আছে কি না এবং ডাটাবেসে কালেকশন ঠিক আছে কি না চেক করুন
        const query = { _id: new ObjectId(id) };
        const result = await artworksCollection.findOne(query);

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: "Artwork not found" });
        }

        res.send({ success: true, data: result });
      } catch (error) {
        console.error("Get Single Artwork Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch artwork" });
      }
    });

    app.patch("/api/artworks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Artwork ID",
          });
        }

        const filter = {
          _id: new ObjectId(id),
        };

        const updateDoc = {
          $set: {
            title: updatedData.title,
            category: updatedData.category,
            description: updatedData.description,
            price: Number(updatedData.price),
            stock: Number(updatedData.stock),
            ...(updatedData.image && {
              image: updatedData.image,
            }),
            updatedAt: new Date(),
          },
        };

        const result = await artworksCollection.updateOne(filter, updateDoc);

        // Artwork not found
        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Artwork not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Artwork updated successfully",
          data: result,
        });
      } catch (error) {
        console.error("Update Artwork Error:", error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.delete("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await artworksCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Artwork not found" });
        }

        res.send({
          success: true,
          message: "Artwork deleted successfully",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete Artwork Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete artwork" });
      }
    });


    app.get("/api/sales", async (req, res) => {
      try {
        const artistId = req.query.artistId;
        if (!artistId) {
          return res
            .status(400)
            .send({ success: false, message: "Artist ID is required" });
        }

       const sales = await ordersCollection.find({ artistId: artistId }).toArray();

        res.send({ success: true, data: sales });
      } catch (error) {
        console.error("Sales History Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch sales history" });
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
