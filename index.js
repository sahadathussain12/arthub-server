const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");


const JWKS = createRemoteJWKSet(
  new URL(
    process.env.BETTER_AUTH_URL
      ? `${process.env.BETTER_AUTH_URL}/api/auth/jwks`
      : "BETTER_AUTH_URL/api/auth/jwks",
  ),
);

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access! No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);

    return res.status(403).json({
      success: false,
      message: "Forbidden! Invalid or expired token.",
    });
  }
};

module.exports = verifyToken;

async function connectToMongoDB() {
  try {
    await client.connect();
    const db = client.db("arthub");
    const artworksCollection = db.collection("artworks");
    const ordersCollection = db.collection("seles");
    const usersCollection = db.collection("user");
    const reviewsCollection = db.collection("reviews");

    app.get("/api/artworks", verifyToken, async (req, res) => {
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

    app.post("/api/artworks", verifyToken, async (req, res) => {
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
    app.get("/api/artworks/:id", verifyToken, async (req, res) => {
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

    app.patch("/api/artworks/:id", verifyToken, async (req, res) => {
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

    // কমা (,) যুক্ত করা হয়েছে: verifyToken, async
    app.delete("/api/artworks/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid artwork ID format" });
        }

        const query = { _id: new ObjectId(id) };

        const artwork = await artworksCollection.findOne(query);
        if (!artwork) {
          return res
            .status(404)
            .send({ success: false, message: "Artwork not found" });
        }

        const result = await artworksCollection.deleteOne(query);

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
        console.log("Frontend theke asha artistId:", artistId); // 👈 এটি টার্মিনালে দেখুন

        if (!artistId) {
          return res
            .status(400)
            .send({ success: false, message: "Artist ID is required" });
        }

        // ডাটাবেজে সব অর্ডার কী অবস্থায় আছে তা দেখতে এটিও লগ করতে পারেন
        const allOrders = await ordersCollection.find({}).toArray();

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

    app.get("/api/admin/dashboard", verifyToken, async (req, res) => {
      try {
        const email = req.user?.email;
        const user = await usersCollection.findOne({ email });

        // 🔴 এই জায়গাটি এভাবে .json() দিয়ে দেবেন, যাতে ফ্রন্টএন্ডে HTML এরর না আসে
        if (!user || user.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Forbidden! You do not have admin access.",
          });
        }

        // এডমিন হলে বাকি ডাটা পাঠাবে...
        res.json({ success: true, stats: {} });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });
    // // ইউজারের রোল আপডেট করার API (user / artist / admin)
    app.put("/api/admin/users/role", verifyToken, async (req, res) => {
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
    app.delete("/api/admin/artworks/:id", verifyToken, async (req, res) => {
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
        const { search, category } = req.query;
        let query = {};

        // সার্চ বা ক্যাটাগরি থাকলে কুয়েরিতে শর্ত যোগ হবে
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }
        if (category && category !== "All") {
          query.category = { $regex: `^${category}$`, $options: "i" };
        }

        // এখন এই query দিয়ে ডাটাবেস থেকে ফিল্টার করে ডাটা আনা হবে
        const artworks = await artworksCollection
          .find(query)
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

    app.get("/api/all/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid artwork ID",
          });
        }

        const query = { _id: new ObjectId(id) };
        const artwork = await artworksCollection.findOne(query);

        if (!artwork) {
          return res.status(404).send({
            success: false,
            message: "Artwork not found",
          });
        }

        res.send({
          success: true,
          artwork,
        });
      } catch (error) {
        console.error("Get Single Artwork Error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch artwork details",
        });
      }
    });

    app.get("/api/artworks/:id/reviews", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const reviews = await reviewsCollection
          .find({ artworkId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: reviews });
      } catch (error) {
        console.error("Get Reviews Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch reviews" });
      }
    });

    // নতুন রিভিউ যোগ করা
    app.post("/api/artworks/:id/reviews", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const { userName, userImage, rating, comment } = req.body;

        if (!comment || !comment.trim()) {
          return res
            .status(400)
            .send({ success: false, message: "Comment text is required" });
        }

        const newReview = {
          artworkId,
          userName: userName || "Anonymous User",
          userImage: userImage || null,
          rating: Math.min(5, Math.max(1, Number(rating) || 5)),
          comment: comment.trim(),
          createdAt: new Date(),
        };

        const result = await reviewsCollection.insertOne(newReview);

        res.status(201).send({
          success: true,
          message: "Review added successfully",
          review: { ...newReview, _id: result.insertedId },
        });
      } catch (error) {
        console.error("Add Review Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to add review" });
      }
    });

    app.post("/api/verify-payment", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res
            .status(400)
            .send({ success: false, message: "Session ID is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== "paid") {
          return res
            .status(400)
            .send({ success: false, message: "Payment not completed" });
        }

        const existingOrder = await ordersCollection.findOne({
          transactionId: session.id,
        });
        if (existingOrder) {
          return res.send({
            success: true,
            message: "Order already recorded",
            order: existingOrder,
          });
        }

        const { artworkId, userId, artistId } = session.metadata;
        const artwork = await artworksCollection.findOne({
          _id: new ObjectId(artworkId),
        });

        const newOrder = {
          artworkId,
          artworkTitle: artwork?.title || "Artwork",
          artworkImage: artwork?.image || "",
          userId,
          artistId,
          price: session.amount_total / 100,
          transactionId: session.id,
          status: "paid",
          createdAt: new Date(),
        };

        await ordersCollection.insertOne(newOrder);
        res.send({
          success: true,
          message: "Payment verified and order saved!",
          order: newOrder,
        });
      } catch (error) {
        console.error("Verify Payment Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Payment verification failed" });
      }
    });

    app.get("/api/top-artists", verifyToken, async (req, res) => {
      try {
        const topArtistsData = await ordersCollection
          .aggregate([
            {
              $group: {
                _id: "$artistId",
                totalSales: { $sum: 1 },
                totalRevenue: { $sum: "$price" },
              },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 3 },
          ])
          .toArray();
        const artistIds = topArtistsData.map((item) => new ObjectId(item._id));
        const artistsInfo = await usersCollection
          .find({ _id: { $in: artistIds } })
          .toArray();
        const result = topArtistsData.map((stat) => {
          const artist = artistsInfo.find((u) => u._id.toString() === stat._id);
          return {
            artistId: stat._id,
            name: artist?.name || artist?.username || "Featured Artist",
            avatar:
              artist?.image ||
              artist?.photoURL ||
              "https://i.ibb.co/5G02kwv/default-avatar.png",
            totalSales: stat.totalSales,
            totalRevenue: stat.totalRevenue,
          };
        });

        res.send({ success: true, data: result });
      } catch (error) {
        console.error("Top Artists Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch top artists" });
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
