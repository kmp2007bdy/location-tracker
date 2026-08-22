// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map').setView([40.7128, -74.0060], 13);

// ========================================
// 2. MAP LAYERS (With Street Names)
// ========================================
const mapLayers = {
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    })
};

let currentLayer = 'carto';
mapLayers.carto.addTo(map);

// ========================================
// 3. MAP STYLE SELECTOR
// ========================================
const styleBtns = document.querySelectorAll('.map-style-btn');
styleBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        styleBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        Object.values(mapLayers).forEach(layer => map.removeLayer(layer));
        const layerName = this.dataset.layer;
        mapLayers[layerName].addTo(map);
        currentLayer = layerName;
    });
});

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
// 6. ROUTE CALCULATIONS (Like Google Maps)
// ========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateDuration(distanceKm, speedKmh = 5) {
    // Default speed: 5 km/h (walking)
    // You can change to: 50 km/h (driving), 15 km/h (biking)
    const hours = distanceKm / speedKmh;
    const minutes = Math.round(hours * 60);
    return minutes;
}

function getSpeedText(deviceType) {
    if (deviceType && deviceType.includes('Phone')) {
        return '🚶 Walking'; // Walking speed for phones
    }
    return '🚗 Driving'; // Driving speed for laptops
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
// 7. LOCATION TRACKING
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
            (error) => console.error('Geolocation error:', error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        alert('❌ Geolocation not supported.');
    }
}

// ========================================
// 8. MARKERS & ROUTES
// ========================================
const markers = {};
const locationHistory = {};
const routeLines = {};

// ========================================
// 9. RECEIVE LOCATION UPDATES (With Route Info)
// ========================================
socket.on('update-location', (data) => {
    const { id, latitude, longitude, device, connectedAt, username: userName, lastUpdate } = data;
    if (id === socket.id) return;
    
    if (!locationHistory[id]) locationHistory[id] = [];
    locationHistory[id].push([latitude, longitude]);
    if (locationHistory[id].length > 50) locationHistory[id].shift();
    
    // Calculate route info
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
    
    // Update or create marker
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
        
        // Update popup with route info
        const displayName = userName || id.slice(0, 6);
        markers[id].setPopupContent(`
            <b>👤 ${displayName}</b><br>
            📱 ${device || 'Unknown'}<br>
            📏 Distance: ${formatDistance(distance)}<br>
            ⏱️ ETA: ${formatDuration(duration)}<br>
            ${speedText}
        `);
        
        // Update route line
        if (myLocation && routeLines[id]) {
            routeLines[id].setLatLngs([
                [myLocation.latitude, myLocation.longitude],
                [latitude, longitude]
            ]);
        }
        
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
                📏 Distance: ${formatDistance(distance)}<br>
                ⏱️ ETA: ${formatDuration(duration)}<br>
                ${speedText}
            `);
        
        // Draw route line to this user
        if (myLocation) {
            routeLines[id] = L.polyline([
                [myLocation.latitude, myLocation.longitude],
                [latitude, longitude]
            ], {
                color: color,
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 6'
            }).addTo(map);
        }
        
        // Trail
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
socket.on('user-joined', () => playSound('join'));

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
// 14. DARK MODE
// ========================================
const darkToggle = document.getElementById('dark-toggle');
let darkMode = false;
darkToggle.addEventListener('click', function(e) {
    e.preventDefault();
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    darkToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// ========================================
// 15. SOUNDS
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
// 16. MAP CLICK - ADDRESS
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
// 17. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); darkToggle.click(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); document.getElementById('sos-button').click(); }
    if (e.ctrlKey && e.shiftKey && e.key === '1') { e.preventDefault(); document.querySelector('[data-layer="carto"]').click(); }
    if (e.ctrlKey && e.shiftKey && e.key === '2') { e.preventDefault(); document.querySelector('[data-layer="satellite"]').click(); }
    if (e.ctrlKey && e.shiftKey && e.key === '3') { e.preventDefault(); document.querySelector('[data-layer="osm"]').click(); }
    if (e.ctrlKey && e.shiftKey && e.key === '4') { e.preventDefault(); document.querySelector('[data-layer="dark"]').click(); }
    if (e.key === 'Escape') map.closePopup();
});

console.log('🚀 App loaded!');
console.log('📱 Device:', deviceType);
console.log('👤 Auto-logged in as:', username);
console.log('✅ Route & duration tracking enabled!');
console.log('📏 Click any user marker to see distance and ETA');
console.log('⌨️ Shortcuts: Ctrl+Shift+D (Dark), Ctrl+Shift+S (SOS), Ctrl+Shift+1-4 (Maps)');
