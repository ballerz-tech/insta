@echo off
echo Building WebProxy Docker image...
docker build -t webproxy:latest .
echo Build complete!
echo.
echo To run the application:
echo docker-compose up -d
echo.
echo To access the application:
echo http://localhost:4000