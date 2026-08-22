// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map').setView([40.7128, -74.0060], 13);

// Define map layers
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});

// Add default layer
let currentLayer = 'street';
streetLayer.addTo(map);

// ========================================
// 2. SOCKET CONNECTION
// ========================================
const socket = io();

let myLocation = null;
let username = '';
let previousCount = 0;

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

// ========================================
// 3. USERNAME SYSTEM
// ========================================
function joinApp() {
    const input = document.getElementById('username-input');
    username = input.value.trim() || 'Anonymous';
    document.getElementById('login-screen').style.display = 'none';

    // Send username to server
    socket.emit('set-username', username);

    // Start location tracking
    startLocationTracking();
}

document.getElementById('join-btn').addEventListener('click', joinApp);
document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinApp();
});

// ========================================
// 4. DEVICE DETECTION
// ========================================
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return '📱 Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
        return '📱 Phone';
    }
    return '💻 Laptop/Desktop';
}

const deviceType = getDeviceType();
console.log('📱 Device detected:', deviceType);

// ========================================
// 5. LOCATION TRACKING
// ========================================
function startLocationTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                myLocation = { latitude, longitude };

                socket.emit('send-location', {
                    latitude,
                    longitude,
                    device: deviceType,
                    username: username,
                    userAgent: navigator.userAgent.slice(0, 50)
                });

                map.setView([latitude, longitude], 15);
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        alert('❌ Geolocation is not supported by your browser.');
    }
}

// ========================================
// 6. MARKERS & LOCATION HISTORY
// ========================================
const markers = {};
const locationHistory = {};

