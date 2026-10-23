# syntax=docker/dockerfile:1
# The dashboard, built and served as static files. Public origins are compiled in.
#   docker build --build-arg VITE_API_URL=https://api.bilhanah.com --build-arg VITE_MENU_DOMAIN=bilhanah.com .

FROM node:24-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_API_URL
ARG VITE_MENU_DOMAIN
ENV VITE_API_URL=$VITE_API_URL VITE_MENU_DOMAIN=$VITE_MENU_DOMAIN
RUN npm run build -w @bilhanah/contracts && npm run build

FROM caddy:2.11.7
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
