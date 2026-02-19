# Multi-stage build for WebProxy application
FROM node:20-alpine AS frontend-build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS production

# Install Python and Chrome (headless — no VNC/Xvfb needed)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    chromium \
    chromium-chromedriver \
    && ln -sf python3 /usr/bin/python

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

EXPOSE 4000

WORKDIR /app/server
CMD ["node", "server.js"]