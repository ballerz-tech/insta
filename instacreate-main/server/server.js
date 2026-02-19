// backend/server.js
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');
const WebSocket = require('ws');
const authModule = require('./auth-fallback');

const { 
  authenticateToken, 
  checkPermission, 
  login, 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} = authModule;
const app = express();
const PORT = 4000;

const runningProcesses = new Map();
// Track Chrome debugging ports per profile (name -> port number)
const profileDebugPorts = new Map();
let nextDebugPort = 9200;

// --- CDP Helper: connect to Chrome's debugging port and run a command ---
async function cdpCommand(port, method, params = {}) {
    // Get the WS debugger URL from Chrome
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = await listRes.json();
    if (!pages.length) throw new Error('No pages found');
    const wsUrl = pages[0].webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No webSocketDebuggerUrl');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const id = 1;
        const timeout = setTimeout(() => { ws.close(); reject(new Error('CDP timeout')); }, 10000);
        ws.on('open', () => ws.send(JSON.stringify({ id, method, params })));
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
                clearTimeout(timeout);
                ws.close();
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
            }
        });
        ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
}

// Python configuration
// Allow overriding via environment (useful in container). Default to Windows venv Python for dev, or /usr/bin/python in production/linux.
const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === 'win32'
    ? path.resolve(__dirname, '..', '.venv', 'Scripts', 'python.exe')
    : '/usr/bin/python');
const MANAGER_PATH = path.resolve(__dirname, '..', 'manager.py');

// Data storage files
const DATA_DIR = './data';
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

// Profile storage — same path Python uses (CWD = __dirname = /app/server in Docker)
const PROFILES_DIR = path.join(__dirname, 'selenium_profiles');
const PROFILE_CONFIG_FILE = path.join(PROFILES_DIR, 'profiles.json');

// Random profile config options (mirrors manager.py)
const USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];
const SCREEN_RESOLUTIONS = [[1920,1080],[1366,768],[1536,864],[1440,900],[1280,720]];
const LANGUAGES = ['en-US,en;q=0.9','en-GB,en;q=0.9','es-ES,es;q=0.9','fr-FR,fr;q=0.9','de-DE,de;q=0.9'];
const TIMEZONES = ['Europe/Berlin','Europe/Munich','Europe/Paris','America/New_York','America/Los_Angeles'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Direct profile JSON helpers — instant, no Python spawn needed
const readProfiles = () => {
    if (!fs.existsSync(PROFILE_CONFIG_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(PROFILE_CONFIG_FILE, 'utf8')); } catch { return {}; }
};
const saveProfiles = (data) => {
    if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_CONFIG_FILE, JSON.stringify(data, null, 4));
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helper functions
const readJsonFile = (filePath, defaultData = []) => {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
    }
    return defaultData;
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
};

// Initialize default data
if (!fs.existsSync(GROUPS_FILE)) {
    writeJsonFile(GROUPS_FILE, []);
}
if (!fs.existsSync(PROXIES_FILE)) {
    writeJsonFile(PROXIES_FILE, []);
}
if (!fs.existsSync(SETTINGS_FILE)) {
    writeJsonFile(SETTINGS_FILE, {
        notifications: true,
        autoStart: false,
        darkMode: true,
        language: 'en',
        defaultProxy: '',
        maxProfiles: 50,
        sessionTimeout: 30,
        autoBackup: true,
        backupInterval: 24
    });
}
if (!fs.existsSync(ANALYTICS_FILE)) {
    writeJsonFile(ANALYTICS_FILE, {
        sessions: [],
        stats: { totalSessions: 0, activeProfiles: 0, avgSessionTime: 0, countries: 0 },
        instagramFollows: { totalSuccessful: 0, history: [] }
    });
}

