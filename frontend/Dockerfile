FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY index.html vite.config.ts env.d.ts ./
COPY tsconfig*.json ./
COPY public/ ./public/
COPY src/ ./src

EXPOSE 5173

CMD ["pnpm", "dev", "--host"]