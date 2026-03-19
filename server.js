const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Storage ───────────────────────────────────────────────────
const SOS_FILE = path.join(__dirname, 'sos_events.json');
const LOCATION_FILE = path.join(__dirname, 'live_locations.json');

function loadJSON(file) {
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── POST /api/sos — Initial SOS trigger ──────────────────────
app.post('/api/sos', (req, res) => {
    const { event, session_id, timestamp, device_name,
        device_ip, latitude, longitude, maps_link } = req.body;

    if (!event || !timestamp)
        return res.status(400).json({ error: 'Missing fields' });

    const sosEvent = {
        id: Date.now(),
        session_id: session_id || `SOS_${Date.now()}`,
        event: event,
        timestamp,
        received_at: new Date().toISOString(),
        device_name: device_name || 'Unknown',
        device_ip: device_ip || 'Unknown',
        latitude: latitude || null,
        longitude: longitude || null,
        maps_link: maps_link || null,
    };

    const events = loadJSON(SOS_FILE);
    events.unshift(sosEvent);
    saveJSON(SOS_FILE, events);

    console.log('🚨 SOS RECEIVED:', sosEvent.session_id,
        '| Device:', sosEvent.device_name,
        '| Location:', sosEvent.latitude, sosEvent.longitude);

    return res.status(200).json({ success: true, id: sosEvent.id });
});

// ── POST /api/location — Live location update every 1 min ────
app.post('/api/location', (req, res) => {
    const { session_id, latitude, longitude,
        maps_link, device_name, device_ip, timestamp } = req.body;

    if (!session_id || !latitude || !longitude)
        return res.status(400).json({ error: 'Missing fields' });

    const update = {
        session_id,
        latitude,
        longitude,
        maps_link: maps_link || `https://maps.google.com/?q=${latitude},${longitude}`,
        device_name: device_name || 'Unknown',
        device_ip: device_ip || 'Unknown',
        timestamp: timestamp || new Date().toISOString(),
        received_at: new Date().toISOString(),
    };

    // Keep only latest location per session_id
    const locations = loadJSON(LOCATION_FILE)
        .filter(l => l.session_id !== session_id);
    locations.unshift(update);

    // Keep max 100 entries
    saveJSON(LOCATION_FILE, locations.slice(0, 100));

    console.log('📍 LOCATION UPDATE:', session_id,
        '| Lat:', latitude, '| Lng:', longitude);

    return res.status(200).json({ success: true });
});

// ── GET /api/sos — All SOS events ────────────────────────────
app.get('/api/sos', (req, res) => {
    res.json(loadJSON(SOS_FILE));
});

// ── GET /api/location/:sessionId — Latest location for session
app.get('/api/location/:sessionId', (req, res) => {
    const locations = loadJSON(LOCATION_FILE);
    const latest = locations.find(
        l => l.session_id === req.params.sessionId
    );
    res.json(latest || null);
});

// ── GET /api/location — All latest locations ─────────────────
app.get('/api/location', (req, res) => {
    res.json(loadJSON(LOCATION_FILE));
});

// ── GET /track/:sessionId — Live tracking page ───────────────
app.get('/track/:sessionId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// ── DELETE /api/sos/:id ───────────────────────────────────────
app.delete('/api/sos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const events = loadJSON(SOS_FILE).filter(e => e.id !== id);
    saveJSON(SOS_FILE, events);
    res.json({ success: true });
});

// ── GET /health ───────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`✅ Kavach Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 SOS endpoint: http://localhost:${PORT}/api/sos`);
    console.log(`📍 Location endpoint: http://localhost:${PORT}/api/location`);
});