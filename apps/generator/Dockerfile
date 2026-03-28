FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=3069

EXPOSE 3069

CMD ["pnpm", "start"]
