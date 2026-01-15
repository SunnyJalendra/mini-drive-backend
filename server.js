const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.static(__dirname + '/public'));

// routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/files", require("./routes/fileRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// database connection
// database connection
const startServer = () => {
    const PORT = process.env.PORT || 4000;
    if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set in .env');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb')) {
    mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    })
        .then(() => {
            console.log('✅ MongoDB Connected');
            startServer();
        })
        .catch(err => {
            console.error('❌ MongoDB connection error:', err.message);
            console.log('Make sure MongoDB service is running: net start MongoDB');
            // Still start the server so frontend can be developed, but mongoose ops will fail until DB is fixed
            startServer();
        });
} else {
    console.warn('MONGO_URI not configured. Using in-memory storage.');
    startServer();
}

// root - serve home page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
    // res.json({ message: 'Welcome to Mini Drive Backend API' });
});

// start server
const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set in .env');
// graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    try {
        await mongoose.disconnect();
    } catch (e) {
        // ignore
    }
    process.exit(0);
});
