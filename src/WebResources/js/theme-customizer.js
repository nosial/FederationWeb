/**
 * Liquid Elegance — Theme Customizer Panel
 * Injects a slide-out settings panel that lets users change theme, color,
 * density, layout, RTL, and width in real time.
 *
 * Requires: src/js/app.js (loaded first)
 */
(function (LE) {
    'use strict';

    /** @type {HTMLElement|null} */ var _panel = null;
    /** @type {HTMLElement|null} */ var _overlay = null;
    var _open = false;

    // ─── Color swatches ──────────────────────────────────────────────────

    var COLOR_PRESETS = [
        { id: 'default', label: 'Default',  swatch: '#0d9488' },
        { id: 'ocean',   label: 'Ocean',    swatch: '#0ea5e9' },
        { id: 'sunset',  label: 'Sunset',   swatch: '#f97316' },
        { id: 'forest',  label: 'Forest',   swatch: '#16a34a' },
        { id: 'berry',   label: 'Berry',    swatch: '#9333ea' },
        { id: 'slate',   label: 'Slate',    swatch: '#64748b' },
        { id: 'ruby',    label: 'Ruby',     swatch: '#dc2626' },
        { id: 'amber',   label: 'Amber',    swatch: '#ca8a04' },
        { id: 'rose',    label: 'Rose',     swatch: '#ec4899' },
        { id: 'midnight',label: 'Midnight', swatch: '#4338ca' },
        { id: 'coral',   label: 'Coral',    swatch: '#ef6461' },
        { id: 'sage',    label: 'Sage',     swatch: '#6b8f71' }
    ];

    // ─── Build HTML ──────────────────────────────────────────────────────

    function buildPanel() {
        // Overlay
        _overlay = document.createElement('div');
        _overlay.className = 'customizer-overlay';
        _overlay.addEventListener('click', close);

        // Panel
        _panel = document.createElement('div');
        _panel.className = 'customizer-panel';
        _panel.setAttribute('role', 'dialog');
        _panel.setAttribute('aria-label', 'Theme Customizer');

        _panel.innerHTML = [
            '<div class="customizer-header">',
            '  <h6 class="mb-0">Theme Customizer</h6>',
            '  <button type="button" class="btn-close customizer-close" aria-label="Close"></button>',
            '</div>',
            '<div class="customizer-body">',

            // Theme mode
            '  <div class="customizer-section">',
            '    <label class="customizer-label">Appearance</label>',
            '    <div class="btn-group w-100" role="group" aria-label="Theme mode">',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-mode="light">Light</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-mode="dark">Dark</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-mode="system">System</button>',
            '    </div>',
            '  </div>',

            // Color preset
            '  <div class="customizer-section">',
            '    <label class="customizer-label">Theme Color</label>',
            '    <div class="customizer-colors">' + buildColorSwatches() + '</div>',
            '  </div>',

            // Density
            '  <div class="customizer-section">',
            '    <label class="customizer-label">Density</label>',
            '    <div class="btn-group w-100" role="group" aria-label="Density">',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-density="compact">Compact</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-density="default">Default</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-density="comfortable">Comfortable</button>',
            '    </div>',
            '  </div>',

            // Layout
            '  <div class="customizer-section">',
            '    <label class="customizer-label">Layout</label>',
            '    <div class="btn-group w-100" role="group" aria-label="Layout">',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-layout="sidebar">Sidebar</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-layout="horizontal">Horizontal</button>',
            '    </div>',
            '  </div>',

            // Layout width
            '  <div class="customizer-section">',
            '    <label class="customizer-label">Layout Width</label>',
            '    <div class="btn-group w-100" role="group" aria-label="Layout Width">',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-width="fluid">Fluid</button>',
            '      <button type="button" class="btn btn-outline-secondary btn-sm" data-set-width="boxed">Boxed</button>',
            '    </div>',
            '  </div>',

            // RTL
            '  <div class="customizer-section">',
            '    <label class="customizer-label d-flex align-items-center justify-content-between">',
            '      Direction (RTL)',
            '      <div class="form-check form-switch mb-0">',
            '        <input class="form-check-input" type="checkbox" id="customizerRtl">',
            '      </div>',
            '    </label>',
            '  </div>',

            // Reset
            '  <div class="customizer-section">',
            '    <button type="button" class="btn btn-outline-danger btn-sm w-100" id="customizerReset">Reset to Defaults</button>',
            '  </div>',

            '</div>' // .customizer-body
        ].join('\n');

        document.body.appendChild(_overlay);
        document.body.appendChild(_panel);
    }

    function buildColorSwatches() {
        return COLOR_PRESETS.map(function (c) {
            return '<button type="button" class="customizer-color-btn" data-set-color="' +
                c.id + '" title="' + c.label + '" style="background:' + c.swatch + '"></button>';
        }).join('');
    }

    // ─── Floating Action Button ──────────────────────────────────────────

    function createFab() {
        var btn = document.createElement('button');
        btn.className = 'customizer-fab';
        btn.setAttribute('aria-label', 'Open Theme Customizer');
        btn.setAttribute('title', 'Theme Customizer (Ctrl+Shift+T)');
        btn.innerHTML = '<i data-feather="settings"></i>';
        btn.addEventListener('click', function () { toggle(); });
        document.body.appendChild(btn);
    }

    // ─── Open / Close ────────────────────────────────────────────────────

    function open() {
        if (_open) return;
        _open = true;
        _panel.classList.add('open');
        _overlay.classList.add('show');
        syncUI();
    }

    function close() {
        if (!_open) return;
        _open = false;
        _panel.classList.remove('open');
        _overlay.classList.remove('show');
    }

    /**
     * Toggle the customizer panel.
     */
    function toggle() {
        _open ? close() : open();
    }

    LE.toggleCustomizer = toggle;

    // ─── Sync UI to current preferences ──────────────────────────────────

    function syncUI() {
        if (!_panel) return;
        var prefs = LE.getPrefs ? LE.getPrefs() : {};

        // Mode buttons
        _panel.querySelectorAll('[data-set-mode]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-set-mode') === prefs.themeMode);
        });

        // Color buttons
        _panel.querySelectorAll('[data-set-color]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-set-color') === prefs.themeColor);
        });

        // Density
        _panel.querySelectorAll('[data-set-density]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-set-density') === prefs.density);
        });

        // Layout
        _panel.querySelectorAll('[data-set-layout]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-set-layout') === prefs.layout);
        });

        // Width
        _panel.querySelectorAll('[data-set-width]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-set-width') === prefs.layoutWidth);
        });

        // RTL
        var rtlCheck = _panel.querySelector('#customizerRtl');
        if (rtlCheck) rtlCheck.checked = !!prefs.rtl;
    }

    // ─── Bind events ─────────────────────────────────────────────────────

    function bindEvents() {
        // Theme mode
        _panel.querySelectorAll('[data-set-mode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                LE.setThemeMode(btn.getAttribute('data-set-mode'));
                syncUI();
            });
        });

        // Color
        _panel.querySelectorAll('[data-set-color]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                LE.setThemeColor(btn.getAttribute('data-set-color'));
                syncUI();
            });
        });

        // Density
        _panel.querySelectorAll('[data-set-density]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                LE.setDensity(btn.getAttribute('data-set-density'));
                syncUI();
            });
        });

        // Layout
        _panel.querySelectorAll('[data-set-layout]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                LE.setLayout(btn.getAttribute('data-set-layout'));
                syncUI();
            });
        });

        // Width
        _panel.querySelectorAll('[data-set-width]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                LE.setLayoutWidth(btn.getAttribute('data-set-width'));
                syncUI();
            });
        });

        // RTL
        var rtlCheck = _panel.querySelector('#customizerRtl');
        if (rtlCheck) {
            rtlCheck.addEventListener('change', function () {
                LE.setRTL(rtlCheck.checked);
            });
        }

        // Reset
        var resetBtn = _panel.querySelector('#customizerReset');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                LE.resetPrefs();
                syncUI();
            });
        }

        // Close button
        _panel.querySelector('.customizer-close').addEventListener('click', close);

        // Keyboard shortcut: Ctrl+Shift+T
        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                toggle();
            }
        });

        // Escape to close
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _open) {
                close();
            }
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────

    function init() {
        buildPanel();
        createFab();
        bindEvents();
        syncUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.LiquidElegance);
