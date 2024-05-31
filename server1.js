// Import dependencies modules:
const express = require('express');
const { MongoClient, ObjectID } = require('mongodb');

// Create an Express.js instance:
const app = express();

// Config Express.js
app.use(express.json());
app.set('port', 8000); // Update to match the listening port

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
    next();
});

// Connect to MongoDB
let db;
const mongoUri = 'mongodb+srv://muhammadibrahimabdallah782:Nov262003&@cluster0.5afkpqu.mongodb.net/';
MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
    if (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
    db = client.db('Coursework2');
    console.log('Connected to MongoDB');
});

// Route to select a collection
app.get('/', (req, res) => {
    res.send('Select a collection, e.g., /collection/messages');
});

// Middleware to handle collectionName parameter
app.param('collectionName', (req, res, next, collectionName) => {
    req.collection = db.collection(collectionName);
    return next();
});

// Retrieve all objects from a collection
app.get('/collection/:collectionName', (req, res, next) => {
    req.collection.find({}, { limit: 10, sort: [['price', -1]] }).toArray((err, results) => {
        if (err) {
            return next(err);
        }
        res.send(results);
    });
});

// Add a new order and update spaces
app.post('/collection/orders', async (req, res, next) => {
    const order = req.body;
    const session = db.startSession();

    try {
        session.startTransaction();

        // Update spaces for each lesson
        for (const lesson of order.lessons) {
            const updateResult = await db.collection('lessons').updateOne(
                { _id: new ObjectID(lesson._id) },
                { $inc: { spaces: -lesson.spaces } },
                { session }
            );

            if (updateResult.modifiedCount === 0) {
                throw new Error(`Failed to update spaces for lesson ${lesson._id}`);
            }
        }

        await db.collection('orders').insertOne(order, { session });

        await session.commitTransaction();
        res.status(201).send(order);
    } catch (error) {
        await session.abortTransaction();
        console.error('Failed to create order:', error);
        res.status(500).send({ error: 'Failed to create order' });
    } finally {
        session.endSession();
    }
});

// Update an object by id in a collection
app.put('/collection/:collectionName/:id', (req, res, next) => {
    req.collection.updateOne(
        { _id: new ObjectID(req.params.id) },
        { $set: req.body },
        { safe: true, multi: false },
        (err, result) => {
            if (err) {
                return next(err);
            }
            res.send(result.modifiedCount === 1 ? { msg: 'success' } : { msg: 'error' });
        }
    );
});

// Search for lessons by subject or location
app.get('/collection/:collectionName/search', async (req, res, next) => {
    const { subject, location } = req.query;
    const searchCriteria = {};

    if (subject) {
        searchCriteria.subject = { $regex: subject, $options: 'i' }; // Case-insensitive search
    }

    if (location) {
        searchCriteria.location = { $regex: location, $options: 'i' }; // Case-insensitive search
    }

    try {
        const results = await req.collection.find(searchCriteria).toArray();
        res.send(results);
    } catch (err) {
        next(err);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});
