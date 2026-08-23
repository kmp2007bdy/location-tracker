// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map', {
    center: [40.7128, -74.0060],
    zoom: 13,
    zoomControl: true,
    fadeAnimation: true,
    zoomAnimation: true,
    inertia: true,
    inertiaDeceleration: 2000,
    inertiaMaxSpeed: 1000
});

// ========================================
// 2. 3D MAP LAYERS
// ========================================
let is3DMode = false;
let isSatelliteMode = false;
let terrainLayer = null;
let buildingsLayer = null;
let _3dRoutes = [];

// Base layers
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    })
};

let currentLayer = 'street';
layers.street.addTo(map);

// ========================================
// 3. 3D TERRAIN (Apple Maps Style)
// ========================================
function enable3DMode() {
    if (is3DMode) return;
    
    console.log('🌍 Enabling 3D mode...');
    is3DMode = true;
    
    // Add 3D terrain
    terrainLayer = L.terrain({
        source: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        maxZoom: 14
    });
    terrainLayer.addTo(map);
    
    // Add 3D buildings (using OSM building data)
    buildingsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        opacity: 0.3
    });
    buildingsLayer.addTo(map);
    
    // Enable 3D rotation
    map.getContainer().style.transition = 'transform 0.5s';
    
    // Tilt the map (like Apple Maps)
    if (map._controlContainer) {
        // Add tilt controls
        addTiltControls();
    }
    
    // Update existing routes to be 3D
    updateRoutes3D();
    
    document.getElementById('toggle-3d').textContent = '⬆️ 2D Mode';
    showNotification('🌍 3D Mode Enabled');
}

function disable3DMode() {
    if (!is3DMode) return;
    
    console.log('⬆️ Disabling 3D mode...');
    is3DMode = false;
    
    if (terrainLayer) {
        map.removeLayer(terrainLayer);
        terrainLayer = null;
    }
    if (buildingsLayer) {
        map.removeLayer(buildingsLayer);
        buildingsLayer = null;
    }
    
    // Reset tilt
    map.setView(map.getCenter(), map.getZoom());
    
    document.getElementById('toggle-3d').textContent = '🌍 3D Mode';
    showNotification('⬆️ 2D Mode Enabled');
}

function toggle3DMode() {
    if (is3DMode) {
        disable3DMode();
    } else {
        enable3DMode();
    }
}

// ========================================
// 4. SATELLITE MODE
// ========================================
function toggleSatelliteMode() {
    isSatelliteMode = !isSatelliteMode;
    
    if (isSatelliteMode) {
        map.removeLayer(layers.street);
        map.removeLayer(layers.dark);
        layers.satellite.addTo(map);
        document.getElementById('toggle-satellite').textContent = '🗺️ Street View';
        showNotification('🛰️ Satellite Mode');
        
        // Enable 3D with satellite
        if (!is3DMode) {
            enable3DMode();
        }
    } else {
        map.removeLayer(layers.satellite);
        if (currentLayer === 'street') {
            layers.street.addTo(map);
        } else {
            layers.dark.addTo(map);
        }
        document.getElementById('toggle-satellite').textContent = '🛰️ Satellite';
        showNotification('🗺️ Street View');
        
        // Disable 3D if no satellite
        if (is3DMode) {
            disable3DMode();
        }
    }
}

// ========================================
// 5. 3D ROUTE CREATION (Apple Maps Style)
// ========================================
function create3DRoute(startLat, startLng, endLat, endLng, color = '#007aff') {
    // Create a 3D route with altitude
    const routePoints = [];
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const lat = startLat + (endLat - startLat) * t;
        const lng = startLng + (endLng - startLng) * t;
        
        // Add altitude for 3D effect (sine wave like Apple Maps)
        const altitude = 50 + Math.sin(t * Math.PI * 4) * 30; // 20-80m altitude
        routePoints.push([lat, lng, altitude]);
    }
    
    // Create 3D polyline with altitude
    const routeLine = L.polyline3D(routePoints, {
        color: color,
        weight: is3DMode ? 6 : 4,
        opacity: 0.9,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: null
    });
    
    // Add glow effect for 3D
    if (is3DMode) {
        routeLine._glow = L.polyline3D(routePoints, {
            color: color,
            weight: 12,
            opacity: 0.2,
            smoothFactor: 1
        });
        routeLine._glow.addTo(map);
    }
    
    // Add to map
    routeLine.addTo(map);
    _3dRoutes.push(routeLine);
    
    return routeLine;
}

