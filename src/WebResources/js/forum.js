/* =============================================================================
   Liquid Elegance — Forum App Logic
   ============================================================================= */

/* ── Event API ─────────────────────────────────────────────────────────────── */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Forum = {
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

    var F = LiquidElegance.Forum;
    if (typeof feather !== 'undefined') feather.replace();

    /* ── Helper: extract post data from a .forum-post element ─────────────── */
    function getPostData(postEl) {
        if (!postEl) return {};
        var titleEl = postEl.querySelector('.forum-post-title, .forum-post-heading a, h3 a, h4 a, h5 a');
        var authorEl = postEl.querySelector('.forum-post-author, .forum-post-user a');
        var communityEl = postEl.querySelector('.forum-post-community, .forum-post-sub');
        var scoreEl = postEl.querySelector('.forum-vote-count, .vote-count');
        return {
            title: titleEl ? titleEl.textContent.trim() : '',
            author: authorEl ? authorEl.textContent.trim() : '',
            community: communityEl ? communityEl.textContent.trim() : '',
            score: scoreEl ? parseInt(scoreEl.textContent, 10) || 0 : 0,
            el: postEl
        };
    }

    /* ── Helper: extract comment data ──────────────────────────────────────── */
    function getCommentData(commentEl) {
        if (!commentEl) return {};
        var authorEl = commentEl.querySelector('.forum-comment-author, .comment-author a');
        var bodyEl = commentEl.querySelector('.forum-comment-body, .comment-body');
        var scoreEl = commentEl.querySelector('.forum-vote-count, .vote-count');
        return {
            author: authorEl ? authorEl.textContent.trim() : '',
            body: bodyEl ? bodyEl.textContent.trim().substring(0, 140) : '',
            score: scoreEl ? parseInt(scoreEl.textContent, 10) || 0 : 0,
            el: commentEl
        };
    }

    /* ── Helper: extract user data ─────────────────────────────────────────── */
    function getUserData(el) {
        if (!el) return {};
        var nameEl = el.querySelector('.forum-follower-name, .follow-name, .user-name, a');
        var karmaEl = el.querySelector('.forum-follower-karma, .karma');
        return {
            name: nameEl ? nameEl.textContent.trim() : '',
            karma: karmaEl ? karmaEl.textContent.trim() : '',
            el: el
        };
    }

    /* ── Create post bar ───────────────────────────────────────────────────── */
    var createPostInput = document.querySelector('.forum-create-input, .forum-create-bar input');
    if (createPostInput) {
        createPostInput.addEventListener('focus', function() {
            F.emit('post:compose-start', { source: 'create-bar' });
        });
        createPostInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                F.emit('post:create', { title: this.value.trim(), timestamp: new Date().toISOString() });
            }
        });
    }

    var createImageBtn = document.querySelector('.forum-create-bar .btn-image, .forum-create-tools [title="Image"]');
    if (createImageBtn) {
        createImageBtn.addEventListener('click', function() {
            F.emit('post:attach-image', {});
        });
    }

    var createLinkBtn = document.querySelector('.forum-create-bar .btn-link, .forum-create-tools [title="Link"]');
    if (createLinkBtn) {
        createLinkBtn.addEventListener('click', function() {
            F.emit('post:attach-link', {});
        });
    }

    /* ── Sort buttons ──────────────────────────────────────────────────────── */
    document.querySelectorAll('.forum-sort-btn, .forum-sort button, .comment-sort-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var parent = this.closest('.forum-sort, .forum-sort-bar, .comment-sort-bar');
            if (parent) {
                parent.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
            }
            this.classList.add('active');
            var sort = this.textContent.trim().toLowerCase();
            var isComment = this.classList.contains('comment-sort-btn') || (parent && parent.classList.contains('comment-sort-bar'));
            F.emit(isComment ? 'comment:sort' : 'sort:change', { sort: sort });
        });
    });

    /* ── Post upvote/downvote ──────────────────────────────────────────────── */
    document.querySelectorAll('.forum-post, .forum-post-card').forEach(function(post) {
        var data = getPostData(post);
        var upvoteBtn = post.querySelector('.forum-vote-up, .vote-up, .btn-upvote');
        var downvoteBtn = post.querySelector('.forum-vote-down, .vote-down, .btn-downvote');
        var scoreEl = post.querySelector('.forum-vote-count, .vote-count');

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', function() {
                var active = this.classList.toggle('active');
                if (active && downvoteBtn) downvoteBtn.classList.remove('active');
                F.emit(active ? 'post:upvote' : 'post:unvote', data);
            });
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', function() {
                var active = this.classList.toggle('active');
                if (active && upvoteBtn) upvoteBtn.classList.remove('active');
                F.emit(active ? 'post:downvote' : 'post:unvote', data);
            });
        }

        /* ── Post action buttons ───────────────────────────────────────────── */
        var commentLink = post.querySelector('.forum-comments-link, .btn-comments, [title="Comments"]');
        if (commentLink) {
            commentLink.addEventListener('click', function() {
                F.emit('post:comments', data);
            });
        }

        var shareBtn = post.querySelector('.btn-share, [title="Share"]');
        if (shareBtn) {
            shareBtn.addEventListener('click', function(e) {
                e.preventDefault();
                F.emit('post:share', data);
            });
        }

        var saveBtn = post.querySelector('.btn-save, [title="Save"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.preventDefault();
                this.classList.toggle('active');
                F.emit(this.classList.contains('active') ? 'post:save' : 'post:unsave', data);
            });
        }

        var awardBtn = post.querySelector('.btn-award, [title="Award"], [title="Awards"]');
        if (awardBtn) {
            awardBtn.addEventListener('click', function(e) {
                e.preventDefault();
                F.emit('post:award', data);
            });
        }

        var reportBtn = post.querySelector('.btn-report, [title="Report"]');
        if (reportBtn) {
            reportBtn.addEventListener('click', function(e) {
                e.preventDefault();
                F.emit('post:report', data);
            });
        }

        var moreBtn = post.querySelector('.btn-more, [title="More"]');
        if (moreBtn) {
            moreBtn.addEventListener('click', function(e) {
                e.preventDefault();
                F.emit('post:more', data);
            });
        }
    });

    /* ── Comment actions ───────────────────────────────────────────────────── */
    document.querySelectorAll('.forum-comment, .comment-card').forEach(function(comment) {
        var data = getCommentData(comment);
        var upvoteBtn = comment.querySelector('.forum-vote-up, .vote-up, .btn-upvote, .comment-upvote');
        var downvoteBtn = comment.querySelector('.forum-vote-down, .vote-down, .btn-downvote, .comment-downvote');

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', function() {
                var active = this.classList.toggle('active');
                if (active && downvoteBtn) downvoteBtn.classList.remove('active');
                F.emit(active ? 'comment:upvote' : 'comment:unvote', data);
            });
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', function() {
                var active = this.classList.toggle('active');
                if (active && upvoteBtn) upvoteBtn.classList.remove('active');
                F.emit(active ? 'comment:downvote' : 'comment:unvote', data);
            });
        }

        var replyBtn = comment.querySelector('.btn-reply, [title="Reply"], .comment-reply');
        if (replyBtn) {
            replyBtn.addEventListener('click', function() {
                F.emit('comment:reply', data);
            });
        }

        var awardBtn = comment.querySelector('.btn-award, [title="Award"]');
        if (awardBtn) {
            awardBtn.addEventListener('click', function() {
                F.emit('comment:award', data);
            });
        }

        var moreBtn = comment.querySelector('.btn-more, [title="More"]');
        if (moreBtn) {
            moreBtn.addEventListener('click', function() {
                F.emit('comment:more', data);
            });
        }
    });

    /* ── Comment compose ───────────────────────────────────────────────────── */
    var commentTextarea = document.querySelector('.forum-comment-compose textarea, .comment-compose textarea');
    var commentSubmitBtn = document.querySelector('.forum-comment-compose .btn-primary, .comment-compose .btn-comment, .btn-submit-comment');

    if (commentTextarea) {
        commentTextarea.addEventListener('input', function() {
            F.emit('comment:input', { text: this.value, length: this.value.length });
        });
    }

    if (commentSubmitBtn) {
        commentSubmitBtn.addEventListener('click', function() {
            var text = commentTextarea ? commentTextarea.value.trim() : '';
            if (!text) return;
            F.emit('comment:submit', { text: text, timestamp: new Date().toISOString() });
            if (commentTextarea) commentTextarea.value = '';
        });
    }

    /* ── Comment formatting toolbar ────────────────────────────────────────── */
    document.querySelectorAll('.comment-format-btn, .forum-comment-compose .btn-format').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var format = this.getAttribute('title') || this.textContent.trim();
            F.emit('comment:format', { format: format.toLowerCase() });
        });
    });

    /* ── Follow / Unfollow buttons ─────────────────────────────────────────── */
    document.querySelectorAll('.btn-forum-follow, .forum-follow-btn, .btn-follow').forEach(function(btn) {
        // Skip "Join Community" buttons
        if (btn.textContent.trim().toLowerCase().indexOf('join') !== -1) return;
        btn.addEventListener('click', function() {
            var parent = this.closest('.forum-follower-card, .forum-follow-item, .forum-suggestion');
            var userData = getUserData(parent);
            var isFollowing = this.classList.contains('following');
            this.classList.toggle('following');
            if (isFollowing) {
                this.textContent = 'Follow';
                F.emit('user:unfollow', userData);
            } else {
                this.textContent = 'Following';
                F.emit('user:follow', userData);
            }
        });
    });

    /* ── Profile tabs ──────────────────────────────────────────────────────── */
    document.querySelectorAll('.forum-profile-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.forum-profile-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            F.emit('tab:switch', { tab: this.textContent.trim() });
        });
    });

    /* ── Follower / Following tabs ─────────────────────────────────────────── */
    document.querySelectorAll('.forum-follow-tabs .forum-follow-tab, .forum-follow-tabs .glass-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.forum-follow-tabs .forum-follow-tab, .forum-follow-tabs .glass-tab')
                .forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            F.emit('follow-tab:switch', { tab: this.textContent.trim() });
        });
    });

    /* ── Follower search ───────────────────────────────────────────────────── */
    var followerSearch = document.querySelector('.forum-follower-search input, #forumFollowerSearch');
    if (followerSearch) {
        followerSearch.addEventListener('input', function() {
            F.emit('follower:search', { query: this.value.trim() });
        });
    }

    /* ── Community join buttons ─────────────────────────────────────────────── */
    document.querySelectorAll('.btn-join-community, .forum-community-join').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var parent = this.closest('.forum-community-card, .forum-trending-item, .community-sidebar');
            var nameEl = parent ? parent.querySelector('.forum-community-name, h5, h6, .community-name') : null;
            var joined = this.classList.toggle('joined');
            this.textContent = joined ? 'Joined' : 'Join';
            F.emit(joined ? 'community:join' : 'community:leave', {
                name: nameEl ? nameEl.textContent.trim() : ''
            });
        });
    });

    /* ── Pagination ────────────────────────────────────────────────────────── */
    document.querySelectorAll('.forum-pagination .page-link, .forum-pagination button').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var page = this.textContent.trim();
            F.emit('pagination:change', { page: page });
        });
    });

    /* ── Search ────────────────────────────────────────────────────────────── */
    document.querySelectorAll('.forum-search-input, .forum-search input').forEach(function(input) {
        input.addEventListener('input', function() {
            F.emit('search:query', { query: this.value.trim() });
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                F.emit('search:submit', { query: this.value.trim() });
            }
        });
    });

    /* ── Profile actions (Message / More) ──────────────────────────────────── */
    var profileFollowBtn = document.querySelector('.forum-profile-header .btn-follow');
    if (profileFollowBtn) {
        profileFollowBtn.addEventListener('click', function() {
            var isFollowing = this.classList.toggle('following');
            F.emit(isFollowing ? 'profile:follow' : 'profile:unfollow', {});
        });
    }

    var profileMsgBtn = document.querySelector('.forum-profile-header .btn-message, .forum-profile-header [title="Message"]');
    if (profileMsgBtn) {
        profileMsgBtn.addEventListener('click', function() {
            F.emit('profile:message', {});
        });
    }

    var profileMoreBtn = document.querySelector('.forum-profile-header .btn-more, .forum-profile-header [title="More"]');
    if (profileMoreBtn) {
        profileMoreBtn.addEventListener('click', function() {
            F.emit('profile:more', {});
        });
    }

    /* ── Mobile sidebar toggle ─────────────────────────────────────────────── */
    var sidebar = document.getElementById('forumSidebar');
    var backdrop = document.getElementById('forumSidebarBackdrop');
    var toggle = document.getElementById('forumSidebarToggle');
    var closeBtn = document.getElementById('forumSidebarClose');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('show');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
        F.emit('sidebar:open', {});
    }
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
        F.emit('sidebar:close', {});
    }

    if (toggle) toggle.addEventListener('click', openSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
});
