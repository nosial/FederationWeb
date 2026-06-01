/* =============================================================================
   Liquid Elegance — Chat App Logic
   ============================================================================= */

/* ---- Event API ---- */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Chat = {
    _handlers: {},
    on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); return this; },
    off(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn); return this; },
    once(event, fn) { const wrap = (data) => { this.off(event, wrap); fn(data); }; return this.on(event, wrap); },
    emit(event, data) {
        (this._handlers[event] || []).forEach(fn => fn(data));
        return this;
    }
};

/* ---- Context Menu Helper ---- */
(function () {
    let menu = null;
    let activeTarget = null;

    function getMenu() {
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'le-context-menu';
            document.body.appendChild(menu);
        }
        return menu;
    }

    function closeMenu() {
        if (!menu) return;
        menu.classList.remove('visible');
        if (activeTarget) {
            activeTarget.classList.remove('ctx-active');
            activeTarget = null;
        }
    }

    function showMenu(e, html, target) {
        e.preventDefault();
        closeMenu();

        const m = getMenu();
        m.innerHTML = html;
        activeTarget = target;
        target.classList.add('ctx-active');

        // Position off-screen first to measure
        m.style.left = '0px';
        m.style.top = '0px';
        m.style.visibility = 'hidden';
        m.classList.add('visible');

        requestAnimationFrame(() => {
            const rect = m.getBoundingClientRect();
            let x = e.clientX;
            let y = e.clientY;
            if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
            if (x < 0) x = 4;
            if (y < 0) y = 4;
            m.style.left = x + 'px';
            m.style.top = y + 'px';
            m.style.visibility = '';

            if (typeof feather !== 'undefined') feather.replace();
        });
    }

    // Close on outside click, Escape, scroll
    document.addEventListener('mousedown', function (e) {
        if (menu && !menu.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });
    document.addEventListener('scroll', closeMenu, { capture: true, passive: true });

    // Expose utilities
    window._chatCtx = { showMenu, closeMenu };
})();

/* ---- Build menu items ---- */
function _ctxItem(icon, label, cls) {
    const c = cls ? ` ${cls}` : '';
    return `<button class="le-context-menu-item${c}" data-action="${label}"><i data-feather="${icon}"></i>${label}</button>`;
}
function _ctxSep() { return '<div class="le-context-menu-sep"></div>'; }
function _ctxHeader(text) { return `<div class="le-context-menu-header">${text}</div>`; }

