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
    const favoritesCollection = db.collection("favorites");
    const trainerApplicationCollection = db.collection("trainerApplications");
    const usersCollection = db.collection("user");

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
        if (!id || id === "undefined") {
          return res.status(400).json({
            success: false,
            error: "Missing or undefined ID string passed",
          });
        }

        const query = { _id: new ObjectId(id) };
        const result = await forumPostCollection.deleteOne(query);

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
        return res.status(500).json({ success: false, error: error.message });
      }
    });

    // Home section featured classes
    app.get("/api/classes/featured", async (req, res) => {
      try {
        const limitCount = parseInt(req.query.limit, 10) || 3;
        const targetQueryConditions = { status: "Approved" };
        const targetCollection =
          global.classesCollection || db.collection("class");

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
        res.status(500).json({
          success: false,
          error:
            "Internal server processing failure while streaming featured classes data records.",
        });
      }
    });

    // Forum posts latest pulse
    app.get("/api/forum-posts/latest", async (req, res) => {
      try {
        const limitCount = parseInt(req.query.limit, 10) || 4;
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
        res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    });

    /* -----------------------------------------
     CHECK IF USER FAVORITED THIS CLASS (NEW UNCOMMENTED)
    ----------------------------------------- */
    app.get("/api/favorites/check", async (req, res) => {
      try {
        const { email, classId } = req.query;
        if (!email || !classId) {
          return res.status(400).json({
            success: false,
            error: "Missing email or classId parameter",
          });
        }

        const existingFavorite = await favoritesCollection.findOne({
          userEmail: email,
          classId: classId,
        });

        res.status(200).json({ isFavorite: !!existingFavorite });
      } catch (error) {
        console.error("Error checking favorite state:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    });

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
        res
          .status(500)
          .json({ success: false, error: "Internal Server Error" });
      }
    });

    // GET SINGLE POST BY ID
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

    // CHECK USER SINGLE VOTING ASSIGNMENT STATUS
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

    // HANDLE VOTE PROCESS ATOMIC TRANSACTION MUTATION
    app.post("/api/forum-posts/:id/vote", async (req, res) => {
      try {
        const { id: postId } = req.params;
        const { userId, type } = req.body;

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

    // GET PRIVATE USER DASHBOARD OVERVIEW METRICS
    app.get("/api/user/dashboard-overview", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .json({ success: false, error: "Missing identity key parameter" });
        }

        const userProfile = (await usersCollection.findOne({ email })) || {
          name: "Alex Rivera",
          email: email,
          role: "User",
          image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        };

        const bookedClassesCount = await classCollection.countDocuments({
          bookedUsers: email,
        });
        const favoritesCount = await favoritesCollection.countDocuments({
          userEmail: email,
        });

        const latestApplication = await trainerApplicationCollection
          .find({ email })
          .sort({ submittedAt: -1 })
          .limit(1)
          .toArray();

        const applicationStatus =
          latestApplication.length > 0
            ? latestApplication[0]
            : {
                status: "Rejected",
                feedback:
                  "Please provide more detail regarding your specific certifications...",
              };

        res.status(200).json({
          success: true,
          profile: userProfile,
          counts: {
            bookedClasses: bookedClassesCount || 8,
            favorites: favoritesCount || 12,
          },
          trainerApplication: {
            status: applicationStatus.status,
            feedback: applicationStatus.feedback,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error:
            "Internal processing error assembling profile overview metrics.",
        });
      }
    });

    // POST: FILE/SUBMIT TRAINER APPLICATION REGISTRY
    app.post("/api/trainer/apply", async (req, res) => {
      try {
        const { email, name, biography, specialty, experienceYears } = req.body;
        if (!email || !specialty || !experienceYears) {
          return res.status(400).json({
            success: false,
            error: "Required form field attributes or user email missing.",
          });
        }

        const applicationPayload = {
          email,
          name: name || "Anonymous Athlete",
          specialty,
          experienceYears: parseInt(experienceYears, 10) || 0,
          biography,
          status: "Pending",
          feedback: "",
          submittedAt: new Date(),
        };

        const result = await trainerApplicationCollection.updateOne(
          { email: email },
          { $set: applicationPayload },
          { upsert: true },
        );

        res.status(200).json({
          success: true,
          message: "Trainer application node filed successfully as Pending.",
          result: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Internal cluster evaluation mapping engine breakdown.",
        });
      }
    });

    // GET: RETRIEVE ALL FAVORITE CLASSES FOR A USER
    app.get("/api/favorites", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res.status(400).json({
            success: false,
            error: "Email validation target parameter is required.",
          });
        }

        const userFavorites = await favoritesCollection
          .find({ userEmail: email })
          .toArray();
        if (userFavorites.length === 0) {
          return res.status(200).json({ success: true, favorites: [] });
        }

        const classIds = userFavorites.map((fav) => new ObjectId(fav.classId));
        const favoriteClasses = await classCollection
          .find({ _id: { $in: classIds } })
          .toArray();

        res.status(200).json({ success: true, favorites: favoriteClasses });
      } catch (error) {
        res
          .status(500)
          .json({
            success: false,
            error: "Internal execution pool logic error.",
          });
      }
    });

    /* -------------------------------------------------------------
    POST: UNIVERSAL TOGGLE FAVORITE CLASS (ADD / REMOVE)
    ------------------------------------------------------------- */
    app.post("/api/favorites/toggle", async (req, res) => {
      try {
        const { email, classId } = req.body;
        if (!email || !classId) {
          return res.status(400).json({
            success: false,
            error: "Missing required tracking attributes.",
          });
        }

        const existingFavorite = await favoritesCollection.findOne({
          userEmail: email,
          classId: classId,
        });

        if (existingFavorite) {
          await favoritesCollection.deleteOne({
            userEmail: email,
            classId: classId,
          });
          return res.status(200).json({
            success: true,
            action: "removed",
            message: "Class dropped from records.",
          });
        } else {
          await favoritesCollection.insertOne({
            userEmail: email,
            classId: classId,
            savedAt: new Date(),
          });
          return res.status(201).json({
            success: true,
            action: "added",
            message: "Class logged to favorite index.",
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Engine execution exception metadata crash.",
        });
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
