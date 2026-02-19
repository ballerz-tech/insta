#!/bin/sh

# Start dbus (Chrome needs it for IPC)
mkdir -p /var/run/dbus
dbus-daemon --system --fork 2>/dev/null || true

# Start Xvfb (virtual framebuffer)
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2

# Verify Xvfb is running
if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi
echo "Xvfb started (PID $XVFB_PID)"

# Configure Fluxbox to use a single workspace and no toolbar clutter
mkdir -p /root/.fluxbox
cat > /root/.fluxbox/init <<'EOF'
session.screen0.workspaces: 1
session.screen0.workspaceNames: Desktop
session.screen0.toolbar.visible: false
session.screen0.toolbar.autoHide: true
session.screen0.tabs.usePixmap: false
EOF

# Start Fluxbox window manager (needed for Chrome to render properly)
DISPLAY=:99 fluxbox &
sleep 1
echo "Fluxbox started"

# Start x11vnc
DISPLAY=:99 x11vnc \
    -display :99 \
    -rfbport 5900 \
    -forever \
    -shared \
    -nopw \
    -xkb \
    -noxrecord \
    -noxfixes \
    -noxdamage &
sleep 1
echo "x11vnc started"

# Start noVNC websocket proxy
/opt/noVNC/utils/websockify/run \
    --web /opt/noVNC \
    6080 localhost:5900 &
sleep 1
echo "noVNC started on port 6080"

# Quick sanity check that Chromium can start
DISPLAY=:99 timeout 5 chromium --no-sandbox --headless --dump-dom about:blank >/dev/null 2>&1 \
    && echo "Chromium sanity check: OK" \
    || echo "WARNING: Chromium sanity check failed"

# Start the Node.js backend
export DISPLAY=:99
cd /app/server
echo "Starting Node.js server..."
exec node server.js
