FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Every folder under demos/ becomes a page at /demos/<id>/.
RUN pnpm build
# Demos with routes of their own (demos/<id>/server.js) need that file at run time, nothing else.
RUN mkdir -p /routes/demos && for f in demos/*/server.js; do \
      [ -f "$f" ] || continue; mkdir -p "/routes/$(dirname "$f")"; cp "$f" "/routes/$f"; done

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY server.js ./
COPY --from=build /routes/demos ./demos
COPY --from=build /app/dist ./dist
CMD ["node", "server.js"]
