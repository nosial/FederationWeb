/**
 * Liquid Elegance — Core Application
 * Bootstrap 5 Admin Template with Liquid Glass Design
 *
 * This file must be loaded before all other Liquid Elegance scripts.
 * Dependencies: Bootstrap 5, Feather Icons (optional)
 */
window.LiquidElegance = window.LiquidElegance || {};

(function (LE) {
    'use strict';

    // ─── Defaults ────────────────────────────────────────────────────────
    var STORAGE_KEY = 'liquid_elegance_prefs';

    var DEFAULTS = {
        themeMode: 'light',
        themeColor: 'default',
        density: 'default',
        rtl: false,
        layout: 'sidebar',
        layoutWidth: 'fluid'
    };

    var VALID = {
        themeMode: ['dark', 'light', 'system'],
        themeColor: ['default', 'ocean', 'sunset', 'forest', 'berry', 'slate', 'ruby', 'amber', 'rose', 'midnight', 'coral', 'sage'],
        density: ['compact', 'default', 'comfortable'],
        layout: ['sidebar', 'horizontal'],
        layoutWidth: ['fluid', 'boxed']
    };

    // Only purely visual prefs are persisted across pages. Structural prefs
    // (layout, layoutWidth, rtl) are tied to the SSR-rendered markup and would
    // clobber the document if a stale value was applied on a later page load.
    // They still update live within the current session via the customizer.
    var PERSIST_KEYS = ['themeMode', 'themeColor', 'density'];

    /** @type {MediaQueryList|null} */
    var _darkMql = null;

    /** @type {Object} Current preferences */
    var _prefs = {};

    // ─── LocalStorage utilities ──────────────────────────────────────────

    /**
     * Read the persisted prefs from localStorage, keeping only the safe keys
     * defined in PERSIST_KEYS. Silently sanitizes (and rewrites) any stale
     * structural keys left behind by older versions of the customizer.
     * @returns {Object} Partial object containing only safe keys.
     */
    function loadPersistedPrefs() {
        var safe = {};
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return safe;
            var saved = JSON.parse(raw) || {};
            var hadUnsafeKeys = false;
            Object.keys(saved).forEach(function (key) {
                if (PERSIST_KEYS.indexOf(key) !== -1) {
                    safe[key] = saved[key];
                } else {
                    hadUnsafeKeys = true;
                }
            });
            if (hadUnsafeKeys) {
                // One-time cleanup: rewrite storage with only the safe subset.
                localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
            }
        } catch (_) { /* ignore parse / storage errors */ }
        return safe;
    }

    /**
     * Read the SSR-rendered HTML attributes as the layout source of truth.
     * @returns {Object}
     */
    function readHtmlPrefs() {
        var el = root();
        return {
            themeMode: el.getAttribute('data-theme') || DEFAULTS.themeMode,
            themeColor: el.getAttribute('data-theme-color') || DEFAULTS.themeColor,
            density: el.getAttribute('data-density') || DEFAULTS.density,
            layout: el.getAttribute('data-layout') || DEFAULTS.layout,
            layoutWidth: el.getAttribute('data-layout-width') || DEFAULTS.layoutWidth,
            rtl: el.getAttribute('dir') === 'rtl'
        };
    }

    /**
     * Persist the safe subset of the current prefs to localStorage. No-ops on
     * variant pages (their state is baked into the SSR markup).
     */
    function savePrefs() {
        if (isVariantPage()) return;
        try {
            var safe = {};
            PERSIST_KEYS.forEach(function (key) {
                if (_prefs[key] !== undefined) safe[key] = _prefs[key];
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
        } catch (_) { /* storage full / disabled */ }
    }

    // ─── DOM utilities ───────────────────────────────────────────────────

    /** @returns {HTMLElement} */
    function root() {
        return document.documentElement;
    }

    /**
     * Resolve the effective theme ("dark" or "light") considering "system" mode.
     * @param {string} mode
     * @returns {string}
     */
    function resolveTheme(mode) {
        if (mode === 'system') {
            return _darkMql && _darkMql.matches ? 'dark' : 'light';
        }
        return mode === 'dark' ? 'dark' : 'light';
    }

    /**
     * Apply all current preferences to the <html> element.
     */
    function applyAll() {
        var el = root();
        el.setAttribute('data-theme', resolveTheme(_prefs.themeMode));
        el.setAttribute('data-theme-color', _prefs.themeColor);
        el.setAttribute('data-density', _prefs.density);
        el.setAttribute('data-layout', _prefs.layout);
        el.setAttribute('data-layout-width', _prefs.layoutWidth);
        el.dir = _prefs.rtl ? 'rtl' : 'ltr';
    }

    // ─── System theme detection ──────────────────────────────────────────

    function initSystemThemeListener() {
        if (!window.matchMedia) return;
        _darkMql = window.matchMedia('(prefers-color-scheme: dark)');

        var handler = function () {
            if (_prefs.themeMode === 'system') {
                root().setAttribute('data-theme', resolveTheme('system'));
                document.dispatchEvent(new CustomEvent('liquidelegance:themechange'));
            }
        };

        if (_darkMql.addEventListener) {
            _darkMql.addEventListener('change', handler);
        } else if (_darkMql.addListener) {
            _darkMql.addListener(handler);
        }
    }

    // ─── Bootstrap component initialization ──────────────────────────────

    function initTooltips() {
        var nodes = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        nodes.forEach(function (el) {
            new bootstrap.Tooltip(el);
        });
    }

    function initPopovers() {
        var nodes = document.querySelectorAll('[data-bs-toggle="popover"]');
        nodes.forEach(function (el) {
            new bootstrap.Popover(el);
        });
    }

    // ─── Feather Icons ───────────────────────────────────────────────────

    /**
     * Replace feather icon placeholders. Safe to call repeatedly.
     */
    function replaceIcons() {
        if (typeof feather !== 'undefined' && feather.replace) {
            feather.replace();
        }
    }

    // ─── Page transitions ────────────────────────────────────────────────

    function initPageTransition() {
        document.body.classList.add('le-page-loaded');
    }

    // ─── Toast container ─────────────────────────────────────────────────

    var _toastContainer = null;

    function getToastContainer() {
        if (_toastContainer && document.body.contains(_toastContainer)) {
            return _toastContainer;
        }
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        _toastContainer.style.zIndex = '1090';
        document.body.appendChild(_toastContainer);
        return _toastContainer;
    }

    // ─── Public API ──────────────────────────────────────────────────────

    /**
     * Set the theme mode.
     * @param {'dark'|'light'|'system'} mode
     */
    LE.setThemeMode = function (mode) {
        if (VALID.themeMode.indexOf(mode) === -1) return;
        _prefs.themeMode = mode;
        root().setAttribute('data-theme', resolveTheme(mode));
        savePrefs();
        document.dispatchEvent(new CustomEvent('liquidelegance:themechange'));
    };

    /**
     * Set the theme color preset.
     * @param {'default'|'ocean'|'sunset'|'forest'|'berry'|'slate'} color
     */
    LE.setThemeColor = function (color) {
        if (VALID.themeColor.indexOf(color) === -1) return;
        _prefs.themeColor = color;
        root().setAttribute('data-theme-color', color);
        savePrefs();
        document.dispatchEvent(new CustomEvent('liquidelegance:themechange'));
    };

    /**
     * Set the UI density.
     * @param {'compact'|'default'|'comfortable'} density
     */
    LE.setDensity = function (density) {
        if (VALID.density.indexOf(density) === -1) return;
        _prefs.density = density;
        root().setAttribute('data-density', density);
        savePrefs();
        document.dispatchEvent(new CustomEvent('liquidelegance:densitychange'));
    };

    /**
     * Toggle right-to-left layout.
     * @param {boolean} enabled
     */
    LE.setRTL = function (enabled) {
        _prefs.rtl = !!enabled;
        root().dir = _prefs.rtl ? 'rtl' : 'ltr';
        savePrefs();
    };

    /**
     * Set the layout type.
     * @param {'sidebar'|'horizontal'} layout
     */
    LE.setLayout = function (layout) {
        if (VALID.layout.indexOf(layout) === -1) return;
        _prefs.layout = layout;
        root().setAttribute('data-layout', layout);
        savePrefs();
        document.dispatchEvent(new CustomEvent('liquidelegance:layoutchange'));
    };

    /**
     * Set the layout width.
     * @param {'fluid'|'boxed'} width
     */
    LE.setLayoutWidth = function (width) {
        if (VALID.layoutWidth.indexOf(width) === -1) return;
        _prefs.layoutWidth = width;
        root().setAttribute('data-layout-width', width);
        savePrefs();
    };

    /**
     * Get current preference value.
     * @param {string} key
     * @returns {*}
     */
    LE.getPref = function (key) {
        return _prefs[key];
    };

    /**
     * Get all current preferences (shallow copy).
     * @returns {Object}
     */
    LE.getPrefs = function () {
        return Object.assign({}, _prefs);
    };

    /**
     * Reset all preferences to defaults and apply.
     */
    LE.resetPrefs = function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
        _prefs = Object.assign({}, DEFAULTS, readHtmlPrefs());
        applyAll();
        document.dispatchEvent(new CustomEvent('liquidelegance:themechange'));
        document.dispatchEvent(new CustomEvent('liquidelegance:layoutchange'));
    };

    /**
     * Re-initialize feather icons (call after injecting dynamic content).
     */
    LE.refreshIcons = function () {
        replaceIcons();
    };

    // ─── Utility methods ─────────────────────────────────────────────────

    /**
     * Show a Bootstrap 5 toast notification.
     * @param {string} message - Toast body text (may contain HTML)
     * @param {'primary'|'success'|'warning'|'danger'|'info'} [type='primary']
     * @param {number} [delay=4000] - Auto-hide delay in ms
     */
    LE.showToast = function (message, type, delay) {
        type = type || 'primary';
        delay = delay || 4000;

        var icons = {
            primary: 'info',
            success: 'check-circle',
            warning: 'alert-triangle',
            danger: 'alert-circle',
            info: 'info'
        };
        var iconName = icons[type] || 'info';

        // Render the leading icon inline so we don't have to re-scan the entire
        // document with feather.replace() every time a toast appears.
        var iconSvg;
        if (typeof feather !== 'undefined' && feather.icons && feather.icons[iconName]) {
            iconSvg = feather.icons[iconName].toSvg({ class: 'me-2', width: 16, height: 16 });
        } else {
            iconSvg = '<i data-feather="' + iconName + '" class="me-2" style="width:16px;height:16px"></i>';
        }

        var wrapper = document.createElement('div');
        wrapper.className = 'toast align-items-center text-bg-' + type + ' border-0';
        wrapper.setAttribute('role', 'alert');
        wrapper.setAttribute('aria-live', 'assertive');
        wrapper.setAttribute('aria-atomic', 'true');

        wrapper.innerHTML =
            '<div class="d-flex">' +
            '  <div class="toast-body">' + iconSvg +
                 message +
            '  </div>' +
            '  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
            '</div>';

        getToastContainer().appendChild(wrapper);
        // Only fall back to a full sweep if we couldn't render the icon inline.
        if (iconSvg.indexOf('data-feather') !== -1) replaceIcons();

        var toast = new bootstrap.Toast(wrapper, { delay: delay });
        toast.show();

        wrapper.addEventListener('hidden.bs.toast', function () {
            wrapper.remove();
        });
    };

    // ─── Horizontal nav height sync ─────────────────────────────────────

    /**
     * In horizontal layout, sync main-content padding-top to the actual
     * combined height of the fixed topbar + horizontal nav bar.
     * This runs on layout change, density change, and window resize.
     */
    function syncHorizontalPadding() {
        var el = root();
        if (el.getAttribute('data-layout') !== 'horizontal') return;
        if (window.innerWidth < 992) return;

        var topbar = document.querySelector('.topbar');
        var sidebar = document.querySelector('.sidebar');
        var mainContent = document.querySelector('.main-content');
        if (!topbar || !sidebar || !mainContent) return;

        var total = topbar.offsetHeight + sidebar.offsetHeight;
        mainContent.style.paddingTop = total + 'px';
    }

    function clearHorizontalPadding() {
        var mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.paddingTop = '';
    }

    function onLayoutOrDensityChange() {
        var el = root();
        if (el.getAttribute('data-layout') === 'horizontal' && window.innerWidth >= 992) {
            requestAnimationFrame(function () {
                requestAnimationFrame(syncHorizontalPadding);
            });
        } else {
            clearHorizontalPadding();
        }
    }

    // ─── Horizontal nav dropdown menus ──────────────────────────────────

    function initHorizontalNav() {
        var sections = document.querySelectorAll('.sidebar-nav-section');
        if (!sections.length) return;

        function positionMenu(section) {
            var menu = section.querySelector('.sidebar-menu');
            if (!menu) return;

            // CSS handles base positioning (top:100%; left:0 relative to section).
            // Clear any leftover inline overrides so CSS takes effect.
            menu.style.top = '';
            menu.style.left = '';

            // Clamp: if the menu overflows the right edge of the viewport, nudge it left.
            requestAnimationFrame(function () {
                var menuRect = menu.getBoundingClientRect();
                var overflow = menuRect.right - (window.innerWidth - 8);
                if (overflow > 0) {
                    menu.style.left = -overflow + 'px';
                }
            });
        }

        function closeAll(except) {
            sections.forEach(function (s) {
                if (s !== except) {
                    s.classList.remove('hnav-open');
                    var m = s.querySelector('.sidebar-menu');
                    if (m) { m.style.top = ''; m.style.left = ''; }
                }
            });
        }

        sections.forEach(function (section) {
            var label = section.querySelector('.sidebar-nav-label');
            if (!label) return;

            label.addEventListener('click', function (e) {
                if (root().getAttribute('data-layout') !== 'horizontal') return;
                if (window.innerWidth < 992) return;
                e.preventDefault();
                e.stopPropagation();

                var isOpen = section.classList.contains('hnav-open');
                closeAll();
                if (!isOpen) {
                    section.classList.add('hnav-open');
                    positionMenu(section);
                }
            });
        });

        // Close on click outside
        document.addEventListener('click', function (e) {
            if (root().getAttribute('data-layout') !== 'horizontal') return;
            if (!e.target.closest('.sidebar-nav-section')) {
                closeAll();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll();
        });

        // Close on scroll
        var sidebarBody = document.querySelector('.sidebar-body');
        if (sidebarBody) {
            sidebarBody.addEventListener('scroll', function () {
                closeAll();
            }, { passive: true });
        }

        // Close when a link is clicked
        document.querySelectorAll('.sidebar-link').forEach(function (link) {
            link.addEventListener('click', function () {
                closeAll();
            });
        });
    }

    // ─── Initialisation ──────────────────────────────────────────────────

    /**
     * Detect if this is a pre-built variant page (data-variant on <html>).
     * Variant pages have their theme baked in and should not be overridden.
     */
    function isVariantPage() {
        return root().hasAttribute('data-variant');
    }

    function init() {
        var fromHtml = readHtmlPrefs();
        if (isVariantPage()) {
            // Variant pages: HTML attrs are authoritative; never read storage.
            _prefs = Object.assign({}, DEFAULTS, fromHtml);
        } else {
            // Full build: HTML attrs are the structural baseline (the page
            // was rendered for that layout). Overlay only the safe persisted
            // visual prefs on top.
            _prefs = Object.assign({}, DEFAULTS, fromHtml, loadPersistedPrefs());
        }
        initSystemThemeListener();
        applyAll();
        replaceIcons();

        if (typeof bootstrap !== 'undefined') {
            initTooltips();
            initPopovers();
        }

        initPageTransition();
        initHorizontalNav();

        // Sync horizontal nav height (resize is rAF-throttled to coalesce
        // the rapid event burst that fires during a window drag).
        document.addEventListener('liquidelegance:layoutchange', onLayoutOrDensityChange);
        document.addEventListener('liquidelegance:densitychange', onLayoutOrDensityChange);
        var _resizeRaf = 0;
        window.addEventListener('resize', function () {
            if (_resizeRaf) return;
            _resizeRaf = requestAnimationFrame(function () {
                _resizeRaf = 0;
                if (root().getAttribute('data-layout') === 'horizontal') {
                    onLayoutOrDensityChange();
                }
            });
        }, { passive: true });
        onLayoutOrDensityChange();

        document.dispatchEvent(new CustomEvent('liquidelegance:ready'));
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.LiquidElegance);
