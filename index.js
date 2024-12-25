const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Attach socket.io to the server
const pool = require('./db'); // Database connection pool

const PORT = 52864;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public/')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.set('view engine', 'ejs');

// Routes
const routes = require('./routes/routing');
app.use('/', routes);

// Socket.io handling
io.on('connection', (socket) => {
    console.log('A user connected.');

    // Load past messages from the database when a user connects
    socket.on('loadMessages', async () => {
        try {
            const connection = await pool.getConnection();
            const [messages] = await connection.query('SELECT username, message FROM messages');
            connection.release();
            socket.emit('messagesLoaded', messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    });

    // Handle new chat messages
    socket.on('chatMessage', async (data) => {
        const { username, message } = data;
        const formattedMessage = `${username}: ${message}`;

        // Broadcast message to all connected clients
        io.emit('chatMessage', formattedMessage);

        // Save message to the database
        try {
            const connection = await pool.getConnection();
            await connection.query('INSERT INTO messages (username, message) VALUES (?, ?)', [username, message]);
            connection.release();
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected.');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
