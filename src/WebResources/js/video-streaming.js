/* =============================================================================
   Liquid Elegance — Streamflix (Video Streaming)
   Lightweight progressive-enhancement script. The pages are mostly static —
   this script only powers the custom video player on the watch page and a few
   minor interactive niceties (tab toggles, like/save, comment compose, etc).
   ============================================================================= */
(function () {
    'use strict';

    const $  = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    function refreshIcons() {
        if (window.feather && typeof feather.replace === 'function') {
            feather.replace({ 'stroke-width': 2, width: '1em', height: '1em' });
        }
    }

    /* ========================================================================
       CATEGORY CHIPS  (static; just visual toggle on the home page)
       ===================================================================== */
    function bindChips() {
        const chips = $$('.video-chip');
        if (!chips.length) return;
        chips.forEach(chip => {
            chip.addEventListener('click', e => {
                e.preventDefault();
                chips.forEach(c => c.classList.remove('is-active'));
                chip.classList.add('is-active');
            });
        });
    }

    /* ========================================================================
       CHANNEL / LIBRARY TABS  (visual toggle)
       ===================================================================== */
    function bindChannelTabs() {
        const groups = new Set();
        $$('.video-channel-tab').forEach(t => groups.add(t.parentElement));
        groups.forEach(group => {
            const tabs = $$('.video-channel-tab', group);
            tabs.forEach(t => {
                t.addEventListener('click', e => {
                    if (!t.getAttribute('href') || t.getAttribute('href') === '#') e.preventDefault();
                    tabs.forEach(x => x.classList.remove('is-active'));
                    t.classList.add('is-active');
                });
            });
        });
    }

    /* ========================================================================
       SUBSCRIBE BUTTONS  (visual toggle)
       ===================================================================== */
    function bindSubscribeButtons() {
        $$('.video-subscribe-btn, .video-row-action').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const subscribed = btn.classList.toggle('is-subscribed');
                btn.textContent = subscribed ? 'Subscribed' : 'Subscribe';
            });
        });
    }

    /* ========================================================================
       LIKE / DISLIKE / SAVE  (visual toggle on watch page)
       ===================================================================== */
    function bindWatchActions() {
        const like = $('#vidLike');
        const dislike = $('#vidDislike');
        const save = $('#vidSave');
        const share = $('#vidShare');
        const likeCount = $('#vidLikeCount');

        let baseLikeCount = 348;
        let liked = false;

        if (like) {
            like.addEventListener('click', () => {
                liked = !liked;
                like.classList.toggle('is-active', liked);
                if (liked && dislike && dislike.classList.contains('is-active')) {
                    dislike.classList.remove('is-active');
                }
                if (likeCount) likeCount.textContent = (baseLikeCount + (liked ? 1 : 0)) + 'K';
            });
        }
        if (dislike) {
            dislike.addEventListener('click', () => {
                const on = dislike.classList.toggle('is-active');
                if (on && liked) {
                    liked = false;
                    like.classList.remove('is-active');
                    if (likeCount) likeCount.textContent = baseLikeCount + 'K';
                }
            });
        }
        if (save) {
            save.addEventListener('click', () => {
                const on = save.classList.toggle('is-active');
                const lbl = save.querySelector('span');
                if (lbl) lbl.textContent = on ? 'Saved' : 'Save';
            });
        }
        if (share) {
            share.addEventListener('click', () => {
                const lbl = share.querySelector('span');
                if (!lbl) return;
                const orig = lbl.textContent;
                lbl.textContent = 'Copied!';
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(location.href).catch(() => {});
                }
                setTimeout(() => { lbl.textContent = orig; }, 1500);
            });
        }
    }

    /* ========================================================================
       DESCRIPTION SHOW MORE / LESS
       ===================================================================== */
    function bindDescription() {
        const box = $('#vidDescBox');
        const toggle = $('#vidDescToggle');
        if (!box || !toggle) return;
        toggle.addEventListener('click', () => {
            box.classList.toggle('is-expanded');
            toggle.textContent = box.classList.contains('is-expanded') ? 'Show less' : 'Show more';
        });
    }

    /* ========================================================================
       COMMENTS — compose + per-comment like/dislike/reply (visual)
       ===================================================================== */
    function bindComments() {
        const compose = $('#vidCompose');
        const text = $('#vidComposeText');
        const cancel = $('#vidComposeCancel');
        const post = $('#vidComposePost');
        const list = $('.video-comment-list');

        if (text) {
            text.addEventListener('focus', () => compose && compose.classList.add('is-active'));
            text.addEventListener('input', () => {
                if (post) post.disabled = text.value.trim().length === 0;
                text.style.height = 'auto';
                text.style.height = Math.min(text.scrollHeight, 160) + 'px';
            });
        }
        if (cancel) {
            cancel.addEventListener('click', () => {
                if (text) { text.value = ''; text.style.height = 'auto'; }
                if (post) post.disabled = true;
                if (compose) compose.classList.remove('is-active');
            });
        }
        if (post) {
            post.addEventListener('click', () => {
                const value = text && text.value.trim(); if (!value) return;
                const node = document.createElement('div');
                node.className = 'video-comment';
                node.innerHTML = `
                    <span class="video-comment-avatar le-bg-gradient-primary">JD</span>
                    <div class="video-comment-body">
                        <div class="video-comment-head">
                            <span class="video-comment-author">You</span>
                            <span class="video-comment-time">just now</span>
                        </div>
                        <div class="video-comment-text"></div>
                        <div class="video-comment-actions">
                            <button class="video-comment-action" data-comment-act="like"><i data-feather="thumbs-up" class="le-icon-14"></i><span>0</span></button>
                            <button class="video-comment-action" data-comment-act="dislike"><i data-feather="thumbs-down" class="le-icon-14"></i></button>
                            <button class="video-comment-action" data-comment-act="reply">Reply</button>
                        </div>
                    </div>`;
                node.querySelector('.video-comment-text').textContent = value;
                if (list) list.insertBefore(node, list.firstChild);
                refreshIcons();
                text.value = ''; text.style.height = 'auto';
                post.disabled = true;
                compose && compose.classList.remove('is-active');

                const head = $('.video-comments-count');
                if (head) {
                    const m = head.textContent.match(/(\d+)/);
                    const next = (m ? parseInt(m[1], 10) : 0) + 1;
                    head.textContent = next + ' Comments';
                }
            });
        }

        // Per-comment actions (delegated)
        if (list) {
            list.addEventListener('click', e => {
                const btn = e.target.closest('.video-comment-action'); if (!btn) return;
                const act = btn.dataset.commentAct;
                if (act === 'reply') { text && text.focus(); return; }
                if (act === 'like' || act === 'dislike') {
                    const wrap = btn.parentElement;
                    if (!wrap) return;
                    if (act === 'like') {
                        const dis = wrap.querySelector('[data-comment-act="dislike"]');
                        if (dis) dis.classList.remove('is-active');
                    } else {
                        const lk = wrap.querySelector('[data-comment-act="like"]');
                        if (lk) lk.classList.remove('is-active');
                    }
                    btn.classList.toggle('is-active');
                }
            });
        }
    }

    /* ========================================================================
       SUGGESTIONS TAB FILTER  (visual on watch page)
       ===================================================================== */
    function bindSuggestionTabs() {
        const tabs = $$('.video-suggestions-tab');
        if (!tabs.length) return;
        const list = $('.video-suggestions-list');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('is-active'));
                tab.classList.add('is-active');
                if (!list) return;
                const filter = tab.dataset.suggestTab;
                $$('.video-card-h', list).forEach(card => {
                    const tag = card.dataset.suggest || '';
                    card.style.display = (filter === 'all' || tag === filter || (filter === 'related' && tag !== 'from-channel'))
                        ? '' : 'none';
                });
            });
        });
    }

    /* ========================================================================
       VIDEO PLAYER  (watch page only)
       ===================================================================== */

    function fmtTime(secs) {
        if (!secs && secs !== 0) return '0:00';
        secs = Math.max(0, Math.floor(secs));
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        return m + ':' + String(s).padStart(2, '0');
    }

    function bindPlayer() {
        const card  = $('.video-player-card');
        const frame = $('#vidPlayerFrame');
        const video = $('#vidVideo');
        if (!card || !frame || !video) return;

        const VIDEO_SRC = card.dataset.videoSrc || 'assets/media/big_buck_bunny_720p_h264.mov';

        const poster        = $('#vidPoster');
        const flash         = $('#vidPlayerFlash');
        const playBtn       = $('#vidPlay');
        const skipBack      = $('#vidSkipBack');
        const skipFwd       = $('#vidSkipFwd');
        const muteBtn       = $('#vidMute');
        const volIcon       = $('#vidVolIcon');
        const volBar        = $('#vidVolBar');
        const volFill       = $('#vidVolFill');
        const timeCur       = $('#vidTimeCur');
        const timeTot       = $('#vidTimeTot');
        const captions      = $('#vidCaptions');
        const settingsBtn   = $('#vidSettings');
        const settingsMenu  = $('#vidSettingsMenu');
        const pipBtn        = $('#vidPip');
        const fullscreenBtn = $('#vidFullscreen');
        const progress      = $('#vidProgress');
        const progressBuf   = $('#vidProgressBuffer');
        const progressFill  = $('#vidProgressFill');

        // Load src lazily on first interaction
        let loaded = false;
        function ensureLoaded() {
            if (loaded) return;
            video.src = VIDEO_SRC;
            video.load();
            loaded = true;
        }

        function flashIcon(name) {
            if (!flash) return;
            flash.innerHTML = `<i data-feather="${name}"></i>`;
            if (window.feather) feather.replace({ width: '1em', height: '1em' });
            flash.classList.remove('is-visible');
            void flash.offsetWidth;
            flash.classList.add('is-visible');
        }

        function togglePlay() {
            ensureLoaded();
            if (video.paused) {
                video.play().then(() => flashIcon('play')).catch(() => {});
            } else {
                video.pause();
                flashIcon('pause');
            }
        }

        function updateProgress() {
            const cur = video.currentTime || 0;
            const dur = video.duration || 0;
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            if (progressFill) progressFill.style.width = pct + '%';
            if (video.buffered && video.buffered.length && progressBuf) {
                const end = video.buffered.end(video.buffered.length - 1);
                progressBuf.style.width = (dur > 0 ? (end / dur) * 100 : 0) + '%';
            }
            if (timeCur) timeCur.textContent = fmtTime(cur);
            if (dur > 0 && timeTot) timeTot.textContent = fmtTime(dur);
        }

        function seekFromEvent(e) {
            const rect = progress.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const pct = Math.max(0, Math.min(1, x / rect.width));
            if (video.duration > 0) video.currentTime = pct * video.duration;
        }

        function setVolume(v) {
            v = Math.max(0, Math.min(1, v));
            video.volume = v;
            video.muted = v === 0;
            if (volFill) volFill.style.width = (v * 100) + '%';
            updateVolumeIcon();
        }

        function updateVolumeIcon() {
            if (!volIcon) return;
            const ic = video.muted || video.volume === 0 ? 'volume-x' : (video.volume < 0.5 ? 'volume-1' : 'volume-2');
            volIcon.setAttribute('data-feather', ic);
            if (window.feather) feather.replace({ width: '1em', height: '1em' });
        }

        function volFromEvent(e) {
            const rect = volBar.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            setVolume(Math.max(0, Math.min(1, x / rect.width)));
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                const fs = frame.requestFullscreen || frame.webkitRequestFullscreen || frame.mozRequestFullScreen || frame.msRequestFullscreen;
                if (fs) fs.call(frame);
            } else {
                const es = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
                if (es) es.call(document);
            }
        }

        function togglePip() {
            if (!document.pictureInPictureEnabled) return;
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else if (video.requestPictureInPicture) video.requestPictureInPicture().catch(() => {});
        }

        // Idle controls
        let idleTimer = null;
        function showControls() {
            frame.classList.remove('is-idle');
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!video.paused) frame.classList.add('is-idle');
            }, 2400);
        }

        // Bindings
        if (poster) poster.addEventListener('click', togglePlay);
        if (playBtn) playBtn.addEventListener('click', togglePlay);
        video.addEventListener('click', togglePlay);
        video.addEventListener('dblclick', toggleFullscreen);

        video.addEventListener('play',  () => { frame.classList.add('is-playing', 'has-played'); showControls(); });
        video.addEventListener('pause', () => { frame.classList.remove('is-playing'); frame.classList.remove('is-idle'); });
        video.addEventListener('timeupdate',     updateProgress);
        video.addEventListener('durationchange', updateProgress);
        video.addEventListener('progress',       updateProgress);
        video.addEventListener('loadedmetadata', updateProgress);
        video.addEventListener('volumechange',   updateVolumeIcon);
        video.addEventListener('ended',          () => frame.classList.remove('is-playing'));

        if (skipBack) skipBack.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); flashIcon('rotate-ccw'); });
        if (skipFwd)  skipFwd.addEventListener('click',  () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); flashIcon('rotate-cw'); });

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                if (video.muted || video.volume === 0) {
                    video.muted = false;
                    if (video.volume === 0) setVolume(0.6);
                } else {
                    video.muted = true;
                }
                updateVolumeIcon();
            });
        }

        if (volBar) {
            let dragging = false;
            volBar.addEventListener('pointerdown', e => { dragging = true; volBar.setPointerCapture(e.pointerId); volFromEvent(e); });
            volBar.addEventListener('pointermove', e => { if (dragging) volFromEvent(e); });
            volBar.addEventListener('pointerup',   e => { dragging = false; try { volBar.releasePointerCapture(e.pointerId); } catch (_) {} });
        }
        if (progress) {
            let dragging = false;
            progress.addEventListener('pointerdown', e => { dragging = true; progress.setPointerCapture(e.pointerId); seekFromEvent(e); });
            progress.addEventListener('pointermove', e => { if (dragging) seekFromEvent(e); });
            progress.addEventListener('pointerup',   e => { dragging = false; try { progress.releasePointerCapture(e.pointerId); } catch (_) {} });
        }

        if (captions) {
            captions.addEventListener('click', () => captions.classList.toggle('is-active'));
        }

        if (settingsBtn && settingsMenu) {
            settingsBtn.addEventListener('click', e => {
                e.stopPropagation();
                settingsMenu.classList.toggle('is-open');
            });
            document.addEventListener('click', e => {
                if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
                    settingsMenu.classList.remove('is-open');
                }
            });
            settingsMenu.addEventListener('click', e => {
                const item = e.target.closest('.video-settings-item'); if (!item) return;
                if (item.dataset.speed) {
                    settingsMenu.querySelectorAll('[data-speed]').forEach(x => x.classList.remove('is-selected'));
                    item.classList.add('is-selected');
                    video.playbackRate = parseFloat(item.dataset.speed);
                }
                if (item.dataset.quality) {
                    settingsMenu.querySelectorAll('[data-quality]').forEach(x => x.classList.remove('is-selected'));
                    item.classList.add('is-selected');
                }
            });
        }

        if (pipBtn) pipBtn.addEventListener('click', togglePip);
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

        ['mousemove', 'pointermove', 'touchstart'].forEach(ev =>
            frame.addEventListener(ev, showControls)
        );
        document.addEventListener('fullscreenchange', () => {
            frame.classList.toggle('is-fullscreen', !!document.fullscreenElement);
        });

        // Keyboard shortcuts (when not in input/textarea)
        document.addEventListener('keydown', e => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
            else if (e.key === 'f') { toggleFullscreen(); }
            else if (e.key === 'm' && muteBtn) { muteBtn.click(); }
            else if (e.key === 'ArrowLeft' && skipBack) { skipBack.click(); }
            else if (e.key === 'ArrowRight' && skipFwd) { skipFwd.click(); }
            else if (e.key === 'ArrowUp')   { setVolume((video.volume || 0) + 0.05); }
            else if (e.key === 'ArrowDown') { setVolume((video.volume || 0) - 0.05); }
        });

        // Initial volume
        setVolume(0.7);
    }

    /* ========================================================================
       INIT
       ===================================================================== */

    function init() {
        bindChips();
        bindChannelTabs();
        bindSubscribeButtons();
        bindWatchActions();
        bindDescription();
        bindComments();
        bindSuggestionTabs();
        bindPlayer();
        refreshIcons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
