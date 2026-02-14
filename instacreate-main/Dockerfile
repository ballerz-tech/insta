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
    fluxbox \
    git \
    && ln -sf python3 /usr/bin/python

# Install noVNC
RUN git clone https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone https://github.com/novnc/websockify /opt/noVNC/utils/websockify \
    && ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html

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
RUN mkdir -p server/data selenium_profiles /root/.local/share/undetected_chromedriver
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