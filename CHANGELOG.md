# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
 - Quick review on the reports list: a new row action opens a modal that shows the report (status, incident type,
   entity with its other reports and active blacklist records, operators, dates and message) and its evidence as
   tabs with the text content, context, note, metadata and attachments, with previews of image attachments. An open
   report can be closed from the modal with an optional classification: the modal closes at once while the report is
   closed in the background, its row shows it as closing and is updated in place without reloading the page, and a
   notification reports the outcome. Notifications stack, so several reports can be closed one after another.
 - Added the `native` build configuration, a standalone executable built by ncc's `frankenphp` build type that
   contains PHP, the FrankenPHP web server and FederationWeb. It is run with
   `./federationweb php-server --listen 127.0.0.1:8080`, keeps sessions in APCu, and is attached to every release as
   `federationweb-linux-x86_64`.

### Changed
 - Without `FEDERATION_SERVER_ENDPOINT`, pages lead to the sign-in page, where visitors enter the server they connect
   to, instead of the configuration error page. The error page is still shown when `FEDERATION_DISABLE_CUSTOM_HOST` is
   set without a server, or when the endpoint is not a valid URL.
 - Pages read records that don't depend on each other at the same time instead of one after another when FederationLib
   supports it (the labels of table rows, the related records of detail pages, the dashboard's overview and the quick
   review), which matters most when the server is far away. With an older FederationLib they are read as before.
 - Actions (POST requests) no longer read the records of their page before they are carried out, only the record they
   act on, since they redirect back to the page.
 - Search suggestions and the theme toggle read through the cache and no longer discard the cached records of the
   server, since they change no records.
 - Server information read before the access token is applied is kept for the rest of the request rather than read
   again, and the dashboard's top threats and the entity query of entity pages are cached like other reads.
 - Requires DynamicalWeb `1.0.23` or newer, which keeps sessions and the cache in APCu when memcached is not enabled.
 - The badge class of evidence classifications and the icon of attachment MIME types are shared through `Utilities`.

### Fixed
 - Changes made through FederationWeb were not always visible on the next page: the cached records of the server
   were discarded when the request ended, which can be after the browser has followed the redirect, and under the
   endpoint as configured rather than as the pages cache it (eg; with a trailing slash), so the change could stay
   hidden until the cache expired. They are now discarded before the response is sent, under the same endpoint.



## [1.0.5] - 2026-11-01

This update introduces a minor bug fix

### Fixed
 - The API specification page printed an `Undefined variable $type` warning for every schema that is not a reference,
   and showed those schemas with a generic label (eg; `object` or `mixed`) instead of their declared type.



## [1.0.4] - 2026-11-01

This update follows version `2.2` of the OFD Specification and requires FederationLib `2.1.0` or newer, servers of
versions `2.0` and `2.1` remain supported. Servers of another major version of the interface are refused.

### Added
 - The Content Scanning card of the dashboard shows the file limits of scanning (`max_scan_files` and
   `max_scan_file_size`), or that the server ignores the files submitted with scanned content.
 - Signing in to, or continuing a session with, a server whose `api_version` is not of major version `2` shows an
   error saying the version is unsupported, with a button to sign out.
 - Operator configuration: the operator detail page shows the auto-assign opt-ins for ordinary and automated reports
   and the bot setting, and an Edit Configuration modal changes them. Operators can change their own configuration,
   operators with operator permissions that of any operator. A configuration the server does not disclose is shown as
   a dash, and bot operators carry a Bot badge.
 - Evidence forms (the evidence list, the entity page and the New Report form) take a content type (`TEXT`, `EMAIL`,
   `SMS`, `WEB_PAGE`, `HOSTNAME` or `URL`) and the context fields defined for it, and evidence detail pages show the
   content type and context.
 - Evidence shows whether it is automated, in the evidence list (with Automated and Not Automated filters), on its
   detail page and in printed lists.
 - Attachments can be uploaded from a URL, which the server retrieves itself, when the server publishes
   `allow_url_uploads`.
 - Query Entity and the entity page let the concerns to assess be chosen when the server publishes its concerns.
 - Blacklist records can be filtered by incident type, including in printed lists.
 - The `ADVERTISING` and `TRACKING` incident types.
 - Audit log entries link the report they concern.
 - The dashboard shows whether telephone entities are public, whether the server accepts uploads by URL and stores
   public scan content, and the content types and concerns it scans for.
 - Entity pages of telephone numbers carry a Telephone Number badge.
 - A server that limits the rate of its requests (OFD 2.2) is reported as such: a request it rejects with HTTP 429
   shows that the server is limiting requests, with a button to retry, instead of saying that it is unavailable, and
   signing in shows it instead of saying that the server is unreachable or the access token is invalid.

