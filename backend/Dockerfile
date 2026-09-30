FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev 2>/dev/null || true

COPY index.ts ./

EXPOSE 3000

CMD ["node", "--experimental-strip-types", "index.ts"]