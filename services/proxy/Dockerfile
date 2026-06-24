FROM nginx:1.27-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
RUN nginx -t

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
