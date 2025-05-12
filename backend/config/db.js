require('dotenv').config();
const mongoose = require('mongoose');

// Set strictQuery option to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

function connectDB() {
    // Debug MongoDB connection
    console.log("MongoDB connection debugging:");
    console.log("MONGO_CONNECTION_URL exists:", !!process.env.MONGO_CONNECTION_URL);
    console.log("MONGO_CONNECTION_URL type:", typeof process.env.MONGO_CONNECTION_URL);
    
    if (process.env.MONGO_CONNECTION_URL) {
        console.log("MONGO_CONNECTION_URL starts with:", process.env.MONGO_CONNECTION_URL.substring(0, 20) + "...");
    } else {
        console.log("MONGO_CONNECTION_URL is undefined or empty");
    }
    
    // Database connection - with fallback for debugging
    try {
        mongoose.connect(process.env.MONGO_CONNECTION_URL, { 
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
            console.error("The MONGO_CONNECTION_URL environment variable is not properly formatted.");
            console.error("It should start with mongodb:// or mongodb+srv://");
        }
    }
}

module.exports = connectDB;
