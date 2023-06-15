const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //   bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c5zhdwf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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

    const classCollection = client.db("spaceDB").collection("classes");
    const cartCollection = client.db("spaceDB").collection("carts");
    const userCollection = client.db("spaceDB").collection("users");
    const paymentCollection = client.db("spaceDB").collection("payments");
    const enrolledCollection = client.db("spaceDB").collection("enrolled");
    const reviewCollection = client.db("spaceDB").collection("reviews");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // Student middleware
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "student") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // Instructor middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // user related apis
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);

      //   for social login
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      console.log("existing user", existingUser);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // student user related apis
    app.get(
      "/users/student/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;

        if (req.decoded.email !== email) {
          res.send({ student: false });
        } else {
          const query = { email: email };
          const user = await userCollection.findOne(query);
          const result = { student: user?.role === "student" };
          res.send(result);
        }
      }
    );

    app.patch("/users/student/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "student",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // admin user related apis
    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      } else {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.send(result);
      }
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // instructor user related apis
    app.get(
      "/users/instructor/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;

        if (req.decoded.email !== email) {
          res.send({ instructor: false });
        } else {
          const query = { email: email };
          const user = await userCollection.findOne(query);
          const result = { instructor: user?.role === "instructor" };
          res.send(result);
        }
      }
    );

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // class related apis
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      console.log(newClass);
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedClass = req.body;
      const uniqueClass = {
        $set: {
          price: parseInt(updatedClass.price),
          class_image: updatedClass.class_image,
          available_seats: parseInt(updatedClass.available_seats),
        },
      };

      const result = await classCollection.updateOne(
        filter,
        uniqueClass,
        options
      );
      res.send(result);
    });

    app.patch("/classes/approve/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/deny/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // POST route to handle adding feedback to a class
    app.post("/classes/feedback/:id", (req, res) => {
      const { id } = req.params;
      const { feedback } = req.body;

      // Convert the ID string to ObjectID
      const objectId = new ObjectId(id);

      // Update the document based on its _id
      classCollection
        .updateOne({ _id: objectId }, { $set: { feedback: feedback } })
        .then(() => {
          // Find the updated document
          classCollection.findOne({ _id: objectId }).then((updatedClass) => {
            if (updatedClass) {
              res.send(updatedClass);
            } else {
              res.status(404).json({ error: "Class not found" });
            }
          });
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: "Internal server error" });
        });
    });

    // cart collection apis
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // reviews related apis
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related apis
    app.post("/payment", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      // Update the classCollection
      const updateResult = await classCollection.updateMany(
        { _id: { $in: payment.classItems.map((id) => new ObjectId(id)) } },
        { $inc: { number_of_students: 1, available_seats: -1 } }
      );

      // Retrieve the enrolled class data
      const enrolledClassIds = payment.classItems.map((id) => new ObjectId(id));
      const enrolledClasses = [];

      for (const classId of enrolledClassIds) {
        const alreadyEnrolled = await enrolledCollection.findOne({
          _id: classId,
        });
        if (alreadyEnrolled) {
          console.log(`User already enrolled in class with ID: ${classId}`);
          continue;
        }

        const enrolledClass = await classCollection.findOne({ _id: classId });
        enrolledClasses.push(enrolledClass);
        await enrolledCollection.insertOne(enrolledClass);
      }

      res.send({ insertResult, deleteResult, updateResult, enrolledClasses });
    });

    // payment history api
    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // enrolled api
    app.get("/enrolled", async (req, res) => {
      const result = await enrolledCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("language is spacing");
});

app.listen(port, () => {
  console.log(`The Language is spacing on port: ${port}`);
});
