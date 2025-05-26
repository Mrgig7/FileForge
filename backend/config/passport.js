const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// Local strategy using email and password
passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
        try {
            // Find user by email and explicitly include password field
            // The password field has select: false by default, so we need to explicitly include it
            const user = await User.findOne({ email }).select('+password');

            // If user doesn't exist
            if (!user) {
                return done(null, false, { message: 'Incorrect email or password' });
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect email or password' });
            }

            // If successful
            return done(null, user);
        } catch (error) {
            console.error('Passport authentication error:', error);
            return done(error);
        }
    }
));

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

module.exports = passport;