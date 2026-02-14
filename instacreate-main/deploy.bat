@echo off
echo Building WebProxy Docker Image...
docker build -t webproxy-app .

echo Starting WebProxy Container...
docker-compose up -d

echo Checking container status...
docker ps | findstr webproxy-app

echo Testing health endpoint...
timeout 3 >nul 2>&1
curl http://localhost:4000/api/health

echo.
echo WebProxy is now running at http://localhost:4000
echo Use 'docker-compose down' to stop the application