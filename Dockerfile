FROM node:25-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Corepack is unavailable in this base image; install pnpm directly.
RUN npm install -g pnpm@latest

WORKDIR /app

# Build-only deps (no eslint, stylelint, prettier, husky, lint-staged)
COPY package.build.json package.json
COPY pnpm-lock.build.yaml pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --unsafe-perm

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm run build

FROM nginx:1.26-alpine

RUN apk add --no-cache nginx-mod-http-brotli

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]