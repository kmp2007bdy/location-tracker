// ========================================
// 1. MAP INITIALIZATION
// ========================================
const map = L.map('map').setView([40.7128, -74.0060], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ========================================
// 2. SOCKET CONNECTION
// ========================================
const socket = io();

let myLocation = null;

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

// ========================================
// 3. DEVICE DETECTION
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
// 4. MARKERS & LOCATION HISTORY
// ========================================
const markers = {};
const locationHistory = {};

// ========================================
// 5. GEOLOCATION TRACKING
// ========================================
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            myLocation = { latitude, longitude };

            // Send to server with device info
            socket.emit('send-location', {
                latitude,
                longitude,
                device: deviceType,
                userAgent: navigator.userAgent.slice(0, 50)
            });

            // Center map on user (only if not already centered)
            map.setView([latitude, longitude], 15);
        },
        (error) => {
            console.error('❌ Geolocation error:', error);
            // Don't alert, just log
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
} else {
    alert('❌ Geolocation is not supported by your browser.');
}

// ========================================
// 6. RECEIVE LOCATION UPDATES
// ========================================
socket.on('update-location', (data) => {
    console.log('📍 Location update from:', data.id);
    const { id, latitude, longitude, device, connectedAt } = data;

    // Don't create marker for self (we'll handle it differently)
    if (id === socket.id) return;

    // Store history
    if (!locationHistory[id]) {
        locationHistory[id] = [];
    }
    locationHistory[id].push([latitude, longitude]);
    if (locationHistory[id].length > 50) {
        locationHistory[id].shift();
    }

    // Update or create marker
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);

        // Update popup with distance
        updatePopupWithDistance(id, latitude, longitude, device, connectedAt);

        // Update trail
        if (locationHistory[id].length > 2) {
            if (markers[id].trail) {
                markers[id].trail.setLatLngs(locationHistory[id]);
            }
        }
    } else {
        // Determine marker style based on device
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

        markers[id] = L.marker([latitude, longitude], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
                <b>👤 User:</b> ${id.slice(0, 6)}<br>
                <b>📱 Device:</b> ${device || 'Unknown'}<br>
                <b>⏱ Since:</b> ${connectedAt || 'Just now'}
            `);

        // Add trail
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
// 7. CALCULATE DISTANCE
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

function updatePopupWithDistance(id, lat, lon, device, connectedAt) {
    if (!markers[id] || !myLocation) return;

    const dist = calculateDistance(
        myLocation.latitude, myLocation.longitude,
        lat, lon
    );
    const distanceText = dist < 1 ?
        `${(dist * 1000).toFixed(0)}m away` :
        `${dist.toFixed(2)}km away`;

    markers[id].setPopupContent(`
        <b>👤 User:</b> ${id.slice(0, 6)}<br>
        <b>📱 Device:</b> ${device || 'Unknown'}<br>
        <b>⏱ Since:</b> ${connectedAt || 'Just now'}<br>
        <b>📏 Distance:</b> ${distanceText}
    `);
}

// ========================================
// 8. USER DISCONNECT
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
// 9. USER COUNT
// ========================================
socket.on('user-count', (count) => {
    document.getElementById('count').textContent = count;
});

// ========================================
// 10. USER LIST (SIDEBAR) - FIXED
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
        // Skip self
        if (id === socket.id) continue;
        count++;
        html += `
            <div class="user-item">
                <span class="user-device">${data.device || '💻'}</span>
                <span class="user-id">${id.slice(0, 6)}</span>
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

// Request user list on load
socket.emit('get-users');

// ========================================
// 11. CHAT FUNCTIONALITY - FIXED
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

        // Add own message to chat immediately
        addMessageToChat('You', deviceType, new Date().toLocaleTimeString(), text, true);
    }
}

function addMessageToChat(user, device, timestamp, text, isOwn = false) {
    // Remove "No messages" placeholder
    const noMsg = messagesDiv.querySelector('.no-messages');
    if (noMsg) noMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    if (isOwn) {
        msgDiv.style.background = '#2c3e50';
        msgDiv.style.color = 'white';
        msgDiv.style.marginLeft = '20px';
    }
    msgDiv.innerHTML = `
        <div class="msg-meta" style="${isOwn ? 'color:#aaa;' : ''}">
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
    addMessageToChat(
        data.userId || 'Unknown',
        data.device || '💻',
        data.timestamp || '',
        data.text,
        false
    );
});

// ========================================
// 12. SOS BUTTON - FIXED
// ========================================
document.getElementById('sos-button').addEventListener('click', () => {
    if (!myLocation) {
        alert('❌ Please wait, getting your location...');
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

    // Show alert to sender
    alert('🚨 SOS Alert sent to all online users!');
});

socket.on('sos-alert', (data) => {
    console.log('🚨 SOS ALERT RECEIVED from:', data.userId);

    // Flash screen red
    const originalBg = document.body.style.backgroundColor;
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

    // Show alert
    alert(`🚨🚨🚨 SOS ALERT! 🚨🚨🚨\n\nUser: ${data.userId || 'Unknown'}\nDevice: ${data.device || 'Unknown'}\nTime: ${data.time || 'Just now'}\n\n📍 Location shared! Check map!`);

    // Fly map to SOS location
    if (data.latitude && data.longitude) {
        map.flyTo([data.latitude, data.longitude], 17, {
            duration: 2
        });

        // Add a special SOS marker
        const sosIcon = L.divIcon({
            className: 'sos-marker',
            html: `<div style="background:#ff0000;width:30px;height:30px;border-radius:50%;border:4px solid white;box-shadow:0 0 30px rgba(255,0,0,0.8);display:flex;align-items:center;justify-content:center;font-size:20px;animation:pulse 1s infinite;">🆘</div>`,
            iconSize: [30, 30]
        });

        const sosMarker = L.marker([data.latitude, data.longitude], { icon: sosIcon })
            .addTo(map)
            .bindPopup(`
                <b style="color:red;">🚨 SOS ALERT!</b><br>
                <b>User:</b> ${data.userId || 'Unknown'}<br>
                <b>Device:</b> ${data.device || 'Unknown'}<br>
                <b>Time:</b> ${data.time || 'Just now'}
            `)
            .openPopup();

        // Remove SOS marker after 30 seconds
        setTimeout(() => {
            map.removeLayer(sosMarker);
        }, 30000);
    }
});

// ========================================
// 13. DARK MODE TOGGLE
// ========================================
const darkToggle = document.getElementById('dark-toggle');
let darkMode = false;

darkToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    darkToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// ========================================
// 14. MAP CLICK: ADD TEMPORARY MARKER
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

    // Remove after 5 seconds
    setTimeout(() => {
        map.removeLayer(tempMarker);
    }, 5000);
});

// ========================================
// 15. KEYBOARD SHORTCUTS
// ========================================
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+D = Toggle dark mode
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        darkToggle.click();
    }

    // Ctrl+Shift+S = SOS
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        document.getElementById('sos-button').click();
    }

    // Escape = Close all popups
    if (e.key === 'Escape') {
        map.closePopup();
    }
});

console.log('🚀 App loaded successfully!');
console.log('📱 Device:', deviceType);
console.log('⌨️ Shortcuts: Ctrl+Shift+D (Dark Mode), Ctrl+Shift+S (SOS)');