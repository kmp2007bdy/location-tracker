// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map', {
    center: [40.7128, -74.0060],
    zoom: 13,
    zoomControl: true,
    fadeAnimation: true,
    zoomAnimation: true
});

// ========================================
// 2. MAP LAYERS
// ========================================
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    })
};

let currentLayer = 'street';
layers.street.addTo(map);

// ========================================
// 3. STAY AREA TRACKING
// ========================================
const stayMarkers = {};
const stayRadius = {};

function getStayColor(durationMs) {
    const hours = durationMs / (1000 * 60 * 60);
    if (hours < 1) return '#4CAF50';
    if (hours < 3) return '#FFC107';
    if (hours < 6) return '#FF9800';
    return '#FF5722';
}

function formatStayDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

// ========================================
// 4. SOCKET CONNECTION
// ========================================
const socket = io();
let myLocation = null;
let username = 'User_' + Math.floor(Math.random() * 1000);
let previousCount = 0;

socket.on('connect', () => {
    console.log('✅ Connected to server');
    socket.emit('set-username', username);
    startLocationTracking();
});

socket.on('disconnect', () => console.log('❌ Disconnected'));

// ========================================
// 5. DEVICE DETECTION
// ========================================
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return '📱 Tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) return '📱 Phone';
    return '💻 Laptop/Desktop';
}
const deviceType = getDeviceType();
console.log('📱 Device:', deviceType);
console.log('👤 Auto-login as:', username);

// ========================================
// 6. LOCATION TRACKING
// ========================================
function startLocationTracking() {
    console.log('📍 Starting location tracking...');
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
            (error) => console.error('Geolocation error:', error), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        alert('❌ Geolocation not supported.');
    }
}

// ========================================
// 7. RECEIVE LOCATION UPDATES
// ========================================
const markers = {};
const locationHistory = {};
const routeLines = {};

