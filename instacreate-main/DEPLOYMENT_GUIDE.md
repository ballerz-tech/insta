# WebProxy Production Deployment Guide

## 🚀 Quick Start

Deploy your WebProxy application in production with browser viewing capabilities.

### Prerequisites

- Docker installed on your server
- Ports 4000 and 6080 available
- At least 2GB RAM recommended

### Install Docker
```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose
```

## 📦 Deployment Steps

### 1. Pull the Docker Image

```bash
docker pull dawebba/webproxy-app:latest
```

### 2. Create Data Directories

```bash
mkdir -p webproxy-data
mkdir -p webproxy-profiles
```

### 3. Deploy the Application

```bash
docker run -d \
  --name webproxy-app \
  -p 4000:4000 \
  -p 6080:6080 \
  -v $(pwd)/webproxy-data:/app/server/data \
  -v $(pwd)/webproxy-profiles:/app/selenium_profiles \
  --restart unless-stopped \
  dawebba/webproxy-app:latest
```

### 4. Verify Deployment

```bash
# Check if container is running
docker ps

# Check logs
docker logs webproxy-app
```

## 🌐 Access Your Application

### Main Application
- **URL**: `http://your-server-ip:4000`
- **Default Login**: 
  - Username: `admin`
  - Password: `admin123`

### Browser Viewer (noVNC)
- **URL**: `http://your-server-ip:6080`
- **Purpose**: View running browser profiles
- **No password required**

## 📋 How to Use

### Step 1: Login to WebProxy
1. Open `http://your-server-ip:4000`
2. Login with admin credentials
3. You'll see the dashboard

### Step 2: Create a Profile
1. Click **"Create Profile"**
2. Enter profile name
3. Configure proxy (optional):
   ```
   http://username:password@proxy-host:port
   ```
4. Click **"Create"**

### Step 3: Launch Profile
1. Find your profile in the list
2. Click **"Launch"** button
3. Status will change to "Running"

### Step 4: View Browser
1. Open `http://your-server-ip:6080`
2. Click **"Connect"**
3. You'll see the desktop with your browser profile

## 🔧 Advanced Configuration

### Environment Variables

```bash
docker run -d \
  --name webproxy-app \
  -p 4000:4000 \
  -p 6080:6080 \
  -e NODE_ENV=production \
  -v $(pwd)/webproxy-data:/app/server/data \
  -v $(pwd)/webproxy-profiles:/app/selenium_profiles \
  --restart unless-stopped \
  dawebba/webproxy-app:latest
```

### Custom Ports

```bash
# Use different ports
docker run -d \
  --name webproxy-app \
  -p 8080:4000 \
  -p 8081:6080 \
  -v $(pwd)/webproxy-data:/app/server/data \
  -v $(pwd)/webproxy-profiles:/app/selenium_profiles \
  --restart unless-stopped \
  dawebba/webproxy-app:latest
```

### Behind Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Main application
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Browser viewer
    location /vnc/ {
        proxy_pass http://localhost:6080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🛡️ Security Recommendations

### 1. Change Default Password
1. Login to the application
2. Go to **User Management**
3. Change admin password

### 2. Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 4000
ufw allow 6080
ufw enable
```

### 3. Use HTTPS (Recommended)
Set up SSL certificate with Let's Encrypt or your certificate provider.

## 📊 Monitoring & Maintenance

### Check Application Status
```bash
# View logs
docker logs webproxy-app -f

# Check resource usage
docker stats webproxy-app

# Restart if needed
docker restart webproxy-app
```

### Backup Data
```bash
# Backup profiles and data
tar -czf webproxy-backup-$(date +%Y%m%d).tar.gz webproxy-data webproxy-profiles
```

### Update Application
```bash
# Pull latest version
docker pull dawebba/webproxy-app:latest

# Stop current container
docker stop webproxy-app
docker rm webproxy-app

# Start with new image
docker run -d \
  --name webproxy-app \
  -p 4000:4000 \
  -p 6080:6080 \
  -v $(pwd)/webproxy-data:/app/server/data \
  -v $(pwd)/webproxy-profiles:/app/selenium_profiles \
  --restart unless-stopped \
  dawebba/webproxy-app:latest
```

## 🔍 Troubleshooting

### Container Won't Start
```bash
# Check logs for errors
docker logs webproxy-app

# Check if ports are in use
netstat -tulpn | grep :4000
netstat -tulpn | grep :6080
```

### Can't Access Application
1. Check firewall settings
2. Verify ports are not blocked
3. Ensure Docker container is running

### Browser Profiles Not Visible
1. Go to `http://your-server-ip:6080`
2. Click "Connect" button
3. Wait for desktop to load
4. Launch profiles from main app first

### Performance Issues
```bash
# Increase container resources
docker run -d \
  --name webproxy-app \
  --memory=4g \
  --cpus=2 \
  -p 4000:4000 \
  -p 6080:6080 \
  -v $(pwd)/webproxy-data:/app/server/data \
  -v $(pwd)/webproxy-profiles:/app/selenium_profiles \
  --restart unless-stopped \
  dawebba/webproxy-app:latest
```

## 📱 Mobile Access

The browser viewer (noVNC) works on mobile devices:
- Open `http://your-server-ip:6080` on mobile
- Tap "Connect"
- Use touch gestures to control browsers

## 🌍 Cloud Deployment

### AWS EC2
1. Launch EC2 instance (t3.medium or larger)
2. Install Docker
3. Configure security groups (ports 4000, 6080)
4. Follow deployment steps above

### DigitalOcean Droplet
1. Create droplet with Docker pre-installed
2. Configure firewall
3. Follow deployment steps above

### Google Cloud Platform
1. Create Compute Engine instance
2. Install Docker
3. Configure firewall rules
4. Follow deployment steps above

## 📞 Support

For technical support or issues:
1. Check logs: `docker logs webproxy-app`
2. Verify all ports are accessible
3. Ensure sufficient server resources
4. Check proxy configurations if using proxies

## 🔄 Auto-Start on Boot

```bash
# Container will auto-restart with --restart unless-stopped
# To ensure Docker starts on boot:
sudo systemctl enable docker
```

---

**Your WebProxy application is now ready for production use!** 🎉

Access your application at `http://your-server-ip:4000` and view browsers at `http://your-server-ip:6080`.
