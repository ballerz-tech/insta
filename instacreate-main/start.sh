#!/bin/sh

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1920x1080x24 -ac &
XVFB_PID=$!
# Wait until Xvfb is ready (up to 10 seconds)
for i in $(seq 1 10); do
    DISPLAY=:99 xdpyinfo >/dev/null 2>&1 && break
    sleep 1
done

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
export DISPLAY=:99
cd /app/server && node server.js