// ========================================
// 7. RECEIVE LOCATION UPDATES
// ========================================
socket.on('update-location', (data) => {
    console.log('📍 Location update from:', data.id);
    const { id, latitude, longitude, device, connectedAt, username: userName } = data;

    if (id === socket.id) return;

    if (!locationHistory[id]) {
        locationHistory[id] = [];
    }
    locationHistory[id].push([latitude, longitude]);
    if (locationHistory[id].length > 50) {
        locationHistory[id].shift();
    }

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);

        // Update distance
        if (myLocation) {
            updatePopupWithDistance(id, latitude, longitude, device, connectedAt, userName);
        }

        if (locationHistory[id].length > 2 && markers[id].trail) {
            markers[id].trail.setLatLngs(locationHistory[id]);
        }
    } else {
        const isPhone = device && device.includes('Phone');
        const isTablet = device && device.includes('Tablet');
        const color = isPhone ? '#ff4757' : (isTablet ? '#2ed573' : '#1e90ff');
        const iconSize = isPhone ? 12 : (isTablet ? 15 : 18);
        const emoji = isPhone ? '📱' : (isTablet ? '📱' : '💻');

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};width:${iconSize}px;height:${iconSize}px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${iconSize * 0.5}px;">${emoji}</div>`,
            iconSize: [iconSize, iconSize]
        });

        const displayName = userName || id.slice(0, 6);
        markers[id] = L.marker([latitude, longitude], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
                <b>👤 ${displayName}</b><br>
                <b>📱 Device:</b> ${device || 'Unknown'}<br>
                <b>⏱ Since:</b> ${connectedAt || 'Just now'}
            `);

        if (locationHistory[id].length > 2) {
            const trail = L.polyline(locationHistory[id], {
                color: color,
                weight: 2,
                opacity: 0.4,
                dashArray: '5, 5'
            }).addTo(map);
            markers[id].trail = trail;
        }
    }
});

// ========================================
// 8. CALCULATE DISTANCE
// ========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function updatePopupWithDistance(id, lat, lon, device, connectedAt, userName) {
    if (!markers[id] || !myLocation) return;

    const dist = calculateDistance(
        myLocation.latitude, myLocation.longitude,
        lat, lon
    );
    const distanceText = dist < 1 ?
        `${(dist * 1000).toFixed(0)}m away` :
        `${dist.toFixed(2)}km away`;

    const displayName = userName || id.slice(0, 6);
    markers[id].setPopupContent(`
        <b>👤 ${displayName}</b><br>
        <b>📱 Device:</b> ${device || 'Unknown'}<br>
        <b>⏱ Since:</b> ${connectedAt || 'Just now'}<br>
        <b>📏 Distance:</b> ${distanceText}
    `);
}

// ========================================
// 9. USER DISCONNECT
// ========================================
socket.on('user-disconnected', (id) => {
    console.log('👋 User disconnected:', id);
    if (markers[id]) {
        if (markers[id].trail) {
            map.removeLayer(markers[id].trail);
        }
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    delete locationHistory[id];
});

// ========================================
// 10. USER COUNT & JOIN SOUND
// ========================================
socket.on('user-count', (count) => {
    document.getElementById('count').textContent = count;
});

socket.on('user-joined', (data) => {
    playSound('join');
});

// ========================================
// 11. USER LIST (SIDEBAR)
// ========================================
const userList = document.getElementById('user-list');

socket.on('user-list', (users) => {
    console.log('📋 User list updated:', Object.keys(users).length, 'users');

    if (!users || Object.keys(users).length === 0) {
        userList.innerHTML = '<div class="no-users">No users online</div>';
        return;
    }

    let html = '';
    let count = 0;
    for (const [id, data] of Object.entries(users)) {
        if (id === socket.id) continue;
        count++;
        const displayName = data.username || id.slice(0, 6);
        html += `
            <div class="user-item">
                <span class="user-device">${data.device || '💻'}</span>
                <span class="user-name">${displayName}</span>
                <span class="user-time">${data.connectedAt || ''}</span>
            </div>
        `;
    }

    if (count === 0) {
        userList.innerHTML = '<div class="no-users">No other users online</div>';
    } else {
        userList.innerHTML = html;
    }
});

socket.emit('get-users');

// ========================================
// 12. CHAT FUNCTIONALITY
// ========================================
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const messagesDiv = document.getElementById('messages');

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        console.log('📤 Sending message:', text);
        socket.emit('chat-message', {
            text: text,
            device: deviceType,
            timestamp: new Date().toLocaleTimeString()
        });
        chatInput.value = '';

        // Add own message
        addMessageToChat('You', deviceType, new Date().toLocaleTimeString(), text, true);
    }
}

function addMessageToChat(user, device, timestamp, text, isOwn = false) {
    const noMsg = messagesDiv.querySelector('.no-messages');
    if (noMsg) noMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message${isOwn ? ' own' : ''}`;
    msgDiv.innerHTML = `
        <div class="msg-meta">
            ${isOwn ? 'You' : user} · ${device || '💻'} · ${timestamp || ''}
        </div>
        <div class="msg-text">${text}</div>
    `;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

socket.on('chat-message', (data) => {
    console.log('💬 Received message from:', data.userId);
    playSound('message');
    const displayName = data.username || data.userId || 'Unknown';
    addMessageToChat(
        displayName,
        data.device || '💻',
        data.timestamp || '',
        data.text,
        false
    );
});

// ========================================
// 13. SOS BUTTON
// ========================================
document.getElementById('sos-button').addEventListener('click', () => {
    if (!myLocation) {
        alert('⏳ Getting your location...');
        return;
    }

    const { latitude, longitude } = myLocation;
    console.log('🚨 Sending SOS from:', latitude, longitude);

    socket.emit('sos-alert', {
        latitude,
        longitude,
        device: deviceType,
        time: new Date().toLocaleTimeString()
    });

    // Visual feedback
    const btn = document.getElementById('sos-button');
    btn.style.background = '#ff6b81';
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => {
        btn.style.background = '#ff4757';
        btn.style.transform = 'scale(1)';
    }, 1000);

    alert('🚨 SOS Alert sent to all online users!');
});

