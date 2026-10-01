# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - Ongoing

This is an ongoing update



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