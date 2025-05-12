require('dotenv').config();
const mongoose = require('mongoose');

// Set strictQuery option to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

function connectDB() {
    // Debug MongoDB connection
    console.log("MongoDB connection debugging:");
    console.log("MONGO_CONNECTION_URL exists:", !!process.env.MONGO_CONNECTION_URL);
    console.log("MONGO_CONNECTION_URL type:", typeof process.env.MONGO_CONNECTION_URL);
    
    // Define a fallback MongoDB connection string for production
    // This is a temporary solution until environment variables are properly set in Vercel
    const FALLBACK_MONGO_URL = "mongodb+srv://nitesh_01:6UZsptd3070RWHHw@filesharingmanager.w6zlzbj.mongodb.net/?retryWrites=true&w=majority&appName=FileSharingManager";
    
    if (process.env.MONGO_CONNECTION_URL) {
        console.log("MONGO_CONNECTION_URL starts with:", process.env.MONGO_CONNECTION_URL.substring(0, 20) + "...");
    } else {
        console.log("MONGO_CONNECTION_URL is undefined or empty, using fallback URL");
    }
    
    // Use environment variable if available, otherwise use fallback
    const connectionURL = process.env.MONGO_CONNECTION_URL || FALLBACK_MONGO_URL;
    
    // Database connection - with fallback for debugging
    try {
        console.log("Attempting to connect with URL starting with:", connectionURL.substring(0, 20) + "...");
        
        mongoose.connect(connectionURL, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });

        const connection = mongoose.connection;

        connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
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
