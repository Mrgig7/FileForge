require('dotenv').config();
const mongoose = require('mongoose');

// Set strictQuery option to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

function connectDB() {
    // Database connection
    mongoose.connect(process.env.MONGO_CONNECTION_URL, { useNewUrlParser: true, useUnifiedTopology: true });


    const connection = mongoose.connection;

    connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
    });

    connection.once('open', () => {
        console.log('MongoDB database connection established successfully 🥳🥳🥳🥳');
    });
}

module.exports = connectDB;
