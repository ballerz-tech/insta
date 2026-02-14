const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Initialize users file with default admin
const initializeUsers = async () => {
  if (!fs.existsSync(USERS_FILE)) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const defaultUsers = [{
      id: '1',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      permissions: ['all'],
      createdAt: new Date().toISOString()
    }];
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    console.log('Default admin user created');
  }
};

// Helper functions
const readUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
    return [];
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
};

const writeUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
};

// Initialize on startup
(async () => {
  await initializeUsers();
})();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check permissions
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions;
    
    if (userPermissions.includes('all') || userPermissions.includes(requiredPermission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

// Login route
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readUsers();
    
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        permissions: user.permissions 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    const users = readUsers().map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Create user (admin only)
const createUser = async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body;
    const users = readUsers();
    
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      role,
      permissions,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    if (writeUsers(users)) {
      const { password: _, ...userResponse } = newUser;
      res.status(201).json(userResponse);
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, permissions } = req.body;
    const users = readUsers();
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    users[userIndex].username = username;
    users[userIndex].role = role;
    users[userIndex].permissions = permissions;
    
    if (password) {
      users[userIndex].password = await bcrypt.hash(password, 10);
    }
    
    if (writeUsers(users)) {
      res.json({ message: 'User updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const users = readUsers();
    
    const filteredUsers = users.filter(u => u.id !== id);
    
    if (writeUsers(filteredUsers)) {
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  authenticateToken,
  checkPermission,
  login,
  getUsers,
  createUser,
  updateUser,
  deleteUser
};