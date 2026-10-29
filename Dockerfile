FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.build.json package.json

RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --no-save

COPY . .

RUN bun run build

FROM alpine:3.22

RUN apk add --no-cache nginx nginx-mod-http-brotli

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/lib/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /run/nginx/nginx.pid && \
    chown nginx:nginx /run/nginx/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]