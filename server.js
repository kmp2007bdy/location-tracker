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

app.use(express.static('public'));

let users = {};
let previousCount = 0;

io.on('connection', (socket) => {
    console.log('✅ New user connected:', socket.id);
    socket.emit('user-list', users);

    socket.on('set-username', (username) => {
        if (users[socket.id]) {
            users[socket.id].username = username || 'Anonymous';
            io.emit('user-list', users);
        }
    });

    socket.on('send-location', (data) => {
        users[socket.id] = {
            latitude: data.latitude,
            longitude: data.longitude,
            device: data.device || '💻 Unknown',
            connectedAt: new Date().toLocaleTimeString(),
            username: data.username || 'Anonymous',
            userAgent: data.userAgent || 'Unknown'
        };
        io.emit('update-location', {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            device: users[socket.id].device,
            connectedAt: users[socket.id].connectedAt,
            username: users[socket.id].username
        });
        io.emit('user-list', users);
        const count = Object.keys(users).length;
        io.emit('user-count', count);
        if (count > previousCount) {
            io.emit('user-joined', { username: users[socket.id].username });
        }
        previousCount = count;
    });

    socket.on('chat-message', (data) => {
        io.emit('chat-message', {
            ...data,
            userId: socket.id.slice(0, 6),
            username: users[socket.id]?.username || 'Anonymous'
        });
    });

    socket.on('sos-alert', (data) => {
        io.emit('sos-alert', {
            ...data,
            userId: socket.id.slice(0, 6),
            username: users[socket.id]?.username || 'Anonymous',
            socketId: socket.id
        });
    });

    socket.on('get-users', () => {
        socket.emit('user-list', users);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user-disconnected', socket.id);
        io.emit('user-list', users);
        const count = Object.keys(users).length;
        io.emit('user-count', count);
        previousCount = count;
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📊 Waiting for connections...');
});
