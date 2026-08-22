const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from "public" folder
app.use(express.static('public'));

// Store users with their details
let users = {};
let previousCount = 0;

// When a client connects
io.on('connection', (socket) => {
    console.log('✅ New user connected:', socket.id);

    // Send current user list to the new user
    socket.emit('user-list', users);

    // Handle username setting
    socket.on('set-username', (username) => {
        if (users[socket.id]) {
            users[socket.id].username = username || 'Anonymous';
            io.emit('user-list', users);
        }
    });

    // When user sends their location
    socket.on('send-location', (data) => {
        console.log(`📍 Location received from ${socket.id}:`, data.latitude, data.longitude);

        users[socket.id] = {
            latitude: data.latitude,
            longitude: data.longitude,
            device: data.device || '💻 Unknown',
            connectedAt: new Date().toLocaleTimeString(),
            username: data.username || 'Anonymous',
            userAgent: data.userAgent || 'Unknown'
        };

        // Broadcast updated location to ALL users
        io.emit('update-location', {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            device: users[socket.id].device,
            connectedAt: users[socket.id].connectedAt,
            username: users[socket.id].username
        });

        // Update user list for everyone
        io.emit('user-list', users);
        const count = Object.keys(users).length;
        io.emit('user-count', count);

        // Play join sound if someone new joined
        if (count > previousCount) {
            io.emit('user-joined', { username: users[socket.id].username });
        }
        previousCount = count;
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        console.log(`💬 Chat from ${socket.id}:`, data.text);
        io.emit('chat-message', {
            ...data,
            userId: socket.id.slice(0, 6),
            username: users[socket.id] ? .username || 'Anonymous'
        });
    });

    // Handle SOS alerts
    socket.on('sos-alert', (data) => {
        console.log(`🚨 SOS ALERT from ${socket.id}!`);
        io.emit('sos-alert', {
            ...data,
            userId: socket.id.slice(0, 6),
            username: users[socket.id] ? .username || 'Anonymous',
            socketId: socket.id
        });
    });

    // Handle request for user list
    socket.on('get-users', () => {
        socket.emit('user-list', users);
    });

    // When user disconnects
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('user-disconnected', socket.id);
        io.emit('user-list', users);
        const count = Object.keys(users).length;
        io.emit('user-count', count);
        previousCount = count;
        console.log('📊 Users online:', count);
    });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Waiting for connections...`);
});