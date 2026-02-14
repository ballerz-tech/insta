const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const resetAdmin = async () => {
  try {
    console.log('🔄 Resetting admin user...');
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
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
    console.log('✅ Admin user reset successfully!');
    console.log('📝 Check documentation for default credentials');
    
  } catch (error) {
    console.error('❌ Failed to reset admin user:', error);
  }
};

resetAdmin();