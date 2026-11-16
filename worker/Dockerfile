
FROM node:22-alpine

WORKDIR /app

# Install FFmpeg and FFprobe for audio processing
RUN apk add --no-cache ffmpeg

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5000

CMD ["npm", "start"]
