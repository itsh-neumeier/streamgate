FROM node:22-alpine AS build
WORKDIR /app
COPY apps/admin/package*.json ./
RUN npm install
COPY apps/admin ./
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
