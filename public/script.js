// ===== MAP =====
const map = L.map('map').setView([40.7128, -74.0060], 13);

const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
});
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});
let currentLayer = 'street';
streetLayer.addTo(map);

// ===== SOCKET =====
const socket = io();
let myLocation = null;
let username = '';
let previousCount = 0;

// ===== USERNAME =====
function joinApp() {
    const input = document.getElementById('username-input');
    username = input.value.trim() || 'Anonymous';
    document.getElementById('login-screen').style.display = 'none';
    socket.emit('set-username', username);
    startLocationTracking();
}
document.getElementById('join-btn').addEventListener('click', joinApp);
document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinApp();
});

// ===== DEVICE DETECTION =====
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return '📱 Tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) return '📱 Phone';
    return '💻 Laptop/Desktop';
}
const deviceType = getDeviceType();

// ===== LOCATION TRACKING =====
function startLocationTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                myLocation = { latitude, longitude };
                socket.emit('send-location', { latitude, longitude, device: deviceType, username });
                map.setView([latitude, longitude], 15);
            },
            (error) => console.error('Geolocation error:', error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

// ===== MARKERS =====
const markers = {};
const locationHistory = {};

// ===== RECEIVE LOCATION =====
socket.on('update-location', (data) => {
    const { id, latitude, longitude, device, connectedAt, username: userName } = data;
    if (id === socket.id) return;
    
    if (!locationHistory[id]) locationHistory[id] = [];
    locationHistory[id].push([latitude, longitude]);
    if (locationHistory[id].length > 50) locationHistory[id].shift();
    
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
        if (locationHistory[id].length > 2 && markers[id].trail) {
            markers[id].trail.setLatLngs(locationHistory[id]);
        }
    } else {
        const isPhone = device && device.includes('Phone');
        const color = isPhone ? '#ff4757' : '#1e90ff';
        const iconSize = isPhone ? 12 : 18;
        const emoji = isPhone ? '📱' : '💻';
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};width:${iconSize}px;height:${iconSize}px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${iconSize*0.5}px;">${emoji}</div>`,
            iconSize: [iconSize, iconSize]
        });
        markers[id] = L.marker([latitude, longitude], { icon: customIcon })
            .addTo(map)
            .bindPopup(`<b>👤 ${userName || id.slice(0, 6)}</b><br>📱 ${device || 'Unknown'}`);
        if (locationHistory[id].length > 2) {
            markers[id].trail = L.polyline(locationHistory[id], {
                color: color, weight: 2, opacity: 0.4, dashArray: '5, 5'
            }).addTo(map);
        }
    }
});

// ===== USER DISCONNECT =====
socket.on('user-disconnected', (id) => {
    if (markers[id]) {
        if (markers[id].trail) map.removeLayer(markers[id].trail);
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    delete locationHistory[id];
});

// ===== USER COUNT =====
socket.on('user-count', (count) => {
    document.getElementById('count').textContent = count;
});
socket.on('user-joined', () => { playSound('join'); });

// ===== USER LIST =====
const userList = document.getElementById('user-list');
socket.on('user-list', (users) => {
    if (!users || Object.keys(users).length === 0) {
        userList.innerHTML = '<div class="no-users">No users online</div>';
        return;
    }
    let html = '';
    let count = 0;
    for (const [id, data] of Object.entries(users)) {
        if (id === socket.id) continue;
        count++;
        html += `<div class="user-item">
            <span>${data.device || '💻'}</span>
            <span class="user-name">${data.username || id.slice(0, 6)}</span>
            <span class="user-time">${data.connectedAt || ''}</span>
        </div>`;
    }
    userList.innerHTML = count === 0 ? '<div class="no-users">No other users online</div>' : html;
});
socket.emit('get-users');

// ===== CHAT =====
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const messagesDiv = document.getElementById('messages');

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chat-message', { text, device: deviceType, timestamp: new Date().toLocaleTimeString() });
        chatInput.value = '';
        addMessageToChat('You', deviceType, new Date().toLocaleTimeString(), text, true);
    }
}
function addMessageToChat(user, device, timestamp, text, isOwn = false) {
    const noMsg = messagesDiv.querySelector('.no-messages');
    if (noMsg) noMsg.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = `message${isOwn ? ' own' : ''}`;
    msgDiv.innerHTML = `<div class="msg-meta">${isOwn ? 'You' : user} · ${device} · ${timestamp}</div><div class="msg-text">${text}</div>`;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

socket.on('chat-message', (data) => {
    playSound('message');
    addMessageToChat(data.username || data.userId || 'Unknown', data.device || '💻', data.timestamp || '', data.text, false);
});

// ===== SOS =====
document.getElementById('sos-button').addEventListener('click', () => {
    if (!myLocation) { alert('⏳ Getting your location...'); return; }
    socket.emit('sos-alert', {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        device: deviceType,
        time: new Date().toLocaleTimeString()
    });
    alert('🚨 SOS Alert sent!');
});

socket.on('sos-alert', (data) => {
    playSound('sos');
    document.body.style.backgroundColor = '#ff000055';
    setTimeout(() => document.body.style.backgroundColor = '', 3000);
    alert(`🚨 SOS ALERT!\nUser: ${data.username || data.userId || 'Unknown'}\nDevice: ${data.device}\nTime: ${data.time}`);
    if (data.latitude && data.longitude) {
        map.flyTo([data.latitude, data.longitude], 17, { duration: 2 });
        const sosIcon = L.divIcon({
            className: 'sos-marker',
            html: `<div style="background:#ff0000;width:30px;height:30px;border-radius:50%;border:4px solid white;box-shadow:0 0 30px rgba(255,0,0,0.8);display:flex;align-items:center;justify-content:center;font-size:20px;">🆘</div>`,
            iconSize: [30, 30]
        });
        const sosMarker = L.marker([data.latitude, data.longitude], { icon: sosIcon })
            .addTo(map)
            .bindPopup(`🚨 SOS!`)
            .openPopup();
        setTimeout(() => map.removeLayer(sosMarker), 30000);
    }
});

// ===== MAP TOGGLE =====
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

// ===== DARK MODE =====
const darkToggle = document.getElementById('dark-toggle');
let darkMode = false;
darkToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    darkToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// ===== SOUNDS =====
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

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); darkToggle.click(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); document.getElementById('sos-button').click(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); mapToggle.click(); }
    if (e.key === 'Escape') map.closePopup();
});

console.log('🚀 App loaded!');
console.log('📱 Device:', deviceType);
console.log('⌨️ Shortcuts: Ctrl+Shift+D (Dark), Ctrl+Shift+S (SOS), Ctrl+Shift+M (Map)');
