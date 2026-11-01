# <picture><source media="(prefers-color-scheme: dark)" srcset="assets/icon/federationweb_light.svg"><img src="assets/icon/federationweb_dark.svg" alt="FederationWeb" width="32" height="32"></picture> FederationWeb

> FederationWeb is a web interface for browsing and managing a Federated Database server.

FederationWeb connects to a server that implements the [Open Federated Database](https://github.com/Nosial/OFD-Specification)
(OFD) specification and turns its records into pages. Operators can sign in with their access token to review reports,
evidence, blacklist records, entities and audit logs and to act on them. Anonymous visitors see the records the server
makes public.

FederationWeb is a client only: it stores no records of its own, and the server enforces every permission. It is
built on [FederationLib](https://github.com/nosial/FederationLib) and served by [DynamicalWeb](https://github.com/nosial/DynamicalWeb).


## Table of Contents

<!-- TOC -->
* [Installation](#installation)
  * [Requirements](#requirements)
  * [Building the Package](#building-the-package)
  * [Compiling the Assets](#compiling-the-assets)
  * [Makefile Targets](#makefile-targets)
* [Deploying with Docker](#deploying-with-docker)
  * [Connecting to an Existing Server](#connecting-to-an-existing-server)
  * [Running the Complete Stack](#running-the-complete-stack)
  * [Preparing a Production Deployment](#preparing-a-production-deployment)
* [Usage](#usage)
  * [Signing In](#signing-in)
  * [Browsing Records](#browsing-records)
  * [Searching](#searching)
  * [Querying Entities](#querying-entities)
  * [Submitting Reports and Evidence](#submitting-reports-and-evidence)
  * [Managing Records](#managing-records)
  * [Managing Operators](#managing-operators)
  * [Printing Records](#printing-records)
  * [Viewing the API Specification](#viewing-the-api-specification)
  * [Changing the Theme and Language](#changing-the-theme-and-language)
  * [Link Previews and Search Engines](#link-previews-and-search-engines)
* [Configuration](#configuration)
  * [Configuring the Server Connection](#configuring-the-server-connection)
  * [Configuring Sessions](#configuring-sessions)
  * [Configuring the Cache](#configuring-the-cache)
  * [Environment Variable Reference](#environment-variable-reference)
* [Access and Permissions](#access-and-permissions)
* [Security](#security)
* [License](#license)
<!-- TOC -->


## Installation

FederationWeb is distributed as a [Nosial Code Compiler (ncc)](https://github.com/nosial/ncc) package that DynamicalWeb
serves. Most deployments do not need to build it by hand. The [Dockerfile](Dockerfile) builds the package and installs
it into the DynamicalWeb image (see [Deploying with Docker](#deploying-with-docker)).

### Requirements

To build and run FederationWeb outside of Docker, you need:

 - [ncc](https://github.com/nosial/ncc), to build and install the package;
 - PHP 8.4.1 or newer (the version current ncc requires) with the `curl` and `memcached` extensions;
 - Node.js and npm, to compile the stylesheets, scripts and vendor assets;
 - a memcached server, for sessions and the cache;
 - [FederationLib](https://github.com/nosial/FederationLib) `2.1.0` or newer, whose client the package is built with;
 - a Federated Database server that implements version `2.0`, `2.1` or `2.2` of the OFD specification, such as
   FederationLib `2.0.0` or newer.

> [!NOTE]
> Different major versions of the OFD interface do not interoperate. FederationWeb refuses a server whose `api_version`
> has another major version (for example `1.0`) and shows an error saying the version is unsupported.

### Building the Package

First, install the project's dependencies:

```shell
ncc project install
```

Then build the `web_release` configuration, which is the one meant for deployment:

```shell
ncc build --configuration web_release
```

The build runs `npm install` and `npm run build` before compiling, so the assets are always up to date. The package is
written to `target/web_release/net.nosial.federationweb.ncc`.

### Compiling the Assets

The stylesheets are written in SCSS under `bootstrap/scss/`. The compiled files in `src/WebResources/css/` are not
tracked by git. When you work on the stylesheets or scripts, you can compile them without building the whole package:

```shell
npm install
npm run build
```

Use `npm run watch:css` to recompile the stylesheet every time a SCSS file changes.

### Makefile Targets

The [Makefile](Makefile) wraps the common commands:

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


## Deploying with Docker

Docker is the recommended way to deploy FederationWeb. The [Dockerfile](Dockerfile) compiles the `web_release` package
in a builder stage and installs it into the `ghcr.io/nosial/dynamicalweb` image, which runs:

 - **nginx**, which serves the web application on port `8080`;
 - **memcached** (256MB), which stores sessions and the cache;
 - **supervisord**, which keeps these services running;
 - **PHP-FPM** with the `apcu`, `sockets` and `memcached` extensions.

The image enables memcached, renews sessions on every request (`MEMCACHED_SESSION_SLIDING=1`) and caches server reads
for 60 seconds (`FEDERATION_CACHE_TTL=60`). It also raises PHP's upload limits to 64MB so that evidence can carry file
attachments, and its health check requests `/` every 30 seconds.

### Connecting to an Existing Server

FederationWeb only needs to reach a Federated Database server. To deploy it for a server that already runs, set
`FEDERATION_SERVER_ENDPOINT` to the server's URL:

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

Start the container, open `http://localhost:8080` and sign in with an operator's access token. You can also leave the
token blank to connect anonymously.

### Running the Complete Stack

The included [docker-compose.yml](docker-compose.yml) runs FederationWeb together with a FederationLib server, MariaDB
and Redis. This is useful for development, or for trying FederationWeb without an existing server:

```shell
docker compose up -d
```

The web application waits until the server's health check passes, then connects to it at
`http://federation_server:7000` on the internal network. The server is also exposed on port `7000`.

> [!CAUTION]
> The compose file falls back to well-known values for `FEDERATION_ACCESS_TOKEN` and the database passwords. Set
> `FEDERATION_ACCESS_TOKEN`, `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in an `.env` file before you expose the stack
> to anyone.

### Preparing a Production Deployment

FederationWeb handles operators' access tokens. Before you deploy it publicly, make sure that:

 - the web application is only served over HTTPS. A reverse proxy in front of it must send the `X-Forwarded-Proto`
   header, so that session cookies are marked as secure;
 - `FEDERATION_DISABLE_CUSTOM_HOST` is set (see [Configuring the Server Connection](#configuring-the-server-connection));
 - `MEMCACHED_SESSION_SECRET` is set to a long random value;
 - memcached is not reachable from outside the deployment. Sessions contain operators' access tokens, and the cache
   contains the records those operators can read;
 - sign-in attempts are rate-limited, at the reverse proxy or on the Federated Database server.


## Usage

### Signing In

The sign-in page offers two ways to connect:

 - **With an access token**, you sign in as the operator the token belongs to. You see the pages and actions your
   permissions allow (see [Access and Permissions](#access-and-permissions)).
 - **Without an access token**, you browse anonymously and see only what the server makes public. Set
   `FEDERATION_DISABLE_ANONYMOUS` to require a token.

By default, the sign-in page also has a server host field, so you can connect to any Federated Database server instead
of the configured one. FederationWeb keeps the chosen host in your session for as long as you stay signed in.

When the configured server cannot be reached, FederationWeb shows an error page instead of a broken page. The error
page remembers the page you asked for and lets you retry it. It does the same, saying so, when the server limits the
rate of its requests and rejects one with HTTP 429 (OFD 2.2). The same page explains a missing or invalid
`FEDERATION_SERVER_ENDPOINT`, and a server whose major OFD version is not supported; for the latter, it offers to sign
out.

> [!TIP]
> Sessions end after `MEMCACHED_SESSION_TTL` seconds without activity, one hour by default. Active users stay signed
> in, because the Docker image renews the session cookie on every request.

### Browsing Records

The navigation bar leads to a list page for each record type: operators, entities, reports, evidence, blacklist records
and the audit log. Each list can be searched, filtered and sorted, and the current state is kept in the address. You can
bookmark or share a filtered list, for example the opened reports, sorted from oldest to newest:

```text
/reports?category_filter=opened&sort_order=asc
```

The available filters depend on the record type. For example, reports filter by opened, closed, automated, assigned or
unassigned, evidence filters by automated or not automated, and blacklist records filter by incident type. Every record
has a detail page that shows its fields, its related records, its attachments and the audit entries that concern it.

The dashboard summarizes the connected server: how many records it holds, which record types it makes public, whether
it accepts illegal content reports, uploads by URL and public scan content, and the content types and concerns it scans
for.

> [!NOTE]
> When a filter has to be applied by FederationWeb rather than the server, the list reads at most 50 pages of results
> from the server. On very large servers such a list shows the first matching records only.

### Searching

The search page (`/search`) searches every record type at once, and the search field in the top bar suggests matching
records as you type. Anonymous visitors can use search when the server makes at least one searchable record type
public.

### Querying Entities

An entity is anything evidence can be about: a user, a domain, a telephone number and so on. Query Entity
(`/entities/query`) asks the server for its assessment of an entity, given its address, UUID or SHA-256 identifier:

```text
/entities/query?identifier=user@example.com
```

If the server publishes the concerns it can assess, you can choose which ones the query covers. Otherwise the server
assesses its default concerns:

```text
/entities/query?identifier=user@example.com&concerns=SPAM,PHISHING
```

Telephone numbers are entities of the `e164.arpa` host, and their pages carry a Telephone Number badge.

### Submitting Reports and Evidence

Operators with client permissions can submit reports from the New Report form (`/reports/submit`), and evidence from the
evidence list or an entity's page. Every piece of evidence has a content type, which defines the context fields the form
asks for:

 - **TEXT**, plain text content;
 - **EMAIL**, an email message;
 - **SMS**, a text message;
 - **WEB_PAGE**, the content of a web page;
 - **HOSTNAME**, a host name;
 - **URL**, an address.

A report is submitted together with all of its evidence in a single request. The evidence of an Illegal Content report
is therefore confidential from the moment it exists. The form only offers the Illegal Content incident type when the
server accepts such reports.

Evidence about a telephone number is always submitted as confidential.

You can attach files of up to 64MB to evidence you submitted, or to any evidence if you hold management permissions. If
the server publishes `allow_url_uploads`, you can instead give a URL, and the server retrieves the file itself.

### Managing Records

Operators with management permissions can act on records from their detail pages:

 - **Reports**: assign them to an operator, close them with a classification, or delete them;
 - **Evidence**: change their tag, mark or unmark them as confidential, add them to a report, upload or delete their
   attachments, or delete them;
 - **Entities**: edit their metadata, whitelist them, set or clear a relationship to another entity, clear their
   reputation, blacklist them, or delete them;
 - **Blacklist records**: lift them, extend them, or delete them.

Actions that are hard to undo, such as lifting a blacklist record or changing an evidence record's confidentiality,
ask for confirmation first. FederationWeb hides actions that the server would reject, such as unmarking evidence that
belongs to an illegal content report.

### Managing Operators

Operators with operator permissions can create, rename, enable, disable and delete operators, set their permissions,
and generate new access tokens for them. Every operator can change their own configuration: the auto-assign opt-ins for
ordinary and automated reports, and the bot setting.

> [!WARNING]
> The server discloses an access token only once, in the response that creates it. FederationWeb shows the token on
> the operator's page immediately after you create the operator or generate a token. Copy it before you leave the
> page, because it cannot be shown again.

The root and system operators cannot be modified, so their pages show no management actions.

### Printing Records

Every list and detail page has a printable version, at the same address followed by `/print`:

```text
/reports/print?category_filter=opened
/entities/{entity_id}/print
```

The printable pages use a separate stylesheet suited for paper and archiving, keep the filters of the list they were
opened from, and are excluded from search engines.

### Viewing the API Specification

When the server provides an OpenAPI specification at `/specification`, the API Specification page
(`/api-specification`) renders it. This endpoint is a FederationLib feature rather than part of the OFD
specification, so FederationWeb checks for it once per server and hides the page for servers that lack it.

### Changing the Theme and Language

FederationWeb starts in the dark theme. The theme toggle in the top bar switches between dark and light, and your
session remembers the choice.

The interface is available in English (`en`), Chinese (`cn`), Spanish (`es`) and Russian (`ru`). On your first visit,
FederationWeb picks the language from your browser's `Accept-Language` header and falls back to English. The language
menu in the top bar changes it, which is the same as visiting:

```text
/dynaweb/language/es
```

Translations are YAML files in `src/WebLocale/`. To add a language, add a file and register it under `locales` in
[project.yml](project.yml).

### Link Previews and Search Engines

Every page has a description, a canonical address, Open Graph and Twitter tags and schema.org structured data. Search
engines and link previews (Discord, Slack, Telegram and other messaging apps) therefore show the page's own title and
summary. Page titles end with the connected server's name, for example `Reports - Example Server`.

Previews are fetched without a session, so they describe a page as an anonymous visitor sees it. A page that the server
does not make public is previewed as the sign-in page. Print documents, search results and error pages ask search
engines not to index them.


## Configuration

FederationWeb is configured entirely through environment variables. With Docker, set them in the `environment` section
of the service in `docker-compose.yml`.

### Configuring the Server Connection

`FEDERATION_SERVER_ENDPOINT` is the only required variable. It is the URL of the Federated Database server to connect
to, including its scheme:

```yaml
environment:
  - FEDERATION_SERVER_ENDPOINT=https://federation.example.com
```

By default, users may enter the URL of any other server on the sign-in page. This suits a FederationWeb instance that
you host for yourself. On a public deployment, lock the sign-in page to the configured server:

```yaml
environment:
  - FEDERATION_DISABLE_CUSTOM_HOST=1
```

> [!CAUTION]
> The requests to a custom host are made by the FederationWeb server, not by the user's browser. On a public deployment
> a custom host lets anyone make your server send requests to addresses of their choosing, including addresses on your
> internal network.

To require an access token and disable anonymous browsing:

```yaml
environment:
  - FEDERATION_DISABLE_ANONYMOUS=1
```

> [!NOTE]
> Any non-empty value enables a flag, including `0` and `false`. To disable a flag, remove the variable or leave it
> empty.

What anonymous visitors can see is configured on the server itself. For FederationLib, see its `server.public`
configuration option.

### Configuring Sessions

DynamicalWeb handles sessions and stores them in memcached. Signing in requires sessions, so `MEMCACHED_ENABLED` must be
`1`, `true`, `yes` or `on`. The Docker image sets it already.

Sessions are bound to the client's user agent and IP address with an HMAC, using `MEMCACHED_SESSION_SECRET` as the key.
The default secret is publicly known, so always set your own in production:

```yaml
environment:
  - MEMCACHED_SESSION_SECRET=a-long-random-value
```

A session expires after `MEMCACHED_SESSION_TTL` seconds (3600 by default). Because the Docker image sets
`MEMCACHED_SESSION_SLIDING=1`, the cookie is renewed on every request, so the TTL is really an idle timeout. With
`MEMCACHED_SESSION_SLIDING=0`, users are signed out one TTL after signing in, however active they are.

Set `MEMCACHED_SESSION_BIND_IP=0` to keep sessions when a user's IP address changes, for example when a phone switches
between networks. The user agent is still checked.

### Configuring the Cache

A page reads many records from the server. Tables in particular resolve the operator and entity of every row.
FederationWeb reads each record once per request, and keeps successful reads in DynamicalWeb's memcached instance, so
following pages, paging through a table or reloading a page do not read them again.

Cached reads are kept separately for every server and access token, so an operator never sees records read with
another operator's permissions. Submitting a form discards the cache of the server, so the next page shows the change.
Changes made by other clients of the server appear once the cached reads expire.

Reads are cached for `FEDERATION_CACHE_TTL` seconds, 60 by default. Lower it to see changes from other clients sooner,
or set it to `0` to disable the cache:

```yaml
environment:
  - FEDERATION_CACHE_TTL=30
```

If memcached is unavailable (`MEMCACHED_ENABLED` is not set, or the `memcached` extension is missing), every page reads
from the server.

> [!NOTE]
> An access token revoked by another client of the server can keep seeing the pages it already loaded until they
> expire from the cache. Tokens regenerated through FederationWeb stop working immediately.

> [!TIP]
> Every cache key starts with `MEMCACHED_KEY_PREFIX`, `fw_` in the Docker image. When several web applications share
> one memcached server, give each its own prefix.

### Environment Variable Reference

| Environment Variable             | Type   | Default                               | Description                                                                   |
|----------------------------------|--------|---------------------------------------|-------------------------------------------------------------------------------|
| `FEDERATION_SERVER_ENDPOINT`     | string | None (required)                       | The URL of the Federated Database server to connect to                        |
| `FEDERATION_DISABLE_CUSTOM_HOST` | flag   | Not set                               | Locks the sign-in page to `FEDERATION_SERVER_ENDPOINT`                        |
| `FEDERATION_DISABLE_ANONYMOUS`   | flag   | Not set                               | Requires an access token to sign in                                           |
| `FEDERATION_CACHE_TTL`           | int    | `60`                                  | Seconds server reads are shared between requests, `0` disables the cache      |
| `MEMCACHED_ENABLED`              | bool   | `1` (Docker image)                    | Enables sessions and the cache; signing in requires it                        |
| `MEMCACHED_HOST`                 | string | `127.0.0.1`                           | The memcached server host                                                     |
| `MEMCACHED_PORT`                 | int    | `11211`                               | The memcached server port                                                     |
| `MEMCACHED_KEY_PREFIX`           | string | `fw_` (Docker image)                  | The prefix of every cache key                                                 |
| `MEMCACHED_SESSION_TTL`          | int    | `3600`                                | Seconds a session stays valid                                                 |
| `MEMCACHED_SESSION_SECRET`       | string | `dynamicalweb_default_session_secret` | The key that binds sessions to the client; set a long random value            |
| `MEMCACHED_SESSION_SLIDING`      | bool   | `1` (Docker image)                    | Renews the session cookie on every request, making the TTL an idle timeout    |
| `MEMCACHED_SESSION_BIND_IP`      | bool   | `1`                                   | Set to `0` to keep sessions when the client's IP address changes              |


## Access and Permissions

FederationWeb shows only the pages and actions your access allows. The Federated Database server remains responsible
for enforcing them:

| Access                 | Allows                                                                                                                    |
|------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Anonymous              | Read-only access to the records the server makes public                                                                   |
| Operator               | Read access to the server's records, and changing your own configuration (auto-assign opt-ins and bot status)             |
| Client permissions     | Submitting reports and evidence, and uploading attachments to the evidence you submitted                                  |
| Management permissions | Managing reports, evidence, entities and blacklist records, including closing and assigning reports and blacklisting      |
| Operator permissions   | Managing operators, their permissions, their configuration and their access tokens                                        |

Management permissions include client permissions, so client permissions cannot be revoked from an operator that keeps
management permissions.

Operator records are public: every visitor, anonymous ones included, can see the operator list and operator pages.
Entity metadata is shown to every signed-in operator, and to anonymous visitors when the server publishes
`public_entity_metadata`.


## Security

Besides the server's own permission checks, FederationWeb protects its users in the following ways:

 - **Cross-site request forgery**: every form and script request that changes something must carry the session's CSRF
   token. A form without a valid token is sent back to its page with an error.
 - **Response headers**: every response forbids framing (`X-Frame-Options: DENY` and `frame-ancestors 'none'`),
   restricts form targets and base URLs to the application itself, disables MIME type sniffing, and sends the referrer
   to the same origin only.
 - **Status messages**: success and error messages are carried to the next page in the session rather than the
   address, so they cannot be crafted into a link.

See [Preparing a Production Deployment](#preparing-a-production-deployment) for what a deployment must do on its side.


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
