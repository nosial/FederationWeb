/* =============================================================================
   Liquid Elegance — Mail App Logic
   ============================================================================= */

/* ---- Event API ----------------------------------------------------------- */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Mail = {
    _handlers: {},
    on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); return this; },
    off(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn); return this; },
    once(event, fn) { const wrap = (data) => { this.off(event, wrap); fn(data); }; return this.on(event, wrap); },
    emit(event, data) {
        (this._handlers[event] || []).forEach(fn => fn(data));
        return this;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    feather.replace();

    const mailItems = document.querySelectorAll('.mail-item');
    const readingPane = document.getElementById('readingPane');
    const emptyPane = document.getElementById('emptyPane');
    const readingSubject = document.getElementById('readingSubject');
    const readingFromName = document.getElementById('readingFromName');
    const readingFromEmail = document.getElementById('readingFromEmail');
    const readingDate = document.getElementById('readingDate');
    const readingBody = document.getElementById('readingBody');
    const readingAvatar = document.getElementById('readingAvatar');
    const readingAttachments = document.getElementById('readingAttachments');

    /* -- Mobile navigation elements --------------------------------------- */
    const mailBack = document.getElementById('mailBack');
    const mailSidebar = document.getElementById('mailSidebar');
    const sidebarToggle = document.getElementById('mailSidebarToggle');
    const sidebarBackdrop = document.getElementById('mailSidebarBackdrop');
    const sidebarClose = document.getElementById('mailSidebarClose');
    const fabCompose = document.getElementById('mailFabCompose');

    function isMobile() { return window.innerWidth < 992; }

    /* -- Back button: close reading pane, return to list ------------------- */
    if (mailBack) {
        mailBack.addEventListener('click', function() {
            readingPane.classList.add('hidden');
            if (emptyPane && !isMobile()) emptyPane.classList.remove('hidden');
            mailItems.forEach(i => i.classList.remove('active'));
            LiquidElegance.Mail.emit('mail:back', {});
        });
    }

    /* -- Sidebar toggle --------------------------------------------------- */
    function openSidebar() {
        if (mailSidebar) mailSidebar.classList.add('show');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        if (mailSidebar) mailSidebar.classList.remove('show');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
        document.body.style.overflow = '';
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);

    /* -- Hide FAB when reading pane is open ------------------------------- */
    function updateFab() {
        if (fabCompose && isMobile()) {
            fabCompose.style.display = readingPane.classList.contains('hidden') ? '' : 'none';
        }
    }

    const avatarColors = [
        'linear-gradient(135deg,var(--le-primary),var(--le-secondary,var(--le-primary)))',
        'linear-gradient(135deg,var(--le-success),#059669)',
        'linear-gradient(135deg,var(--le-warning),#d97706)',
        'linear-gradient(135deg,#6366f1,#8b5cf6)',
        'linear-gradient(135deg,#ec4899,#f43f5e)',
        'linear-gradient(135deg,#14b8a6,#0d9488)',
        'linear-gradient(135deg,#3b82f6,#2563eb)',
        'linear-gradient(135deg,#a855f7,#7c3aed)',
        'linear-gradient(135deg,#f59e0b,#ea580c)',
        'linear-gradient(135deg,#06b6d4,#0891b2)',
        'linear-gradient(135deg,#84cc16,#65a30d)',
        'linear-gradient(135deg,#ef4444,#dc2626)',
    ];

    /* -- Helper: extract mail-item metadata -------------------------------- */
    function itemData(el) {
        return { id: el.dataset.id, from: el.dataset.from, subject: el.dataset.subject };
    }

    /* -- Click email to open reading pane ---------------------------------- */
    mailItems.forEach((item, index) => {
        item.addEventListener('click', function(e) {
            if (e.target.closest('.mail-item-check')) return;
            mailItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            this.classList.remove('unread');

            const subject = this.dataset.subject;
            const from = this.dataset.from;
            const fromEmail = this.dataset.fromEmail;
            const body = this.dataset.body;
            const date = this.dataset.date;
            const hasAttachments = this.dataset.attachments === 'true';
            const initials = from.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            readingSubject.textContent = subject;
            readingFromName.textContent = from;
            readingFromEmail.textContent = fromEmail;
            readingDate.textContent = date;
            readingBody.innerHTML = body;
            readingAvatar.textContent = initials;
            readingAvatar.style.background = avatarColors[index % avatarColors.length];
            readingAttachments.style.display = hasAttachments ? '' : 'none';
            readingPane.classList.remove('hidden');
            if (emptyPane) emptyPane.classList.add('hidden');
            feather.replace();
            updateFab();

            // On mobile, scroll reading pane to top
            if (isMobile()) {
                readingPane.scrollTop = 0;
            }

            LiquidElegance.Mail.emit('mail:select', itemData(this));
        });
    });

    /* -- Checkbox change --------------------------------------------------- */
    document.querySelectorAll('.mail-item-check input').forEach(cb => {
        cb.addEventListener('change', function() {
            const item = this.closest('.mail-item');
            LiquidElegance.Mail.emit('mail:check', { ...itemData(item), checked: this.checked });
        });
    });

    /* -- Select all -------------------------------------------------------- */
    const selectAll = document.getElementById('selectAll');
    selectAll.addEventListener('change', function() {
        document.querySelectorAll('.mail-item-check input').forEach(cb => {
            cb.checked = selectAll.checked;
        });
    });

    /* -- Folder switching -------------------------------------------------- */
    document.querySelectorAll('.mail-folder-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.mail-folder-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const folder = this.textContent.trim();
            if (isMobile()) closeSidebar();
            LiquidElegance.Mail.emit('mail:folder-switch', { folder });
        });
    });

    /* -- Search emails ----------------------------------------------------- */
    const mailSearch = document.getElementById('mailSearch');
    mailSearch.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        mailItems.forEach(item => {
            const sender = (item.dataset.from || '').toLowerCase();
            const subject = (item.dataset.subject || '').toLowerCase();
            item.style.display = (sender.includes(query) || subject.includes(query)) ? '' : 'none';
        });
        LiquidElegance.Mail.emit('mail:search', { query });
    });

    /* ======================================================================
       Context Menu
       ====================================================================== */
    let ctxMenu = null;
    let ctxTarget = null;

    function closeCtxMenu() {
        if (ctxMenu) {
            ctxMenu.classList.remove('visible');
        }
        if (ctxTarget) {
            ctxTarget.classList.remove('ctx-active');
            ctxTarget = null;
        }
    }

    function buildCtxMenu(item) {
        const isUnread = item.classList.contains('unread');
        const isStarred = item.dataset.starred === 'true';
        const isFlagged = item.dataset.flagged === 'true';

        if (!ctxMenu) {
            ctxMenu = document.createElement('div');
            ctxMenu.className = 'le-context-menu';
            document.body.appendChild(ctxMenu);
        }

        ctxMenu.innerHTML = `
            <div class="le-context-menu-header">Actions</div>
            <div class="le-context-menu-item" data-action="toggle-read">
                <i data-feather="${isUnread ? 'eye' : 'eye'}"></i>
                <span>${isUnread ? 'Mark as Read' : 'Mark as Unread'}</span>
            </div>
            <div class="le-context-menu-item" data-action="toggle-star">
                <i data-feather="star"></i>
                <span>${isStarred ? 'Unstar' : 'Star'}</span>
            </div>
            <div class="le-context-menu-item" data-action="toggle-flag">
                <i data-feather="flag"></i>
                <span>${isFlagged ? 'Unflag' : 'Flag'}</span>
            </div>
            <div class="le-context-menu-sep"></div>
            <div class="le-context-menu-item" data-action="reply">
                <i data-feather="reply"></i>
                <span>Reply</span>
            </div>
            <div class="le-context-menu-item" data-action="forward">
                <i data-feather="corner-up-right"></i>
                <span>Forward</span>
            </div>
            <div class="le-context-menu-sep"></div>
            <div class="le-context-menu-item" data-action="move">
                <i data-feather="folder"></i>
                <span>Move to…</span>
            </div>
            <div class="le-context-menu-item" data-action="label">
                <i data-feather="tag"></i>
                <span>Label…</span>
            </div>
            <div class="le-context-menu-item" data-action="archive">
                <i data-feather="archive"></i>
                <span>Archive</span>
            </div>
            <div class="le-context-menu-sep"></div>
            <div class="le-context-menu-item danger" data-action="delete">
                <i data-feather="trash-2"></i>
                <span>Delete</span>
            </div>
        `;

        feather.replace();
        return ctxMenu;
    }

    function positionCtxMenu(menu, x, y) {
        menu.style.position = 'fixed';
        menu.style.zIndex = '9999';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
            }
            menu.classList.add('visible');
        });
    }

    /* -- Right-click handler ----------------------------------------------- */
    document.getElementById('mailItems').addEventListener('contextmenu', function(e) {
        const item = e.target.closest('.mail-item');
        if (!item) return;
        e.preventDefault();
        closeCtxMenu();

        ctxTarget = item;
        item.classList.add('ctx-active');

        const menu = buildCtxMenu(item);
        positionCtxMenu(menu, e.clientX, e.clientY);
    });

    /* -- Context menu action handler --------------------------------------- */
    document.addEventListener('click', function(e) {
        const action = e.target.closest('.le-context-menu-item');
        if (action && ctxTarget) {
            const data = itemData(ctxTarget);
            const act = action.dataset.action;

            switch (act) {
                case 'toggle-read':
                    if (ctxTarget.classList.contains('unread')) {
                        ctxTarget.classList.remove('unread');
                        LiquidElegance.Mail.emit('mail:mark-read', data);
                    } else {
                        ctxTarget.classList.add('unread');
                        LiquidElegance.Mail.emit('mail:mark-unread', data);
                    }
                    break;
                case 'toggle-star':
                    if (ctxTarget.dataset.starred === 'true') {
                        ctxTarget.dataset.starred = 'false';
                        LiquidElegance.Mail.emit('mail:unstar', data);
                    } else {
                        ctxTarget.dataset.starred = 'true';
                        LiquidElegance.Mail.emit('mail:star', data);
                    }
                    break;
                case 'toggle-flag':
                    if (ctxTarget.dataset.flagged === 'true') {
                        ctxTarget.dataset.flagged = 'false';
                        LiquidElegance.Mail.emit('mail:unflag', data);
                    } else {
                        ctxTarget.dataset.flagged = 'true';
                        LiquidElegance.Mail.emit('mail:flag', data);
                    }
                    break;
                case 'reply':
                    LiquidElegance.Mail.emit('mail:reply', data);
                    break;
                case 'forward':
                    LiquidElegance.Mail.emit('mail:forward', data);
                    break;
                case 'move':
                    LiquidElegance.Mail.emit('mail:move', data);
                    break;
                case 'label':
                    LiquidElegance.Mail.emit('mail:label', data);
                    break;
                case 'archive':
                    LiquidElegance.Mail.emit('mail:archive', data);
                    break;
                case 'delete':
                    LiquidElegance.Mail.emit('mail:delete', data);
                    break;
            }
            closeCtxMenu();
            return;
        }
        // Click outside closes the menu
        if (ctxMenu && !e.target.closest('.le-context-menu')) {
            closeCtxMenu();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCtxMenu();
    });

    document.addEventListener('scroll', closeCtxMenu, { capture: true, passive: true });

    /* ======================================================================
       Mobile three-dot menu button on mail items
       ====================================================================== */
    function injectMailMoreBtns() {
        mailItems.forEach(function(item) {
            if (item.querySelector('.mail-item-more-btn')) return;
            var btn = document.createElement('button');
            btn.className = 'mail-item-more-btn';
            btn.title = 'More actions';
            btn.innerHTML = '<i data-feather="more-vertical"></i>';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                closeCtxMenu();

                ctxTarget = item;
                item.classList.add('ctx-active');

                var menu = buildCtxMenu(item);
                var rect = btn.getBoundingClientRect();
                positionCtxMenu(menu, rect.right - 180, rect.bottom + 4);
            });
            item.appendChild(btn);
        });
        feather.replace();
    }
    injectMailMoreBtns();

    /* ======================================================================
       Compose Modal — Rich Text Editor & Attachments
       ====================================================================== */
    (function initCompose() {
        var editor = document.getElementById('composeEditor');
        var toolbar = document.getElementById('composeToolbar');
        var overflowBtn = document.getElementById('composeToolbarOverflow');
        var ccToggle = document.getElementById('composeCcToggle');
        var ccField = document.getElementById('composeCcField');
        var bccField = document.getElementById('composeBccField');
        var dropZone = document.getElementById('composeDropZone');
        var fileInput = document.getElementById('composeFileInput');
        var fileList = document.getElementById('composeFileList');
        var attachBtn = document.getElementById('composeAttachBtn');
        var expandBtn = document.getElementById('composeExpand');
        var modal = document.getElementById('composeModal');
        var sendBtn = document.getElementById('composeSendBtn');

        if (!editor || !toolbar) return;

        var attachments = [];
        var MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

        /* -- CC / BCC toggle -------------------------------------------- */
        if (ccToggle) {
            ccToggle.addEventListener('click', function() {
                var showing = !ccField.classList.contains('hidden');
                if (showing) {
                    ccField.classList.add('hidden');
                    bccField.classList.add('hidden');
                    ccToggle.classList.remove('active');
                } else {
                    ccField.classList.remove('hidden');
                    bccField.classList.remove('hidden');
                    ccToggle.classList.add('active');
                    document.getElementById('composeCc').focus();
                }
            });
        }

        /* -- Toolbar overflow toggle (mobile) --------------------------- */
        if (overflowBtn) {
            overflowBtn.addEventListener('click', function() {
                toolbar.classList.toggle('expanded');
            });
        }

        /* -- Rich text commands ----------------------------------------- */
        toolbar.addEventListener('click', function(e) {
            var btn = e.target.closest('.compose-tool-btn');
            if (!btn) return;
            e.preventDefault();

            var command = btn.dataset.command;
            var value = btn.dataset.value || null;

            if (command === 'createLink') {
                var url = prompt('Enter URL:', 'https://');
                if (url) {
                    document.execCommand('createLink', false, url);
                }
                editor.focus();
                return;
            }

            if (command === 'formatBlock' && value) {
                document.execCommand(command, false, '<' + value + '>');
            } else {
                document.execCommand(command, false, value);
            }
            editor.focus();
            updateToolbarState();
        });

        /* -- Update toolbar active states based on selection ------------ */
        function updateToolbarState() {
            toolbar.querySelectorAll('.compose-tool-btn[data-command]').forEach(function(btn) {
                var cmd = btn.dataset.command;
                if (['bold', 'italic', 'underline', 'strikeThrough',
                     'insertUnorderedList', 'insertOrderedList',
                     'justifyLeft', 'justifyCenter', 'justifyRight'].indexOf(cmd) !== -1) {
                    try {
                        btn.classList.toggle('active', document.queryCommandState(cmd));
                    } catch(ex) { /* ignore */ }
                }
            });
        }

        editor.addEventListener('keyup', updateToolbarState);
        editor.addEventListener('mouseup', updateToolbarState);

        /* -- Keyboard shortcuts in editor ------------------------------- */
        editor.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); document.execCommand('bold'); break;
                    case 'i': e.preventDefault(); document.execCommand('italic'); break;
                    case 'u': e.preventDefault(); document.execCommand('underline'); break;
                }
                updateToolbarState();
            }
        });

        /* -- Ensure editor always has a focusable block ----------------- */
        editor.addEventListener('focus', function() {
            if (!editor.innerHTML || editor.innerHTML === '<br>') {
                document.execCommand('formatBlock', false, '<p>');
            }
        });

        /* -- Full-screen toggle ----------------------------------------- */
        if (expandBtn && modal) {
            expandBtn.addEventListener('click', function() {
                modal.classList.toggle('compose-fullscreen');
                feather.replace();
            });
        }

        /* -- Attachment: file type → icon/color mapping ------------------ */
        function fileIcon(name) {
            var ext = (name.split('.').pop() || '').toLowerCase();
            var map = {
                pdf:  { icon: 'file-text', bg: 'rgba(239,68,68,0.1)',  color: '#ef4444' },
                doc:  { icon: 'file-text', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
                docx: { icon: 'file-text', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
                xls:  { icon: 'file-text', bg: 'rgba(34,197,94,0.1)',  color: '#22c55e' },
                xlsx: { icon: 'file-text', bg: 'rgba(34,197,94,0.1)',  color: '#22c55e' },
                ppt:  { icon: 'file-text', bg: 'rgba(249,115,22,0.1)', color: '#f97316' },
                pptx: { icon: 'file-text', bg: 'rgba(249,115,22,0.1)', color: '#f97316' },
                png:  { icon: 'image',     bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
                jpg:  { icon: 'image',     bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
                jpeg: { icon: 'image',     bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
                gif:  { icon: 'image',     bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
                svg:  { icon: 'image',     bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
                zip:  { icon: 'archive',   bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
                rar:  { icon: 'archive',   bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
                mp4:  { icon: 'film',      bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
                mp3:  { icon: 'music',     bg: 'rgba(20,184,166,0.1)', color: '#14b8a6' }
            };
            return map[ext] || { icon: 'file', bg: 'rgba(var(--le-primary-rgb),0.1)', color: 'var(--le-primary)' };
        }

        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }

        /* -- Render file list ------------------------------------------- */
        function renderFileList() {
            fileList.innerHTML = '';
            attachments.forEach(function(file, idx) {
                var fi = fileIcon(file.name);
                var el = document.createElement('div');
                el.className = 'compose-file-item';
                el.innerHTML =
                    '<div class="compose-file-icon" style="background:' + fi.bg + ';">' +
                        '<i data-feather="' + fi.icon + '" style="color:' + fi.color + ';"></i>' +
                    '</div>' +
                    '<div class="compose-file-info">' +
                        '<div class="compose-file-name">' + escapeHtml(file.name) + '</div>' +
                        '<div class="compose-file-size">' + formatSize(file.size) + '</div>' +
                    '</div>' +
                    '<button type="button" class="compose-file-remove" data-idx="' + idx + '" title="Remove">' +
                        '<i data-feather="x"></i>' +
                    '</button>';
                fileList.appendChild(el);
            });
            feather.replace();

            // Toggle drop zone visibility when files exist
            if (attachments.length > 0) {
                dropZone.style.display = 'none';
            }
        }

        function escapeHtml(str) {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        }

        /* -- Add files -------------------------------------------------- */
        function addFiles(files) {
            Array.from(files).forEach(function(file) {
                if (file.size > MAX_FILE_SIZE) {
                    alert(file.name + ' exceeds the 25 MB limit.');
                    return;
                }
                // Prevent duplicates by name+size
                var exists = attachments.some(function(a) {
                    return a.name === file.name && a.size === file.size;
                });
                if (!exists) {
                    attachments.push(file);
                }
            });
            renderFileList();
        }

        /* -- Remove file ------------------------------------------------ */
        fileList.addEventListener('click', function(e) {
            var removeBtn = e.target.closest('.compose-file-remove');
            if (!removeBtn) return;
            var idx = parseInt(removeBtn.dataset.idx, 10);
            attachments.splice(idx, 1);
            renderFileList();
            if (attachments.length === 0) {
                dropZone.style.display = '';
            }
        });

        /* -- File input change ------------------------------------------ */
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (this.files.length) addFiles(this.files);
                this.value = '';
            });
        }

        /* -- Drag & drop ------------------------------------------------ */
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(function(evt) {
                dropZone.addEventListener(evt, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('drag-over');
                });
            });
            ['dragleave', 'drop'].forEach(function(evt) {
                dropZone.addEventListener(evt, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('drag-over');
                });
            });
            dropZone.addEventListener('drop', function(e) {
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            });
        }

        // Also allow dropping files on the editor
        editor.addEventListener('dragover', function(e) { e.preventDefault(); });
        editor.addEventListener('drop', function(e) {
            if (e.dataTransfer.files.length) {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
            }
        });

        /* -- Attach button in footer ------------------------------------ */
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', function() {
                if (dropZone.style.display === 'none') {
                    dropZone.style.display = '';
                }
                fileInput.click();
            });
        }

        /* -- Send button ------------------------------------------------ */
        if (sendBtn) {
            sendBtn.addEventListener('click', function() {
                var to = (document.getElementById('composeTo').value || '').trim();
                var subject = (document.getElementById('composeSubject').value || '').trim();
                var body = editor.innerHTML;
                var cc = document.getElementById('composeCc') ? document.getElementById('composeCc').value.trim() : '';
                var bcc = document.getElementById('composeBcc') ? document.getElementById('composeBcc').value.trim() : '';

                LiquidElegance.Mail.emit('mail:compose-send', {
                    to: to, cc: cc, bcc: bcc,
                    subject: subject,
                    body: body,
                    attachments: attachments.map(function(f) { return { name: f.name, size: f.size, type: f.type }; })
                });

                // Reset and close
                resetCompose();
                var bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
        }

        /* -- Reset compose state ---------------------------------------- */
        function resetCompose() {
            editor.innerHTML = '';
            attachments = [];
            fileList.innerHTML = '';
            dropZone.style.display = '';
            if (ccField) ccField.classList.add('hidden');
            if (bccField) bccField.classList.add('hidden');
            if (ccToggle) ccToggle.classList.remove('active');
            modal.classList.remove('compose-fullscreen');
            ['composeTo', 'composeCc', 'composeBcc', 'composeSubject'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            toolbar.querySelectorAll('.compose-tool-btn.active').forEach(function(b) {
                b.classList.remove('active');
            });
        }

        // Reset on modal close
        if (modal) {
            modal.addEventListener('hidden.bs.modal', resetCompose);
        }

        // Focus To field on modal open
        if (modal) {
            modal.addEventListener('shown.bs.modal', function() {
                var toInput = document.getElementById('composeTo');
                if (toInput) toInput.focus();
                feather.replace();
            });
        }
    })();
});

