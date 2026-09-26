# --- STAGE 1: BUILDER (Compiles the NCC Package) ---
FROM ghcr.io/nosial/ncc:latest AS builder
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app
RUN ncc project install -y && ncc build --configuration=web_release


# --- STAGE 2: PRODUCTION ---
FROM ghcr.io/nosial/dynamicalweb:latest
#FROM docker.io/library/dynaweb:latest

LABEL org.opencontainers.image.title="FederationWeb" \
      org.opencontainers.image.version="1.0.0" \
      ncc.package="net.nosial.federationweb"

COPY --from=builder /app/target/web_release/net.nosial.federationweb.ncc /tmp/package.ncc
RUN ncc package install --package=/tmp/package.ncc -y && rm /tmp/package.ncc

RUN mkdir -p /var/www/html
COPY --from=builder /app/web_entry /var/www/html/index.php

# Increase PHP upload limits for file attachments
RUN echo "upload_max_filesize=64M" >> /usr/local/etc/php/conf.d/federationweb.ini && \
    echo "post_max_size=64M" >> /usr/local/etc/php/conf.d/federationweb.ini

WORKDIR /var/www/html
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/ || exit 1
