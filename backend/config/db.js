require('dotenv').config();
const mongoose = require('mongoose');

// Set strictQuery option to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

function connectDB() {
    // Enhanced debugging for MongoDB connection
    console.log("=== MongoDB Connection Debugging ===");
    console.log("MONGO_CONNECTION_URL exists:", !!process.env.MONGO_CONNECTION_URL);
    console.log("MONGO_CONNECTION_URL type:", typeof process.env.MONGO_CONNECTION_URL);
    
    // Define a fallback MongoDB connection string for production
    // This is a temporary solution until environment variables are properly set in Vercel
    const FALLBACK_MONGO_URL = "mongodb+srv://nitesh_01:6UZsptd3070RWHHw@filesharingmanager.w6zlzbj.mongodb.net/?retryWrites=true&w=majority&appName=FileSharingManager";
    
    // Check if the environment variable exists and is valid
    let connectionURL;
    
    if (process.env.MONGO_CONNECTION_URL) {
        const urlValue = process.env.MONGO_CONNECTION_URL.trim();
        // Check if the URL starts with mongodb:// or mongodb+srv://
        if (urlValue.startsWith('mongodb://') || urlValue.startsWith('mongodb+srv://')) {
            connectionURL = urlValue;
            console.log("Using environment variable for MongoDB connection");
            console.log("URL starts with:", connectionURL.substring(0, 20) + "...");
        } else {
            console.log("WARNING: Environment variable exists but has invalid format");
            console.log("Value starts with:", urlValue.substring(0, 20) + "...");
            connectionURL = FALLBACK_MONGO_URL;
            console.log("Using fallback MongoDB URL");
        }
    } else {
        console.log("Environment variable MONGO_CONNECTION_URL is undefined or empty");
        connectionURL = FALLBACK_MONGO_URL;
        console.log("Using fallback MongoDB URL");
    }
    
    // Database connection - with enhanced error handling
    try {
        console.log("Attempting to connect to MongoDB...");
        
        mongoose.connect(connectionURL, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });

        const connection = mongoose.connection;

        connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            if (err.name === 'MongoParseError') {
                console.error('This is a MongoDB connection string format error. Check your URL format.');
                console.error('Valid format examples: mongodb://user:pass@host:port/db or mongodb+srv://user:pass@host/db');
            }
        });

        connection.once('open', () => {
            console.log('MongoDB database connection established successfully 🥳🥳🥳🥳');
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        if (error.message.includes("Invalid scheme")) {
            console.error("The MongoDB connection URL is not properly formatted.");
            console.error("It should start with mongodb:// or mongodb+srv://");
        }
    }
}

module.exports = connectDB;
