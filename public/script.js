// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map').setView([40.7128, -74.0060], 13);

// ========================================
// 2. DYNAMIC MAP STYLES (Like Google Maps)
// ========================================

// Define all map styles
const mapStyles = {
    // 1. Standard Street Map
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }),
    
    // 2. Satellite View
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    }),
    
    // 3. Dark Mode Map (like Google Dark)
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    }),
    
    // 4. Vintage/Retro Style
    vintage: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    }),
    
    // 5. Green/Nature Theme
    green: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    }),
    
    // 6. Light Gray (Clean)
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    }),
    
    // 7. Outdoors (Topographic)
    outdoors: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap',
        maxZoom: 17
    }),
    
    // 8. Watercolor (Artistic)
    watercolor: L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
        attribution: '© Stamen',
        maxZoom: 18,
        subdomains: 'abcd'
    })
};

// Current active style
let currentStyle = 'street';
mapStyles.street.addTo(map);

// ========================================
// 3. MAP STYLE SWITCHER UI
// ========================================

// Create style switcher buttons
function createStyleSwitcher() {
    const container = document.createElement('div');
    container.id = 'style-switcher';
    container.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(10px);
        padding: 8px 12px;
        border-radius: 30px;
        display: flex;
        gap: 6px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        flex-wrap: wrap;
        justify-content: center;
        max-width: 90%;
    `;
    
    const styles = [
        { id: 'street', label: '🗺️ Street' },
        { id: 'satellite', label: '🛰️ Satellite' },
        { id: 'dark', label: '🌙 Dark' },
        { id: 'vintage', label: '🎨 Vintage' },
        { id: 'green', label: '🌿 Green' },
        { id: 'light', label: '☀️ Light' },
        { id: 'outdoors', label: '⛰️ Outdoors' },
        { id: 'watercolor', label: '🎨 Watercolor' }
    ];
    
    styles.forEach(style => {
        const btn = document.createElement('button');
        btn.id = `style-${style.id}`;
        btn.textContent = style.label;
        btn.style.cssText = `
            padding: 6px 14px;
            background: ${style.id === currentStyle ? '#2c3e50' : 'transparent'};
            color: ${style.id === currentStyle ? 'white' : '#ccc'};
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.3s;
            white-space: nowrap;
            font-weight: ${style.id === currentStyle ? '600' : '400'};
        `;
        
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            switchMapStyle(style.id);
        });
        
        // Touch support
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            switchMapStyle(style.id);
        });
        
        container.appendChild(btn);
    });
    
    document.body.appendChild(container);
}

// ========================================
// 4. SWITCH MAP STYLE FUNCTION
// ========================================
function switchMapStyle(styleId) {
    console.log('🔄 Switching to:', styleId);
    
    // Remove current layer
    Object.values(mapStyles).forEach(layer => {
        map.removeLayer(layer);
    });
    
    // Add selected layer
    if (mapStyles[styleId]) {
        mapStyles[styleId].addTo(map);
        currentStyle = styleId;
        
        // Update button styles
        document.querySelectorAll('#style-switcher button').forEach(btn => {
            const isActive = btn.id === `style-${styleId}`;
            btn.style.background = isActive ? '#2c3e50' : 'transparent';
            btn.style.color = isActive ? 'white' : '#ccc';
            btn.style.fontWeight = isActive ? '600' : '400';
        });
        
        // Show notification
        showNotification(`🗺️ ${styleId.charAt(0).toUpperCase() + styleId.slice(1)} mode`);
    } else {
        console.error('Style not found:', styleId);
        // Fallback to street
        mapStyles.street.addTo(map);
        currentStyle = 'street';
    }
}

// ========================================
// 5. NOTIFICATION SYSTEM
// ========================================
function showNotification(message) {
    // Remove existing notification
    const existing = document.getElementById('map-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'map-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1001;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 20px;
        border-radius: 20px;
        font-size: 13px;
        font-family: -apple-system, Arial, sans-serif;
        backdrop-filter: blur(10px);
        animation: notificationFade 2s ease-out;
        pointer-events: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes notificationFade {
            0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
            20% { opacity: 1; transform: translateX(-50%) translateY(0); }
            80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// ========================================
// 6. SOCKET CONNECTION
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
// 7. DEVICE DETECTION
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
// 8. ROUTE CALCULATIONS
// ========================================
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
// 9. LOCATION TRACKING
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
// 10. MARKERS & ROUTES
// ========================================
const markers = {};
const locationHistory = {};
const routeLines = {};

// ========================================
// 11. RECEIVE LOCATION UPDATES
// ========================================
socket.on('update-location', (data) => {
    const { id, latitude, longitude, device, connectedAt, username: userName, lastUpdate } = data;
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
    
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
        const displayName = userName || id.slice(0, 6);
        markers[id].setPopupContent(`
            <b>👤 ${displayName}</b><br>
            📱 ${device || 'Unknown'}<br>
            📏 Distance: ${formatDistance(distance)}<br>
            ⏱️ ETA: ${formatDuration(duration)}<br>
            ${speedText}
        `);
        
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
// 12. USER DISCONNECT
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
// 13. USER COUNT & LIST
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
// 14. CHAT
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
// 15. SOS
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
// 16. DARK MODE (App Theme)
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
// 17. SOUNDS
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
// 18. MAP CLICK - ADDRESS
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
// 19. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); darkToggle.click(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); document.getElementById('sos-button').click(); }
    if (e.key === 'Escape') map.closePopup();
});

// ========================================
// 20. INITIALIZE STYLE SWITCHER
// ========================================
// Wait for DOM to load before creating the switcher
document.addEventListener('DOMContentLoaded', function() {
    createStyleSwitcher();
    console.log('🗺️ Dynamic map style switcher loaded!');
    console.log('📱 Available styles: Street, Satellite, Dark, Vintage, Green, Light, Outdoors, Watercolor');
});

console.log('🚀 App loaded!');
console.log('📱 Device:', deviceType);
console.log('👤 Auto-logged in as:', username);
console.log('🗺️ Click the buttons at the bottom to change map style!');
console.log('⌨️ Shortcuts: Ctrl+Shift+D (Dark Mode), Ctrl+Shift+S (SOS)');
