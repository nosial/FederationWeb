# syntax=docker/dockerfile:1
# --- STAGE 1: BUILDER (Compiles the NCC Package) ---
ARG NCC_BUILDER_IMAGE=ghcr.io/nosial/ncc:latest
ARG WEB_RUNTIME_IMAGE=ghcr.io/nosial/dynamicalweb:latest
FROM ${NCC_BUILDER_IMAGE} AS builder
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app
RUN ncc project install -y && ncc build --configuration=web_release


# --- STAGE 2: PRODUCTION ---
FROM ${WEB_RUNTIME_IMAGE}

LABEL org.opencontainers.image.title="FederationWeb" \
      org.opencontainers.image.version="1.0.0" \
      ncc.package="net.nosial.federationweb"

RUN --mount=type=bind,from=builder,source=/app/target/web_release/net.nosial.federationweb.ncc,target=/tmp/package.ncc \
    ncc package install --package=/tmp/package.ncc -y

# Memcached (run by the DynamicalWeb image) holds sessions and the shared cache of federation server reads
ENV MEMCACHED_ENABLED=1 \
    MEMCACHED_SESSION_SLIDING=1 \
    MEMCACHED_KEY_PREFIX=fw_ \
    FEDERATION_CACHE_TTL=60

RUN mkdir -p /var/www/html
COPY --from=builder /app/web_entry /var/www/html/index.php

# Increase PHP upload limits for file attachments
RUN echo "upload_max_filesize=64M" >> /usr/local/etc/php/conf.d/federationweb.ini && \
    echo "post_max_size=64M" >> /usr/local/etc/php/conf.d/federationweb.ini

WORKDIR /var/www/html
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/ || exit 1
