FROM node:26.13.1-trixie-slim AS toolchain
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=ghcr.io/pnpm/pnpm:12.21.0 /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}"

FROM toolchain AS source
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --strict-peer-dependencies
COPY .gitignore biome.json components.json next.config.ts postcss.config.mjs tsconfig.json ./
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY server ./server
COPY scripts ./scripts
COPY public ./public

FROM source AS maintenance
USER node

FROM source AS checks
RUN pnpm run typecheck && pnpm run check

FROM checks AS build
RUN pnpm run build

FROM protomaps/go-pmtiles:v1.31.2@sha256:06574f01f55a78f78f887bc7ebf729a5c093c0d6e17d9876300cfcb0758b59d3 AS pmtiles

FROM node:26.13.1-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/node_modules/@fontsource-variable/inter/LICENSE ./licenses/Inter.txt
COPY --from=pmtiles /go-pmtiles /usr/local/bin/pmtiles
USER node
CMD ["node", "server.js"]
