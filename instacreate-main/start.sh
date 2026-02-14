#!/bin/sh

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1920x1080x24 -ac &
sleep 2

# Start window manager
DISPLAY=:99 fluxbox &
sleep 1

# Start VNC server
DISPLAY=:99 x11vnc -display :99 -nopw -listen localhost -xkb -ncache 10 -ncache_cr -forever &
sleep 2

# Start noVNC web server with correct web root
cd /opt/noVNC && ./utils/websockify/run --web /opt/noVNC 6080 localhost:5900 &
sleep 2

# Start the main application
cd /app/server && node server.js