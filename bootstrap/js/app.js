(function () {
  'use strict';

  var alerts = document.querySelectorAll('.fw-alert');
  alerts.forEach(function (alert) {
    setTimeout(function () {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 300ms ease';
      setTimeout(function () { alert.remove(); }, 300);
    }, 5000);
  });

  var copyLabel = document.getElementById('fw-copy-label');
  if (copyLabel) {
    document.querySelectorAll('.fw-copy-btn[title="Copy"]').forEach(function (button) {
      button.title = copyLabel.dataset.label;
    });
  }

  // === Table Filter Engine ===
  var activeFilters = {};
  var currentPage = {};

  function getTable(tableId) {
    return document.getElementById('table-' + tableId);
  }

  function getRows(table) {
    if (!table) return [];
    return Array.prototype.slice.call(table.querySelector('tbody').rows);
  }

  function getTotalCount(tableId) {
    var pag = document.querySelector('.fw-pagination[data-table="' + tableId + '"]');
    if (!pag) return 0;
    var el = pag.querySelector('.fw-showing-total');
    return el ? parseInt(el.textContent.replace(/[,\s]/g, ''), 10) || 0 : 0;
  }

  function getPerPage(tableId) {
    var pag = document.querySelector('.fw-pagination[data-table="' + tableId + '"]');
    if (!pag) return 10;
    var info = pag.querySelector('.fw-pagination-info');
    if (!info) return 10;
    var m = info.textContent.match(/–(\d+)/);
    return m ? parseInt(m[1], 10) : 10;
  }

  function applyFilters(tableId) {
    var table = getTable(tableId);
    if (!table) return;
    var rows = getRows(table);
    if (!rows.length) return;

    var bar = document.querySelector('.fw-filter-bar');
    var searchInput = bar ? bar.querySelector('.fw-filter-input[data-table="' + tableId + '"]') : null;
    var searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    var page = currentPage[tableId] || 1;
    var pp = getPerPage(tableId);

    var filterState = {};
    var badgesHtml = '';

    if (bar) {
      bar.querySelectorAll('.fw-filter-select[data-table="' + tableId + '"]').forEach(function (sel) {
        var val = sel.value;
        var col = parseInt(sel.getAttribute('data-col'), 10);
        if (val) {
          filterState['col' + col] = val;
          var label = sel.options[sel.selectedIndex].text;
          badgesHtml += '<span class="fw-filter-badge">' + label + '<button class="fw-filter-badge-remove" data-table="' + tableId + '" data-type="select" data-col="' + col + '">&times;</button></span>';
        }
      });
    }

    if (bar) {
      bar.querySelectorAll('.fw-filter-toggle[data-table="' + tableId + '"]').forEach(function (toggle) {
        var col = parseInt(toggle.getAttribute('data-col'), 10);
        var val = toggle.getAttribute('data-val');
        if (toggle.checked) {
          filterState['toggle' + col] = val;
          var label = toggle.closest('.fw-toggle-label');
          var text = label ? label.textContent.trim() : val;
          badgesHtml += '<span class="fw-filter-badge">' + text + '<button class="fw-filter-badge-remove" data-table="' + tableId + '" data-type="toggle" data-col="' + col + '">&times;</button></span>';
        }
      });
    }

    var visibleCount = 0;
    rows.forEach(function (row) {
      var textContent = row.textContent.toLowerCase();
      var show = true;

      if (searchVal && textContent.indexOf(searchVal) === -1) {
        show = false;
      }

      for (var key in filterState) {
        if (key.indexOf('col') === 0) {
          var c = parseInt(key.replace('col', ''), 10);
          var cell = row.cells[c];
          if (cell && cell.textContent.trim().indexOf(filterState[key]) === -1) {
            show = false;
            break;
          }
        }
      }

      for (var tkey in filterState) {
        if (tkey.indexOf('toggle') === 0) {
          var tc = parseInt(tkey.replace('toggle', ''), 10);
          var tcell = row.cells[tc];
          if (tcell && tcell.textContent.trim().indexOf(filterState[tkey]) === -1) {
            show = false;
            break;
          }
        }
      }

      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    var totalPages = Math.max(1, Math.ceil(visibleCount / pp));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    currentPage[tableId] = page;

    var shown = 0;
    var pageStart = (page - 1) * pp;
    var pageEnd = pageStart + pp;
    rows.forEach(function (row) {
      if (row.style.display === 'none') return;
      if (shown < pageStart || shown >= pageEnd) {
        row.style.display = 'none';
      }
      shown++;
    });

    var pag = document.querySelector('.fw-pagination[data-table="' + tableId + '"]');
    if (pag) {
      var startEl = pag.querySelector('.fw-showing-start');
      var endEl = pag.querySelector('.fw-showing-end');
      var totalEl = pag.querySelector('.fw-showing-total');
      var prevEl = pag.querySelector('.fw-page-prev');
      var nextEl = pag.querySelector('.fw-page-next');
      var currentEl = pag.querySelector('.fw-page-current');
      var totalPageEl = pag.querySelector('.fw-page-total');
      var ellipsis = pag.querySelector('.fw-page-ellipsis');

      var actualVisible = 0;
      rows.forEach(function (r) { if (r.style.display !== 'none') actualVisible++; });

      var start = Math.min(actualVisible, (page - 1) * pp + 1);
      var end = Math.min(actualVisible, page * pp);

      if (startEl) startEl.textContent = actualVisible > 0 ? start : 0;
      if (endEl) endEl.textContent = actualVisible > 0 ? end : 0;
      if (totalEl) totalEl.textContent = getTotalCount(tableId);

      if (prevEl) {
        if (page <= 1) prevEl.classList.add('disabled');
        else prevEl.classList.remove('disabled');
      }
      if (nextEl) {
        if (page >= totalPages) nextEl.classList.add('disabled');
        else nextEl.classList.remove('disabled');
      }
      if (currentEl) currentEl.textContent = page;
      if (totalPageEl) {
        totalPageEl.textContent = totalPages;
        totalPageEl.style.display = totalPages > 1 ? '' : 'none';
      }
      if (ellipsis) {
        ellipsis.style.display = totalPages > 2 ? '' : 'none';
      }
    }

    var badgesContainer = document.getElementById('badges-' + tableId);
    if (badgesContainer) {
      badgesContainer.innerHTML = badgesHtml;
    }
  }

  // Search input handler
  document.addEventListener('input', function (e) {
    if (e.target.matches('.fw-filter-input')) {
      applyFilters(e.target.getAttribute('data-table'));
    }
  });

  // Select change handler
  document.addEventListener('change', function (e) {
    if (e.target.matches('.fw-filter-select')) {
      applyFilters(e.target.getAttribute('data-table'));
    }
    if (e.target.matches('.fw-filter-toggle')) {
      applyFilters(e.target.getAttribute('data-table'));
    }
    if (e.target.matches('.fw-col-panel input[type="checkbox"]')) {
      var panel = e.target.closest('.fw-col-panel');
      if (!panel) return;
      var tableId = panel.id.replace('cols-', '');
      var col = parseInt(e.target.getAttribute('data-col'), 10);
      var table = getTable(tableId);
      if (!table) return;
      var visible = e.target.checked;
      table.querySelectorAll('tr').forEach(function (row) {
        if (row.cells[col]) row.cells[col].style.display = visible ? '' : 'none';
      });
    }
  });

  // Reset button
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fw-filter-reset');
    if (!btn) return;
    var tableId = btn.getAttribute('data-table');
    var bar = btn.closest('.fw-filter-bar');
    if (!bar) return;
    bar.querySelectorAll('.fw-filter-input').forEach(function (i) { i.value = ''; });
    bar.querySelectorAll('.fw-filter-select').forEach(function (s) { s.selectedIndex = 0; });
    bar.querySelectorAll('.fw-filter-toggle').forEach(function (t) { t.checked = false; });
    currentPage[tableId] = 1;
    applyFilters(tableId);
  });

  // Column toggle button
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fw-col-toggle');
    if (!btn) return;
    var tableId = btn.getAttribute('data-table');
    var panel = document.getElementById('cols-' + tableId);
    if (panel) panel.classList.toggle('open');
  });

  // Badge remove
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fw-filter-badge-remove');
    if (!btn) return;
    var tableId = btn.getAttribute('data-table');
    var type = btn.getAttribute('data-type');
    var col = btn.getAttribute('data-col');
    var bar = document.querySelector('.fw-filter-bar');

    if (type === 'select' && bar) {
      var sel = bar.querySelector('.fw-filter-select[data-table="' + tableId + '"][data-col="' + col + '"]');
      if (sel) sel.selectedIndex = 0;
    } else if (type === 'toggle' && bar) {
      var toggle = bar.querySelector('.fw-filter-toggle[data-table="' + tableId + '"][data-col="' + col + '"]');
      if (toggle) toggle.checked = false;
    }
    applyFilters(tableId);
  });

  // Pagination
  document.addEventListener('click', function (e) {
    var target = e.target.closest('a');
    if (!target) return;
    var pag = target.closest('.fw-pagination[data-table]');
    if (!pag) return;
    e.preventDefault();
    var tableId = pag.getAttribute('data-table');
    if (!tableId) return;
    if (target.classList.contains('fw-page-prev') && !target.classList.contains('disabled')) {
      currentPage[tableId] = (currentPage[tableId] || 1) - 1;
      applyFilters(tableId);
    } else if (target.classList.contains('fw-page-next') && !target.classList.contains('disabled')) {
      currentPage[tableId] = (currentPage[tableId] || 1) + 1;
      applyFilters(tableId);
    }
  });

  // Init tables on page load
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.fw-pagination[data-table]').forEach(function (pag) {
      var id = pag.getAttribute('data-table');
      if (id) {
        currentPage[id] = 1;
        applyFilters(id);
      }
    });
  });

  // === Global Search ===
  var searchInput = document.getElementById('globalSearch');
  var searchResults = document.getElementById('globalSearchResults');
  var searchToggle = document.querySelector('.fw-topbar-search-toggle');

  var searchIndex = [
    { title: 'Dashboard', desc: 'Overview and key metrics', href: 'pages/dashboard.html', icon: 'speedometer2', tags: 'home overview metrics statistics' },
    { title: 'Entities', desc: 'Tracked domains, URLs, emails, IPs', href: 'pages/entities.html', icon: 'person', tags: 'domain host ip address email entity' },
    { title: 'Evidence', desc: 'Evidence records linked to entities', href: 'pages/evidence.html', icon: 'file-earmark-text', tags: 'proof attachment file' },
    { title: 'Reports', desc: 'Incident reports against entities', href: 'pages/reports.html', icon: 'flag', tags: 'incident case ticket' },
    { title: 'Blacklist', desc: 'Blacklisted entities with classifications', href: 'pages/blacklist.html', icon: 'shield-exclamation', tags: 'block ban deny' },
    { title: 'Operators', desc: 'Manage operator accounts', href: 'pages/operators.html', icon: 'person-badge', tags: 'user account permission role' },
    { title: 'Audit Log', desc: 'Immutable record of all operations', href: 'pages/audit-log.html', icon: 'journal-text', tags: 'log history audit trail' },
    { title: 'Server', desc: 'Server information and configuration', href: 'pages/server.html', icon: 'hdd-stack', tags: 'info config specification api' }
  ];

  var searchRecords = [
    { type: 'Entity', icon: 'person', title: 'malicious-site.com', uuid: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890', fields: [{ l: 'ID', v: '—' },{ l: 'Reputation', v: '-750' },{ l: 'Whitelisted', v: 'No' },{ l: 'Relationship', v: '—' }], badges: [{ t: 'Entity', c: 'fw-search-badge-entity' },{ t: 'Rep -750', c: 'fw-badge-red' }], href: 'pages/entity-detail.html', tags: 'malicious-site.com domain malicious f1a2b3c4 entity' },
    { type: 'Entity', icon: 'person', title: 'evil.corp', uuid: 'a2b3c4d5-e6f7-8901-abcd-ef1234567891', fields: [{ l: 'ID', v: 'scam-support' },{ l: 'Reputation', v: '-920' },{ l: 'Whitelisted', v: 'No' },{ l: 'Relationship', v: '—' }], badges: [{ t: 'Entity', c: 'fw-search-badge-entity' },{ t: 'Rep -920', c: 'fw-badge-red' }], href: 'pages/entity-detail.html', tags: 'evil.corp email scam a2b3c4d5 entity support' },
    { type: 'Entity', icon: 'person', title: 'example.org', uuid: 'b3c4d5e6-f7a8-9012-abcd-ef1234567892', fields: [{ l: 'ID', v: '—' },{ l: 'Reputation', v: '+450' },{ l: 'Whitelisted', v: 'Yes' },{ l: 'Relationship', v: '—' }], badges: [{ t: 'Entity', c: 'fw-search-badge-entity' },{ t: 'Rep +450', c: 'fw-badge-emerald' }], href: 'pages/entity-detail.html', tags: 'example.org domain trusted b3c4d5e6 entity' },
    { type: 'Entity', icon: 'person', title: '192.168.1.100', uuid: 'c4d5e6f7-a8b9-0123-abcd-ef1234567893', fields: [{ l: 'ID', v: '—' },{ l: 'Reputation', v: '-120' },{ l: 'Whitelisted', v: 'No' },{ l: 'Relationship', v: 'CHILD → example.org' }], badges: [{ t: 'Entity', c: 'fw-search-badge-entity' },{ t: 'Rep -120', c: 'fw-badge-amber' }], href: 'pages/entity-detail.html', tags: '192.168.1.100 ipv4 address c4d5e6f7 entity' },
    { type: 'Entity', icon: 'person', title: 'trusted-mail.com', uuid: 'd5e6f7a8-b9c0-1234-abcd-ef1234567894', fields: [{ l: 'ID', v: 'noreply' },{ l: 'Reputation', v: '+850' },{ l: 'Whitelisted', v: 'Yes' },{ l: 'Relationship', v: '—' }], badges: [{ t: 'Entity', c: 'fw-search-badge-entity' },{ t: 'Rep +850', c: 'fw-badge-emerald' }], href: 'pages/entity-detail.html', tags: 'trusted-mail.com email trusted d5e6f7a8 entity' },
    { type: 'Evidence', icon: 'file-earmark-text', title: 'Phishing evidence linked to malicious-site.com', uuid: 'e1a2b3c4-d5e6-7890-abcd-ef1234567895', fields: [{ l: 'classification_flag', v: 'SUSPICIOUS' },{ l: 'tag', v: 'phishing_proof' },{ l: 'entity', v: 'malicious-site.com' },{ l: 'confidential', v: 'No' }], badges: [{ t: 'Evidence', c: 'fw-search-badge-evidence' },{ t: 'SUSPICIOUS', c: 'fw-badge-amber' }], href: 'pages/evidence-detail.html', tags: 'phishing evidence malicious-site.com suspicious e1a2b3c4' },
    { type: 'Evidence', icon: 'file-earmark-text', title: 'Malware sample collected from evil.corp', uuid: 'e3c4d5e6-f7a8-9012-abcd-ef1234567896', fields: [{ l: 'classification_flag', v: 'MALICIOUS' },{ l: 'tag', v: 'malware_sample' },{ l: 'entity', v: 'evil.corp' },{ l: 'confidential', v: 'No' }], badges: [{ t: 'Evidence', c: 'fw-search-badge-evidence' },{ t: 'MALICIOUS', c: 'fw-badge-red' }], href: 'pages/evidence-detail.html', tags: 'malware sample evil.corp malicious e3c4d5e6' },
    { type: 'Evidence', icon: 'file-earmark-text', title: 'Benign check performed on example.org', uuid: 'e7f8g9h0-i1j2-3456-abcd-ef1234567897', fields: [{ l: 'classification_flag', v: 'BENIGN' },{ l: 'tag', v: 'false_positive_check' },{ l: 'entity', v: 'example.org' },{ l: 'confidential', v: 'Yes' }], badges: [{ t: 'Evidence', c: 'fw-search-badge-evidence' },{ t: 'BENIGN', c: 'fw-badge-emerald' }], href: 'pages/evidence-detail.html', tags: 'benign check example.org e7f8g9h0 evidence' },
    { type: 'Report', icon: 'flag', title: 'MALWARE incident against malicious-site.com', uuid: 'r9a3b7c2-d5e6-7890-abcd-ef1234567898', fields: [{ l: 'submitting_operator', v: 'b2c3d4e5…' },{ l: 'reporting_entity', v: 'malicious-site.com' },{ l: 'automated', v: 'No' },{ l: 'opened', v: 'Closed' }], badges: [{ t: 'Report', c: 'fw-search-badge-report' },{ t: 'MALWARE', c: 'fw-badge-red' }], href: 'pages/report-detail.html', tags: 'malware report malicious-site.com closed r9a3b7c2' },
    { type: 'Report', icon: 'flag', title: 'SCAM incident against evil.corp', uuid: 'r4b5c6d7-e6f7-8901-abcd-ef1234567899', fields: [{ l: 'submitting_operator', v: 'e5f6a7b8…' },{ l: 'reporting_entity', v: 'evil.corp' },{ l: 'automated', v: 'Yes' },{ l: 'opened', v: 'Open' }], badges: [{ t: 'Report', c: 'fw-search-badge-report' },{ t: 'SCAM', c: 'fw-badge-amber' }], href: 'pages/report-detail.html', tags: 'scam report evil.corp open r4b5c6d7' },
    { type: 'Report', icon: 'flag', title: 'PHISHING incident against example.org', uuid: 'r8c9d0e1-f7a8-9012-abcd-ef1234567900', fields: [{ l: 'submitting_operator', v: 'b2c3d4e5…' },{ l: 'reporting_entity', v: 'example.org' },{ l: 'automated', v: 'No' },{ l: 'opened', v: 'Open' }], badges: [{ t: 'Report', c: 'fw-search-badge-report' },{ t: 'PHISHING', c: 'fw-badge-blue' }], href: 'pages/report-detail.html', tags: 'phishing report example.org open r8c9d0e1' },
    { type: 'Blacklist', icon: 'shield-exclamation', title: 'malicious-site.com', uuid: 'b1a2b3c4-d5e6-7890-abcd-ef1234567901', fields: [{ l: 'incident_type', v: 'SCAM' },{ l: 'lifted', v: 'No' },{ l: 'expires', v: '2026-08-13' },{ l: 'evidence', v: 'e1a2b3c4…' }], badges: [{ t: 'Blacklist', c: 'fw-search-badge-blacklist' },{ t: 'SCAM', c: 'fw-badge-amber' }], href: 'pages/blacklist-detail.html', tags: 'malicious-site.com scam blacklist active b1a2b3c4' },
    { type: 'Blacklist', icon: 'shield-exclamation', title: 'evil.corp', uuid: 'b3c4d5e6-f7a8-9012-abcd-ef1234567902', fields: [{ l: 'incident_type', v: 'MALWARE' },{ l: 'lifted', v: 'No' },{ l: 'expires', v: '2026-09-01' },{ l: 'evidence', v: 'e3c4d5e6…' }], badges: [{ t: 'Blacklist', c: 'fw-search-badge-blacklist' },{ t: 'MALWARE', c: 'fw-badge-red' }], href: 'pages/blacklist-detail.html', tags: 'evil.corp malware blacklist active b3c4d5e6' },
    { type: 'Blacklist', icon: 'shield-exclamation', title: '192.168.1.100', uuid: 'b5d6e7f8-a8b9-0123-abcd-ef1234567903', fields: [{ l: 'incident_type', v: 'PHISHING' },{ l: 'lifted', v: 'Yes' },{ l: 'expires', v: '—' },{ l: 'evidence', v: '—' }], badges: [{ t: 'Blacklist', c: 'fw-search-badge-blacklist' },{ t: 'PHISHING', c: 'fw-badge-blue' }], href: 'pages/blacklist-detail.html', tags: '192.168.1.100 phishing blacklist lifted b5d6e7f8' },
    { type: 'Operator', icon: 'person-badge', title: 'Alpha', uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567904', fields: [{ l: 'disabled', v: 'No' },{ l: 'client_permissions', v: 'Yes' },{ l: 'management_permissions', v: 'Yes' },{ l: 'operator_permissions', v: 'Yes' }], badges: [{ t: 'Operator', c: 'fw-search-badge-operator' },{ t: 'Manager', c: 'fw-badge-purple' }], href: 'pages/operator-detail.html', tags: 'alpha manager operator a1b2c3d4' },
    { type: 'Operator', icon: 'person-badge', title: 'Beta', uuid: 'b2c3d4e5-f6a7-8901-abcd-ef1234567905', fields: [{ l: 'disabled', v: 'No' },{ l: 'client_permissions', v: 'Yes' },{ l: 'management_permissions', v: 'No' },{ l: 'operator_permissions', v: 'Yes' }], badges: [{ t: 'Operator', c: 'fw-search-badge-operator' },{ t: 'Operator', c: 'fw-badge-blue' }], href: 'pages/operator-detail.html', tags: 'beta operator b2c3d4e5' },
    { type: 'Operator', icon: 'person-badge', title: 'Gamma', uuid: 'c3d4e5f6-a7b8-9012-abcd-ef1234567906', fields: [{ l: 'disabled', v: 'Yes' },{ l: 'client_permissions', v: 'No' },{ l: 'management_permissions', v: 'No' },{ l: 'operator_permissions', v: 'No' }], badges: [{ t: 'Operator', c: 'fw-search-badge-operator' },{ t: 'Viewer', c: 'fw-badge-gray' }], href: 'pages/operator-detail.html', tags: 'gamma viewer operator c3d4e5f6' },
    { type: 'Audit Log', icon: 'journal-text', title: 'Entity pushed: malicious-site.com', uuid: 'aud-0001-0001-0000-000000000001', fields: [{ l: 'type', v: 'ENTITY_BLACKLISTED' },{ l: 'operator', v: 'Alpha' },{ l: 'entity', v: 'malicious-site.com' },{ l: 'timestamp', v: '2026-07-13 13:15' }], badges: [{ t: 'Audit Log', c: 'fw-search-badge-audit-log' },{ t: 'ENTITY', c: 'fw-badge-amber' }], href: 'pages/audit-detail.html', tags: 'entity pushed malicious-site.com alpha audit' },
    { type: 'Audit Log', icon: 'journal-text', title: 'Evidence submitted for malicious-site.com', uuid: 'aud-0001-0002-0000-000000000002', fields: [{ l: 'type', v: 'EVIDENCE_SUBMITTED' },{ l: 'operator', v: 'Alpha' },{ l: 'evidence', v: 'e1a2b3c4…' },{ l: 'timestamp', v: '2026-07-13 11:30' }], badges: [{ t: 'Audit Log', c: 'fw-search-badge-audit-log' },{ t: 'EVIDENCE', c: 'fw-badge-cyan' }], href: 'pages/audit-detail.html', tags: 'evidence submitted malicious-site.com alpha audit' },
    { type: 'Audit Log', icon: 'journal-text', title: 'Blacklist entry created: SCAM', uuid: 'aud-0001-0003-0000-000000000003', fields: [{ l: 'type', v: 'ENTITY_BLACKLISTED' },{ l: 'operator', v: 'Alpha' },{ l: 'blacklist', v: 'b1a2b3c4…' },{ l: 'timestamp', v: '2026-07-12 09:45' }], badges: [{ t: 'Audit Log', c: 'fw-search-badge-audit-log' },{ t: 'BLACKLIST', c: 'fw-badge-red' }], href: 'pages/audit-detail.html', tags: 'blacklist entry created scam alpha audit' },
    { type: 'Audit Log', icon: 'journal-text', title: 'Operator login: Alpha', uuid: 'aud-0001-0004-0000-000000000004', fields: [{ l: 'type', v: 'OPERATOR_LOGIN' },{ l: 'operator', v: 'Alpha' },{ l: 'entity', v: '—' },{ l: 'timestamp', v: '2026-07-13 08:00' }], badges: [{ t: 'Audit Log', c: 'fw-search-badge-audit-log' },{ t: 'AUTH', c: 'fw-badge-gray' }], href: 'pages/audit-detail.html', tags: 'operator login alpha audit' }
  ];

  window.__FW_SEARCH_DATA = {
    pages: searchIndex,
    records: searchRecords
  };

  if (searchInput) {
    var rootPath = searchInput.getAttribute('data-root') || './';

    function renderResults(query, pages, records) {
      if (!searchResults) return;
      if (!query || (pages.length === 0 && records.length === 0)) {
        searchResults.classList.remove('open');
        return;
      }

      var html = '';
      var totalCount = pages.length + records.length;
      var maxShow = 8;

      if (pages.length > 0) {
        var pageCount = Math.min(pages.length, 3);
        for (var i = 0; i < pageCount && html.split('</a>').length - 1 < maxShow; i++) {
          var p = pages[i];
          html += '<a class="fw-search-result-item" href="' + rootPath + p.href + '">';
          html += '<i class="bi bi-' + p.icon + '"></i>';
          html += '<div class="fw-search-result-info">';
          html += '<div class="fw-search-result-title">' + p.title + '</div>';
          html += '<div class="fw-search-result-desc">' + p.desc + '</div>';
          html += '</div>';
          html += '<span class="fw-search-result-badge fw-search-badge-page">Page</span>';
          html += '</a>';
        }
      }

      if (records.length > 0 && html.split('</a>').length - 1 < maxShow) {
        var recordLimit = maxShow - (html.split('</a>').length - 1);
        for (var j = 0; j < Math.min(records.length, recordLimit); j++) {
          var r = records[j];
          var metaStr = '';
          for (var m = 0; m < r.fields.length; m++) {
            if (m > 0) metaStr += ' · ';
            metaStr += r.fields[m].v;
          }
          html += '<a class="fw-search-result-item fw-search-result-record" href="' + rootPath + r.href + '">';
          html += '<i class="bi bi-' + r.icon + '"></i>';
          html += '<div class="fw-search-result-info">';
          html += '<div class="fw-search-result-title">' + r.title + '</div>';
          html += '<div class="fw-search-result-desc">' + metaStr + '</div>';
          html += '</div>';
          html += '<span class="fw-search-result-badge fw-search-badge-' + r.type.toLowerCase().replace(/\s+/g, '-') + '">' + r.type + '</span>';
          html += '</a>';
        }
      }

      if (totalCount > (html.split('</a>').length - 1)) {
        html += '<a class="fw-search-result-item fw-search-result-view-all" href="' + rootPath + 'pages/search-results.html">';
        html += '<span>View all ' + totalCount + ' results</span>';
        html += '<i class="bi bi-arrow-right"></i>';
        html += '</a>';
      }

      searchResults.innerHTML = html;
      searchResults.classList.add('open');
    }

    function doSearch(query) {
      if (!query || query.length < 2) {
        renderResults('', [], []);
        return;
      }
      var q = query.toLowerCase();
      var matchedPages = searchIndex.filter(function (item) {
        return item.title.toLowerCase().indexOf(q) !== -1 ||
               item.desc.toLowerCase().indexOf(q) !== -1 ||
               item.tags.toLowerCase().indexOf(q) !== -1;
      });
      var matchedRecords = searchRecords.filter(function (item) {
        if (item.title.toLowerCase().indexOf(q) !== -1) return true;
        if (item.uuid.toLowerCase().indexOf(q) !== -1) return true;
        if (item.tags.toLowerCase().indexOf(q) !== -1) return true;
        for (var mi = 0; mi < item.fields.length; mi++) {
          if (item.fields[mi].v.toLowerCase().indexOf(q) !== -1) return true;
        }
        return false;
      });
      renderResults(query, matchedPages, matchedRecords);
    }

    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      var val = this.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { doSearch(val); }, 150);
    });

    searchInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (searchResults) searchResults.classList.remove('open');
      }, 200);
    });

    searchInput.addEventListener('focus', function () {
      if (this.value.length >= 2) doSearch(this.value);
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        this.blur();
        if (searchResults) searchResults.classList.remove('open');
      }
    });

    if (searchToggle) {
      searchToggle.addEventListener('click', function () {
        searchInput.classList.toggle('open');
        if (searchInput.classList.contains('open')) {
          searchInput.focus();
        } else {
          searchInput.blur();
          if (searchResults) searchResults.classList.remove('open');
        }
      });
    }

    document.addEventListener('click', function (e) {
      if (searchInput && searchInput.classList.contains('open')) {
        var searchWrap = document.querySelector('.fw-topbar-search');
        if (searchWrap && !searchWrap.contains(e.target)) {
          searchInput.classList.remove('open');
          if (searchResults) searchResults.classList.remove('open');
        }
      }
    });
  }

  // === Copy to clipboard ===
  function fwCopyText(text, btn) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () {
        fwCopied(btn);
      }).catch(function () {
        fwCopyFallback(text, btn);
      });
    } else {
      fwCopyFallback(text, btn);
    }
  }

  function fwCopyFallback(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
    fwCopied(btn);
  }

  function fwCopied(btn) {
    var icon = btn.querySelector('i');
    if (!icon) return;
    icon.className = 'bi bi-check';
    btn.classList.add('copied');
    fwCopyToast(btn);
    setTimeout(function () {
      icon.className = 'bi bi-clipboard';
      btn.classList.remove('copied');
    }, 1500);
  }

  function fwCopyToast(btn) {
    var existing = document.querySelector('.fw-copy-toast');
    if (existing) existing.remove();

    var el = document.createElement('span');
    el.className = 'fw-copy-toast';
    el.innerHTML = '<i class="bi bi-check"></i>Copied';
    document.body.appendChild(el);

    var rect = btn.getBoundingClientRect();
    el.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    el.style.top = Math.round(rect.top - 8) + 'px';

    requestAnimationFrame(function () {
      el.classList.add('in');
    });

    setTimeout(function () {
      el.classList.remove('in');
      setTimeout(function () { el.remove(); }, 200);
    }, 1200);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fw-copy-btn');
    if (!btn) return;
    e.preventDefault();
    var text = btn.getAttribute('data-copy');
    if (!text) return;
    fwCopyText(text, btn);
  });

  // === Clickable table rows ===
  function fwOpenRow(row, newTab) {
    var url = row.getAttribute('data-href');
    if (!url) return;
    if (newTab) {
      window.open(url, '_blank');
      return;
    }
    window.location.href = url;
  }
  document.addEventListener('click', function (e) {
    var row = e.target.closest('tr[data-href]');
    if (!row) return;
    if (e.target.closest('a, button, .fw-copy-btn, input, textarea, select')) return;
    e.preventDefault();
    fwOpenRow(row, e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1);
  });
  document.addEventListener('auxclick', function (e) {
    if (e.button !== 1) return;
    var row = e.target.closest('tr[data-href]');
    if (!row) return;
    if (e.target.closest('a, button, .fw-copy-btn, input, textarea, select')) return;
    e.preventDefault();
    fwOpenRow(row, true);
  });

  // === Dark Mode Toggle ===
  function fwInitDarkMode() {
    var html = document.documentElement;
    var stored = html.getAttribute('data-fw-theme') === 'dark';

    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('.fw-dark-mode-toggle');
      if (!toggle) return;

      var isDark = html.getAttribute('data-fw-theme') === 'dark';
      var next = isDark ? '' : 'dark';

      html.setAttribute('data-fw-theme', next);

      var label = toggle.querySelector('span');
      var icon = toggle.querySelector('i');
      if (label) {
        label.textContent = next === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      }
      if (icon) {
        icon.className = next === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
      }

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/toggle-dark-mode', true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send();
    });
  }

  // === Date/time picker ===
  function fwInitDatePickers() {
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var pickers = document.querySelectorAll('[data-fw-date-picker]');

    function positionPanel(picker) {
      var toggle = picker._fwToggle;
      var panel = picker._fwPanel;
      if (!toggle || !panel || panel.hidden) return;
      var rect = toggle.getBoundingClientRect();
      var panelWidth = panel.offsetWidth;
      var panelHeight = panel.offsetHeight;
      var margin = 8;
      var left = rect.left;
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - panelWidth);
      }
      var top = rect.bottom + 4;
      if (top + panelHeight > window.innerHeight - margin) {
        var above = rect.top - 4 - panelHeight;
        if (above >= margin) top = above;
      }
      panel.style.position = 'fixed';
      panel.style.zIndex = '1075'; // above Bootstrap modal (1055)
      panel.style.left = Math.round(left) + 'px';
      panel.style.top = Math.round(top) + 'px';
    }

    function closePicker(picker) {
      var panel = picker._fwPanel;
      var toggle = picker._fwToggle;
      if (!panel || !toggle) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    pickers.forEach(function(picker) {
      var value = picker.querySelector('[data-fw-date-value]');
      var toggle = picker.querySelector('[data-fw-date-toggle]');
      var panel = picker.querySelector('[data-fw-date-panel]');
      var label = picker.querySelector('[data-fw-date-label]');
      var monthLabel = picker.querySelector('[data-fw-date-month]');
      var days = picker.querySelector('[data-fw-date-days]');
      var hour = picker.querySelector('[data-fw-date-hour]');
      var minute = picker.querySelector('[data-fw-date-minute]');
      var min = Number(picker.getAttribute('data-min')) * 1000;
      var optional = picker.hasAttribute('data-optional');
      var placeholder = label.textContent;
      var selected = value.value ? new Date(Number(value.value) * 1000) : null;
      var cursor = selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(Math.max(Date.now(), min));
      picker._fwPanel = panel;
      picker._fwToggle = toggle;

      for (var h = 0; h < 24; h++) hour.add(new Option(String(h).padStart(2, '0'), h));
      for (var m = 0; m < 60; m++) minute.add(new Option(String(m).padStart(2, '0'), m));

      function commit() {
        if (!selected) { value.value = ''; renderLabel(); return; }
        selected.setHours(Number(hour.value), Number(minute.value), 0, 0);
        if (selected.getTime() < min) return;
        value.value = String(Math.floor(selected.getTime() / 1000));
        renderLabel();
      }

      function renderLabel() {
        label.textContent = selected ? selected.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : placeholder;
      }

      function renderCalendar() {
        monthLabel.textContent = monthNames[cursor.getMonth()] + ' ' + cursor.getFullYear();
        days.innerHTML = '';
        var start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        start.setDate(start.getDate() - start.getDay());
        for (var i = 0; i < 42; i++) {
          var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'fw-date-picker-day' + (day.getMonth() !== cursor.getMonth() ? ' muted' : '');
          button.textContent = day.getDate();
          button.disabled = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() <= min;
          if (selected && day.toDateString() === selected.toDateString()) button.classList.add('selected');
          (function(chosenDay) {
            button.addEventListener('click', function() {
              selected = new Date(chosenDay.getFullYear(), chosenDay.getMonth(), chosenDay.getDate(), Number(hour.value), Number(minute.value));
              commit();
              renderCalendar();
            });
          })(day);
          days.appendChild(button);
        }
      }

      if (selected) {
        hour.value = selected.getHours();
        minute.value = selected.getMinutes();
      } else {
        var initial = new Date(Math.max(Date.now(), min));
        hour.value = initial.getHours();
        minute.value = initial.getMinutes();
      }
      renderLabel();
      renderCalendar();

      hour.addEventListener('change', function() { if (selected) commit(); });
      minute.addEventListener('change', function() { if (selected) commit(); });

      toggle.addEventListener('click', function() {
        var open = panel.hidden;
        pickers.forEach(closePicker);
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { renderCalendar(); positionPanel(picker); }
      });
      // Internal clicks must never reach the document outside-close handler.
      // Day buttons are rebuilt by renderCalendar(), detaching the clicked node,
      // which would otherwise make closest() there return null and close the panel.
      panel.addEventListener('click', function(event) { event.stopPropagation(); });
      picker.querySelector('[data-fw-date-previous]').addEventListener('click', function() { cursor.setMonth(cursor.getMonth() - 1); renderCalendar(); });
      picker.querySelector('[data-fw-date-next]').addEventListener('click', function() { cursor.setMonth(cursor.getMonth() + 1); renderCalendar(); });
      picker.querySelector('[data-fw-date-apply]').addEventListener('click', function() {
        commit();
        closePicker(picker);
      });
      var clear = picker.querySelector('[data-fw-date-clear]');
      if (clear) clear.addEventListener('click', function() { selected = null; value.value = ''; renderLabel(); closePicker(picker); });
      var form = picker.closest('form');
      if (form) form.addEventListener('submit', function(event) {
        if (!optional && !value.value) {
          event.preventDefault();
          panel.hidden = false;
          toggle.setAttribute('aria-expanded', 'true');
          renderCalendar();
          positionPanel(picker);
        }
      });
    });

    function repositionOpenPanels() {
      pickers.forEach(function(picker) { positionPanel(picker); });
    }
    window.addEventListener('resize', repositionOpenPanels);
    window.addEventListener('scroll', repositionOpenPanels, true);

    document.addEventListener('click', function(event) {
      if (event.target.closest('[data-fw-date-picker]') || event.target.closest('[data-fw-date-panel]')) return;
      pickers.forEach(closePicker);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    fwInitDarkMode();
    fwInitDatePickers();
  });
})();
