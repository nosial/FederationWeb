# FederationWeb

FederationWeb is a web application for browsing and managing a Federated Database server, it provides a management
panel for operators to review reports, evidence, blacklist records, entities and audit logs, and a public view of the
records a server chooses to make publicly available.

FederationWeb is a client of the [Open Federated Database](https://github.com/Nosial/OFD-Specification) specification,
it is built on top of [FederationLib](https://github.com/nosial/FederationLib) and served using
[DynamicalWeb](https://github.com/nosial/DynamicalWeb)

## Features

 - Browse operators, entities, reports, evidence, blacklist records and audit logs with searching, filtering and sorting
 - Detail pages for every record type with their related records, attachments and audit history
 - Manage the federation server through the web application using an operator's access token, including submitting
   reports & evidence, closing and assigning reports, blacklisting entities and managing operators and their permissions
 - Anonymous access to the records the connected server makes publicly available
 - Printable documents for every record page and record list, suitable for review and archiving
 - API specification page for servers that support it (A FederationLib feature, omitted for other server implementations)
 - Light & dark themes and localization support
 - Optionally connect to any Federated Database server rather than only the configured one


## Table of Contents

<!-- TOC -->
* [FederationWeb](#federationweb)
  * [Features](#features)
  * [Table of Contents](#table-of-contents)
  * [Building & Installing](#building--installing)
    * [Requirements](#requirements)
    * [Building from source](#building-from-source)
    * [Makefile targets](#makefile-targets)
  * [Deployment](#deployment)
    * [Docker](#docker)
    * [Production checklist](#production-checklist)
  * [Configuration](#configuration)
    * [Web application configuration](#web-application-configuration)
    * [Session configuration](#session-configuration)
  * [Access & Permissions](#access--permissions)
* [License](#license)
<!-- TOC -->


## Building & Installing

FederationWeb is built as a [Nosial Code Compiler (ncc)](https://github.com/nosial/ncc) package which is then served by
DynamicalWeb, the stylesheets, scripts and vendor assets are compiled during the build using npm.

### Requirements

 - [ncc](https://github.com/nosial/ncc) for building and installing the package
 - PHP 8.3 or newer with the `curl` extension, and the `memcached` extension for sessions
 - Node.js and npm for compiling the stylesheets, scripts and vendor assets
 - A memcached server for storing sessions (The DynamicalWeb docker image includes one)
 - A Federated Database server to connect to, such as [FederationLib](https://github.com/nosial/FederationLib)

### Building from source

First ensure all the dependencies are available in the environment by running

```shell
ncc project install
```

Then build the package, the `web_release` configuration is intended for deploying the web application, the npm
dependencies are installed and the assets are compiled automatically before the package is compiled

```shell
ncc build --configuration web_release
```

The resulting package is written to `target/web_release/net.nosial.federationweb.ncc`, the assets can also be compiled
on their own using npm when working on the stylesheets or scripts

```shell
npm install
npm run build
```

### Makefile targets

| Target                | Description                                                                  |
|-----------------------|------------------------------------------------------------------------------|
| `make all`            | Builds the `debug`, `release` and `web_release` packages                     |
| `make configure`      | Generates the IDE stubs for the project's dependencies (`ncc project stubs`) |
| `make clean`          | Removes the build output, compiled assets and installed dependencies         |
| `make docker-build`   | Builds the docker image                                                      |
| `make docker-up`      | Starts the services defined in `docker-compose.yml`                          |
| `make docker-down`    | Stops the services defined in `docker-compose.yml`                           |
| `make docker-restart` | Restarts the services defined in `docker-compose.yml`                        |
| `make docker-logs`    | Follows the logs of the running services                                     |


## Deployment

### Docker

The project comes with a populated [Dockerfile](Dockerfile) and [docker-compose.yml](docker-compose.yml) file, this is
the recommended way to deploy FederationWeb.

`Dockerfile` builds the `web_release` package in a builder stage and installs it into the
`ghcr.io/nosial/dynamicalweb` image, which provides the following components

 - `nginx`: For handling web requests, listening on port `8080`
 - `memcached`: For storing sessions
 - `supervisord`: For managing services
 - PHP with the `apcu`, `sockets` and `memcached` extensions

The image also raises PHP's upload limits to 64MB so that file attachments can be uploaded as evidence.

FederationWeb only needs to be able to reach a Federated Database server, the included `docker-compose.yml` file deploys
the web application alongside a FederationLib server and its database and cache. Below is a minimal example of how a
`docker-compose.yml` file might look like deploying FederationWeb for an existing Federated Database server.

```yaml
services:
  app:
    image: federation_web
    build:
      context: .
    container_name: federation_web
    ports:
      - "8080:8080"
    restart: unless-stopped
    environment:
      - FEDERATION_SERVER_ENDPOINT=https://federation.example.com
      - FEDERATION_DISABLE_CUSTOM_HOST=1
      - MEMCACHED_SESSION_SECRET=${MEMCACHED_SESSION_SECRET} # CHANGE THIS!!!
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Once the container is running, open the web application in a browser and sign in with an operator's access token, or
leave the access token blank to connect anonymously. See the [Configuration](#configuration) section for all the
available options.

### Production checklist

FederationWeb handles operators' access tokens, when deploying it publicly make sure that

 - The web application is only served over HTTPS, if it runs behind a reverse proxy the proxy must send the
   `X-Forwarded-Proto` header so that session cookies are marked as secure
 - `FEDERATION_DISABLE_CUSTOM_HOST` is set, custom hosts are intended for self-hosting FederationWeb for personal use
   (See [Web application configuration](#web-application-configuration))
 - `MEMCACHED_SESSION_SECRET` is set to a long random value
 - The memcached server is not reachable from outside the deployment, sessions contain operators' access tokens
 - Login attempts are rate-limited at the reverse proxy or on the Federated Database server


## Configuration

FederationWeb is configured entirely using environment variables, in the docker image these are set in the
`environment` section of the `docker-compose.yml` file.

### Web application configuration

This section configures which Federated Database server the web application connects to and who may sign in.

| Environment Variable             | Type   | Default Value | Required | Description                                                                                                                                                                              |
|----------------------------------|--------|---------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `FEDERATION_SERVER_ENDPOINT`     | string | None          | Yes      | The URL of the Federated Database server to connect to, for example `https://federation.example.com`. The web application shows a configuration error page when it is missing or invalid |
| `FEDERATION_DISABLE_CUSTOM_HOST` | flag   | Not set       | No       | When set, users can only connect to `FEDERATION_SERVER_ENDPOINT` and the server host field on the sign-in page is locked                                                                 |
| `FEDERATION_DISABLE_ANONYMOUS`   | flag   | Not set       | No       | When set, an access token is required to sign in and anonymous access is disabled                                                                                                        |

> **Note:** Flags are enabled by any non-empty value, including `0` and `false`. To disable a flag, remove the
> variable or leave it empty.

By default the sign-in page allows entering the URL of any Federated Database server. This is intended for self-hosting
FederationWeb for personal use, because the web application's server makes the requests to whichever host is entered,
it should be disabled on public deployments by setting `FEDERATION_DISABLE_CUSTOM_HOST`.

Anonymous users can only see the records the connected server makes publicly available, what is public is configured
on the Federated Database server itself (For FederationLib, see its `server.public_*` configuration options).

### Session configuration

Sessions are handled by DynamicalWeb and stored in memcached, the DynamicalWeb docker image runs memcached within the
container and enables sessions by default.

| Environment Variable        | Type   | Default Value                         | Required | Description                                                                                                                                       |
|-----------------------------|--------|---------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `MEMCACHED_ENABLED`         | bool   | `1` (Docker image)                    | Yes      | Whether sessions are enabled (`1`, `true`, `yes` or `on`), signing in requires sessions                                                           |
| `MEMCACHED_HOST`            | string | `127.0.0.1`                           | No       | The memcached server host                                                                                                                         |
| `MEMCACHED_PORT`            | int    | `11211`                               | No       | The memcached server port                                                                                                                         |
| `MEMCACHED_SESSION_TTL`     | int    | `3600` (1 hour)                       | No       | How long a session stays valid without activity in seconds, active users stay signed in                                                           |
| `MEMCACHED_SESSION_SECRET`  | string | `dynamicalweb_default_session_secret` | No       | The secret used to bind sessions to the client's IP address and user agent, should be set to a long random value in production                    |
| `MEMCACHED_SESSION_SLIDING` | bool   | `1` (Docker image)                    | No       | Renews the session cookie on every request, so `MEMCACHED_SESSION_TTL` is an idle timeout; with `0` users are signed out one TTL after signing in |
| `MEMCACHED_SESSION_BIND_IP` | bool   | `1`                                   | No       | Set to `0` to keep sessions when a user's IP address changes, for example a phone switching networks; the user agent is still checked             |


## Access & Permissions

Operators sign in using their access token, the web application only shows the pages and actions the operator's
permissions allow, the Federated Database server remains responsible for enforcing these permissions.

| Access                 | Description                                                                                                               |
|------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Anonymous              | Read-only access to the records the server makes publicly available                                                       |
| Operator               | Read access to the server's records                                                                                       |
| Client permissions     | Submit reports and evidence, and upload file attachments                                                                  |
| Management permissions | Manage reports, evidence, entities and blacklist records, including closing & assigning reports and blacklisting entities |
| Operator permissions   | Manage operators, their permissions and access tokens                                                                     |

Newly generated access tokens are shown once on the operator's page after they are generated, make sure to copy them
before leaving the page.


# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
