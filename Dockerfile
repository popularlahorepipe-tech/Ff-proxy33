# Latest Stable Node.js LTS version
FROM node:20-slim

# Install dependencies, latest chrome stable, fonts, and FFMPEG
# FIX: Replaced deprecated apt-key with modern signed keyring approach
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 ffmpeg \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files strictly first for better Docker caching
COPY package*.json ./

# ==========================================
# FIX: SYSTEM ENVIRONMENT VARIABLES
# ==========================================
# Puppeteer ko bata rahe hain ke apni default downloading skip kare
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Puppeteer ko installed Chrome ka path de rahe hain
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install

# Copy all remaining project files
COPY . .

# Railway port
EXPOSE 3000

CMD ["npm", "start"]
