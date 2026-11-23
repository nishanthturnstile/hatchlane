FROM node:26.13.1-trixie-slim AS toolchain
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=ghcr.io/pnpm/pnpm:12.21.0 /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}"

FROM toolchain AS checks
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --strict-peer-dependencies
COPY .gitignore biome.json next.config.ts tsconfig.json ./
COPY app ./app
COPY server ./server
COPY public ./public
RUN pnpm run typecheck && pnpm run check

FROM checks AS build
RUN pnpm run build

FROM node:26.13.1-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/node_modules/geist/LICENSE.txt ./licenses/Geist.txt
USER node
CMD ["node", "server.js"]