### Changed
 - Server reads are cached in DynamicalWeb's memcached instance and shared between requests for
   `FEDERATION_CACHE_TTL` seconds (default `60`, `0` disables it), per server and access token. Submitting a form
   discards the cache of the server, so changes made through the web application show on the next page. Lists,
   searches and the audit log are now also read once per request. The Docker image enables memcached explicitly
   ([#4](https://github.com/nosial/FederationWeb/issues/4))
 - Cards no longer have colored borders: the accent stripes of the related-record cards on detail pages and of the
   record header, reputation and operator profile cards were removed, so every card keeps the neutral border
 - Rewrote the README in the style of the Symfony documentation, and documented the features it left out: signing in
   and the error page, browsing, searching, querying entities, submitting and managing records, printing, the API
   specification page, themes and languages, link previews, the complete Docker stack and the security measures
 - Included the project's light and dark icons from NosialFrontier in the README header.
 - Permissions are updated in a single request, and management permissions keep client permissions granted in the
   Set Permissions modal, as management permissions inherit them.
 - Creating an operator opens its page with its access token, as the server discloses it only in that response. The
   Generate Access Token modal no longer offers to show an existing token, which the server never discloses.
 - Blacklisting an entity no longer requires a report, and the report may concern another entity.
 - Evidence about a telephone number is always submitted as confidential.
 - Upload Attachment is only offered for evidence the operator submitted, unless it holds management permissions.
 - Removing the confidential mark is no longer offered for evidence linked to an illegal content report, which the
   server rejects.
 - The root and system operators no longer show management actions, which the server rejects.
 - Entity metadata is shown to every authenticated operator, and to anonymous visitors when the server publishes
   `public_entity_metadata`.
 - Updated the project to use ncc 3.1.11

### Fixed
 - Sorting the reports of an entity, of an operator or assigned to an operator takes effect, as FederationLib `2.1.0`
   honours the `by` and `order` parameters of these lists, which earlier servers ignored.
 - A failed attachment download shows the error message of the server (eg; that the attachment does not exist).
 - Updated the documented PHP minimum to match current ncc's PHP 8.4.1 requirement.
 - File attachments retained without their evidence no longer break the search and audit log pages.
 - The API Specification page failed with HTTP 500 for FederationLib `2.0.0`, whose OpenAPI 3.2 specification gives
   nullable members a list of types (eg; `["string", "null"]`). Such types are now shown as `string | null`, and the
   nested members of nullable objects and arrays are shown like any other.



## [1.0.3] - 2026-10-01

This update follows version `v1.0-R4` of the OFD Specification and requires FederationLib `1.0.13`.

### Added
 - The dashboard shows whether the server accepts illegal content reports.

### Changed
 - The New Report form no longer offers the Illegal Content incident type when the server does not accept illegal
   content, and submitting one anyway shows an error saying so.
 - All evidence of a new report is submitted with the report in a single request instead of submitting and linking
   each additional evidence record afterwards. Evidence of an Illegal Content report is therefore confidential from
   the moment it is created, and submitting a report with several evidence records no longer needs management
   permissions.
 - A failed report submission now shows an error with the server's reason instead of silently returning to the reports
   page.
 - Lifting a blacklist from its detail page, enabling or disabling an operator from the operators list, and marking or
   unmarking evidence as confidential now ask for confirmation in a modal instead of applying on a single click
   ([#2](https://github.com/nosial/FederationWeb/issues/2)). Toggling auto assign still applies immediately.
 - Operators with client or management permissions can set and clear entity relationships from the entity detail page,
   following `v1.0-R4` of the OFD Specification; operators holding only operator permissions no longer see the
   action ([#3](https://github.com/nosial/FederationWeb/issues/3)). Updating evidence tags still requires operator
   permissions.

### Fixed
 - Submitting a report from the New Report form failed with an HTTP 500 error, because it still called
   `FederationClient::submitReport()` and `submitEvidence()` with their signatures from before FederationLib `1.0.2`.
 - On small screens, opening a modal on a record detail page while scrolled down placed the modal and its backdrop at
   the top of the page instead of in view. Detail-page modals are now rendered outside the page layout, as on the list
   pages, and content wider than the screen no longer widens the page
   ([#1](https://github.com/nosial/FederationWeb/issues/1)).


## [1.0.2] - 2026-09-29

This update follows version `v1.0-R2` of the OFD Specification, where operator records are public information. This
update introduces stylesheet changes for a better mobile-view experience.

### Changed
 - The operators list and operator detail pages (and their print views) are now visible to every visitor, including
   anonymous sessions and operators without operator permissions. Operator names are resolved on every page for everyone.
 - Operator management controls (create, edit, delete, enable/disable, auto assign, permissions and access tokens) are
   only shown to operators with operator permissions.
 - Each record collection on the operator detail page follows its own domain's visibility and is loaded separately, so
   a private domain no longer hides the others.
 - The search page is available to anonymous sessions when operator search is public.
 - On small screens the navigation toggle spans the full bar and shows the current section.
 - Small screens keep the same compact component sizes as desktop: login fields, sign-in button, theme toggle,
   headings, pagination links, filter controls and the topbar search field are no longer enlarged. Text in input
   fields and text areas keeps its compact size too; interactive pages set `maximum-scale=1` in the viewport so
   iOS Safari doesn't zoom in when a field is focused.
 - On small screens tables scroll inside a box at most one screen tall, so the column headers stay visible while
   scrolling rows. The filter bar's action buttons match the height of the search field and selects beside them.
 - Page titles now end with the connected server's name (for example `Reports - Example Server`), and the dashboard
   and sign-in pages follow the same format.

### Added
 - Every page has a description, canonical address, robots directive, Open Graph and Twitter link-preview tags and
   schema.org structured data, so search engines and link previews (Discord, Slack, Telegram, messaging apps) show the
   page's own title and summary.

### Fixed
 - The "failed to load" error card on record detail pages sat at the left of the page instead of in the centre.
 - The operator detail page reported an access token as present when the server returned none.
 - On small screens the closed navigation menu was invisible but still clickable over the navigation bar, so tapping
   the menu toggle often opened a page instead of the menu.
 - Between the small and medium breakpoints the topbar's labelled buttons overlapped the search box; the topbar now
   switches to its compact, icon-only layout at the same width as the collapsed navigation.
 - At widths just above the compact layout, the topbar's button labels wrapped onto two lines and overlapped the search
   box; the buttons now keep their width and long operator names are shortened with an ellipsis.
 - The topbar search did nothing for anonymous sessions, because its script was only included for signed-in operators.
 - The compact topbar search field showed an empty gap where its icon should be and could only be dismissed with the
   Escape key; it now shows the icon, has a close button and closes when tapping outside it.
 - Tapping outside the open mobile navigation menu or search field to dismiss it also opened the link or table row
   under the tap; that tap now only dismisses.


## [1.0.1] - 2026-09-28

This update introduces minor fixes

### Changed
 - Renamed `zh.yml` to `cn.yml`

### Fixed
 - Login page layout on mobile devices; the logo panel now stacks above the form on narrow screens
 - Mobile Safari zooming into form fields, filter inputs and search boxes on focus
 - Pagination, filter bars, card headers, metadata rows and API specification endpoints overflowing on narrow screens


## [1.0.0] - 2026-09-26

Initial release of FederationWeb
