const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.static(__dirname + '/public'));

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/files", require("./routes/fileRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ message, error: process.env.NODE_ENV === 'production' ? undefined : err });
});

// Database connection and server startup
const startServer = () => {
    const PORT = process.env.PORT || 5000;

    if (!process.env.JWT_SECRET) {
        console.warn('⚠️  WARNING: JWT_SECRET not set in .env - using default (insecure)');
    }

    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📍 API URL: http://localhost:${PORT}`);
    });
};

// Connect to MongoDB
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
            console.log('⚠️  Starting server without database connection');
            startServer();
        });
} else {
    console.warn('⚠️  MONGO_URI not configured. Starting without database.');
    startServer();
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
    } catch (e) {
        console.error('Error during shutdown:', e);
    }
    process.exit(0);
});
