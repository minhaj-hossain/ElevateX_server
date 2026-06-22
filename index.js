const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI;

//middleware
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("elevatex");
    const classCollection = db.collection("class");

    app.post("/api/classes", async (req, res) => {
      const newClass = req.body;
      const classWithStatus = { ...newClass, status: "pending" };
      const result = await classCollection.insertOne(classWithStatus);
      res.send(result);
    });

    app.get("/api/getClasses/:id", async (req, res) => {
      const { id } = req.params;

      const result = await classCollection.find({ trainerId: id }).toArray();
      console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await db.command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