// CORS configuration
if (process.env.NODE_ENV === 'production') {
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.static(path.join(__dirname, '../client/dist')));
} else {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Authentication routes
app.post('/api/auth/login', login);
app.get('/api/auth/users', authenticateToken, checkPermission('manage_users'), getUsers);
app.post('/api/auth/users', authenticateToken, checkPermission('manage_users'), createUser);
app.put('/api/auth/users/:id', authenticateToken, checkPermission('manage_users'), updateUser);
app.delete('/api/auth/users/:id', authenticateToken, checkPermission('manage_users'), deleteUser);

// API to get the list of profiles — reads JSON directly, no Python spawn
app.get('/api/profiles', authenticateToken, checkPermission('view_profiles'), (req, res) => {
    try {
        res.json(readProfiles());
    } catch (e) {
        res.status(500).json({ error: 'Failed to read profiles.' });
    }
});

// API to create a new profile — writes JSON directly, no Python spawn
app.post('/api/profiles', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { name, config } = req.body;
        if (!name) return res.status(400).json({ error: 'Profile name required' });
        const profiles = readProfiles();
        if (profiles[name]) return res.status(409).json({ error: `Profile '${name}' already exists.` });
        // Create browser profile directories
        const profileDataPath = path.join(PROFILES_DIR, name);
        fs.mkdirSync(path.join(profileDataPath, 'Default'), { recursive: true });
        const cfg = config || {};
        profiles[name] = {
            proxy: cfg.proxy || '',
            user_agent: cfg.user_agent || pick(USER_AGENTS),
            window_size: cfg.window_size || pick(SCREEN_RESOLUTIONS),
            remark: cfg.remark || '',
            language: cfg.language || pick(LANGUAGES),
            timezone: cfg.timezone || pick(TIMEZONES),
            webrtc: cfg.webrtc || 'disabled',
            startup_urls: cfg.startup_urls || ['https://httpbin.org/ip'],
            created_at: new Date().toISOString().replace('T',' ').slice(0,19),
            status: 'active',
        };
        saveProfiles(profiles);
        res.status(201).json({ message: `Profile '${name}' created.` });
    } catch (e) {
        console.error('Create profile error:', e);
        res.status(500).json({ error: 'Failed to create profile', details: e.message });
    }
});

// API to update a profile's status (e.g., mark banned/active)
app.post('/api/profiles/status', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { name, status } = req.body;
        const profiles = readProfiles();
        if (!profiles[name]) return res.status(404).json({ error: `Profile '${name}' not found` });
        profiles[name].status = status;
        saveProfiles(profiles);
        res.json({ message: `Profile '${name}' status updated to '${status}'` });
    } catch (error) {
        console.error('Error updating profile status:', error);
        res.status(500).json({ error: 'Failed to update profile status' });
    }
});

app.get('/api/status', authenticateToken, (req, res) => {
    res.json(Array.from(runningProcesses.keys()));
});

