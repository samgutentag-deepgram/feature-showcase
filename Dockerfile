FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Which folder under demos/ this image serves. scripts/deploy.sh always passes it.
ARG FEATURE
RUN test -n "$FEATURE" && test -d "demos/$FEATURE" || { echo "FEATURE must name a folder under demos/" >&2; exit 1; }
RUN FEATURE=$FEATURE pnpm build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY server.js ./
COPY --from=build /app/dist ./dist
CMD ["node", "server.js"]
