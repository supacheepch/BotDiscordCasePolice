FROM node:22-slim

# ติดตั้ง Python และ dependencies สำหรับ yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    ffmpeg \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# ติดตั้ง yt-dlp แบบ standalone binary (เร็วกว่า pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
