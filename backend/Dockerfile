FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@12

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY src ./src
COPY nest-cli.json prisma7.config.ts tsconfig.json tsconfig.build.json ./

RUN pnpm db:generate

EXPOSE 3000

CMD ["pnpm", "dev"]
