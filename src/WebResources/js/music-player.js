/* =============================================================================
   Liquid Elegance — Music Player App Logic
   - Single shared <audio> element drives the player bar UI.
   - All tracks use the same demo MP3 URL; all radio stations use the same
     Icecast stream URL. This is purely a UI/UX demo.
   ============================================================================= */

(function () {
    'use strict';

    /* ---- demo media sources ------------------------------------------------ */

    const DEMO_TRACK_URL = 'https://file-examples.com/storage/fec16fcd9269f83bf9b0e12/2017/11/file_example_MP3_2MG.mp3';
    const DEMO_RADIO_URL = 'https://icecast.walmradio.com:8443/classic';

    /* ---- demo library ------------------------------------------------------ */

    const ARTISTS = [
        { id: 'a1', name: 'Aurora Skye',     grad: 'music-cover-grad-1' },
        { id: 'a2', name: 'Ember Lane',      grad: 'music-cover-grad-2' },
        { id: 'a3', name: 'Coastal Drift',   grad: 'music-cover-grad-3' },
        { id: 'a4', name: 'Midnight Quartet',grad: 'music-cover-grad-4' },
        { id: 'a5', name: 'Neon Pulse',      grad: 'music-cover-grad-5' },
        { id: 'a6', name: 'River & Stone',   grad: 'music-cover-grad-6' },
        { id: 'a7', name: 'Solace Mode',     grad: 'music-cover-grad-7' },
        { id: 'a8', name: 'Velvet Static',   grad: 'music-cover-grad-8' }
    ];

    const ALBUMS = [
        { id: 'al1', title: 'Liquid Horizons',   artistId: 'a1', year: 2024, grad: 'music-cover-grad-1' },
        { id: 'al2', title: 'Glass Cathedrals',  artistId: 'a2', year: 2023, grad: 'music-cover-grad-2' },
        { id: 'al3', title: 'Tide & Time',       artistId: 'a3', year: 2025, grad: 'music-cover-grad-3' },
        { id: 'al4', title: 'After Hours',       artistId: 'a4', year: 2022, grad: 'music-cover-grad-4' },
        { id: 'al5', title: 'Volt Romance',      artistId: 'a5', year: 2024, grad: 'music-cover-grad-5' },
        { id: 'al6', title: 'Heartwood',         artistId: 'a6', year: 2023, grad: 'music-cover-grad-6' },
        { id: 'al7', title: 'Quiet Geometry',    artistId: 'a7', year: 2025, grad: 'music-cover-grad-7' },
        { id: 'al8', title: 'Phantom Channel',   artistId: 'a8', year: 2024, grad: 'music-cover-grad-8' }
    ];

    // Use cycled durations to vary track display only (audio is the same demo file)
    const SAMPLE_DURATIONS = [212, 184, 247, 198, 263, 175, 224, 309, 156, 192];

    function buildTracks() {
        const titles = [
            'Refraction', 'Drift Mode', 'Pale Architecture', 'Slow Tide',
            'Glassline', 'Neon Sleep', 'Echoes in Linen', 'Soft Machines',
            'Late Bloom', 'Halcyon', 'Patina', 'Currents',
            'Open Window', 'Foglight', 'Magnolia Static', 'After Rain',
            'Cobalt', 'Holding Pattern', 'Saltwater', 'Long Exposure',
            'Stargrazer', 'Velvet Hour', 'Polar Bloom', 'Slipstream'
        ];
        const out = [];
        titles.forEach((title, i) => {
            const album = ALBUMS[i % ALBUMS.length];
            out.push({
                id: 't' + (i + 1),
                title,
                albumId: album.id,
                artistId: album.artistId,
                duration: SAMPLE_DURATIONS[i % SAMPLE_DURATIONS.length],
                liked: i % 7 === 0
            });
        });
        return out;
    }

    const TRACKS = buildTracks();

    const PLAYLISTS = [
        { id: 'chill-evening',  name: 'Chill Evening',  grad: 'music-cover-grad-1', icon: 'moon',       desc: 'Lo-fi & ambient picks for unwinding after work.', trackIds: ['t1','t4','t7','t10','t13','t16','t19','t22'] },
        { id: 'focus-flow',     name: 'Focus Flow',     grad: 'music-cover-grad-2', icon: 'zap',        desc: 'Steady minimal tracks to keep you in the zone.',   trackIds: ['t2','t5','t8','t11','t14','t17','t20','t23'] },
        { id: 'weekend-drive',  name: 'Weekend Drive',  grad: 'music-cover-grad-3', icon: 'navigation', desc: 'Open road, open windows. Built for the highway.', trackIds: ['t3','t6','t9','t12','t15','t18','t21','t24'] },
        { id: 'late-night-jazz',name: 'Late Night Jazz',grad: 'music-cover-grad-4', icon: 'coffee',     desc: 'Smoky standards and neo-jazz for after midnight.',  trackIds: ['t4','t8','t12','t16','t20','t24'] },
        { id: 'workout-burn',   name: 'Workout Burn',   grad: 'music-cover-grad-5', icon: 'activity',   desc: 'High-energy tempos to push through your set.',     trackIds: ['t5','t10','t15','t20','t1','t6','t11','t16','t21'] }
    ];

    const RADIO_STATIONS = [
        { id: 'r1', name: 'WALM Classical',     genre: 'Classical', listeners: '12.4k', grad: 'music-cover-grad-6' },
        { id: 'r2', name: 'Liquid Lounge FM',   genre: 'Lounge',    listeners:  '8.1k', grad: 'music-cover-grad-1' },
        { id: 'r3', name: 'Sunset Jazz Cafe',   genre: 'Jazz',      listeners:  '6.7k', grad: 'music-cover-grad-2' },
        { id: 'r4', name: 'Neon Nights Synth',  genre: 'Synthwave', listeners:  '9.3k', grad: 'music-cover-grad-5' },
        { id: 'r5', name: 'Driftwood Indie',    genre: 'Indie',     listeners:  '4.2k', grad: 'music-cover-grad-3' },
        { id: 'r6', name: 'Atrium Ambient',     genre: 'Ambient',   listeners:  '3.5k', grad: 'music-cover-grad-7' },
        { id: 'r7', name: 'Velvet Soul Radio',  genre: 'Soul',      listeners:  '7.8k', grad: 'music-cover-grad-8' },
        { id: 'r8', name: 'Pacific Drive Mix',  genre: 'Chillwave', listeners:  '5.6k', grad: 'music-cover-grad-4' }
    ];

    const MIXES = [
        { id: 'm1', title: 'Daily Mix 1',  sub: 'Aurora Skye, Ember Lane and more', grad: 'music-cover-grad-1' },
        { id: 'm2', title: 'Daily Mix 2',  sub: 'Coastal Drift, Solace Mode',       grad: 'music-cover-grad-3' },
        { id: 'm3', title: 'Discover Weekly', sub: 'Your fresh handpicked tracks',  grad: 'music-cover-grad-5' },
        { id: 'm4', title: 'Release Radar',sub: 'New from artists you follow',      grad: 'music-cover-grad-7' }
    ];

    /* ---- utility functions ------------------------------------------------- */

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

    function fmtTime(s) {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const r = Math.floor(s % 60);
        return m + ':' + (r < 10 ? '0' + r : r);
    }

    function artistName(id) {
        const a = ARTISTS.find(x => x.id === id);
        return a ? a.name : '';
    }

    function albumOf(track) { return ALBUMS.find(a => a.id === track.albumId); }
    function trackById(id) { return TRACKS.find(t => t.id === id); }

    function refreshIcons() {
        if (window.feather && typeof window.feather.replace === 'function') {
            window.feather.replace();
        }
    }

    /* ---- state ------------------------------------------------------------- */

    const state = {
        currentView: 'browse',
        history: ['browse'],
        historyIndex: 0,
        // playback
        queue: [],            // array of track ids OR a single radio station object
        queueIndex: -1,
        isRadio: false,
        currentTrack: null,
        currentRadio: null,
        isPlaying: false,
        volume: 0.7,
        muted: false,
        repeatMode: 'off',    // off | all | one
        shuffle: false,
        liked: new Set(TRACKS.filter(t => t.liked).map(t => t.id)),
        currentPlaylist: null,
        currentAlbum: null
    };

    /* ---- DOM refs ---------------------------------------------------------- */

    const audio = $('#musicAudio');
    if (!audio) return; // page not present

    const DEMO_TRACK_SRC = audio.dataset.trackSrc || DEMO_TRACK_URL;
    const DEMO_RADIO_SRC = audio.dataset.radioSrc || DEMO_RADIO_URL;

    const els = {
        layout: $('#musicApp'),
        sidebar: $('#musicSidebar'),
        sidebarBackdrop: $('#musicSidebarBackdrop'),
        sidebarToggle: $('#musicSidebarToggle'),
        sidebarClose: $('#musicSidebarClose'),
        navItems: $$('.music-nav-item'),
        playlistItems: $$('.music-playlist-item'),
        pageTitle: $('#musicPageTitle'),
        navBack: $('#musicNavBack'),
        navForward: $('#musicNavForward'),
        scroll: $('#musicScroll'),

        featuredAlbums: $('#featuredAlbums'),
        trendingTracks: $('#trendingTracks'),
        madeForYou: $('#madeForYou'),
        allTracks: $('#allTracks'),
        allAlbums: $('#allAlbums'),
        allArtists: $('#allArtists'),
        radioStations: $('#radioStations'),
        likedTracks: $('#likedTracks'),
        recentTracks: $('#recentTracks'),
        playlistTracks: $('#playlistTracks'),
        playlistHeroCover: $('#playlistHeroCover'),
        playlistHeroTitle: $('#playlistHeroTitle'),
        playlistHeroSub: $('#playlistHeroSub'),
        playlistPlayBtn: $('#playlistPlayBtn'),
        albumTracks: $('#albumTracks'),
        albumHeroCover: $('#albumHeroCover'),
        albumHeroTitle: $('#albumHeroTitle'),
        albumHeroSub: $('#albumHeroSub'),
        albumPlayBtn: $('#albumPlayBtn'),

        // queue panel
        queueToggle: $('#musicQueueToggle'),
        queueClose: $('#musicQueueClose'),
        ctrlQueue: $('#ctrlQueue'),
        queueNowPlaying: $('#queueNowPlaying'),
        queueList: $('#queueList'),

        // player bar
        bar: $('#musicPlayer'),
        playerArt: $('#playerArt'),
        playerTitle: $('#playerTitle'),
        playerArtist: $('#playerArtist'),
        playerLike: $('#playerLike'),
        ctrlShuffle: $('#ctrlShuffle'),
        ctrlPrev: $('#ctrlPrev'),
        ctrlPlay: $('#ctrlPlay'),
        ctrlNext: $('#ctrlNext'),
        ctrlRepeat: $('#ctrlRepeat'),
        ctrlMute: $('#ctrlMute'),
        ctrlExpand: $('#ctrlExpand'),
        timeCurrent: $('#timeCurrent'),
        timeTotal: $('#timeTotal'),
        progressTrack: $('#progressTrack'),
        progressFill: $('#progressFill'),
        progressBuffer: $('#progressBuffer'),
        progressThumb: $('#progressThumb'),
        volumeTrack: $('#volumeTrack'),
        volumeFill: $('#volumeFill'),
        volumeThumb: $('#volumeThumb'),
        playerMobileProgress: $('#playerMobileProgress'),

        // search
        search: $('#musicSearch'),

        // now playing modal
        nowModal: $('#nowPlayingModal'),
        nowSource: $('#nowPlayingSource'),
        nowArt: $('#nowPlayingArt'),
        nowTitle: $('#nowPlayingTitle'),
        nowArtist: $('#nowPlayingArtist'),
        nowProgressTrack: $('#nowProgressTrack'),
        nowProgressFill: $('#nowProgressFill'),
        nowTimeCurrent: $('#nowTimeCurrent'),
        nowTimeTotal: $('#nowTimeTotal'),
        nowPrev: $('#nowPrev'),
        nowNext: $('#nowNext'),
        nowPlay: $('#nowPlay'),
        nowShuffle: $('#nowShuffle'),
        nowRepeat: $('#nowRepeat')
    };

    /* ---- renderers --------------------------------------------------------- */

    function albumCardHtml(album) {
        return [
            '<div class="music-card music-card-album" role="button" tabindex="0" data-album-id="', album.id, '">',
                '<div class="music-card-cover ', album.grad, '">',
                    '<i data-feather="disc"></i>',
                    '<span class="music-card-play" role="button" tabindex="0" data-album-play="', album.id, '" title="Play">',
                        '<i data-feather="play"></i>',
                    '</span>',
                '</div>',
                '<div class="music-card-meta">',
                    '<div class="music-card-title">', album.title, '</div>',
                    '<div class="music-card-sub">', artistName(album.artistId), ' · ', album.year, '</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function artistCardHtml(artist) {
        return [
            '<div class="music-card music-card-artist" role="button" tabindex="0" data-artist-id="', artist.id, '">',
                '<div class="music-card-cover music-card-cover-artist ', artist.grad, '">',
                    '<i data-feather="user"></i>',
                '</div>',
                '<div class="music-card-meta">',
                    '<div class="music-card-title">', artist.name, '</div>',
                    '<div class="music-card-sub">Artist</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function radioCardHtml(station) {
        return [
            '<div class="music-card music-card-radio" role="button" tabindex="0" data-radio-id="', station.id, '">',
                '<div class="music-card-cover ', station.grad, '">',
                    '<span class="music-card-radio-badge"><span class="music-live-badge"><span class="music-live-dot"></span>Live</span></span>',
                    '<i data-feather="radio"></i>',
                    '<span class="music-card-play" role="button" tabindex="0" data-radio-play="', station.id, '" title="Tune in">',
                        '<i data-feather="play"></i>',
                    '</span>',
                '</div>',
                '<div class="music-card-meta">',
                    '<div class="music-card-title">', station.name, '</div>',
                    '<div class="music-card-sub">', station.genre, ' · ', station.listeners, ' listeners</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function mixCardHtml(mix) {
        return [
            '<div class="music-card music-card-mix" role="button" tabindex="0" data-mix-id="', mix.id, '">',
                '<div class="music-card-cover ', mix.grad, '">',
                    '<i data-feather="headphones"></i>',
                    '<span class="music-card-play" role="button" tabindex="0" data-mix-play="', mix.id, '" title="Play">',
                        '<i data-feather="play"></i>',
                    '</span>',
                '</div>',
                '<div class="music-card-meta">',
                    '<div class="music-card-title">', mix.title, '</div>',
                    '<div class="music-card-sub">', mix.sub, '</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function trackRowHtml(track, index, opts) {
        opts = opts || {};
        const album = albumOf(track) || { title: '', grad: 'music-cover-grad-1' };
        const liked = state.liked.has(track.id);
        const isCurrent = state.currentTrack && state.currentTrack.id === track.id;
        return [
            '<div class="music-track-row', isCurrent ? ' playing' : '', isCurrent && !state.isPlaying ? ' paused' : '', '" data-track-id="', track.id, '"', opts.queue ? ' data-queue-from="' + opts.queue + '"' : '', '>',
                '<div class="music-track-index">',
                    '<span class="music-track-num">', (index + 1), '</span>',
                    '<button class="music-track-play" title="Play"><i data-feather="play"></i></button>',
                    '<span class="music-track-equalizer" aria-hidden="true"><span></span><span></span><span></span></span>',
                '</div>',
                '<div class="music-track-info">',
                    '<div class="music-track-cover ', album.grad, '"><i data-feather="music"></i></div>',
                    '<div class="music-track-meta">',
                        '<div class="music-track-title">', track.title, '</div>',
                        '<div class="music-track-artist">', artistName(track.artistId), '</div>',
                    '</div>',
                '</div>',
                '<div class="music-track-album">', album.title, '</div>',
                '<button class="music-track-like', liked ? ' liked' : '', '" data-like="', track.id, '" title="Like"><i data-feather="heart"></i></button>',
                '<div class="music-track-duration">', fmtTime(track.duration), '</div>',
            '</div>'
        ].join('');
    }

    function renderBrowse() {
        if (els.featuredAlbums) {
            els.featuredAlbums.innerHTML = ALBUMS.slice(0, 6).map(albumCardHtml).join('');
        }
        if (els.trendingTracks) {
            const ids = ['t1','t2','t3','t4','t5','t6'];
            els.trendingTracks.innerHTML = ids
                .map((id, i) => trackRowHtml(trackById(id), i, { queue: 'trending' }))
                .join('');
        }
        if (els.madeForYou) {
            els.madeForYou.innerHTML = MIXES.map(mixCardHtml).join('');
        }
    }

    function renderTracks(filter) {
        if (!els.allTracks) return;
        let list = TRACKS.slice();
        if (filter === 'recent') list = list.slice(0, 12);
        else if (filter === 'liked') list = list.filter(t => state.liked.has(t.id));
        els.allTracks.innerHTML = list.map((t, i) => trackRowHtml(t, i, { queue: 'tracks' })).join('');
    }

    function renderAlbums() {
        if (els.allAlbums) els.allAlbums.innerHTML = ALBUMS.map(albumCardHtml).join('');
    }

    function renderArtists() {
        if (els.allArtists) els.allArtists.innerHTML = ARTISTS.map(artistCardHtml).join('');
    }

    function renderRadio() {
        if (els.radioStations) els.radioStations.innerHTML = RADIO_STATIONS.map(radioCardHtml).join('');
    }

    function renderLiked() {
        if (!els.likedTracks) return;
        const list = TRACKS.filter(t => state.liked.has(t.id));
        if (list.length === 0) {
            els.likedTracks.innerHTML = '<div class="music-empty"><div class="music-empty-icon"><i data-feather="heart"></i></div><h6>No liked songs yet</h6><p>Tap the heart on any track to save it here.</p></div>';
        } else {
            els.likedTracks.innerHTML = list.map((t, i) => trackRowHtml(t, i, { queue: 'liked' })).join('');
        }
    }

    function renderRecent() {
        if (!els.recentTracks) return;
        // Pretend the first 10 tracks are most recent
        const list = TRACKS.slice(0, 10);
        els.recentTracks.innerHTML = list.map((t, i) => trackRowHtml(t, i, { queue: 'recent' })).join('');
    }

    function renderPlaylistView(pl) {
        state.currentPlaylist = pl;
        if (!els.playlistTracks) return;
        els.playlistHeroCover.className = 'music-list-hero-cover ' + pl.grad;
        els.playlistHeroCover.innerHTML = '<i data-feather="' + pl.icon + '"></i>';
        els.playlistHeroTitle.textContent = pl.name;
        els.playlistHeroSub.textContent = pl.desc + ' · ' + pl.trackIds.length + ' tracks';
        const list = pl.trackIds.map(trackById).filter(Boolean);
        els.playlistTracks.innerHTML = list.map((t, i) => trackRowHtml(t, i, { queue: 'playlist:' + pl.id })).join('');
    }

    function renderAlbumView(album) {
        state.currentAlbum = album;
        if (!els.albumTracks) return;
        els.albumHeroCover.className = 'music-list-hero-cover ' + album.grad;
        els.albumHeroCover.innerHTML = '<i data-feather="disc"></i>';
        els.albumHeroTitle.textContent = album.title;
        const list = TRACKS.filter(t => t.albumId === album.id);
        els.albumHeroSub.textContent = artistName(album.artistId) + ' · ' + album.year + ' · ' + list.length + ' tracks';
        els.albumTracks.innerHTML = list.map((t, i) => trackRowHtml(t, i, { queue: 'album:' + album.id })).join('');
    }

    /* ---- view router ------------------------------------------------------- */

    const VIEW_TITLES = {
        browse: 'Browse',
        tracks: 'Tracks',
        albums: 'Albums',
        artists: 'Artists',
        radio: 'Radio Stations',
        liked: 'Liked Songs',
        recent: 'Recently Played',
        downloaded: 'Downloaded',
        playlist: 'Playlist',
        album: 'Album'
    };

    function showView(view, opts) {
        opts = opts || {};
        $$('.music-view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
        els.navItems.forEach(b => b.classList.toggle('active', b.dataset.view === view));
        els.playlistItems.forEach(b => b.classList.toggle('active', opts.playlistId && b.dataset.playlist === opts.playlistId));

        let title = VIEW_TITLES[view] || 'Browse';
        if (view === 'playlist' && state.currentPlaylist) title = state.currentPlaylist.name;
        if (view === 'album' && state.currentAlbum) title = state.currentAlbum.title;
        els.pageTitle.textContent = title;

        if (els.scroll) els.scroll.scrollTop = 0;
        state.currentView = view;

        if (!opts.fromHistory) {
            // truncate forward history
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push({ view, opts });
            state.historyIndex = state.history.length - 1;
        }
        updateNavArrows();

        // close mobile sidebar after navigation
        closeSidebar();
        refreshIcons();
    }

    function updateNavArrows() {
        els.navBack.disabled = state.historyIndex <= 0;
        els.navForward.disabled = state.historyIndex >= state.history.length - 1;
    }

    function navigateBack() {
        if (state.historyIndex <= 0) return;
        state.historyIndex--;
        const entry = state.history[state.historyIndex];
        const e = typeof entry === 'string' ? { view: entry, opts: {} } : entry;
        if (e.opts && e.opts.playlistId) {
            const pl = PLAYLISTS.find(p => p.id === e.opts.playlistId);
            if (pl) renderPlaylistView(pl);
        }
        if (e.opts && e.opts.albumId) {
            const al = ALBUMS.find(a => a.id === e.opts.albumId);
            if (al) renderAlbumView(al);
        }
        showView(e.view, Object.assign({}, e.opts, { fromHistory: true }));
    }

    function navigateForward() {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex++;
        const entry = state.history[state.historyIndex];
        const e = typeof entry === 'string' ? { view: entry, opts: {} } : entry;
        if (e.opts && e.opts.playlistId) {
            const pl = PLAYLISTS.find(p => p.id === e.opts.playlistId);
            if (pl) renderPlaylistView(pl);
        }
        if (e.opts && e.opts.albumId) {
            const al = ALBUMS.find(a => a.id === e.opts.albumId);
            if (al) renderAlbumView(al);
        }
        showView(e.view, Object.assign({}, e.opts, { fromHistory: true }));
    }

    /* ---- mobile sidebar ---------------------------------------------------- */

    function openSidebar() {
        if (!els.sidebar) return;
        els.sidebar.classList.add('is-open');
        els.sidebarBackdrop.classList.add('is-visible');
    }

    function closeSidebar() {
        if (!els.sidebar) return;
        els.sidebar.classList.remove('is-open');
        els.sidebarBackdrop.classList.remove('is-visible');
    }

    /* ---- audio engine ------------------------------------------------------ */

    function loadTrack(track, opts) {
        opts = opts || {};
        state.isRadio = false;
        state.currentRadio = null;
        state.currentTrack = track;
        audio.src = DEMO_TRACK_SRC;
        audio.load();
        updatePlayerUi();
        markPlayingRows();
        if (opts.autoplay !== false) {
            playAudio();
        }
    }

    function loadRadio(station) {
        state.isRadio = true;
        state.currentRadio = station;
        state.currentTrack = null;
        audio.src = DEMO_RADIO_SRC;
        audio.load();
        updatePlayerUi();
        markPlayingRows();
        playAudio();
    }

    function playAudio() {
        const playBtn = els.ctrlPlay;
        if (playBtn) playBtn.classList.add('loading');
        const p = audio.play();
        if (p && typeof p.then === 'function') {
            p.then(() => {
                if (playBtn) playBtn.classList.remove('loading');
            }).catch(err => {
                if (playBtn) playBtn.classList.remove('loading');
                state.isPlaying = false;
                els.bar.dataset.playing = 'false';
                els.nowModal.dataset.playing = 'false';
            });
        }
    }

    function pauseAudio() { audio.pause(); }
    function togglePlay() {
        if (!state.currentTrack && !state.currentRadio) {
            // Nothing loaded — start trending
            playFromList(['t1','t2','t3','t4','t5','t6'], 0, 'trending');
            return;
        }
        if (audio.paused) playAudio();
        else pauseAudio();
    }

    function playFromList(trackIds, startIndex, queueLabel) {
        state.queue = trackIds.slice();
        state.queueIndex = startIndex || 0;
        state.queueLabel = queueLabel || '';
        const t = trackById(state.queue[state.queueIndex]);
        if (t) loadTrack(t);
        renderQueue();
    }

    function nextTrack() {
        if (state.isRadio) return;
        if (!state.queue.length) return;
        let next = state.queueIndex + 1;
        if (state.shuffle) {
            next = Math.floor(Math.random() * state.queue.length);
        }
        if (next >= state.queue.length) {
            if (state.repeatMode === 'all') next = 0;
            else { pauseAudio(); return; }
        }
        state.queueIndex = next;
        const t = trackById(state.queue[state.queueIndex]);
        if (t) loadTrack(t);
        renderQueue();
    }

    function prevTrack() {
        if (state.isRadio) return;
        if (!state.queue.length) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        let prev = state.queueIndex - 1;
        if (prev < 0) prev = state.repeatMode === 'all' ? state.queue.length - 1 : 0;
        state.queueIndex = prev;
        const t = trackById(state.queue[state.queueIndex]);
        if (t) loadTrack(t);
        renderQueue();
    }

    /* ---- player UI updates ------------------------------------------------- */

    function updatePlayerUi() {
        const t = state.currentTrack;
        const r = state.currentRadio;

        if (r) {
            els.bar.dataset.mode = 'radio';
            els.playerArt.className = 'music-player-art ' + r.grad;
            els.playerArt.innerHTML = '<i data-feather="radio"></i>';
            els.playerTitle.textContent = r.name;
            els.playerArtist.textContent = r.genre + ' · Live';
            els.nowSource.textContent = 'Live Radio';
            els.nowArt.className = 'music-now-art ' + r.grad;
            els.nowArt.innerHTML = '<i data-feather="radio"></i>';
            els.nowTitle.textContent = r.name;
            els.nowArtist.textContent = r.genre;
        } else if (t) {
            const album = albumOf(t) || { title: '', grad: 'music-cover-grad-1' };
            els.bar.dataset.mode = 'track';
            els.playerArt.className = 'music-player-art ' + album.grad;
            els.playerArt.innerHTML = '<i data-feather="music"></i>';
            els.playerTitle.textContent = t.title;
            els.playerArtist.textContent = artistName(t.artistId) + ' · ' + album.title;
            els.playerLike.setAttribute('aria-pressed', state.liked.has(t.id) ? 'true' : 'false');
            els.nowSource.textContent = album.title;
            els.nowArt.className = 'music-now-art ' + album.grad;
            els.nowArt.innerHTML = '<i data-feather="music"></i>';
            els.nowTitle.textContent = t.title;
            els.nowArtist.textContent = artistName(t.artistId);
        } else {
            els.bar.dataset.mode = 'idle';
            els.playerArt.innerHTML = '<i data-feather="music"></i>';
            els.playerTitle.textContent = 'Select a track to play';
            els.playerArtist.textContent = '—';
        }
        refreshIcons();
    }

    function markPlayingRows() {
        $$('.music-track-row').forEach(row => {
            const isCurrent = state.currentTrack && row.dataset.trackId === state.currentTrack.id;
            row.classList.toggle('playing', !!isCurrent);
            row.classList.toggle('paused', !!isCurrent && !state.isPlaying);
        });
        // playing cards too (album/playlist)
    }

    function setPlayingState(playing) {
        state.isPlaying = playing;
        els.bar.dataset.playing = playing ? 'true' : 'false';
        els.nowModal.dataset.playing = playing ? 'true' : 'false';
        markPlayingRows();
    }

    function updateProgressUi() {
        if (state.isRadio) {
            els.timeCurrent.textContent = '';
            els.timeTotal.textContent = '';
            return;
        }
        const cur = audio.currentTime;
        const dur = audio.duration;
        els.timeCurrent.textContent = fmtTime(cur);
        els.timeTotal.textContent = fmtTime(dur);
        const pct = (dur > 0 ? (cur / dur) * 100 : 0);
        els.progressFill.style.width = pct + '%';
        els.progressThumb.style.left = pct + '%';
        if (els.nowProgressFill) {
            els.nowProgressFill.style.width = pct + '%';
            els.nowTimeCurrent.textContent = fmtTime(cur);
            els.nowTimeTotal.textContent = fmtTime(dur);
        }
        if (els.playerMobileProgress) {
            els.playerMobileProgress.style.setProperty('--mobile-progress', pct + '%');
        }
    }

    function updateBufferUi() {
        try {
            if (audio.buffered.length > 0 && audio.duration > 0) {
                const end = audio.buffered.end(audio.buffered.length - 1);
                els.progressBuffer.style.width = ((end / audio.duration) * 100) + '%';
            }
        } catch (e) { /* noop */ }
    }

    function updateVolumeUi() {
        const v = state.muted ? 0 : state.volume;
        const pct = Math.round(v * 100);
        els.volumeFill.style.width = pct + '%';
        els.volumeThumb.style.left = pct + '%';
        els.ctrlMute.setAttribute('aria-pressed', state.muted || state.volume === 0 ? 'true' : 'false');
    }

    /* ---- queue panel ------------------------------------------------------- */

    function toggleQueue() {
        const open = els.layout.classList.toggle('queue-open');
        els.queueToggle.classList.toggle('active', open);
        els.ctrlQueue.setAttribute('aria-pressed', open ? 'true' : 'false');
        renderQueue();
    }

    function renderQueue() {
        if (!els.queueList) return;
        // Now playing row
        if (state.currentTrack) {
            const t = state.currentTrack;
            const a = albumOf(t) || { grad: 'music-cover-grad-1' };
            els.queueNowPlaying.innerHTML = [
                '<div class="music-queue-cover ', a.grad, '"></div>',
                '<div class="music-queue-meta">',
                    '<div class="music-queue-title">', t.title, '</div>',
                    '<div class="music-queue-artist">', artistName(t.artistId), '</div>',
                '</div>'
            ].join('');
        } else if (state.currentRadio) {
            const r = state.currentRadio;
            els.queueNowPlaying.innerHTML = [
                '<div class="music-queue-cover ', r.grad, '"></div>',
                '<div class="music-queue-meta">',
                    '<div class="music-queue-title">', r.name, '</div>',
                    '<div class="music-queue-artist">Live · ', r.genre, '</div>',
                '</div>'
            ].join('');
        } else {
            els.queueNowPlaying.innerHTML = '<div class="music-queue-meta"><div class="music-queue-title">Nothing playing</div><div class="music-queue-artist">Pick a track to begin</div></div>';
        }
        // Up next
        const upcoming = state.isRadio ? [] : state.queue.slice(state.queueIndex + 1);
        if (!upcoming.length) {
            els.queueList.innerHTML = '<div class="music-empty" style="padding:16px"><span style="font-size:0.8rem">Queue is empty.</span></div>';
        } else {
            els.queueList.innerHTML = upcoming.map((id, i) => {
                const t = trackById(id);
                if (!t) return '';
                const a = albumOf(t) || { grad: 'music-cover-grad-1' };
                return [
                    '<div class="music-queue-row" data-queue-jump="', (state.queueIndex + 1 + i), '">',
                        '<div class="music-queue-cover ', a.grad, '"></div>',
                        '<div class="music-queue-meta">',
                            '<div class="music-queue-title">', t.title, '</div>',
                            '<div class="music-queue-artist">', artistName(t.artistId), '</div>',
                        '</div>',
                    '</div>'
                ].join('');
            }).join('');
        }
    }

    /* ---- pointer drag for sliders ----------------------------------------- */

    function attachSlider(track, onPct) {
        if (!track) return;
        let dragging = false;

        function pctFrom(evt) {
            const rect = track.getBoundingClientRect();
            const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
            return Math.max(0, Math.min(1, x / rect.width));
        }

        function onDown(evt) {
            dragging = true;
            onPct(pctFrom(evt));
            evt.preventDefault();
        }
        function onMove(evt) { if (dragging) onPct(pctFrom(evt)); }
        function onUp() { dragging = false; }

        track.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        track.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);
        // simple click also handled via mousedown
    }

    /* ---- delegated event handlers ----------------------------------------- */

    function onTrackListClick(evt) {
        const likeBtn = evt.target.closest('[data-like]');
        if (likeBtn) {
            evt.stopPropagation();
            const id = likeBtn.dataset.like;
            if (state.liked.has(id)) state.liked.delete(id); else state.liked.add(id);
            likeBtn.classList.toggle('liked', state.liked.has(id));
            // Refresh liked view if currently visible
            if (state.currentView === 'liked') renderLiked();
            // sync the player like button if it's the current track
            if (state.currentTrack && state.currentTrack.id === id) {
                els.playerLike.setAttribute('aria-pressed', state.liked.has(id) ? 'true' : 'false');
            }
            refreshIcons();
            return;
        }
        const row = evt.target.closest('.music-track-row');
        if (!row) return;
        const id = row.dataset.trackId;
        const queueFrom = row.dataset.queueFrom || '';
        // Build queue from the same list this row is in
        const list = Array.from(row.parentElement.querySelectorAll('.music-track-row')).map(r => r.dataset.trackId);
        const idx = list.indexOf(id);
        playFromList(list, idx, queueFrom);
    }

    function onCardClick(evt) {
        // album play button
        const albumPlay = evt.target.closest('[data-album-play]');
        if (albumPlay) {
            evt.stopPropagation();
            const album = ALBUMS.find(a => a.id === albumPlay.dataset.albumPlay);
            if (album) {
                const ids = TRACKS.filter(t => t.albumId === album.id).map(t => t.id);
                playFromList(ids, 0, 'album:' + album.id);
            }
            return;
        }
        // radio play
        const radioPlay = evt.target.closest('[data-radio-play]');
        if (radioPlay) {
            evt.stopPropagation();
            const station = RADIO_STATIONS.find(r => r.id === radioPlay.dataset.radioPlay);
            if (station) loadRadio(station);
            return;
        }
        // mix play (uses trending list as a stub)
        const mixPlay = evt.target.closest('[data-mix-play]');
        if (mixPlay) {
            evt.stopPropagation();
            const ids = TRACKS.slice(0, 10).map(t => t.id);
            playFromList(ids, 0, 'mix:' + mixPlay.dataset.mixPlay);
            return;
        }
        // open album view
        const albumCard = evt.target.closest('[data-album-id]');
        if (albumCard) {
            const album = ALBUMS.find(a => a.id === albumCard.dataset.albumId);
            if (album) {
                renderAlbumView(album);
                showView('album', { albumId: album.id });
            }
            return;
        }
        // radio card click without play button → also tune in
        const radioCard = evt.target.closest('[data-radio-id]');
        if (radioCard) {
            const station = RADIO_STATIONS.find(r => r.id === radioCard.dataset.radioId);
            if (station) loadRadio(station);
        }
    }

    /* ---- init -------------------------------------------------------------- */

    function init() {
        // Initial volume
        audio.volume = state.volume;
        audio.preload = 'metadata';
        updateVolumeUi();
        els.bar.dataset.playing = 'false';
        els.bar.dataset.mode = 'idle';

        // Render all views
        renderBrowse();
        renderTracks('all');
        renderAlbums();
        renderArtists();
        renderRadio();
        renderLiked();
        renderRecent();
        renderQueue();
        refreshIcons();

        // Sidebar nav
        els.navItems.forEach(b => {
            b.addEventListener('click', () => {
                const v = b.dataset.view;
                if (!v) return;
                if (v === 'tracks') renderTracks('all');
                if (v === 'liked') renderLiked();
                showView(v);
            });
        });

        // Playlist nav
        els.playlistItems.forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.playlist;
                const pl = PLAYLISTS.find(p => p.id === id);
                if (pl) {
                    renderPlaylistView(pl);
                    showView('playlist', { playlistId: id });
                }
            });
        });

        // Topbar nav
        els.navBack.addEventListener('click', navigateBack);
        els.navForward.addEventListener('click', navigateForward);

        // Tracks view filter tabs
        const tabsHost = $('.music-tabs');
        if (tabsHost) {
            tabsHost.addEventListener('click', e => {
                const b = e.target.closest('[data-filter]');
                if (!b) return;
                tabsHost.querySelectorAll('.glass-tab').forEach(t => t.classList.remove('active'));
                b.classList.add('active');
                renderTracks(b.dataset.filter);
                refreshIcons();
            });
        }

        // Hero / playlist / album play buttons
        $$('[data-track-id]').forEach(el => {
            // ignore .music-track-row (handled by delegation)
            if (el.classList.contains('music-track-row')) return;
            el.addEventListener('click', () => {
                const id = el.dataset.trackId;
                const t = trackById(id);
                if (t) playFromList(TRACKS.map(x => x.id), TRACKS.findIndex(x => x.id === id), 'all');
            });
        });
        if (els.playlistPlayBtn) {
            els.playlistPlayBtn.addEventListener('click', () => {
                if (!state.currentPlaylist) return;
                playFromList(state.currentPlaylist.trackIds.slice(), 0, 'playlist:' + state.currentPlaylist.id);
            });
        }
        if (els.albumPlayBtn) {
            els.albumPlayBtn.addEventListener('click', () => {
                if (!state.currentAlbum) return;
                const ids = TRACKS.filter(t => t.albumId === state.currentAlbum.id).map(t => t.id);
                playFromList(ids, 0, 'album:' + state.currentAlbum.id);
            });
        }

        // Track-list delegation for every list container
        ['allTracks', 'trendingTracks', 'likedTracks', 'recentTracks', 'playlistTracks', 'albumTracks'].forEach(k => {
            if (els[k]) els[k].addEventListener('click', onTrackListClick);
        });

        // Card-grid delegation
        ['featuredAlbums', 'madeForYou', 'allAlbums', 'allArtists', 'radioStations'].forEach(k => {
            if (els[k]) els[k].addEventListener('click', onCardClick);
        });

        // Sidebar mobile
        if (els.sidebarToggle) els.sidebarToggle.addEventListener('click', openSidebar);
        if (els.sidebarClose) els.sidebarClose.addEventListener('click', closeSidebar);
        if (els.sidebarBackdrop) els.sidebarBackdrop.addEventListener('click', closeSidebar);

        // Queue toggle
        if (els.queueToggle) els.queueToggle.addEventListener('click', toggleQueue);
        if (els.ctrlQueue) els.ctrlQueue.addEventListener('click', toggleQueue);
        if (els.queueClose) els.queueClose.addEventListener('click', () => {
            els.layout.classList.remove('queue-open');
            els.queueToggle.classList.remove('active');
            els.ctrlQueue.setAttribute('aria-pressed', 'false');
        });
        if (els.queueList) {
            els.queueList.addEventListener('click', e => {
                const row = e.target.closest('[data-queue-jump]');
                if (!row) return;
                const idx = parseInt(row.dataset.queueJump, 10);
                if (!isFinite(idx) || idx < 0 || idx >= state.queue.length) return;
                state.queueIndex = idx;
                const t = trackById(state.queue[idx]);
                if (t) loadTrack(t);
                renderQueue();
            });
        }

        // Player controls
        els.ctrlPlay.addEventListener('click', togglePlay);
        els.ctrlNext.addEventListener('click', nextTrack);
        els.ctrlPrev.addEventListener('click', prevTrack);
        els.ctrlShuffle.addEventListener('click', () => {
            state.shuffle = !state.shuffle;
            els.ctrlShuffle.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false');
        });
        els.ctrlRepeat.addEventListener('click', () => {
            state.repeatMode = state.repeatMode === 'off' ? 'all'
                            : state.repeatMode === 'all' ? 'one' : 'off';
            audio.loop = state.repeatMode === 'one';
            els.ctrlRepeat.dataset.mode = state.repeatMode;
            els.ctrlRepeat.setAttribute('aria-pressed', state.repeatMode !== 'off' ? 'true' : 'false');
        });
        els.ctrlMute.addEventListener('click', () => {
            state.muted = !state.muted;
            audio.muted = state.muted;
            updateVolumeUi();
        });

        // Like current track
        els.playerLike.addEventListener('click', () => {
            if (!state.currentTrack) return;
            const id = state.currentTrack.id;
            if (state.liked.has(id)) state.liked.delete(id);
            else state.liked.add(id);
            els.playerLike.setAttribute('aria-pressed', state.liked.has(id) ? 'true' : 'false');
            // sync any visible row
            const row = document.querySelector('[data-track-id="' + id + '"] [data-like]');
            if (row) row.classList.toggle('liked', state.liked.has(id));
            if (state.currentView === 'liked') renderLiked();
            refreshIcons();
        });

        // Sliders
        attachSlider(els.progressTrack, pct => {
            if (state.isRadio) return;
            if (audio.duration > 0) audio.currentTime = pct * audio.duration;
        });
        attachSlider(els.volumeTrack, pct => {
            state.volume = pct;
            state.muted = false;
            audio.muted = false;
            audio.volume = pct;
            updateVolumeUi();
        });
        attachSlider(els.nowProgressTrack, pct => {
            if (state.isRadio) return;
            if (audio.duration > 0) audio.currentTime = pct * audio.duration;
        });

        // Now-playing modal expand / mobile track tap
        const Modal = window.bootstrap && window.bootstrap.Modal;
        let modalInst = null;
        function openNowModal() {
            if (!Modal || !els.nowModal) return;
            modalInst = modalInst || new Modal(els.nowModal);
            modalInst.show();
        }
        if (els.ctrlExpand) els.ctrlExpand.addEventListener('click', openNowModal);
        const playerTrackBox = els.bar.querySelector('.music-player-track');
        if (playerTrackBox) {
            playerTrackBox.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 767.98px)').matches) openNowModal();
            });
        }

        // Now-playing modal controls mirror player bar
        if (els.nowPlay) els.nowPlay.addEventListener('click', togglePlay);
        if (els.nowNext) els.nowNext.addEventListener('click', nextTrack);
        if (els.nowPrev) els.nowPrev.addEventListener('click', prevTrack);
        if (els.nowShuffle) els.nowShuffle.addEventListener('click', () => els.ctrlShuffle.click());
        if (els.nowRepeat) els.nowRepeat.addEventListener('click', () => els.ctrlRepeat.click());

        // Search filter (basic — filters track list views)
        if (els.search) {
            els.search.addEventListener('input', () => {
                const q = els.search.value.trim().toLowerCase();
                if (!q) { renderTracks('all'); return; }
                const list = TRACKS.filter(t => {
                    const album = albumOf(t);
                    const artist = artistName(t.artistId);
                    return t.title.toLowerCase().includes(q)
                        || (artist && artist.toLowerCase().includes(q))
                        || (album && album.title.toLowerCase().includes(q));
                });
                if (els.allTracks) {
                    els.allTracks.innerHTML = list.length
                        ? list.map((t, i) => trackRowHtml(t, i, { queue: 'search' })).join('')
                        : '<div class="music-empty"><div class="music-empty-icon"><i data-feather="search"></i></div><h6>No matches</h6><p>Try a different artist, album, or track name.</p></div>';
                }
                refreshIcons();
                showView('tracks');
            });
        }

        // Audio events
        audio.addEventListener('play', () => setPlayingState(true));
        audio.addEventListener('pause', () => setPlayingState(false));
        audio.addEventListener('ended', () => {
            if (state.repeatMode === 'one') { audio.currentTime = 0; playAudio(); return; }
            nextTrack();
        });
        audio.addEventListener('timeupdate', updateProgressUi);
        audio.addEventListener('durationchange', updateProgressUi);
        audio.addEventListener('progress', updateBufferUi);
        audio.addEventListener('loadedmetadata', updateProgressUi);
        audio.addEventListener('error', () => {
            els.ctrlPlay.classList.remove('loading');
        });

        // Initial state
        state.history = [{ view: 'browse', opts: {} }];
        state.historyIndex = 0;
        updateNavArrows();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
