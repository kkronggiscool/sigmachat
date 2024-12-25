const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

// Middleware to redirect logged-in users
function redirectIfLoggedIn(req, res, next) {
    if (req.session.username) {
        return res.redirect('/home');
    }
    next();
}

// Routes
router.get('/', redirectIfLoggedIn, (req, res) => {
    res.render('index', { error: null });
});

router.get('/register', redirectIfLoggedIn, (req, res) => {
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('register', { error: 'Username and password are required.' });
    }

    try {
        const connection = await pool.getConnection();
        const [existingUser] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            connection.release();
            return res.render('register', { error: 'Username already exists. Please choose a different one.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        connection.release();
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'An error occurred during registration. Please try again later.' });
    }
});

router.post('/', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('index', { error: 'Username and password are required.' });
    }

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        connection.release();

        if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
            return res.render('index', { error: 'Invalid username or password.' });
        }

        req.session.username = username;
        res.redirect('/home');
    } catch (error) {
        console.error(error);
        res.render('index', { error: 'An error occurred during login. Please try again later.' });
    }
});

router.get('/home', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/');
    }
    res.render('home', { username: req.session.username });
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;