/* ---- Main Init ---- */
document.addEventListener('DOMContentLoaded', function () {
    feather.replace();

    // ---- Conversation switching ----
    const convItems = document.querySelectorAll('.conversation-item');
    convItems.forEach(item => {
        item.addEventListener('click', function () {
            convItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const unreadBadge = this.querySelector('.conv-unread');
            if (unreadBadge) unreadBadge.remove();
            if (isMobile()) closeChatSidebar();
            LiquidElegance.Chat.emit('conversation:switch', {
                name: this.getAttribute('data-name'),
                el: this
            });
        });
    });

    // ---- Send message ----
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        const row = document.createElement('div');
        row.className = 'message-row sent';
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        row.innerHTML = '<div><div class="message-bubble">' +
            text.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
            '</div><div class="msg-time">' + timeStr +
            ' <span class="msg-read-receipt"><i data-feather="check"></i></span></div></div>';
        chatMessages.insertBefore(row, typingIndicator);
        chatInput.value = '';
        feather.replace();
        chatMessages.scrollTop = chatMessages.scrollHeight;

        LiquidElegance.Chat.emit('message:send', { text: text, timestamp: now.toISOString() });

        // Show typing indicator briefly
        typingIndicator.style.display = 'flex';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        setTimeout(() => { typingIndicator.style.display = 'none'; }, 2500);
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // ---- Search conversations ----
    const chatSearch = document.getElementById('chatSearch');
    chatSearch.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        convItems.forEach(item => {
            const name = item.getAttribute('data-name').toLowerCase();
            item.style.display = name.includes(query) ? '' : 'none';
        });
        LiquidElegance.Chat.emit('conversation:search', { query: query });
    });

    // ---- Filter tabs ----
    const filterTabs = document.querySelectorAll('.chat-filter .glass-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            convItems.forEach(item => {
                if (filter === 'all') { item.style.display = ''; }
                else if (filter === 'unread') { item.style.display = item.getAttribute('data-unread') ? '' : 'none'; }
                else if (filter === 'groups') { item.style.display = item.getAttribute('data-group') ? '' : 'none'; }
            });
            LiquidElegance.Chat.emit('conversation:filter', { filter: filter });
        });
    });

    // ---- Toggle info panel ----
    const toggleBtn = document.getElementById('toggleInfoPanel');
    const infoPanel = document.getElementById('chatInfoPanel');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            infoPanel.classList.toggle('show');
            LiquidElegance.Chat.emit('panel:toggle', { visible: infoPanel.classList.contains('show') });
        });
    }

    /* -- Mobile sidebar navigation ---------------------------------------- */
    const chatSidebar = document.getElementById('chatSidebar');
    const sidebarToggle = document.getElementById('chatSidebarToggle');
    const sidebarBackdrop = document.getElementById('chatSidebarBackdrop');
    const sidebarClose = document.getElementById('chatSidebarClose');
    const chatInfoClose = document.getElementById('chatInfoClose');

    function isMobile() { return window.innerWidth < 992; }

    function openChatSidebar() {
        if (chatSidebar) chatSidebar.classList.add('show');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeChatSidebar() {
        if (chatSidebar) chatSidebar.classList.remove('show');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
        document.body.style.overflow = '';
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', openChatSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeChatSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeChatSidebar);

    // Close info panel
    if (chatInfoClose) {
        chatInfoClose.addEventListener('click', function () {
            infoPanel.classList.remove('show');
        });
    }

    // ---- Conversation context menu ----
    document.addEventListener('contextmenu', function (e) {
        const convItem = e.target.closest('.conversation-item');
        if (convItem) {
            const name = convItem.getAttribute('data-name') || '';
            const html =
                _ctxHeader('Conversation') +
                _ctxItem('check', 'Mark as Read') +
                _ctxItem('bell-off', 'Mute Notifications') +
                _ctxItem('pin', 'Pin Conversation') +
                _ctxSep() +
                _ctxItem('archive', 'Archive') +
                _ctxItem('trash-2', 'Delete Conversation', 'danger');

            window._chatCtx.showMenu(e, html, convItem);

            // Delegate clicks
            const m = document.querySelector('.le-context-menu');
            m.onclick = function (ev) {
                const btn = ev.target.closest('.le-context-menu-item');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                const data = { name: name, el: convItem };
                const map = {
                    'Mark as Read': 'conversation:mark-read',
                    'Mute Notifications': 'conversation:mute',
                    'Pin Conversation': 'conversation:pin',
                    'Archive': 'conversation:archive',
                    'Delete Conversation': 'conversation:delete'
                };
                if (map[action]) LiquidElegance.Chat.emit(map[action], data);
                window._chatCtx.closeMenu();
            };
            return;
        }

        // ---- Message context menu ----
        const bubble = e.target.closest('.message-bubble');
        const msgRow = e.target.closest('.message-row');
        if (bubble || msgRow) {
            const row = msgRow || bubble.closest('.message-row');
            const bbl = bubble || (row ? row.querySelector('.message-bubble') : null);
            const isSent = row && row.classList.contains('sent');
            const msgText = bbl ? bbl.textContent.trim() : '';
            const target = row || bbl;

            let html =
                _ctxHeader('Message') +
                _ctxItem('copy', 'Copy Text') +
                _ctxItem('corner-up-left', 'Reply') +
                _ctxItem('corner-up-right', 'Forward') +
                _ctxSep() +
                _ctxItem('bookmark', 'Save Message');

            if (isSent) {
                html += _ctxItem('edit-2', 'Edit');
            }

            html += _ctxSep() + _ctxItem('trash-2', 'Delete Message', 'danger');

            window._chatCtx.showMenu(e, html, target);

            const m = document.querySelector('.le-context-menu');
            m.onclick = function (ev) {
                const btn = ev.target.closest('.le-context-menu-item');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                const data = { text: msgText, el: row, bubble: bbl };
                const map = {
                    'Copy Text': 'message:copy',
                    'Reply': 'message:reply',
                    'Forward': 'message:forward',
                    'Save Message': 'message:save',
                    'Edit': 'message:edit',
                    'Delete Message': 'message:delete'
                };
                if (action === 'Copy Text' && navigator.clipboard) {
                    navigator.clipboard.writeText(msgText);
                }
                if (map[action]) LiquidElegance.Chat.emit(map[action], data);
                window._chatCtx.closeMenu();
            };
        }
    });

    // Scroll to bottom of chat
    chatMessages.scrollTop = chatMessages.scrollHeight;

    /* ---- Mobile three-dot menu button on conversation items ---- */
    function injectConvMoreBtns() {
        convItems.forEach(function (item) {
            if (item.querySelector('.conv-more-btn')) return;
            var btn = document.createElement('button');
            btn.className = 'conv-more-btn';
            btn.title = 'More actions';
            btn.innerHTML = '<i data-feather="more-vertical"></i>';
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();

                var name = item.getAttribute('data-name') || '';
                var html =
                    _ctxHeader('Conversation') +
                    _ctxItem('check', 'Mark as Read') +
                    _ctxItem('bell-off', 'Mute Notifications') +
                    _ctxItem('pin', 'Pin Conversation') +
                    _ctxSep() +
                    _ctxItem('archive', 'Archive') +
                    _ctxItem('trash-2', 'Delete Conversation', 'danger');

                var rect = btn.getBoundingClientRect();
                window._chatCtx.showMenu(
                    { preventDefault: function () {}, clientX: rect.right - 180, clientY: rect.bottom + 4 },
                    html, item
                );

                var m = document.querySelector('.le-context-menu');
                m.onclick = function (ev) {
                    var b = ev.target.closest('.le-context-menu-item');
                    if (!b) return;
                    var action = b.getAttribute('data-action');
                    var data = { name: name, el: item };
                    var map = {
                        'Mark as Read': 'conversation:mark-read',
                        'Mute Notifications': 'conversation:mute',
                        'Pin Conversation': 'conversation:pin',
                        'Archive': 'conversation:archive',
                        'Delete Conversation': 'conversation:delete'
                    };
                    if (map[action]) LiquidElegance.Chat.emit(map[action], data);
                    window._chatCtx.closeMenu();
                };
            });
            item.appendChild(btn);
        });
        feather.replace();
    }
    injectConvMoreBtns();

    /* ====================================================================
       Call modals (voice + video)
       Syncs the caller card with the currently active conversation, runs a
       fake "Ringing → Connected" lifecycle with a live timer, and wires up
       the per-control toggle states (mute / camera / speaker / etc.).
       ==================================================================== */
    (function initCallModals() {
        var voiceModalEl = document.getElementById('voiceCallModal');
        var videoModalEl = document.getElementById('videoCallModal');
        if (!voiceModalEl && !videoModalEl) return;

        function getActiveContact() {
            var active = document.querySelector('.conversation-item.active');
            if (!active) return { name: 'Sarah Connor', initials: 'SC', gradClass: 'le-bg-gradient-primary' };
            var name = active.getAttribute('data-name') || 'Contact';
            var av = active.querySelector('.conv-avatar');
            var initials = av ? (av.firstChild && av.firstChild.nodeType === 3 ? av.firstChild.nodeValue.trim() : av.textContent.trim().slice(0, 2)) : name.slice(0, 2).toUpperCase();
            var gradClass = '';
            if (av) {
                av.classList.forEach(function (c) {
                    if (c.indexOf('le-bg-grad') === 0) gradClass = c;
                });
            }
            if (!gradClass) gradClass = 'le-bg-gradient-primary';
            return { name: name, initials: initials, gradClass: gradClass };
        }

        function setAvatar(el, contact) {
            if (!el) return;
            // Strip any prior gradient classes
            Array.from(el.classList).forEach(function (c) {
                if (c.indexOf('le-bg-grad') === 0) el.classList.remove(c);
            });
            el.classList.add(contact.gradClass);
            el.textContent = contact.initials;
        }

        function fmtTime(totalSec) {
            var h = Math.floor(totalSec / 3600);
            var m = Math.floor((totalSec % 3600) / 60);
            var s = totalSec % 60;
            var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
            return (h > 0 ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
        }

        /* ---- per-modal call controller --------------------------------- */
        function bindCall(modalEl, opts) {
            if (!modalEl) return null;
            var nameEl = modalEl.querySelector(opts.nameSel);
            var avatarEl = modalEl.querySelector(opts.avatarSel);
            var statusEl = modalEl.querySelector(opts.statusSel);
            var timerEl = modalEl.querySelector(opts.timerSel);
            var ringTimer = null;
            var tickTimer = null;
            var elapsed = 0;

            function reset() {
                modalEl.classList.remove('is-connected', 'camera-off');
                if (statusEl) statusEl.textContent = opts.ringingText;
                if (timerEl) { timerEl.hidden = true; timerEl.textContent = '00:00'; }
                elapsed = 0;
                // Reset toggle states & per-modal extras
                modalEl.querySelectorAll('.call-btn[aria-pressed]').forEach(function (b) {
                    b.setAttribute('aria-pressed', 'false');
                });
                var keypad = modalEl.querySelector('.call-keypad');
                if (keypad) keypad.hidden = true;
                var pipMic = modalEl.querySelector('#videoSelfMic');
                if (pipMic) pipMic.classList.remove('is-muted');
            }

            function startConnected() {
                modalEl.classList.add('is-connected');
                if (statusEl) statusEl.textContent = opts.connectedText;
                if (timerEl) { timerEl.hidden = false; }
                tickTimer = setInterval(function () {
                    elapsed++;
                    if (timerEl) timerEl.textContent = fmtTime(elapsed);
                }, 1000);
            }

            modalEl.addEventListener('show.bs.modal', function () {
                var contact = getActiveContact();
                if (nameEl) nameEl.textContent = contact.name;
                setAvatar(avatarEl, contact);
                reset();
                if (typeof feather !== 'undefined') feather.replace();

                // Fake "ringing → connected" after ~2.4s
                ringTimer = setTimeout(startConnected, 2400);

                LiquidElegance.Chat.emit('call:start', {
                    type: opts.type, contact: contact.name
                });
            });

            modalEl.addEventListener('hidden.bs.modal', function () {
                if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
                if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
                LiquidElegance.Chat.emit('call:end', {
                    type: opts.type, duration: elapsed
                });
                reset();
            });

            // Generic toggle behaviour
            modalEl.querySelectorAll('[data-call-toggle]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var pressed = btn.getAttribute('aria-pressed') === 'true';
                    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');

                    var key = btn.getAttribute('data-call-toggle');

                    // Per-toggle side effects
                    if (key === 'keypad') {
                        var kp = modalEl.querySelector('.call-keypad');
                        if (kp) kp.hidden = pressed; // pressed was previous state — toggle to opposite
                    }
                    if (key === 'camera') {
                        modalEl.classList.toggle('camera-off', !pressed);
                    }
                    if (key === 'mute') {
                        var pipMic = modalEl.querySelector('#videoSelfMic');
                        if (pipMic) pipMic.classList.toggle('is-muted', !pressed);
                    }

                    LiquidElegance.Chat.emit('call:toggle', {
                        type: opts.type, control: key, active: !pressed
                    });
                });
            });

            // "Switch to video" from voice modal
            var switchBtn = modalEl.querySelector('[data-call-switch="video"]');
            if (switchBtn && opts.type === 'voice') {
                switchBtn.addEventListener('click', function () {
                    var inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                    setTimeout(function () {
                        var v = bootstrap.Modal.getOrCreateInstance(document.getElementById('videoCallModal'));
                        v.show();
                    }, 320);
                });
            }

            return { reset: reset };
        }

        if (typeof bootstrap === 'undefined') return;

        bindCall(voiceModalEl, {
            type: 'voice',
            nameSel: '#voiceCallName',
            avatarSel: '#voiceCallAvatar',
            statusSel: '#voiceCallStatus',
            timerSel: '#voiceCallTimer',
            ringingText: 'Ringing…',
            connectedText: 'Connected'
        });

        bindCall(videoModalEl, {
            type: 'video',
            nameSel: '#videoCallName',
            avatarSel: '#videoCallAvatar',
            statusSel: '#videoCallStatus',
            timerSel: '#videoCallTimer',
            ringingText: 'Connecting…',
            connectedText: 'Live'
        });

        // Keypad button presses (visual feedback only)
        var keypad = document.getElementById('voiceCallKeypad');
        if (keypad) {
            keypad.addEventListener('click', function (e) {
                var b = e.target.closest('button');
                if (!b) return;
                b.style.transform = 'scale(0.92)';
                setTimeout(function () { b.style.transform = ''; }, 120);
            });
        }
    })();
});

