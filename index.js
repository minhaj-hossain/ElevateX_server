const express = require("express");
const cors = require("cors");
require("dotenv").config();
// 1. Imported ObjectId to fix database querying
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("elevatex");
    const classCollection = db.collection("class");
    const forumPostCollection = db.collection("forumPost");

    // Create Class
    app.post("/api/classes", async (req, res) => {
      const newClass = req.body;
      const classWithStatus = { ...newClass, status: "pending" };
      const result = await classCollection.insertOne(classWithStatus);
      res.send(result);
    });

    // Get ALL classes belonging to a specific Trainer
    app.get("/api/getClasses/:id", async (req, res) => {
      const { id } = req.params;
      const result = await classCollection.find({ trainerId: id }).toArray();
      res.send(result);
    });

    // 2. Added Endpoint: Fetch a SINGLE class item by its explicit ID (Matches frontend)
    app.get("/api/getClass/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await classCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(400).send({ error: "Invalid ID format" });
      }
    });

    // 3. Fixed Endpoint: Updates all incoming fields sent from the frontend edit form
    app.patch("/api/updateClass/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // Exclude the _id field from the update payload to prevent MongoDB immutable errors
        const { _id, ...updateData } = req.body;

        const result = await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update target record" });
      }
    });

    // 4. Added Endpoint: Delete Route to support your modal interaction
    app.delete("/api/deleteClass/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await classCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Deletion failed" });
      }
    });


    //forum post routes
    app.post("/api/posts", async (req, res) => {
      const newPost = req.body;
      const result = await forumPostCollection.insertOne(newPost);
      res.send(result);
    });

    app.get("/api/getTrainerPosts/:id", async (req, res) => {
      const { id } = req.params;
      const result = await forumPostCollection.find({ trainerId: id }).toArray();
      res.send(result);
    });

    await db.command({ ping: 1 });
    console.log("Connected successfully to MongoDB!");
  } catch (err) {
    console.error(err);
  }


  app.delete("/api/deletePost/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await forumPostCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    } catch (error) {
      res.status(500).send({ error: "Deletion failed" });
    }
  });
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server running cleanly.");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
