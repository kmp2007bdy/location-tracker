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

// When a client connects
io.on('connection', (socket) => {
    console.log('✅ New user connected:', socket.id);

    // Send current user list to the new user
    socket.emit('user-list', users);

    // When user sends their location
    socket.on('send-location', (data) => {
        console.log(`📍 Location received from ${socket.id}:`, data.latitude, data.longitude);

        users[socket.id] = {
            latitude: data.latitude,
            longitude: data.longitude,
            device: data.device || '💻 Unknown',
            connectedAt: new Date().toLocaleTimeString(),
            userAgent: data.userAgent || 'Unknown'
        };

        // Broadcast updated location to ALL users
        io.emit('update-location', {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            device: users[socket.id].device,
            connectedAt: users[socket.id].connectedAt
        });

        // Update user list for everyone
        io.emit('user-list', users);
        io.emit('user-count', Object.keys(users).length);
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        console.log(`💬 Chat from ${socket.id}:`, data.text);
        io.emit('chat-message', {
            ...data,
            userId: socket.id.slice(0, 6)
        });
    });

    // Handle SOS alerts
    socket.on('sos-alert', (data) => {
        console.log(`🚨 SOS ALERT from ${socket.id}!`);
        // Broadcast SOS to ALL users including sender
        io.emit('sos-alert', {
            ...data,
            userId: socket.id.slice(0, 6),
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
        io.emit('user-count', Object.keys(users).length);
        console.log('📊 Users online:', Object.keys(users).length);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Waiting for connections...`);
});