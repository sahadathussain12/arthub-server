const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

async function connectToMongoDB() {
  try {
    await client.connect();
    const db = client.db("arthub");
    const artworksCollection = db.collection("artworks");
    const ordersCollection = db.collection("seles");
    const usersCollection = db.collection("user");

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

        const sales = await ordersCollection
          .find({ artistId: artistId })
          .toArray();

        res.send({ success: true, data: sales });
      } catch (error) {
        console.error("Sales History Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch sales history" });
      }
    });

    app.get("/api/orders", async (req, res) => {
      try {
        const userId = req.query.userId;
        if (!userId) {
          return res
            .status(400)
            .send({ success: false, message: "User ID is required" });
        }

        // ইউজারের আইডি দিয়ে অর্ডারগুলো খোঁজা (নতুন অর্ডারগুলো আগে দেখাবে)
        const orders = await ordersCollection
          .find({ userId: userId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: orders });
      } catch (error) {
        console.error("Fetch Orders Error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch purchase history",
        });
      }
    });

    app.get("/api/user/bought-artworks", async (req, res) => {
      try {
        const userId = req.query.userId;
        if (!userId) {
          return res
            .status(400)
            .send({ success: false, message: "User ID is required" });
        }

        const orders = await ordersCollection
          .find({ userId: userId })
          .toArray();

        if (orders.length === 0) {
          return res.send({ success: true, data: [] });
        }
        const artworkIds = orders.map((order) => {
          const id = order.artworkId || order.artId;
          return ObjectId.isValid(id) ? new ObjectId(id) : id;
        });

        const boughtArtworks = await artworksCollection
          .find({ _id: { $in: artworkIds } })
          .toArray();

        res.send({ success: true, data: boughtArtworks });
      } catch (error) {
        console.error("Bought Artworks Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch bought artworks" });
      }
    });

    // ইউজারের সাবস্ক্রিপশন স্ট্যাটাস পাওয়ার জন্য
    app.get("/api/user/subscription", async (req, res) => {
      try {
        const userId = req.query.userId;
        console.log("Searching for userId:", userId);

        if (!userId) {
          return res
            .status(400)
            .send({ success: false, message: "User ID is required" });
        }

        // এখানে ObjectId-এ কনভার্ট করে কুয়েরি করা হলো
        const user = await usersCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res
            .status(404)
            .send({ success: false, message: "User not found" });
        }

        res.send({
          success: true,
          tier: user.subscriptionTier || "Free",
          maxPurchases:
            user.subscriptionTier === "Pro"
              ? 9
              : user.subscriptionTier === "Premium"
                ? "Unlimited"
                : 3,
        });
      } catch (error) {
        console.error("Fetch Subscription Error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch subscription status",
        });
      }
    });

    // ২. সাবস্ক্রিপশন আপডেট করার API (PUT)
    app.put("/api/user/subscription", async (req, res) => {
      try {
        const { userId, tier } = req.body;
        console.log(
          "Updating subscription for userId:",
          userId,
          "to tier:",
          tier,
        );

        if (!userId || !tier) {
          return res
            .status(400)
            .send({ success: false, message: "User ID and Tier are required" });
        }

        // এখানেও ObjectId দিয়ে আপডেট করা হচ্ছে
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              subscriptionTier: tier,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: `Successfully upgraded to ${tier} tier`,
          data: result,
        });
      } catch (error) {
        console.error("Update Subscription Error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update subscription",
        });
      }
    });

    app.put("/api/user/profile", async (req, res) => {
      try {
        const { userId, name } = req.body;

        if (!userId || !name) {
          return res
            .status(400)
            .send({ success: false, message: "User ID and Name are required" });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              name: name,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Profile updated successfully",
          data: result,
        });
      } catch (error) {
        console.error("Update Profile Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update profile" });
      }
    });

    // dashboard ar api
    app.get("/api/admin/dashboard", async (req, res) => {
      try {
        // আপনার ডিফাইন করা কালেকশন নামগুলো এখানে ব্যবহার করা হলো
        const [users, artworks, transactions] = await Promise.all([
          usersCollection.find().toArray(),
          artworksCollection.find().toArray(),
          ordersCollection.find().sort({ _id: -1 }).toArray(),
        ]);

        // ১. স্ট্যাটাস বা কার্ডের হিসাব
        const totalUsers = users.length;
        const totalArtists = users.filter((u) => u.role === "artist").length;
        const totalArtworksSold = transactions.length;
        const totalRevenue = transactions.reduce(
          (sum, item) => sum + (Number(item.price || item.amount) || 0),
          0,
        );

        // ২. পাই চার্টের জন্য ক্যাটাগরি অনুযায়ী আর্টওয়ার্ক কাউন্ট
        const categoryMap = {};
        artworks.forEach((art) => {
          const cat = art.category || "Digital Art";
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });
        const categoryData = Object.keys(categoryMap).map((key) => ({
          name: key,

          value: categoryMap[key],
        }));

        // ৩. সেলস চার্টের জন্য সাম্প্রতিক বিক্রির ডেটা
        const salesData = transactions
          .slice(0, 7)
          .reverse()
          .map((t, idx) => ({
            name: t.date
              ? new Date(t.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : `Sale ${idx + 1}`,
            amount: Number(t.price || t.amount) || 0,
          }));

        res.send({
          success: true,
          stats: {
            totalUsers,
            totalArtists,
            totalArtworksSold,
            totalRevenue: totalRevenue.toFixed(2),
          },
          users,
          artworks,
          transactions,
          charts: { categoryData, salesData },
        });
      } catch (error) {
        console.error("Admin Dashboard API Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to load admin dashboard" });
      }
    });
    // // ইউজারের রোল আপডেট করার API (user / artist / admin)
    app.put("/api/admin/users/role", async (req, res) => {
      try {
        const { userId, role } = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: role, updatedAt: new Date() } },
        );
        res.send({
          success: true,
          message: `Role updated to ${role}`,
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to update role" });
      }
    });

    // আর্টওয়ার্ক ডিলিট করার API
    app.delete("/api/admin/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await artworksCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({
          success: true,
          message: "Artwork deleted successfully",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to delete artwork" });
      }
    });

    // ১. Home Page-এর জন্য শুধু ৬টি আর্টওয়ার্ক
    app.get("/api/home-data", async (req, res) => {
      try {
        const featuredArtworks = await artworksCollection
          .find()
          .sort({ _id: -1 })
          .limit(6) // এখানে ৬টি লিমিট দেওয়া আছে
          .toArray();

        res.send({ success: true, featuredArtworks });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to load home data" });
      }
    });

    app.get("/api/all/artworks", async (req, res) => {
      try {
        const artworks = await artworksCollection
          .find()
          .sort({ _id: -1 })
          .toArray();

        res.send({
          success: true,
          artworks,
        });
      } catch (error) {
        console.error("Get Artworks Error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch artworks",
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
