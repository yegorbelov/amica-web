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

FROM nginx:1.28.3-alpine AS brotli-builder

RUN apk add --no-cache --virtual .build-deps \
    build-base \
    git \
    pcre2-dev \
    zlib-dev \
    openssl-dev \
    linux-headers \
    wget \
    tar

WORKDIR /tmp

RUN git clone --recurse-submodules -j8 https://github.com/google/ngx_brotli.git

RUN wget -O nginx.tar.gz https://nginx.org/download/nginx-1.28.3.tar.gz && \
    tar -xzf nginx.tar.gz

RUN cd /tmp/nginx-1.28.3 && \
    ./configure --with-compat --add-dynamic-module=/tmp/ngx_brotli && \
    make modules

FROM nginx:1.28.3-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=brotli-builder /tmp/nginx-1.28.3/objs/ngx_http_brotli_filter_module.so /etc/nginx/modules/
COPY --from=brotli-builder /tmp/nginx-1.28.3/objs/ngx_http_brotli_static_module.so /etc/nginx/modules/
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]