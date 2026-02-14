# Docker Deployment Guide

## Quick Start

### 1. Build and Run
```bash
# Build the Docker image
docker build -t webproxy:latest .

# Run with docker-compose
docker-compose up -d
```

### 2. Access Application
- **URL**: http://localhost:4000
- **Admin Setup**: First-time login will create default admin user

## Build Scripts

### Windows
```cmd
build.bat
```

### Linux/Mac
```bash
chmod +x build.sh
./build.sh
```

## Docker Commands

### Build Image
```bash
docker build -t webproxy:latest .
```

### Run Container
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f
```

### Stop Container
```bash
docker-compose down
```

### Restart Container
```bash
docker-compose restart
```

## Data Persistence

The following directories are mounted as volumes:
- `./server/data` - User accounts and settings
- `./selenium_profiles` - Browser profile data

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | production | Application environment |
| JWT_SECRET | (required) | JWT signing secret |

## Port Configuration

- **Container Port**: 4000
- **Host Port**: 4000 (configurable in docker-compose.yml)

## Health Check

The container includes a health check endpoint:
- **URL**: http://localhost:4000/api/health
- **Interval**: 30 seconds

## Production Deployment

### 1. Update Environment
```yaml
environment:
  - NODE_ENV=production
  - JWT_SECRET=your-secure-secret-key
```

### 2. Configure Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. SSL/HTTPS Setup
Use Let's Encrypt or your SSL certificate provider.

## Troubleshooting

### Container Won't Start
```bash
docker-compose logs webproxy
```

### Permission Issues
```bash
sudo chown -R 1000:1000 server/data selenium_profiles
```

### Reset Admin User
```bash
docker-compose exec webproxy node reset-admin.js
```

## Resource Requirements

- **RAM**: 512MB minimum, 1GB recommended
- **CPU**: 1 core minimum
- **Storage**: 2GB for application + profile data