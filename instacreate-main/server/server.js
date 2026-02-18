// backend/server.js
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
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

// API to get the list of profiles
app.get('/api/profiles', authenticateToken, checkPermission('view_profiles'), (req, res) => {
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'list']);

    let profileData = '';
    pythonProcess.stdout.on('data', (data) => {
        profileData += data.toString();
    });

    pythonProcess.on('close', () => {
         try {
            const profiles = JSON.parse(profileData);
            res.json(profiles);
        } catch (e) {
            res.status(500).json({ error: "Failed to parse profile data." });
        }
    });
});

// API to create a new profile
app.post('/api/profiles', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { name, config } = req.body;
    const args = [MANAGER_PATH, 'create', '--name', name];
    
    const proxy = config?.proxy || req.body.proxy;
    if (proxy && proxy.trim()) {
        args.push('--proxy', proxy.trim());
    }
    
    if (config) {
        args.push('--config', JSON.stringify(config));
    }

    const pythonProcess = spawn(PYTHON_PATH, args);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(201).json({ message: `Profile '${name}' created.` });
        } else {
            console.error('Create profile error:', errorOutput);
            res.status(500).json({ error: 'Failed to create profile', details: errorOutput });
        }
    });
});

// API to update a profile's status (e.g., mark banned/active)
app.post('/api/profiles/status', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { name, status } = req.body;
    console.log('[DEBUG] /api/profiles/status called with body:', req.body);
    // Possible locations where profiles.json may live (server cwd vs repo root)
    const candidatePaths = [
        path.resolve(__dirname, 'selenium_profiles', 'profiles.json'),
        path.resolve(__dirname, '..', 'selenium_profiles', 'profiles.json')
    ];

    try {
        let updated = false;
        for (const profilesPath of candidatePaths) {
            console.log(`[DEBUG] checking path: ${profilesPath} exists=${fs.existsSync(profilesPath)}`);
            if (!fs.existsSync(profilesPath)) continue;
            let profilesRaw = fs.readFileSync(profilesPath, 'utf8');
            let profiles = {};
            try {
                profiles = JSON.parse(profilesRaw || '{}');
                console.log(`[DEBUG] parsed profiles keys at ${profilesPath}:`, Object.keys(profiles));
            } catch (e) {
                console.error(`Failed to parse profiles at ${profilesPath}:`, e);
                continue;
            }
            if (!profiles[name]) {
                console.log(`[DEBUG] profile '${name}' not found in ${profilesPath}`);
                continue;
            }
            profiles[name].status = status;
            fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
            console.log(`Updated profile '${name}' status to '${status}' in ${profilesPath}`);
            res.json({ message: `Profile '${name}' status updated to '${status}'`, path: profilesPath });
            updated = true;
            break;
        }
        if (!updated) {
            return res.status(404).json({ error: `Profile '${name}' not found` });
        }
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

    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'launch', '--name', name]);
    
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
            // Kill process tree immediately
            const killProcess = spawn('taskkill', ['/pid', pid.toString(), '/t', '/f'], { stdio: 'ignore' });
            killProcess.on('close', () => {
                console.log(`Process tree killed for PID: ${pid}`);
            });
            
            // Also try direct kill
            processToKill.kill('SIGTERM');
            
            // Remove from running processes immediately
            runningProcesses.delete(name);
            console.log(`Removed ${name} from running processes`);
            
        } catch (error) {
            console.error('Error killing process:', error);
            runningProcesses.delete(name);
        }
        
        res.status(200).json({ message: `Profile '${name}' closed successfully.` });
    } else {
        res.status(404).json({ error: `No running process found for profile '${name}'.` });
    }
});

app.post('/api/profiles/delete', authenticateToken, checkPermission('delete_profiles'), (req, res) => {
    const { name } = req.body;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'delete', '--name', name]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `Profile '${name}' deleted.` });
        } else {
            console.error('Delete profile error:', errorOutput);
            res.status(500).json({ error: 'Failed to delete profile', details: errorOutput });
        }
    });
});

// Rename profile
app.post('/api/profiles/rename', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { oldName, newName } = req.body;
    res.status(501).json({ error: 'Rename feature not yet implemented' });
    return;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'rename', '--old-name', oldName, '--new-name', newName]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `Profile renamed from '${oldName}' to '${newName}'.` });
        } else {
            console.error('Rename profile error:', errorOutput);
            res.status(500).json({ error: 'Failed to rename profile', details: errorOutput });
        }
    });
});

// Change proxy
app.post('/api/profiles/change-proxy', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { name, proxy } = req.body;
    res.status(501).json({ error: 'Change proxy feature not yet implemented' });
    return;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'change-proxy', '--name', name, '--proxy', proxy]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `Proxy changed for profile '${name}'.` });
        } else {
            console.error('Change proxy error:', errorOutput);
            res.status(500).json({ error: 'Failed to change proxy', details: errorOutput });
        }
    });
});

// Disable proxy
app.post('/api/profiles/disable-proxy', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { name } = req.body;
    res.status(501).json({ error: 'Disable proxy feature not yet implemented' });
    return;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'disable-proxy', '--name', name]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `Proxy disabled for profile '${name}'.` });
        } else {
            console.error('Disable proxy error:', errorOutput);
            res.status(500).json({ error: 'Failed to disable proxy', details: errorOutput });
        }
    });
});

// Bulk create profiles
app.post('/api/profiles/bulk-create', authenticateToken, checkPermission('create_profiles'), (req, res) => {
    const { count, deviceType, prefix } = req.body;
    res.status(501).json({ error: 'Bulk create feature not yet implemented' });
    return;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'bulk-create', '--count', count.toString(), '--device-type', deviceType, '--prefix', prefix]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `${count} profiles created successfully.` });
        } else {
            console.error('Bulk create error:', errorOutput);
            res.status(500).json({ error: 'Failed to create profiles', details: errorOutput });
        }
    });
});

// Bulk delete profiles
app.post('/api/profiles/bulk-delete', authenticateToken, checkPermission('delete_profiles'), (req, res) => {
    const { names } = req.body;
    res.status(501).json({ error: 'Bulk delete feature not yet implemented' });
    return;
    const pythonProcess = spawn(PYTHON_PATH, [MANAGER_PATH, 'bulk-delete', '--names', JSON.stringify(names)]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).json({ message: `${names.length} profiles deleted successfully.` });
        } else {
            console.error('Bulk delete error:', errorOutput);
            res.status(500).json({ error: 'Failed to delete profiles', details: errorOutput });
        }
    });
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