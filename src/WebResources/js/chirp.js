/* =============================================================================
   Liquid Elegance — Chirp App Logic
   ============================================================================= */

/* ── Event API ─────────────────────────────────────────────────────────────── */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Chirp = {
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
    'use strict';

    var C = LiquidElegance.Chirp;
    if (typeof feather !== 'undefined') feather.replace();

    /* ── Helper: extract tweet data from a .chirp-tweet element ──────────── */
    function getTweetData(tweetEl) {
        if (!tweetEl) return {};
        var header = tweetEl.querySelector('.chirp-tweet-header');
        var nameEl = tweetEl.querySelector('.chirp-tweet-name');
        var handleEl = tweetEl.querySelector('.chirp-tweet-handle');
        var bodyEl = tweetEl.querySelector('.chirp-tweet-body');
        return {
            name: nameEl ? nameEl.textContent.trim() : '',
            handle: handleEl ? handleEl.textContent.trim() : '',
            body: bodyEl ? bodyEl.textContent.trim().substring(0, 140) : '',
            el: tweetEl
        };
    }

    /* ── Helper: extract user data from a follow-item or follower element ── */
    function getUserData(el) {
        if (!el) return {};
        var nameEl = el.querySelector('.chirp-follow-name, .chirp-follower-name, .chirp-tweet-name');
        var handleEl = el.querySelector('.chirp-follow-handle, .chirp-follower-handle, .chirp-tweet-handle');
        return {
            name: nameEl ? nameEl.textContent.trim() : '',
            handle: handleEl ? handleEl.textContent.trim() : '',
            el: el
        };
    }

    /* ── Feed tabs ─────────────────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-feed-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chirp-feed-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            C.emit('tab:switch', { tab: this.textContent.trim() });
        });
    });

    /* ── Profile tabs ──────────────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-profile-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chirp-profile-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            C.emit('tab:switch', { tab: this.textContent.trim() });
        });
    });

    /* ── Compose post ──────────────────────────────────────────────────────── */
    var composeInput = document.querySelector('.chirp-compose-input');
    var postBtn = document.querySelector('.chirp-compose .btn-primary, .chirp-compose .btn');

    if (composeInput) {
        composeInput.addEventListener('input', function() {
            C.emit('compose:input', { text: this.value, length: this.value.length });
        });
    }

    if (postBtn) {
        postBtn.addEventListener('click', function() {
            var text = composeInput ? composeInput.value.trim() : '';
            if (!text) return;
            C.emit('post:submit', { text: text, timestamp: new Date().toISOString() });
            if (composeInput) composeInput.value = '';
        });
    }

    /* ── Compose toolbar tools ─────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-compose-tool').forEach(function(tool) {
        tool.addEventListener('click', function() {
            var title = this.getAttribute('title') || '';
            C.emit('compose:tool', { tool: title.toLowerCase() });
        });
    });

    /* ── Tweet action buttons (reply, retweet, like, share, bookmark) ──────── */
    document.querySelectorAll('.chirp-tweet').forEach(function(tweet) {
        var data = getTweetData(tweet);

        var replyBtn = tweet.querySelector('.chirp-action-reply');
        var retweetBtn = tweet.querySelector('.chirp-action-retweet');
        var likeBtn = tweet.querySelector('.chirp-action-like');
        var shareBtn = tweet.querySelector('.chirp-action-share');
        var bookmarkBtn = tweet.querySelector('.chirp-action-bookmark');

        if (replyBtn) {
            replyBtn.addEventListener('click', function() {
                C.emit('post:reply', data);
            });
        }

        if (retweetBtn) {
            retweetBtn.addEventListener('click', function() {
                this.classList.toggle('active');
                var active = this.classList.contains('active');
                C.emit(active ? 'post:repost' : 'post:unrepost', data);
            });
        }

        if (likeBtn) {
            likeBtn.addEventListener('click', function() {
                this.classList.toggle('active');
                var active = this.classList.contains('active');
                C.emit(active ? 'post:like' : 'post:unlike', data);
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', function() {
                C.emit('post:share', data);
            });
        }

        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', function() {
                this.classList.toggle('active');
                var active = this.classList.contains('active');
                C.emit(active ? 'post:bookmark' : 'post:unbookmark', data);
            });
        }
    });

    /* ── Reply compose (chirp-post page) ───────────────────────────────────── */
    var replyCompose = document.querySelector('.chirp-reply-compose');
    if (replyCompose) {
        var replyInput = replyCompose.querySelector('.chirp-compose-input, textarea');
        var replyBtn = replyCompose.querySelector('.btn-primary, .btn');
        if (replyBtn && replyInput) {
            replyBtn.addEventListener('click', function() {
                var text = replyInput.value.trim();
                if (!text) return;
                C.emit('reply:submit', { text: text, timestamp: new Date().toISOString() });
                replyInput.value = '';
            });
        }
    }

    /* ── Follow / Unfollow buttons ─────────────────────────────────────────── */
    document.querySelectorAll('.btn-chirp-follow, .chirp-follow-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var parent = this.closest('.chirp-follow-item, .chirp-follower-card, .chirp-suggestion-card');
            var userData = getUserData(parent);
            var isFollowing = this.classList.contains('following');
            this.classList.toggle('following');
            if (isFollowing) {
                this.textContent = 'Follow';
                C.emit('user:unfollow', userData);
            } else {
                this.textContent = 'Following';
                C.emit('user:follow', userData);
            }
        });
    });

    /* ── Profile action buttons ────────────────────────────────────────────── */
    var profileMessageBtn = document.querySelector('.chirp-profile-actions .btn-message, .chirp-profile-actions [title="Message"]');
    if (profileMessageBtn) {
        profileMessageBtn.addEventListener('click', function() {
            C.emit('profile:message', {});
        });
    }

    var profileOptionsBtn = document.querySelector('.chirp-profile-actions .btn-options, .chirp-profile-actions [title="More"]');
    if (profileOptionsBtn) {
        profileOptionsBtn.addEventListener('click', function() {
            C.emit('profile:options', {});
        });
    }

    /* ── Search ────────────────────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-search-input').forEach(function(input) {
        input.addEventListener('input', function() {
            C.emit('search:query', { query: this.value.trim() });
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                C.emit('search:submit', { query: this.value.trim() });
            }
        });
    });

    /* ── Follower search ───────────────────────────────────────────────────── */
    var followerSearch = document.querySelector('.chirp-follower-search input, #chirpFollowerSearch');
    if (followerSearch) {
        followerSearch.addEventListener('input', function() {
            C.emit('follower:search', { query: this.value.trim() });
        });
    }

    /* ── Follower / Following tabs ─────────────────────────────────────────── */
    document.querySelectorAll('.chirp-follow-tabs .chirp-follow-tab, .chirp-follow-tabs .glass-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chirp-follow-tabs .chirp-follow-tab, .chirp-follow-tabs .glass-tab')
                .forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            C.emit('follow-tab:switch', { tab: this.textContent.trim() });
        });
    });

    /* ── Trending items ────────────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-trend-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            var nameEl = item.querySelector('.chirp-trend-name');
            C.emit('trend:click', {
                name: nameEl ? nameEl.textContent.trim() : '',
                category: (item.querySelector('.chirp-trend-category') || {}).textContent || ''
            });
        });
    });

    /* ── Mobile sidebar toggle ─────────────────────────────────────────────── */
    var sidebar = document.getElementById('chirpSidebar');
    var backdrop = document.getElementById('chirpSidebarBackdrop');
    var toggle = document.getElementById('chirpSidebarToggle');
    var closeBtn = document.getElementById('chirpSidebarClose');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('show');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
        C.emit('sidebar:open', {});
    }
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
        C.emit('sidebar:close', {});
    }

    if (toggle) toggle.addEventListener('click', openSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    /* ── Show more links ───────────────────────────────────────────────────── */
    document.querySelectorAll('.chirp-widget-more').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var widget = this.closest('.chirp-widget, .glass-card');
            var title = widget ? (widget.querySelector('.chirp-widget-title') || {}).textContent || '' : '';
            C.emit('widget:show-more', { widget: title.trim() });
        });
    });
});
