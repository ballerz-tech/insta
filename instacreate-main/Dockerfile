# Multi-stage build for WebProxy application
FROM node:20-slim AS frontend-build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-slim AS production

# Install system deps + noVNC in ONE layer to avoid /bin/sh breakage on Debian-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    dash \
    bash \
    python3 \
    python3-pip \
    chromium \
    chromium-driver \
    xvfb \
    x11vnc \
    x11-utils \
    fluxbox \
    git \
    procps \
    dbus-x11 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3 /usr/bin/python \
    && git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone --depth 1 https://github.com/novnc/websockify /opt/noVNC/utils/websockify \
    && printf '<!DOCTYPE html><html><head><meta charset="utf-8"><title>VNC Viewer</title></head><body><script>var h=window.location.hostname,p=window.location.port;window.location.replace("http://"+h+":"+p+"/vnc.html?autoconnect=1&resize=scale&path=websockify");</script></body></html>' > /opt/noVNC/index.html

# Setup backend
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application files
COPY server/ ./server/
COPY manager.py ./

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Create data directories
RUN mkdir -p server/data server/selenium_profiles

# Setup undetected_chromedriver — COPY the binary (not symlink!) so UC can patch it
RUN mkdir -p /root/.local/share/undetected_chromedriver \
    && cp /usr/bin/chromedriver /root/.local/share/undetected_chromedriver/undetected_chromedriver \
    && chmod 755 /root/.local/share/undetected_chromedriver/undetected_chromedriver

# Set environment variables
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV NODE_ENV=production
ENV DISPLAY=:99

EXPOSE 4000 6080

# Start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

WORKDIR /app/server
CMD ["/start.sh"]