// ========================================
// 6. UPDATE EXISTING ROUTES TO 3D
// ========================================
function updateRoutes3D() {
    // Update all existing routes to 3D
    const routes = document.querySelectorAll('.leaflet-polyline-3d');
    routes.forEach(route => {
        // Convert to 3D if possible
        const latLngs = route._latlngs;
        if (latLngs && latLngs.length > 1) {
            const start = latLngs[0];
            const end = latLngs[latLngs.length - 1];
            const color = route.options.color || '#007aff';
            
            // Remove old route
            map.removeLayer(route);
            
            // Create new 3D route
            create3DRoute(start.lat, start.lng, end.lat, end.lng, color);
        }
    });
}

// ========================================
// 7. TILT CONTROLS (Like Apple Maps)
// ========================================
function addTiltControls() {
    const controlContainer = document.createElement('div');
    controlContainer.id = 'tilt-controls';
    controlContainer.style.cssText = `
        position: absolute;
        bottom: 100px;
        right: 16px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    
    const tiltUp = document.createElement('button');
    tiltUp.textContent = '⬆️';
    tiltUp.style.cssText = `
        padding: 10px 14px;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    `;
    tiltUp.addEventListener('click', () => {
        const center = map.getCenter();
        map.setView(center, map.getZoom(), { animate: true });
        // Tilt up using CSS transform
        const container = map.getContainer();
        const currentTilt = parseFloat(container.style.transform.split('rotateX(')[1]) || 0;
        container.style.transform = `rotateX(${Math.min(currentTilt + 5, 60)}deg)`;
    });
    
    const tiltDown = document.createElement('button');
    tiltDown.textContent = '⬇️';
    tiltDown.style.cssText = `
        padding: 10px 14px;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    `;
    tiltDown.addEventListener('click', () => {
        const container = map.getContainer();
        const currentTilt = parseFloat(container.style.transform.split('rotateX(')[1]) || 0;
        container.style.transform = `rotateX(${Math.max(currentTilt - 5, 0)}deg)`;
    });
    
    controlContainer.appendChild(tiltUp);
    controlContainer.appendChild(tiltDown);
    document.body.appendChild(controlContainer);
}

// ========================================
// 8. SOCKET CONNECTION
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
// 9. DEVICE DETECTION
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
// 10. LOCATION TRACKING
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
// 11. 3D ROUTE BETWEEN USERS
// ========================================
const markers = {};
const locationHistory = {};
const routeLines = {};
const _3dRoutesList = [];

socket.on('update-location', (data) => {
    const { id, latitude, longitude, device, connectedAt, username: userName } = data;
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
        
        // Update 3D route
        if (myLocation && routeLines[id]) {
            if (is3DMode) {
                // Recreate as 3D route
                map.removeLayer(routeLines[id]);
                const newRoute = create3DRoute(
                    myLocation.latitude, myLocation.longitude,
                    latitude, longitude,
                    device && device.includes('Phone') ? '#ff4757' : '#1e90ff'
                );
                routeLines[id] = newRoute;
            } else {
                // Regular 2D route
                routeLines[id].setLatLngs([
                    [myLocation.latitude, myLocation.longitude],
                    [latitude, longitude]
                ]);
            }
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
        
        // Create 3D route to this user
        if (myLocation) {
            let route;
            if (is3DMode) {
                route = create3DRoute(
                    myLocation.latitude, myLocation.longitude,
                    latitude, longitude,
                    color
                );
            } else {
                route = L.polyline([
                    [myLocation.latitude, myLocation.longitude],
                    [latitude, longitude]
                ], {
                    color: color,
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '8, 6'
                }).addTo(map);
            }
            routeLines[id] = route;
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
// 12. CALCULATIONS
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
// 13. USER DISCONNECT
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
// 14. USER COUNT & LIST
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
// 15. CHAT
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
// 16. SOS
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
// 19. NOTIFICATION SYSTEM
// ========================================
function showNotification(message) {
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
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// ========================================
// 20. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === '3') {
        e.preventDefault();
        toggle3DMode();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        document.getElementById('sos-button').click();
    }
    if (e.key === 'Escape') map.closePopup();
});

// ========================================
// 21. INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('toggle-3d').addEventListener('click', toggle3DMode);
    document.getElementById('toggle-satellite').addEventListener('click', toggleSatelliteMode);
    console.log('🌍 3D Map Loaded!');
    console.log('📱 Tips:');
    console.log('  - Click "3D Mode" for Apple Maps style');
    console.log('  - Click "Satellite" for satellite view');
    console.log('  - Use tilt controls on the right');
    console.log('  - Keyboard: Ctrl+Shift+3 for 3D mode');
});

console.log('🚀 App loaded!');
console.log('📱 Device:', deviceType);
console.log('🌍 3D routes available in satellite mode!');
console.log('⌨️ Shortcut: Ctrl+Shift+3 (3D Mode)');
