#!/bin/sh

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1920x1080x24 -ac &
XVFB_PID=$!
# Wait until Xvfb is ready (up to 10 seconds)
for i in $(seq 1 10); do
    DISPLAY=:99 xdpyinfo >/dev/null 2>&1 && break
    echo "Waiting for Xvfb... ($i)"
    sleep 1
done
echo "Xvfb ready"

# Start window manager
DISPLAY=:99 fluxbox &
sleep 1

# Start VNC server — listen on all interfaces so websockify can reach it
DISPLAY=:99 x11vnc -display :99 -nopw -listen 0.0.0.0 -rfbport 5900 -xkb -forever -shared &
echo "x11vnc started"
sleep 2

# Start websockify — bridges WebSocket :6080 <-> VNC :5900
websockify --web /opt/noVNC 6080 localhost:5900 &
echo "websockify started on port 6080"
sleep 1

# Start the main application
export DISPLAY=:99
echo "Starting Node.js server..."
cd /app/server && node server.js