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

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static('public'));

let users = {};
let previousCount = 0;
let stayAreas = {};

io.on('connection', (socket) => {
    console.log('✅ New user connected:', socket.id);
    socket.emit('user-list', users);
    socket.emit('stay-areas', stayAreas);

    socket.on('set-username', (username) => {
        if (users[socket.id]) {
            users[socket.id].username = username || 'Anonymous';
            io.emit('user-list', users);
        }
    });

    socket.on('send-location', (data) => {
        const now = Date.now();
        const isActive = true;
        
        // Check if user is staying in same area (within 50 meters)
        const isStaying = users[socket.id] && 
            calculateDistance(
                users[socket.id].latitude, 
                users[socket.id].longitude,
                data.latitude, 
                data.longitude
            ) < 0.05;
        
        const stayDuration = isStaying && users[socket.id] ? 
            now - users[socket.id].arrivalTime : 0;
        
        users[socket.id] = {
            latitude: data.latitude,
            longitude: data.longitude,
            device: data.device || '💻 Unknown',
            connectedAt: new Date().toLocaleTimeString(),
            username: data.username || 'Anonymous',
            userAgent: data.userAgent || 'Unknown',
            lastUpdate: now,
            arrivalTime: (users[socket.id] && users[socket.id].arrivalTime) || now,
            isStaying: isStaying,
            stayDuration: stayDuration,
            isActive: isActive
        };
        
        // Update stay areas
        updateStayAreas(socket.id, data.latitude, data.longitude, isStaying);
        
        io.emit('update-location', {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            device: users[socket.id].device,
            connectedAt: users[socket.id].connectedAt,
            username: users[socket.id].username,
            lastUpdate: users[socket.id].lastUpdate,
            arrivalTime: users[socket.id].arrivalTime,
            isStaying: users[socket.id].isStaying,
            stayDuration: users[socket.id].stayDuration,
            isActive: users[socket.id].isActive
        });
        
        io.emit('user-list', users);
        io.emit('stay-areas', stayAreas);
        
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
            username: (users[socket.id] && users[socket.id].username) || 'Anonymous'
        });
    });

    socket.on('sos-alert', (data) => {
        io.emit('sos-alert', {
            ...data,
            userId: socket.id.slice(0, 6),
            username: (users[socket.id] && users[socket.id].username) || 'Anonymous',
            socketId: socket.id
        });
    });

    socket.on('get-users', () => {
        socket.emit('user-list', users);
        socket.emit('stay-areas', stayAreas);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        delete stayAreas[socket.id];
        io.emit('user-disconnected', socket.id);
        io.emit('user-list', users);
        io.emit('stay-areas', stayAreas);
        const count = Object.keys(users).length;
        io.emit('user-count', count);
        previousCount = count;
    });
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function updateStayAreas(userId, lat, lng, isStaying) {
    if (isStaying) {
        if (!stayAreas[userId]) {
            stayAreas[userId] = {
                lat: lat,
                lng: lng,
                startTime: Date.now(),
                lastUpdate: Date.now(),
                users: [userId]
            };
        } else {
            stayAreas[userId].lat = lat;
            stayAreas[userId].lng = lng;
            stayAreas[userId].lastUpdate = Date.now();
        }
    } else {
        if (stayAreas[userId]) {
            delete stayAreas[userId];
        }
    }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📊 Waiting for connections...');
});
