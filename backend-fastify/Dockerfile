FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run prisma:generate

RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
