const express = require("express");
const cors = require("cors");
require("dotenv").config();
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

    // Explicit Database Collections Mapping
    const classCollection = db.collection("class");
    const forumPostCollection = db.collection("forumPost");
    const votesCollection = db.collection("forumVotes");
    const commentsCollection = db.collection("forumComments");

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

    // Fetch a SINGLE class item by its explicit ID
    app.get("/api/getClass/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await classCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(400).send({ error: "Invalid ID format" });
      }
    });

    // Updates all incoming fields sent from the frontend edit form
    app.patch("/api/updateClass/:id", async (req, res) => {
      try {
        const { id } = req.params;
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

    // Delete Route to support your modal interaction
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

    // Forum post routes
    app.post("/api/posts", async (req, res) => {
      const newPost = req.body;
      const result = await forumPostCollection.insertOne(newPost);
      res.send(result);
    });

    app.get("/api/getTrainerPosts/:id", async (req, res) => {
      const { id } = req.params;
      const result = await forumPostCollection
        .find({ trainerId: id })
        .toArray();
      res.send(result);
    });

    app.delete("/api/deletePost/:id", async (req, res) => {
      try {
        const { id } = req.params;
        console.log("Backend received ID string:", id);

        if (!id || id === "undefined") {
          return res.status(400).json({
            success: false,
            error: "Missing or undefined ID string passed",
          });
        }

        const query = { _id: new ObjectId(id) };
        const result = await forumPostCollection.deleteOne(query);
        console.log("MongoDB response object:", result);

        if (result.deletedCount === 1) {
          return res
            .status(200)
            .json({ success: true, message: "Deleted successfully" });
        } else {
          return res.status(404).json({
            success: false,
            message: "No post matched this ID inside the collection.",
          });
        }
      } catch (error) {
        console.error("Database deletion crash info:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
    });

    // home section

    /* -----------------------------------------
   GET TOP FEATURED CLASSES BY BOOKING COUNT
   ----------------------------------------- */
    app.get("/api/classes/featured", async (req, res) => {
      try {
        const limitCount = parseInt(req.query.limit, 10) || 3;

        // Constrain search filter exclusively to already evaluated/approved performance programs
        const targetQueryConditions = { status: "Approved" };

        const targetCollection =
          global.classesCollection || db.collection("class");

        // Fetch records, sorting in descending order by bookingCount to catch highest traction assets
        const highlyBookedClasses = await targetCollection
          .find(targetQueryConditions)
          .sort({ bookingCount: -1 })
          .limit(limitCount)
          .toArray();

        res.status(200).json({
          success: true,
          count: highlyBookedClasses.length,
          classes: highlyBookedClasses,
        });
      } catch (error) {
        console.error(
          "Featured high-performance tracking aggregation engine error:",
          error,
        );
        res.status(500).json({
          success: false,
          error:
            "Internal server processing failure while streaming featured classes data records.",
        });
      }
    });

    /* -----------------------------------------
   GET LATEST FORUM POSTS FOR COMMUNITY PULSE
   ----------------------------------------- */
    app.get("/api/forum-posts/latest", async (req, res) => {
      try {
        const limitCount = parseInt(req.query.limit, 10) || 4;
        // const forumPostCollection = db.collection("forumPost");

        // Fetching latest posts sorted by creation date timestamp metric field in descending sequence
        const fallbackResults = await forumPostCollection
          .find({})
          .sort({ createdAtDate: -1, _id: -1 })
          .limit(limitCount)
          .toArray();

        res.status(200).json({
          success: true,
          count: fallbackResults.length,
          posts: fallbackResults,
        });
      } catch (error) {
        console.error("Latest forum pulse stream runtime route crash:", error);
        res.status(500).json({
          success: false,
          error:
            "Internal server processing failure while compiling community activity rows.",
        });
      }
    });
    // Fetch classes list with pagination and query states
    app.get("/api/classes", async (req, res) => {
      try {
        const search = req.query.search || "";
        const category = req.query.category || "All Categories";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const skipCount = (page - 1) * limit;

        const queryConditions = { status: "Approved" };

        if (search.trim() !== "") {
          queryConditions.className = { $regex: search, $options: "i" };
        }

        if (category !== "All Categories") {
          queryConditions.category = category;
        }

        const totalMatchingCount =
          await classCollection.countDocuments(queryConditions);
        const fetchedResults = await classCollection
          .find(queryConditions)
          .skip(skipCount)
          .limit(limit)
          .toArray();

        const evaluatedTotalPages = Math.ceil(totalMatchingCount / limit) || 1;

        res.status(200).json({
          success: true,
          classes: fetchedResults,
          totalPages: evaluatedTotalPages,
          totalItems: totalMatchingCount,
          currentPage: page,
        });
      } catch (error) {
        console.error("Database query processing crash log failure:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal Server Processing Error" });
      }
    });

    // Class details view dynamic route target
    app.get("/api/classes/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!id || !ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid Class ID format" });
        }

        const classData = await classCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!classData) {
          return res
            .status(404)
            .json({ success: false, error: "Class not found" });
        }

        res.status(200).json(classData);
      } catch (error) {
        console.error("Error fetching class details:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    });

    // if user already booked this class
    // app.get("/api/bookings/check", async (req, res) => {
    //   try {
    //     const { userId, classId } = req.query;
    //     if (!userId || !classId) {
    //       return res.status(400).json({
    //         success: false,
    //         error: "Missing userId or classId parameter",
    //       });
    //     }
    //     const bookingsCollection = global.bookingsCollection || db.collection("bookings");
    //     const existingBooking = await bookingsCollection.findOne({
    //       userId: userId,
    //       classId: classId,
    //     });
    //     res.status(200).json({ isBooked: !!existingBooking });
    //   } catch (error) {
    //     console.error("Error checking booking state:", error);
    //     res.status(500).json({ success: false, error: "Internal server error" });
    //   }
    // });

    // 3. CHECK IF USER FAVORITED THIS CLASS
    // app.get("/api/favorites/check", async (req, res) => {
    //   try {
    //     const { userId, classId } = req.query;
    //     if (!userId || !classId) {
    //       return res.status(400).json({
    //         success: false,
    //         error: "Missing userId or classId parameter",
    //       });
    //     }
    //     const favoritesCollection = global.favoritesCollection || db.collection("favorites");
    //     const existingFavorite = await favoritesCollection.findOne({
    //       userId: userId,
    //       classId: classId,
    //     });
    //     res.status(200).json({ isFavorite: !!existingFavorite });
    //   } catch (error) {
    //     console.error("Error checking favorite state:", error);
    //     res.status(500).json({ success: false, error: "Internal server error" });
    //   }
    // });

    /* -----------------------------------------
    4. ADD TO FAVORITES (WITH DUPLICATE GUARD)
    ----------------------------------------- */
    // app.post("/api/favorites/add", async (req, res) => {
    //   try {
    //     const { userId, classId } = req.body;
    //     if (!userId || !classId) {
    //       return res.status(400).json({
    //         success: false,
    //         error: "Missing required payload parameters",
    //       });
    //     }
    //     const favoritesCollection = global.favoritesCollection || db.collection("favorites");
    //     const duplicateCheck = await favoritesCollection.findOne({ userId, classId });
    //     if (duplicateCheck) {
    //       return res.status(400).json({
    //         success: false,
    //         error: "Class already exists in favorites list",
    //       });
    //     }
    //     const result = await favoritesCollection.insertOne({
    //       userId,
    //       classId,
    //       addedAt: new Date(),
    //     });
    //     res.status(200).json({ success: true, insertedId: result.insertedId });
    //   } catch (error) {
    //     console.error("Error saving to favorites:", error);
    //     res.status(500).json({ success: false, error: "Internal server error" });
    //   }
    // });

    /* -----------------------------------------
    5. REMOVE FROM FAVORITES
    ----------------------------------------- */
    // app.post("/api/favorites/remove", async (req, res) => {
    //   try {
    //     const { userId, classId } = req.body;
    //     if (!userId || !classId) {
    //       return res.status(400).json({
    //         success: false,
    //         error: "Missing required payload parameters",
    //       });
    //     }
    //     const favoritesCollection = global.favoritesCollection || db.collection("favorites");
    //     const result = await favoritesCollection.deleteOne({ userId, classId });
    //     if (result.deletedCount === 1) {
    //       res.status(200).json({
    //         success: true,
    //         message: "Removed from favorites successfully",
    //       });
    //     } else {
    //       res.status(404).json({ success: false, error: "Favorite record target mismatch" });
    //     }
    //   } catch (error) {
    //     console.error("Error removing from favorites:", error);
    //     res.status(500).json({ success: false, error: "Internal server error" });
    //   }
    // });

    // Public community articles list query pipeline
    app.get("/api/forum-posts", async (req, res) => {
      try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 6;

        const skipCount = (page - 1) * limit;
        const queryConditions = {};

        if (search.trim() !== "") {
          queryConditions.title = { $regex: search, $options: "i" };
        }

        const totalMatchingCount =
          await forumPostCollection.countDocuments(queryConditions);
        const fetchedResults = await forumPostCollection
          .find(queryConditions)
          .sort({ createdAtDate: -1 })
          .skip(skipCount)
          .limit(limit)
          .toArray();

        const evaluatedTotalPages = Math.ceil(totalMatchingCount / limit) || 1;

        res.status(200).json({
          success: true,
          posts: fetchedResults,
          totalPages: evaluatedTotalPages,
          totalItems: totalMatchingCount,
          currentPage: page,
        });
      } catch (error) {
        console.error("Forum database processing route failure:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal Server Error" });
      }
    });

    // 1. GET SINGLE POST BY ID
    app.get("/api/forum-posts/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ error: "Invalid ID format" });

        const post = await forumPostCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!post)
          return res
            .status(404)
            .json({ error: "Post details found 0 records" });
        res.status(200).json(post);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* -----------------------------------------
    2. CHECK USER SINGLE VOTING ASSIGNMENT STATUS
    ----------------------------------------- */
    app.get("/api/forum-posts/:id/vote-status", async (req, res) => {
      try {
        const { id: postId } = req.params;
        const { userId } = req.query;

        const voteRecord = await votesCollection.findOne({ postId, userId });
        res.status(200).json({ voteType: voteRecord ? voteRecord.type : null });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* -----------------------------------------
    3. HANDLE VOTE PROCESS ATOMIC TRANSACTION MUTATION
    ----------------------------------------- */
    app.post("/api/forum-posts/:id/vote", async (req, res) => {
      try {
        const { id: postId } = req.params;
        const { userId, type } = req.body;

        console.log("Vote request received:", { postId, userId, type });

        const existingVote = await votesCollection.findOne({ postId, userId });

        let likesDelta = 0;
        let dislikesDelta = 0;

        if (existingVote) {
          if (existingVote.type === type) {
            await votesCollection.deleteOne({ _id: existingVote._id });
            if (type === "like") likesDelta = -1;
            else dislikesDelta = -1;
          } else {
            await votesCollection.updateOne(
              { _id: existingVote._id },
              { $set: { type } },
            );
            if (type === "like") {
              likesDelta = 1;
              dislikesDelta = -1;
            } else {
              likesDelta = -1;
              dislikesDelta = 1;
            }
          }
        } else {
          await votesCollection.insertOne({ postId, userId, type });
          if (type === "like") likesDelta = 1;
          else dislikesDelta = 1;
        }

        const updatedPost = await forumPostCollection.findOneAndUpdate(
          { _id: new ObjectId(postId) },
          { $inc: { likes: likesDelta, dislikes: dislikesDelta } },
          { returnDocument: "after" },
        );

        res.status(200).json({
          message: "Vote registered successfully.",
          likes: updatedPost.likes || 0,
          dislikes: updatedPost.dislikes || 0,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get comments mapped to individual forum posts
    app.get("/api/forum-posts/:id/comments", async (req, res) => {
      try {
        const { id: postId } = req.params;

        const matchedComments = await commentsCollection
          .find({ postId })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json(matchedComments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Add comment to a forum post
    app.post("/api/forum-posts/:id/comments", async (req, res) => {
      try {
        const { id: postId } = req.params;
        const { userId, userName, userImage, text } = req.body;

        const newComment = {
          postId,
          userId,
          userName,
          userImage,
          text,
          createdAt: new Date(),
        };

        const result = await commentsCollection.insertOne(newComment);
        res.status(201).json({ _id: result.insertedId, ...newComment });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update comment values
    app.put("/api/comments/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId, text } = req.body;

        const result = await commentsCollection.updateOne(
          { _id: new ObjectId(id), userId },
          { $set: { text, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0)
          return res
            .status(403)
            .json({ error: "Unauthorized rewrite task block triggered" });
        res.status(200).json({ message: "Update success" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Remove single comment document from list
    app.delete("/api/comments/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.query;

        const result = await commentsCollection.deleteOne({
          _id: new ObjectId(id),
          userId,
        });

        if (result.deletedCount === 0)
          return res
            .status(403)
            .json({ error: "Action disallowed or source mismatch" });
        res.status(200).json({ message: "Deletion executed cleanly" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    await db.command({ ping: 1 });
    console.log("Connected successfully to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server running cleanly.");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
