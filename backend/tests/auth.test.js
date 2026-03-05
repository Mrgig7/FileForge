const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

const mockUser = {
    save: jest.fn().mockResolvedValue(true)
};
const MockUserModel = jest.fn().mockImplementation(() => mockUser);
MockUserModel.findOne = jest.fn().mockResolvedValue(null);

jest.mock('../models/User', () => MockUserModel);

jest.mock('../middleware/auth', () => ({
    ensureGuest: (req, res, next) => next(),
    ensureAuthenticated: (req, res, next) => next(),
    ensureApiAuth: (req, res, next) => next()
}));

jest.mock('passport', () => ({
    authenticate: () => (req, res, next) => next()
}));

const authRouter = require('../routes/auth');

const app = express();
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    req.flash = jest.fn();
    req.isAuthenticated = jest.fn().mockReturnValue(false);
    next();
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.response.render = jest.fn();

app.use('/auth', authRouter);

describe('Auth routes security', () => {
    describe('POST /auth/register', () => {
        it('should sanitize returnTo to prevent open redirects', async () => {
            const res = await request(app)
                .post('/auth/register')
                .type('form')
                .send({
                    name: 'Test',
                    email: 'test@example.com',
                    password: 'password123',
                    confirmPassword: 'password123',
                    returnTo: 'https://malicious.com'
                });

            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/auth/login?returnTo=%2Fdashboard');
        });

        it('should allow valid relative returnTo paths', async () => {
            const res = await request(app)
                .post('/auth/register')
                .type('form')
                .send({
                    name: 'Test',
                    email: 'test2@example.com',
                    password: 'password123',
                    confirmPassword: 'password123',
                    returnTo: '/my-files'
                });

            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/auth/login?returnTo=%2Fmy-files');
        });
    });
});
