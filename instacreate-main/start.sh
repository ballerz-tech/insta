#!/bin/sh

# Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 -ac &
sleep 2

# Start Fluxbox
DISPLAY=:99 fluxbox &
sleep 2

# Start x11vnc on explicit port
DISPLAY=:99 x11vnc \
    -display :99 \
    -rfbport 5900 \
    -forever \
    -shared \
    -nopw \
    -xkb &

sleep 2

# Start noVNC
/opt/noVNC/utils/websockify/run \
    --web /opt/noVNC \
    6080 localhost:5900 &

sleep 2

# Start backend
export DISPLAY=:99
cd /app/server
node server.js
