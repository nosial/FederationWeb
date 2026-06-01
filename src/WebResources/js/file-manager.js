/* =============================================================================
   Liquid Elegance — File Manager App Logic
   ============================================================================= */

/* ── Event API ─────────────────────────────────────────────────────────────── */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.FileManager = {
    _handlers: {},
    on: function(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); return this; },
    off: function(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(function(h) { return h !== fn; }); return this; },
    once: function(event, fn) { var self = this; var wrap = function(data) { self.off(event, wrap); fn(data); }; return self.on(event, wrap); },
    emit: function(event, data) {
        (this._handlers[event] || []).forEach(function(fn) { fn(data); });
        return this;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    var FM = LiquidElegance.FileManager;

    if (typeof feather !== 'undefined') feather.replace();

    /* ── Mobile sidebar navigation ────────────────────────────────────────── */
    var fmSidebar         = document.getElementById('fmSidebar');
    var fmSidebarToggle   = document.getElementById('fmSidebarToggle');
    var fmSidebarBackdrop = document.getElementById('fmSidebarBackdrop');
    var fmSidebarClose    = document.getElementById('fmSidebarClose');

    function isMobile() { return window.innerWidth < 768; }

    function openFmSidebar() {
        if (fmSidebar) fmSidebar.classList.add('show');
        if (fmSidebarBackdrop) fmSidebarBackdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeFmSidebar() {
        if (fmSidebar) fmSidebar.classList.remove('show');
        if (fmSidebarBackdrop) fmSidebarBackdrop.classList.remove('show');
        document.body.style.overflow = '';
    }

    if (fmSidebarToggle) fmSidebarToggle.addEventListener('click', openFmSidebar);
    if (fmSidebarBackdrop) fmSidebarBackdrop.addEventListener('click', closeFmSidebar);
    if (fmSidebarClose) fmSidebarClose.addEventListener('click', closeFmSidebar);

    /* ── DOM refs ──────────────────────────────────────────────────────────── */
    var gridViewBtn   = document.getElementById('gridViewBtn');
    var listViewBtn   = document.getElementById('listViewBtn');
    var gridView      = document.getElementById('fmGridView');
    var listView      = document.getElementById('fmListView');
    var searchInput   = document.getElementById('fmSearchInput');
    var uploadBtn     = document.getElementById('uploadBtn');
    var newFolderBtn  = document.getElementById('newFolderBtn');
    var dropZone      = document.getElementById('dropZone');
    var fileInput     = document.getElementById('fileInput');
    var breadcrumb    = document.getElementById('fmBreadcrumb');
    var previewPanel  = document.getElementById('fmPreviewPanel');
    var previewClose  = document.getElementById('fmPreviewClose');
    var contentArea   = document.querySelector('.fm-content-area');

    /* ── Helpers ───────────────────────────────────────────────────────────── */
    var TYPE_ICONS = {
        folder: 'folder', image: 'image', pdf: 'file-text', document: 'file',
        code: 'code', spreadsheet: 'grid', archive: 'archive', video: 'film',
        zip: 'archive', doc: 'file'
    };

    function featherIcon(name) {
        return '<i data-feather="' + name + '"></i>';
    }

    function getFileData(el) {
        return {
            name:  el.getAttribute('data-name')  || '',
            type:  el.getAttribute('data-type')  || '',
            size:  el.getAttribute('data-size')  || '—',
            date:  el.getAttribute('data-date')  || '—',
            owner: el.getAttribute('data-owner') || '—'
        };
    }

    function getBreadcrumbPath() {
        var items = breadcrumb.querySelectorAll('.fm-breadcrumb-item');
        var parts = [];
        items.forEach(function(i) { parts.push(i.textContent.trim()); });
        return parts.join(' / ');
    }

    /* ── View Toggle ──────────────────────────────────────────────────────── */
    gridViewBtn.addEventListener('click', function() {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        gridView.classList.remove('hidden');
        listView.classList.remove('visible');
        FM.emit('view:change', { mode: 'grid' });
    });

    listViewBtn.addEventListener('click', function() {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        gridView.classList.add('hidden');
        listView.classList.add('visible');
        FM.emit('view:change', { mode: 'list' });
    });

    /* ── Upload modal ─────────────────────────────────────────────────────── */
    uploadBtn.addEventListener('click', function() {
        var modal = new bootstrap.Modal(document.getElementById('uploadModal'));
        modal.show();
        FM.emit('file:upload', { source: 'toolbar' });
    });

    /* ── New folder modal ─────────────────────────────────────────────────── */
    newFolderBtn.addEventListener('click', function() {
        var modal = new bootstrap.Modal(document.getElementById('newFolderModal'));
        modal.show();
        setTimeout(function() { document.getElementById('folderNameInput').focus(); }, 300);
    });

    document.getElementById('createFolderBtn').addEventListener('click', function() {
        var name = document.getElementById('folderNameInput').value.trim();
        if (!name) name = 'Untitled folder';

        var card = document.createElement('div');
        card.className = 'fm-file-card glass-inner';
        card.setAttribute('data-name', name);
        card.setAttribute('data-type', 'folder');
        card.setAttribute('data-size', '—');
        card.setAttribute('data-date', 'Just now');
        card.setAttribute('data-owner', 'You');
        card.innerHTML = '<div class="fm-file-icon folder">' + featherIcon('folder') + '</div>' +
            '<div class="fm-file-name" title="' + name + '">' + name + '</div>' +
            '<div class="fm-file-meta">0 items &middot; Just now</div>';
        gridView.insertBefore(card, gridView.firstChild);

        var row = document.createElement('tr');
        row.setAttribute('data-name', name);
        row.setAttribute('data-type', 'folder');
        row.setAttribute('data-size', '—');
        row.setAttribute('data-date', 'Just now');
        row.setAttribute('data-owner', 'You');
        row.innerHTML = '<td><input type="checkbox" class="fm-checkbox-input"></td>' +
            '<td><div class="fm-table-name"><div class="fm-table-icon folder">' + featherIcon('folder') + '</div>' + name + '</div></td>' +
            '<td>0 items</td><td>Folder</td><td>Just now</td>' +
            '<td><div class="fm-table-actions"><button class="fm-row-menu" title="More">' + featherIcon('more-vertical') + '</button></div></td>';
        var tbody = document.getElementById('fmTableBody');
        tbody.insertBefore(row, tbody.firstChild);

        feather.replace();
        document.getElementById('folderNameInput').value = '';
        bootstrap.Modal.getInstance(document.getElementById('newFolderModal')).hide();
        FM.emit('folder:create', { name: name });
    });

    /* ── Drop zone ────────────────────────────────────────────────────────── */
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        FM.emit('file:upload', { source: 'drop', files: e.dataTransfer.files.length });
    });

    /* ── Search / filter ──────────────────────────────────────────────────── */
    searchInput.addEventListener('input', function() {
        var q = this.value.toLowerCase();
        gridView.querySelectorAll('.fm-file-card').forEach(function(c) {
            c.style.display = c.getAttribute('data-name').toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
        document.querySelectorAll('#fmTableBody tr').forEach(function(r) {
            r.style.display = r.getAttribute('data-name').toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
        FM.emit('file:search', { query: q });
    });

    /* ── Breadcrumb navigation ────────────────────────────────────────────── */
    function updateBreadcrumb(folderName) {
        breadcrumb.innerHTML =
            '<span class="fm-breadcrumb-item" data-path="root">My Files</span>' +
            '<span class="fm-breadcrumb-sep">' + featherIcon('chevron-right') + '</span>' +
            '<span class="fm-breadcrumb-item" data-path="documents">Documents</span>' +
            '<span class="fm-breadcrumb-sep">' + featherIcon('chevron-right') + '</span>' +
            '<span class="fm-breadcrumb-item" data-path="projects">Projects</span>' +
            '<span class="fm-breadcrumb-sep">' + featherIcon('chevron-right') + '</span>' +
            '<span class="fm-breadcrumb-item active">' + folderName + '</span>';
        feather.replace();
        FM.emit('folder:navigate', { path: getBreadcrumbPath(), folder: folderName });
    }

    gridView.addEventListener('click', function(e) {
        var card = e.target.closest('.fm-file-card');
        if (!card) return;
        if (card.getAttribute('data-type') === 'folder') {
            updateBreadcrumb(card.getAttribute('data-name'));
        }
        selectFile(card);
    });

    document.getElementById('fmTableBody').addEventListener('click', function(e) {
        var row = e.target.closest('tr');
        if (!row) return;
        if (e.target.closest('.fm-table-actions')) return;
        if (row.getAttribute('data-type') === 'folder') {
            updateBreadcrumb(row.getAttribute('data-name'));
        }
        selectFileFromRow(row);
    });

    breadcrumb.addEventListener('click', function(e) {
        var item = e.target.closest('.fm-breadcrumb-item');
        if (item && !item.classList.contains('active')) {
            var allChildren = Array.from(breadcrumb.children);
            var itemIdx = allChildren.indexOf(item);
            while (breadcrumb.children.length > itemIdx + 1) {
                breadcrumb.removeChild(breadcrumb.lastChild);
            }
            item.classList.add('active');
            FM.emit('folder:navigate', { path: getBreadcrumbPath(), folder: item.textContent.trim() });
        }
    });

    /* ── Sidebar nav highlight ────────────────────────────────────────────── */
    document.querySelectorAll('.fm-nav-item').forEach(function(item) {
        item.addEventListener('click', function() {
            document.querySelectorAll('.fm-nav-item').forEach(function(i) { i.classList.remove('active'); });
            this.classList.add('active');
            if (isMobile()) closeFmSidebar();
        });
    });

    /* ── Quick Access clicks ──────────────────────────────────────────────── */
    document.querySelectorAll('.fm-quick-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var name = item.getAttribute('data-name');
            var card = gridView.querySelector('.fm-file-card[data-name="' + name + '"]');
            if (card) selectFile(card);
        });
    });

    /* ── File Selection + Preview Panel ───────────────────────────────────── */
    function selectFile(cardEl) {
        gridView.querySelectorAll('.fm-file-card').forEach(function(c) { c.classList.remove('selected', 'fm-selected'); });
        cardEl.classList.add('selected', 'fm-selected');
        var data = getFileData(cardEl);
        showPreview(data);
        FM.emit('file:select', data);
    }

    function selectFileFromRow(rowEl) {
        var data = getFileData(rowEl);
        // highlight matching grid card too
        gridView.querySelectorAll('.fm-file-card').forEach(function(c) {
            c.classList.toggle('selected', c.getAttribute('data-name') === data.name);
            c.classList.toggle('fm-selected', c.getAttribute('data-name') === data.name);
        });
        showPreview(data);
        FM.emit('file:select', data);
    }

    function showPreview(data) {
        var iconName = TYPE_ICONS[data.type] || 'file';
        document.getElementById('fmPreviewIcon').innerHTML = featherIcon(iconName);
        document.getElementById('fmPreviewName').textContent = data.name;
        document.getElementById('fmPreviewType').textContent = data.type;
        document.getElementById('fmPreviewSize').textContent = data.size;
        document.getElementById('fmPreviewDate').textContent = data.date;
        document.getElementById('fmPreviewOwner').textContent = data.owner;
        document.getElementById('fmPreviewLocation').textContent = getBreadcrumbPath();
        previewPanel.classList.add('visible');
        feather.replace();
    }

    previewClose.addEventListener('click', function() {
        previewPanel.classList.remove('visible');
        gridView.querySelectorAll('.fm-file-card').forEach(function(c) { c.classList.remove('selected', 'fm-selected'); });
    });

    /* ── Preview panel action buttons ─────────────────────────────────────── */
    previewPanel.addEventListener('click', function(e) {
        var btn = e.target.closest('.fm-action-btn');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var name = document.getElementById('fmPreviewName').textContent;
        var map = { download: 'file:download', share: 'file:share', rename: 'file:rename', 'delete': 'file:delete' };
        if (map[action]) FM.emit(map[action], { name: name });
    });

    /* ── Context Menu Utility ─────────────────────────────────────────────── */
    var activeCtxMenu = null;
    var ctxTarget = null;

    function removeCtxMenu() {
        if (activeCtxMenu) {
            activeCtxMenu.remove();
            activeCtxMenu = null;
        }
        document.querySelectorAll('.fm-file-card.ctx-active').forEach(function(c) { c.classList.remove('ctx-active'); });
        ctxTarget = null;
    }

    document.addEventListener('click', removeCtxMenu);
    document.addEventListener('contextmenu', function(e) {
        if (!e.target.closest('.le-context-menu')) removeCtxMenu();
    });
    window.addEventListener('scroll', removeCtxMenu, { capture: true, passive: true });

    function showCtxMenu(x, y, items) {
        removeCtxMenu();
        var menu = document.createElement('div');
        menu.className = 'le-context-menu';

        items.forEach(function(item) {
            if (item === '---') {
                var div = document.createElement('div');
                div.className = 'le-context-menu-sep';
                menu.appendChild(div);
                return;
            }
            if (item.header) {
                var hdr = document.createElement('div');
                hdr.className = 'le-context-menu-header';
                hdr.textContent = item.header;
                menu.appendChild(hdr);
                return;
            }
            var el = document.createElement('div');
            el.className = 'le-context-menu-item' + (item.cls ? ' ' + item.cls : '');
            el.innerHTML = featherIcon(item.icon) + '<span>' + item.label + '</span>';
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                if (item.fn) item.fn();
                removeCtxMenu();
            });
            menu.appendChild(el);
        });

        document.body.appendChild(menu);
        feather.replace();

        // Keep within viewport
        var rect = menu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
        if (x < 0) x = 4;
        if (y < 0) y = 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        requestAnimationFrame(function() {
            menu.classList.add('visible');
        });

        activeCtxMenu = menu;
    }

    /* ── Context Menu: File Card (right-click) ────────────────────────────── */
    function onFileCtx(e, data) {
        e.preventDefault();
        e.stopPropagation();
        showCtxMenu(e.clientX, e.clientY, [
            { header: 'File Actions' },
            { icon: 'eye',       label: 'Preview',       fn: function() { FM.emit('file:preview',    data); } },
            { icon: 'download',  label: 'Download',      fn: function() { FM.emit('file:download',   data); } },
            { icon: 'share-2',   label: 'Share',         fn: function() { FM.emit('file:share',      data); } },
            '---',
            { icon: 'edit-2',    label: 'Rename',        fn: function() { FM.emit('file:rename',     data); } },
            { icon: 'copy',      label: 'Duplicate',     fn: function() { FM.emit('file:duplicate',  data); } },
            { icon: 'scissors',  label: 'Cut',           fn: function() { FM.emit('file:cut',        data); } },
            '---',
            { icon: 'folder',    label: 'Move to\u2026', fn: function() { FM.emit('file:move',       data); } },
            { icon: 'star',      label: 'Add to Starred',fn: function() { FM.emit('file:star',       data); } },
            { icon: 'info',      label: 'Properties',    fn: function() { FM.emit('file:properties', data); } },
            '---',
            { icon: 'trash-2',   label: 'Delete', cls: 'danger', fn: function() { FM.emit('file:delete', data); } }
        ]);
    }

    gridView.addEventListener('contextmenu', function(e) {
        var card = e.target.closest('.fm-file-card');
        if (card) {
            card.classList.add('ctx-active');
            ctxTarget = card;
            selectFile(card);
            onFileCtx(e, getFileData(card));
        }
    });

    document.getElementById('fmTableBody').addEventListener('contextmenu', function(e) {
        var row = e.target.closest('tr');
        if (row) {
            onFileCtx(e, getFileData(row));
        }
    });

    /* ── Context Menu: Empty area (right-click grid / content-area bg) ────── */
    function onEmptyCtx(e) {
        // only fire when NOT on a file card
        if (e.target.closest('.fm-file-card') || e.target.closest('tr') || e.target.closest('.le-context-menu')) return;
        e.preventDefault();
        showCtxMenu(e.clientX, e.clientY, [
            { header: 'New' },
            { icon: 'folder-plus', label: 'New Folder',    fn: function() { newFolderBtn.click(); FM.emit('folder:create', { source: 'context' }); } },
            { icon: 'upload',      label: 'Upload Files',  fn: function() { uploadBtn.click();    FM.emit('file:upload',   { source: 'context' }); } },
            '---',
            { icon: 'grid',        label: 'Grid View',     fn: function() { gridViewBtn.click();  } },
            { icon: 'list',        label: 'List View',     fn: function() { listViewBtn.click();  } },
            '---',
            { icon: 'refresh-cw',  label: 'Refresh',       fn: function() { FM.emit('action:refresh', {}); } },
            { icon: 'sliders',     label: 'Sort By\u2026', fn: function() { FM.emit('action:sort',    {}); } }
        ]);
    }

    if (contentArea) contentArea.addEventListener('contextmenu', onEmptyCtx);
    gridView.addEventListener('contextmenu', function(e) {
        if (!e.target.closest('.fm-file-card')) onEmptyCtx(e);
    });

    /* ── Mobile three-dot menu on file cards ──────────────────────────────── */
    function injectMobileMenuBtns() {
        gridView.querySelectorAll('.fm-file-card').forEach(function(card) {
            if (card.querySelector('.fm-card-more-btn')) return;
            var btn = document.createElement('button');
            btn.className = 'fm-card-more-btn';
            btn.title = 'More';
            btn.innerHTML = featherIcon('more-vertical');
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var rect = btn.getBoundingClientRect();
                selectFile(card);
                card.classList.add('ctx-active');
                ctxTarget = card;
                showCtxMenu(rect.right - 160, rect.bottom + 4, [
                    { header: 'File Actions' },
                    { icon: 'eye',       label: 'Preview',       fn: function() { FM.emit('file:preview',    getFileData(card)); } },
                    { icon: 'download',  label: 'Download',      fn: function() { FM.emit('file:download',   getFileData(card)); } },
                    { icon: 'share-2',   label: 'Share',         fn: function() { FM.emit('file:share',      getFileData(card)); } },
                    '---',
                    { icon: 'edit-2',    label: 'Rename',        fn: function() { FM.emit('file:rename',     getFileData(card)); } },
                    { icon: 'copy',      label: 'Duplicate',     fn: function() { FM.emit('file:duplicate',  getFileData(card)); } },
                    '---',
                    { icon: 'star',      label: 'Add to Starred',fn: function() { FM.emit('file:star',       getFileData(card)); } },
                    { icon: 'info',      label: 'Properties',    fn: function() { FM.emit('file:properties', getFileData(card)); } },
                    '---',
                    { icon: 'trash-2',   label: 'Delete', cls: 'danger', fn: function() { FM.emit('file:delete', getFileData(card)); } }
                ]);
            });
            card.appendChild(btn);
        });
        feather.replace();
    }
    injectMobileMenuBtns();

});
