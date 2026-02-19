# Multi-stage build for WebProxy application
FROM node:20-alpine AS frontend-build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS production

# Install Python, Chrome, VNC and noVNC
RUN apk add --no-cache \
    python3 \
    py3-pip \
    chromium \
    chromium-chromedriver \
    xvfb \
    x11vnc \
    xdpyinfo \
    fluxbox \
    wget \
    tar \
    && ln -sf python3 /usr/bin/python

# Install noVNC (pinned release — no git clone needed)
RUN wget -qO /tmp/novnc.tar.gz https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.tar.gz \
    && tar -xzf /tmp/novnc.tar.gz -C /opt \
    && mv /opt/noVNC-1.4.0 /opt/noVNC \
    && rm /tmp/novnc.tar.gz

# Install websockify via pip (reliable, no git clone)
RUN pip3 install --no-cache-dir --break-system-packages websockify

# Auto-connect index page so visiting :6080 directly auto-connects
RUN printf '<!DOCTYPE html><html><head><meta charset="utf-8"><title>VNC Viewer</title></head><body><script>var h=window.location.hostname,p=window.location.port;window.location.replace("http://"+h+":"+p+"/vnc.html?autoconnect=1&resize=scale&path=websockify");</script></body></html>' > /opt/noVNC/index.html

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

# Create data directories and set permissions
RUN mkdir -p server/data server/selenium_profiles /root/.local/share/undetected_chromedriver
RUN chmod 755 /root/.local/share/undetected_chromedriver

# Create symlink for undetected_chromedriver
RUN ln -s /usr/bin/chromedriver /root/.local/share/undetected_chromedriver/undetected_chromedriver
RUN chmod +x /usr/bin/chromedriver

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