socket.on('sos-alert', (data) => {
    console.log('🚨 SOS ALERT RECEIVED from:', data.userId);
    playSound('sos');

    // Flash screen red
    document.body.style.backgroundColor = '#ff000055';
    document.body.style.transition = 'background-color 0.1s';

    // Flash 3 times
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        if (flashCount % 2 === 0) {
            document.body.style.backgroundColor = '#ff000088';
        } else {
            document.body.style.backgroundColor = '#ff000022';
        }
        flashCount++;
        if (flashCount > 5) {
            clearInterval(flashInterval);
            document.body.style.backgroundColor = '';
        }
    }, 300);

    const displayName = data.username || data.userId || 'Unknown';
    alert(`🚨🚨🚨 SOS ALERT! 🚨🚨🚨\n\nUser: ${displayName}\nDevice: ${data.device || 'Unknown'}\nTime: ${data.time || 'Just now'}\n\n📍 Location shared! Check map!`);

    if (data.latitude && data.longitude) {
        map.flyTo([data.latitude, data.longitude], 17, { duration: 2 });

        const sosIcon = L.divIcon({
            className: 'sos-marker',
            html: `<div style="background:#ff0000;width:30px;height:30px;border-radius:50%;border:4px solid white;box-shadow:0 0 30px rgba(255,0,0,0.8);display:flex;align-items:center;justify-content:center;font-size:20px;animation:pulse 1s infinite;">🆘</div>`,
            iconSize: [30, 30]
        });

        const sosMarker = L.marker([data.latitude, data.longitude], { icon: sosIcon })
            .addTo(map)
            .bindPopup(`
                <b style="color:red;">🚨 SOS ALERT!</b><br>
                <b>User:</b> ${displayName}<br>
                <b>Device:</b> ${data.device || 'Unknown'}<br>
                <b>Time:</b> ${data.time || 'Just now'}
            `)
            .openPopup();

        setTimeout(() => {
            map.removeLayer(sosMarker);
        }, 30000);
    }
});

// ========================================
// 14. MAP LAYER TOGGLES
// ========================================
const mapToggle = document.getElementById('map-toggle');

mapToggle.addEventListener('click', () => {
    map.removeLayer(streetLayer);
    map.removeLayer(satelliteLayer);

    if (currentLayer === 'street') {
        satelliteLayer.addTo(map);
        currentLayer = 'satellite';
        mapToggle.textContent = '🌍 Street View';
        mapToggle.style.background = '#1a252f';
    } else {
        streetLayer.addTo(map);
        currentLayer = 'street';
        mapToggle.textContent = '🛰️ Satellite';
        mapToggle.style.background = '#2c3e50';
    }
});

// ========================================
// 15. DARK MODE TOGGLE
// ========================================
const darkToggle = document.getElementById('dark-toggle');
let darkMode = false;

darkToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    darkToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// ========================================
// 16. SOUND EFFECTS
// ========================================
function playSound(type) {
    const sounds = {
        message: document.getElementById('sound-message'),
        sos: document.getElementById('sound-sos'),
        join: document.getElementById('sound-join')
    };
    const audio = sounds[type];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

// ========================================
// 17. MAP CLICK - TEMPORARY MARKER
// ========================================
map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    const tempIcon = L.divIcon({
        className: 'temp-marker',
        html: `<div style="background:#ffd93d;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 15px rgba(255,217,61,0.6);"></div>`,
        iconSize: [12, 12]
    });

    const tempMarker = L.marker([lat, lng], { icon: tempIcon })
        .addTo(map)
        .bindPopup(`📍 Clicked location<br>Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}`)
        .openPopup();

    setTimeout(() => {
        map.removeLayer(tempMarker);
    }, 5000);
});

// ========================================
// 18. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        darkToggle.click();
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        document.getElementById('sos-button').click();
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        mapToggle.click();
    }

    if (e.key === 'Escape') {
        map.closePopup();
    }
});

console.log('🚀 App loaded successfully!');
console.log('📱 Device:', deviceType);
console.log('👤 Username:', username);
console.log('⌨️ Shortcuts: Ctrl+Shift+D (Dark Mode), Ctrl+Shift+S (SOS), Ctrl+Shift+M (Map)');