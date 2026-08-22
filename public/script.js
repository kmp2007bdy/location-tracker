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

// Add default layer (CartoDB - shows street names clearly)
let currentLayer = 'carto';
mapLayers.carto.addTo(map);

// ========================================
// 3. MAP STYLE SELECTOR
// ========================================
const styleBtns = document.querySelectorAll('.map-style-btn');

styleBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        // Remove active class from all buttons
        styleBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Remove all layers
        Object.values(mapLayers).forEach(layer => {
            map.removeLayer(layer);
        });

        // Add selected layer
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
let username = '';
let previousCount = 0;

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

// ========================================
// 5. USERNAME SYSTEM (Mobile Optimized)
// ========================================
function joinApp() {
    const input = document.getElementById('username-input');
    username = input.value.trim() || 'Anonymous';

    // Hide login screen
    document.getElementById('login-screen').style.display = 'none';

    // Send username to server
    socket.emit('set-username', username);

    // Start location tracking
    startLocationTracking();
}

// Mobile-optimized event listeners
document.addEventListener('DOMContentLoaded', function() {
    const joinBtn = document.getElementById('join-btn');
    const usernameInput = document.getElementById('username-input');

    // Button click (desktop and mobile)
    if (joinBtn) {
        joinBtn.addEventListener('click', function(e) {
            e.preventDefault();
            joinApp();
        });

        // Touch support for mobile
        joinBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            joinApp();
        });
    }

    // Enter key support
    if (usernameInput) {
        usernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                joinApp();
            }
        });

        // Auto-focus on mobile
        setTimeout(function() {
            usernameInput.focus();
            // Force keyboard to show on mobile
            if (window.innerWidth < 768) {
                usernameInput.click();
            }
        }, 300);
    }
});

// Make joinApp globally accessible
window.joinApp = joinApp;

// ========================================
// 6. DEVICE DETECTION
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
// 7. LOCATION TRACKING
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
                // Don't alert on mobile to avoid annoying popups
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
// 8. MARKERS & LOCATION HISTORY
// ========================================
const markers = {};
const locationHistory = {};

// ========================================
// 9. RECEIVE LOCATION UPDATES
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
// 10. CALCULATE DISTANCE
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
// 11. USER DISCONNECT
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
// 12. USER COUNT & JOIN SOUND
// ========================================
socket.on('user-count', (count) => {
    document.getElementById('count').textContent = count;
});

socket.on('user-joined', (data) => {
    playSound('join');
});

// ========================================
// 13. USER LIST (SIDEBAR)
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
// 14. CHAT FUNCTIONALITY
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
// 15. SOS BUTTON
// ========================================
document.getElementById('sos-button').addEventListener('click', function(e) {
    e.preventDefault();
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

// Touch support for SOS
document.getElementById('sos-button').addEventListener('touchstart', function(e) {
    e.preventDefault();
    this.click();
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
// 16. DARK MODE TOGGLE
// ========================================
const darkToggle = document.getElementById('dark-toggle');
let darkMode = false;

darkToggle.addEventListener('click', function(e) {
    e.preventDefault();
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    darkToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// Touch support for dark mode
darkToggle.addEventListener('touchstart', function(e) {
    e.preventDefault();
    this.click();
});

// ========================================
// 17. SOUND EFFECTS
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
// 18. MAP CLICK - SHOW ADDRESS (Mobile Friendly)
// ========================================
map.on('click', async function(e) {
            const { lat, lng } = e.latlng;

            // Show loading popup
            const popup = L.popup()
                .setLatLng([lat, lng])
                .setContent('🔍 Getting address...')
                .openOn(map);

            try {
                // Use Nominatim (OpenStreetMap's free reverse geocoding)
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
                );
                const data = await response.json();

                if (data && data.display_name) {
                    // Show the full address with street name
                    const parts = data.display_name.split(',');
                    const streetName = parts[0] || 'Unknown street';
                    const city = parts[1] || '';
                    const country = parts[parts.length - 1] || '';

                    popup.setContent(`
                <b>📍 ${streetName}</b><br>
                ${city ? `${city.trim()}, ` : ''}${country.trim()}<br>
                <small style="color:#666;">Tap again to search</small>
            `);
        } else {
            popup.setContent(`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    } catch (error) {
        console.error('Error getting address:', error);
        popup.setContent(`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
});

// ========================================
// 19. KEYBOARD SHORTCUTS (Desktop Only)
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
    
    // Map style shortcuts
    if (e.ctrlKey && e.shiftKey && e.key === '1') {
        e.preventDefault();
        document.querySelector('[data-layer="carto"]').click();
    }
    if (e.ctrlKey && e.shiftKey && e.key === '2') {
        e.preventDefault();
        document.querySelector('[data-layer="satellite"]').click();
    }
    if (e.ctrlKey && e.shiftKey && e.key === '3') {
        e.preventDefault();
        document.querySelector('[data-layer="osm"]').click();
    }
    if (e.ctrlKey && e.shiftKey && e.key === '4') {
        e.preventDefault();
        document.querySelector('[data-layer="dark"]').click();
    }
    
    if (e.key === 'Escape') {
        map.closePopup();
    }
});

console.log('🚀 App loaded successfully!');
console.log('📱 Device:', deviceType);
console.log('⌨️ Shortcuts:');
console.log('  Ctrl+Shift+D = Dark Mode');
console.log('  Ctrl+Shift+S = SOS');
console.log('  Ctrl+Shift+1 = Street Map');
console.log('  Ctrl+Shift+2 = Satellite');
console.log('  Ctrl+Shift+3 = OpenStreetMap');
console.log('  Ctrl+Shift+4 = Dark Map');
console.log('  Escape = Close popups');
console.log('📱 Mobile support enabled!');
// ========================================
// FIX: Force join function for mobile
// ========================================
function handleJoin() {
    console.log('🔥 Join button clicked! (handleJoin)');
    const input = document.getElementById('username-input');
    const username = input.value.trim() || 'Anonymous';
    console.log('📝 Username:', username);
    
    // Hide login screen
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'none';
    }
    
    // Send username to server
    socket.emit('set-username', username);
    
    // Start location tracking
    startLocationTracking();
}

// Also add a direct click handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded!');
    
    // Direct click handler for all buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            console.log('🔘 Button clicked:', this.id || this.className);
        });
        btn.addEventListener('touchstart', function(e) {
            console.log('👆 Button touched:', this.id || this.className);
        });
    });
    
    // Force the join button to work
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.onclick = handleJoin;
        joinBtn.ontouchstart = handleJoin;
    }
    
    const fallbackBtn = document.getElementById('join-btn-fallback');
    if (fallbackBtn) {
        fallbackBtn.onclick = handleJoin;
        fallbackBtn.ontouchstart = handleJoin;
    }
    
    // Auto-focus the input on mobile
    const input = document.getElementById('username-input');
    if (input) {
        setTimeout(() => {
            input.focus();
        }, 500);
    }
});

// Make sure the function is globally available
window.handleJoin = handleJoin;
window.joinApp = handleJoin;

console.log('✅ Mobile join fix loaded!');