socket.on('update-location', (data) => {
    const {
        id,
        latitude,
        longitude,
        device,
        connectedAt,
        username: userName,
        lastUpdate,
        arrivalTime,
        isStaying,
        stayDuration,
        isActive
    } = data;
    if (id === socket.id) return;

    if (!locationHistory[id]) locationHistory[id] = [];
    locationHistory[id].push([latitude, longitude]);
    if (locationHistory[id].length > 50) locationHistory[id].shift();

    let distance = 0;
    let duration = 0;
    let speedText = '🚶 Walking';

    if (myLocation) {
        distance = calculateDistance(
            myLocation.latitude, myLocation.longitude,
            latitude, longitude
        );
        const speed = device && device.includes('Phone') ? 5 : 50;
        duration = calculateDuration(distance, speed);
        speedText = device && device.includes('Phone') ? '🚶 Walking' : '🚗 Driving';
    }

    const status = isActive ? (isStaying ? '🟢 Staying' : '🟠 Moving') : '🔴 Inactive';
    const stayTime = stayDuration ? formatStayDuration(stayDuration) : 'Just arrived';

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
        const displayName = userName || id.slice(0, 6);
        markers[id].setPopupContent(`
            <b>👤 ${displayName}</b><br>
            📱 ${device || 'Unknown'}<br>
            ${status}<br>
            ⏱️ ${stayTime}<br>
            📏 ${formatDistance(distance)}<br>
            ⏱️ ${formatDuration(duration)}
        `);

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

        const displayName = userName || id.slice(0, 6);
        markers[id] = L.marker([latitude, longitude], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
                <b>👤 ${displayName}</b><br>
                📱 ${device || 'Unknown'}<br>
                ${status}<br>
                ⏱️ ${stayTime}<br>
                📏 ${formatDistance(distance)}<br>
                ⏱️ ${formatDuration(duration)}
            `);

        if (locationHistory[id].length > 2) {
            markers[id].trail = L.polyline(locationHistory[id], {
                color: color,
                weight: 2,
                opacity: 0.3,
                dashArray: '5, 5'
            }).addTo(map);
        }
    }
});

// ========================================
// 8. STAY AREA VISUALIZATION
// ========================================
socket.on('stay-areas', (areas) => {
    Object.values(stayMarkers).forEach(marker => map.removeLayer(marker));
    Object.values(stayRadius).forEach(circle => map.removeLayer(circle));
    Object.keys(stayMarkers).forEach(key => delete stayMarkers[key]);
    Object.keys(stayRadius).forEach(key => delete stayRadius[key]);

    for (const [userId, area] of Object.entries(areas)) {
        const stayTime = Date.now() - area.startTime;
        const color = getStayColor(stayTime);
        const formattedTime = formatStayDuration(stayTime);

        stayMarkers[userId] = L.marker([area.lat, area.lng], {
                icon: L.divIcon({
                    className: 'stay-marker',
                    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 20px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12]
                })
            }).addTo(map)
            .bindPopup(`
            <b>📍 Stay Area</b><br>
            ⏱️ ${formattedTime}<br>
            👤 ${userId.slice(0, 6)}
        `);

        stayRadius[userId] = L.circle([area.lat, area.lng], {
            radius: 50,
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2
        }).addTo(map);
    }
});

// ========================================
// 9. CALCULATIONS
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

function calculateDuration(distanceKm, speedKmh = 5) {
    const hours = distanceKm / speedKmh;
    const minutes = Math.round(hours * 60);
    return minutes;
}

function formatDuration(minutes) {
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function formatDistance(km) {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    return `${km.toFixed(2)} km`;
}

// ========================================
// 10. USER DISCONNECT
// ========================================
socket.on('user-disconnected', (id) => {
    if (markers[id]) {
        if (markers[id].trail) map.removeLayer(markers[id].trail);
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    if (routeLines[id]) {
        map.removeLayer(routeLines[id]);
        delete routeLines[id];
    }
    delete locationHistory[id];
});

// ========================================
// 11. USER COUNT & LIST
// ========================================
socket.on('user-count', (count) => {
    document.getElementById('count').textContent = count;
});

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
        const status = data.isStaying ? '🟢' : '🟠';
        const stayTime = data.stayDuration ? formatStayDuration(data.stayDuration) : 'Just arrived';
        html += `<div class="user-item">
            <span>${data.device || '💻'}</span>
            <span class="user-name">${data.username || id.slice(0, 6)}</span>
            <span class="user-status">${status}</span>
            <span class="user-time">${stayTime}</span>
        </div>`;
    }
    userList.innerHTML = count === 0 ? '<div class="no-users">No other users online</div>' : html;
});
socket.emit('get-users');

// ========================================
// 12. CHAT
// ========================================
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

// ========================================
// 13. SOS
// ========================================
document.getElementById('sos-button').addEventListener('click', function(e) {
    e.preventDefault();
    if (!myLocation) { alert('⏳ Getting location...'); return; }
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

// ========================================
// 14. SOUNDS
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
// 15. MAP CLICK - ADDRESS
// ========================================
map.on('click', async function(e) {
            const { lat, lng } = e.latlng;
            const popup = L.popup().setLatLng([lat, lng]).setContent('🔍 Getting address...').openOn(map);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const data = await response.json();
                if (data && data.display_name) {
                    const parts = data.display_name.split(',');
                    const streetName = parts[0] || 'Unknown street';
                    const city = parts[1] || '';
                    const country = parts[parts.length - 1] || '';
                    popup.setContent(`<b>📍 ${streetName}</b><br>${city ? `${city.trim()}, ` : ''}${country.trim()}<br><small style="color:#666;">Click again to search</small>`);
        } else {
            popup.setContent(`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    } catch (error) {
        console.error('Error:', error);
        popup.setContent(`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
});

// ========================================
// 16. MAP STYLE TOGGLES
// ========================================
let isSatelliteMode = false;
document.getElementById('toggle-satellite').addEventListener('click', function() {
    isSatelliteMode = !isSatelliteMode;
    map.removeLayer(layers.street);
    map.removeLayer(layers.satellite);
    if (isSatelliteMode) {
        layers.satellite.addTo(map);
        this.textContent = '🗺️ Street';
    } else {
        layers.street.addTo(map);
        this.textContent = '🛰️ Satellite';
    }
});

// ========================================
// 17. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        document.getElementById('sos-button').click();
    }
    if (e.key === 'Escape') map.closePopup();
});

// ========================================
// 18. INITIALIZE
// ========================================
console.log('🚀 App loaded!');
console.log('📱 Device:', deviceType);
console.log('📍 Stay area tracking enabled!');
console.log('👤 Auto-logged in as:', username);
console.log('📊 Features:');
console.log('  - Real-time location tracking');
console.log('  - Stay duration tracking');
console.log('  - Active/Inactive status');
console.log('  - Stay area heatmap');
console.log('  - Distance & ETA');
console.log('  - Live chat & SOS');