app.post('/api/profiles/launch', authenticateToken, checkPermission('use_profiles'), (req, res) => {
    const { name } = req.body;

    if (runningProcesses.has(name)) {
        return res.status(400).json({ error: `Profile '${name}' is already running.` });
    }

    // Assign a unique Chrome debugging port for this profile
    const debugPort = nextDebugPort++;
    profileDebugPorts.set(name, debugPort);

    const spawnEnv = { ...process.env, CHROME_DEBUG_PORT: String(debugPort) };
    const args = [MANAGER_PATH, 'launch', '--name', name, '--debug-port', String(debugPort)];
    // detached=true on Linux makes Python the process group leader so we can kill -pid to nuke Chrome too
    const spawnOpts = { env: spawnEnv, detached: process.platform !== 'win32' };
    const pythonProcess = spawn(PYTHON_PATH, args, spawnOpts);
    
    runningProcesses.set(name, pythonProcess);
    console.log(`[+] Process started for '${name}' with PID: ${pythonProcess.pid}`);

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[${name}] Error: ${data.toString()}`);
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[${name}] Output: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
        runningProcesses.delete(name);
        profileDebugPorts.delete(name);
        console.log(`[-] Process for '${name}' closed with code ${code}.`);
    });

    res.status(200).json({ message: `Launch command issued for '${name}'.` });
});

app.post('/api/profiles/close', authenticateToken, checkPermission('use_profiles'), (req, res) => {
    const { name } = req.body;

    if (runningProcesses.has(name)) {
        const processToKill = runningProcesses.get(name);
        const pid = processToKill.pid;
        
        try {
            if (process.platform === 'win32') {
                // Kill full process tree on Windows
                spawn('taskkill', ['/pid', pid.toString(), '/t', '/f'], { stdio: 'ignore' });
            } else {
                // On Linux/Docker: kill the entire process group
                try { process.kill(-pid, 'SIGKILL'); } catch (_) {}
                try { process.kill(pid, 'SIGKILL'); } catch (_) {}
            }
            processToKill.kill('SIGKILL');
            runningProcesses.delete(name);
            profileDebugPorts.delete(name);
            console.log(`Killed process ${pid} for profile '${name}'`);
        } catch (error) {
            console.error('Error killing process:', error);
            runningProcesses.delete(name);
            profileDebugPorts.delete(name);
        }
        
        res.status(200).json({ message: `Profile '${name}' closed successfully.` });
    } else {
        res.status(404).json({ error: `No running process found for profile '${name}'.` });
    }
});

// --- CDP-based Browser Viewer API ---
// Screenshot: returns a JPEG image of the running Chrome page
app.get('/api/profiles/:name/screenshot', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const port = profileDebugPorts.get(name);
    if (!port) return res.status(404).json({ error: 'Profile not running or no debug port' });
    try {
        const result = await cdpCommand(port, 'Page.captureScreenshot', { format: 'jpeg', quality: 70 });
        const imgBuf = Buffer.from(result.data, 'base64');
        res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
        res.send(imgBuf);
    } catch (err) {
        console.error(`Screenshot error for ${name}:`, err.message);
        res.status(502).json({ error: 'Failed to capture screenshot', details: err.message });
    }
});

// Mouse event (click, move, scroll)
app.post('/api/profiles/:name/input/mouse', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const port = profileDebugPorts.get(name);
    if (!port) return res.status(404).json({ error: 'Profile not running' });
    const { type, x, y, button, clickCount, deltaX, deltaY } = req.body;
    try {
        if (type === 'scroll') {
            await cdpCommand(port, 'Input.dispatchMouseEvent', {
                type: 'mouseWheel', x: x || 0, y: y || 0, deltaX: deltaX || 0, deltaY: deltaY || 0
            });
        } else {
            // type = mousePressed, mouseReleased, mouseMoved
            await cdpCommand(port, 'Input.dispatchMouseEvent', {
                type, x, y, button: button || 'left', clickCount: clickCount || 1
            });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Keyboard event
app.post('/api/profiles/:name/input/keyboard', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const port = profileDebugPorts.get(name);
    if (!port) return res.status(404).json({ error: 'Profile not running' });
    const { type, text, key, code, modifiers } = req.body;
    try {
        if (type === 'char' && text) {
            await cdpCommand(port, 'Input.dispatchKeyEvent', { type: 'char', text });
        } else {
            await cdpCommand(port, 'Input.dispatchKeyEvent', {
                type: type || 'keyDown', key, code, windowsVirtualKeyCode: modifiers || 0, text
            });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Navigate to a URL
app.post('/api/profiles/:name/navigate', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const port = profileDebugPorts.get(name);
    if (!port) return res.status(404).json({ error: 'Profile not running' });
    const { url } = req.body;
    try {
        await cdpCommand(port, 'Page.navigate', { url });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Delete profile — writes JSON + removes dir directly, no Python spawn
app.post('/api/profiles/delete', authenticateToken, checkPermission('delete_profiles'), (req, res) => {
    try {
        const { name } = req.body;
        const profiles = readProfiles();
        if (!profiles[name]) return res.status(404).json({ error: `Profile '${name}' not found.` });
        delete profiles[name];
        saveProfiles(profiles);
        // Remove the Chrome profile directory
        const profileDataPath = path.join(PROFILES_DIR, name);
        if (fs.existsSync(profileDataPath)) {
            fs.rmSync(profileDataPath, { recursive: true, force: true });
        }
        res.json({ message: `Profile '${name}' deleted.` });
    } catch (e) {
        console.error('Delete profile error:', e);
        res.status(500).json({ error: 'Failed to delete profile', details: e.message });
    }
});

// Rename profile
app.post('/api/profiles/rename', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { oldName, newName } = req.body;
        if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName required' });
        const profiles = readProfiles();
        if (!profiles[oldName]) return res.status(404).json({ error: `Profile '${oldName}' not found.` });
        if (profiles[newName]) return res.status(409).json({ error: `Profile '${newName}' already exists.` });
        profiles[newName] = { ...profiles[oldName] };
        delete profiles[oldName];
        saveProfiles(profiles);
        // Rename directory
        const oldDir = path.join(PROFILES_DIR, oldName);
        const newDir = path.join(PROFILES_DIR, newName);
        if (fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);
        res.json({ message: `Profile renamed from '${oldName}' to '${newName}'.` });
    } catch (e) {
        console.error('Rename profile error:', e);
        res.status(500).json({ error: 'Failed to rename profile', details: e.message });
    }
});

// Change proxy
app.post('/api/profiles/change-proxy', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { name, proxy } = req.body;
        const profiles = readProfiles();
        if (!profiles[name]) return res.status(404).json({ error: `Profile '${name}' not found.` });
        profiles[name].proxy = proxy || '';
        saveProfiles(profiles);
        res.json({ message: `Proxy updated for profile '${name}'.` });
    } catch (e) {
        res.status(500).json({ error: 'Failed to change proxy', details: e.message });
    }
});

// Disable proxy
app.post('/api/profiles/disable-proxy', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { name } = req.body;
        const profiles = readProfiles();
        if (!profiles[name]) return res.status(404).json({ error: `Profile '${name}' not found.` });
        profiles[name].proxy = '';
        saveProfiles(profiles);
        res.json({ message: `Proxy disabled for profile '${name}'.` });
    } catch (e) {
        res.status(500).json({ error: 'Failed to disable proxy', details: e.message });
    }
});

// Bulk create profiles
app.post('/api/profiles/bulk-create', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    try {
        const { count, prefix } = req.body;
        if (!count || count < 1) return res.status(400).json({ error: 'count required' });
        const profiles = readProfiles();
        const created = [];
        for (let i = 1; i <= count; i++) {
            const name = `${prefix || 'profile'}-${Date.now()}-${i}`;
            const profileDataPath = path.join(PROFILES_DIR, name);
            fs.mkdirSync(path.join(profileDataPath, 'Default'), { recursive: true });
            profiles[name] = {
                proxy: '', user_agent: pick(USER_AGENTS), window_size: pick(SCREEN_RESOLUTIONS),
                remark: '', language: pick(LANGUAGES), timezone: pick(TIMEZONES),
                webrtc: 'disabled', startup_urls: ['https://httpbin.org/ip'],
                created_at: new Date().toISOString().replace('T',' ').slice(0,19), status: 'active',
            };
            created.push(name);
        }
        saveProfiles(profiles);
        res.json({ message: `${created.length} profiles created.`, profiles: created });
    } catch (e) {
        res.status(500).json({ error: 'Failed to bulk create profiles', details: e.message });
    }
});

// Bulk delete profiles
app.post('/api/profiles/bulk-delete', authenticateToken, checkPermission('delete_profiles'), (req, res) => {
    try {
        const { names } = req.body;
        if (!Array.isArray(names)) return res.status(400).json({ error: 'names array required' });
        const profiles = readProfiles();
        for (const name of names) {
            delete profiles[name];
            const dir = path.join(PROFILES_DIR, name);
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        }
        saveProfiles(profiles);
        res.json({ message: `${names.length} profiles deleted.` });
    } catch (e) {
        res.status(500).json({ error: 'Failed to bulk delete profiles', details: e.message });
    }
});

// Instagram automation
app.post('/api/automation/instagram-follow', authenticateToken, checkPermission('use_profiles'), (req, res) => {
    const { target, count } = req.body;
    try {
        // Start the python automation in detached mode so the server can return immediately
        const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'instagram-follow', '--target', target, '--count', count.toString()], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore']
        });

        // Unref so the child can continue after the parent exits
        pythonProcess.unref();

        // Return immediately to allow client to poll analytics during the run
        res.status(202).json({ message: `Instagram automation started for ${count} profiles.`, pid: pythonProcess.pid });
    } catch (err) {
        console.error('Failed to start instagram automation:', err);
        res.status(500).json({ error: 'Failed to start instagram automation' });
    }
});

// Groups API
app.get('/api/groups', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const groups = readJsonFile(GROUPS_FILE, []);
    res.json(groups);
});

app.post('/api/groups', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const groups = readJsonFile(GROUPS_FILE, []);
    const newGroup = { 
        id: Date.now().toString(), 
        ...req.body, 
        profiles: [],
        createdAt: new Date().toISOString() 
    };
    groups.push(newGroup);
    if (writeJsonFile(GROUPS_FILE, groups)) {
        res.status(201).json(newGroup);
    } else {
        res.status(500).json({ error: 'Failed to create group' });
    }
});

app.delete('/api/groups/:id', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const groups = readJsonFile(GROUPS_FILE, []);
    const filteredGroups = groups.filter(g => g.id !== req.params.id);
    if (writeJsonFile(GROUPS_FILE, filteredGroups)) {
        res.json({ message: 'Group deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

app.get('/api/groups/:id/profiles', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const groups = readJsonFile(GROUPS_FILE, []);
    const group = groups.find(g => g.id === req.params.id);
    if (group) {
        res.json(group.profiles || []);
    } else {
        res.status(404).json({ error: 'Group not found' });
    }
});

app.post('/api/groups/:id/assign', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    console.log('[DEBUG] Assign profiles endpoint called - Group ID:', req.params.id, 'Body:', req.body);
    const groups = readJsonFile(GROUPS_FILE, []);
    const groupIndex = groups.findIndex(g => g.id === req.params.id);
    console.log('[DEBUG] Group found at index:', groupIndex);
    if (groupIndex === -1) {
        return res.status(404).json({ error: 'Group not found' });
    }
    const { profiles } = req.body;
    if (!Array.isArray(profiles)) {
        return res.status(400).json({ error: 'Profiles must be an array' });
    }
    // Add profiles to the group (avoid duplicates)
    const existingProfiles = groups[groupIndex].profiles || [];
    groups[groupIndex].profiles = [...new Set([...existingProfiles, ...profiles])];
    console.log('[DEBUG] Updated profiles for group:', groups[groupIndex].profiles);
    
    if (writeJsonFile(GROUPS_FILE, groups)) {
        console.log('[DEBUG] Successfully saved groups file');
        res.json({ message: 'Profiles assigned successfully', group: groups[groupIndex] });
    } else {
        console.error('[DEBUG] Failed to write groups file');
        res.status(500).json({ error: 'Failed to assign profiles' });
    }
});

app.post('/api/groups/:id/remove', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const groups = readJsonFile(GROUPS_FILE, []);
    const groupIndex = groups.findIndex(g => g.id === req.params.id);
    if (groupIndex === -1) {
        return res.status(404).json({ error: 'Group not found' });
    }
    const { profile } = req.body;
    if (!profile) {
        return res.status(400).json({ error: 'Profile name required' });
    }
    // Remove profile from the group
    groups[groupIndex].profiles = (groups[groupIndex].profiles || []).filter(p => p !== profile);
    
    if (writeJsonFile(GROUPS_FILE, groups)) {
        res.json({ message: 'Profile removed successfully', group: groups[groupIndex] });
    } else {
        res.status(500).json({ error: 'Failed to remove profile' });
    }
});

// Proxies API
app.get('/api/proxies', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const proxies = readJsonFile(PROXIES_FILE, []);
    res.json(proxies);
});

app.post('/api/proxies', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const proxies = readJsonFile(PROXIES_FILE, []);
    const newProxy = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    proxies.push(newProxy);
    if (writeJsonFile(PROXIES_FILE, proxies)) {
        res.status(201).json(newProxy);
    } else {
        res.status(500).json({ error: 'Failed to create proxy' });
    }
});

app.delete('/api/proxies/:id', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const proxies = readJsonFile(PROXIES_FILE, []);
    const targetId = req.params.id;
    console.log('Deleting proxy with ID:', targetId, 'Type:', typeof targetId);
    console.log('Available proxies:', proxies.map(p => ({ id: p.id, type: typeof p.id })));
    const filteredProxies = proxies.filter(proxy => {
        const match = proxy.id == targetId; // Use == for loose comparison
        console.log(`Comparing ${proxy.id} (${typeof proxy.id}) with ${targetId} (${typeof targetId}): ${match}`);
        return !match;
    });
    console.log('Filtered proxies count:', filteredProxies.length);
    if (writeJsonFile(PROXIES_FILE, filteredProxies)) {
        res.json({ message: 'Proxy deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete proxy' });
    }
});

// Settings API
app.get('/api/settings', authenticateToken, (req, res) => {
    const settings = readJsonFile(SETTINGS_FILE, {});
    res.json(settings);
});

app.put('/api/settings', authenticateToken, (req, res) => {
    if (writeJsonFile(SETTINGS_FILE, req.body)) {
        res.json({ message: 'Settings updated successfully' });
    } else {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Analytics API
app.get('/api/analytics', authenticateToken, (req, res) => {
    const analytics = readJsonFile(ANALYTICS_FILE, { sessions: [], stats: {}, instagramFollows: {} });
    res.json(analytics);
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else {
      next();
    }
  });
}

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log('📁 Using JSON file-based authentication system');
  console.log('✅ Admin user initialized');
  console.log('🔗 Ready to accept requests');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Keep server alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});