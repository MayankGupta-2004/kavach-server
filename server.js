const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'sos_events.json');

function loadEvents() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return []; }
}

function saveEvent(event) {
    const events = loadEvents();
    events.unshift(event);
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
}

// ── POST /api/sos — Kavach app sends alert here ────────────────
app.post('/api/sos', (req, res) => {
    const { event, timestamp, device_name, device_ip, latitude, longitude, maps_link } = req.body;
    if (!event || !timestamp) return res.status(400).json({ error: 'Missing fields' });

    const sosEvent = {
        id: Date.now(),
        event: event || 'SOS_TRIGGERED',
        timestamp,
        received_at: new Date().toISOString(),
        device_name: device_name || 'Unknown Device',
        device_ip: device_ip || 'Unknown IP',
        latitude: latitude || null,
        longitude: longitude || null,
        maps_link: maps_link || null,
    };

    saveEvent(sosEvent);
    console.log('🚨 SOS RECEIVED:', JSON.stringify(sosEvent, null, 2));
    return res.status(200).json({ success: true, message: 'SOS received', id: sosEvent.id });
});

// ── GET /api/sos — Dashboard fetches all events ────────────────
app.get('/api/sos', (req, res) => {
    res.json(loadEvents());
});

// ── DELETE /api/sos/:id — Clear one event ─────────────────────
app.delete('/api/sos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const events = loadEvents().filter(e => e.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
    res.json({ success: true });
});

// ── GET /health — Render keepalive ────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`✅ Kavach Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 SOS endpoint: http://localhost:${PORT}/api/sos`);
});