/**
 * Liquid Elegance — Sidebar Navigation
 * Handles desktop collapse, mobile overlay, backdrop, active state,
 * saved state restoration, responsive behaviour, and Escape key.
 *
 * Uses the window.LiquidElegance namespace. No jQuery.
 */
(function (LE) {
    'use strict';

    var STORAGE_KEY = 'liquid_elegance_sidebar_collapsed';
    var SECTION_STORAGE_KEY = 'liquid_elegance_sidebar_sections';
    var MOBILE_BP  = 992; // lg breakpoint in px

    // ─── Internal methods ────────────────────────────────────────────────

    function isMobile() {
        return window.innerWidth < MOBILE_BP;
    }

    function saveCollapsed(collapsed) {
        try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch (_) {}
    }

    function loadCollapsed() {
        try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
    }

    function enableSidebarTransitions() {
        if (!document.body) return;

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                document.body.classList.add('le-sidebar-ready');
            });
        });
    }

    // ─── Desktop collapse toggle ─────────────────────────────────────────

    function toggleDesktopCollapse() {
        var isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        saveCollapsed(isCollapsed);
    }

    // ─── Mobile sidebar open / close ─────────────────────────────────────

    function openMobileSidebar() {
        document.body.classList.add('sidebar-open');
    }

    function closeMobileSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    function toggleMobileSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    }

    // ─── Active menu item highlighting ───────────────────────────────────

    function setActiveMenuItem() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Current page filename (e.g. "buttons.html")
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';

        var links = sidebar.querySelectorAll('.sidebar-link');
        var bestMatch = null;
        var bestLength = 0;

        // Remove existing active classes and find the best match
        links.forEach(function (link) {
            var item = link.closest('.sidebar-item');
            if (item) item.classList.remove('active');

            var href = link.getAttribute('href');
            if (!href || href === '#') return;

            // Extract the filename from the href
            var hrefPage = href.split('/').pop().split('?')[0].split('#')[0];

            if (hrefPage && hrefPage === currentPage && hrefPage.length > bestLength) {
                bestMatch = link;
                bestLength = hrefPage.length;
            }
        });

        // Mark the matching item as active
        if (bestMatch) {
            var item = bestMatch.closest('.sidebar-item');
            if (item) item.classList.add('active');

            // Ensure the section containing the active item is expanded
            var section = bestMatch.closest('.sidebar-nav-section');
            if (section) section.classList.add('section-open');
        }
    }

    // ─── Responsive handler ──────────────────────────────────────────────

    function handleResize() {
        if (!isMobile()) {
            closeMobileSidebar();
        }
        if (isMobile()) {
            document.body.classList.remove('sidebar-collapsed');
        }
    }

    // ─── Escape key closes mobile sidebar ────────────────────────────────

    function handleKeydown(e) {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeMobileSidebar();
        }
    }

    // ─── Touch swipe to close mobile sidebar ─────────────────────────────

    var _touchStartX = 0;
    var _touchStartY = 0;
    var _touchSwiping = false;

    function handleTouchStart(e) {
        if (!isMobile() || !document.body.classList.contains('sidebar-open')) return;
        var touch = e.touches[0];
        _touchStartX = touch.clientX;
        _touchStartY = touch.clientY;
        _touchSwiping = true;
    }

    function handleTouchEnd(e) {
        if (!_touchSwiping) return;
        _touchSwiping = false;
        if (!isMobile() || !document.body.classList.contains('sidebar-open')) return;

        var touch = e.changedTouches[0];
        var deltaX = touch.clientX - _touchStartX;
        var deltaY = Math.abs(touch.clientY - _touchStartY);

        // Swipe left to close (must be mostly horizontal, ≥60px)
        if (deltaX < -60 && deltaY < 80) {
            closeMobileSidebar();
        }
    }

    // ─── Sidebar section expand/collapse ─────────────────────────────────

    function saveSectionState(states) {
        try { localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(states)); } catch (_) {}
    }

    function loadSectionState() {
        try {
            var raw = localStorage.getItem(SECTION_STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return null;
    }

    function initSectionToggle() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        var sections = sidebar.querySelectorAll('.sidebar-nav-section');
        if (!sections.length) return;

        var saved = loadSectionState();

        sections.forEach(function (section, index) {
            var label = section.querySelector('.sidebar-nav-label');
            if (!label) return;

            // Restore saved state or default to open
            var shouldOpen = saved ? !!saved[index] : true;
            if (shouldOpen) {
                section.classList.add('section-open');
            }

            label.addEventListener('click', function (e) {
                e.preventDefault();
                section.classList.toggle('section-open');

                // Persist state
                var states = {};
                sections.forEach(function (s, i) {
                    states[i] = s.classList.contains('section-open');
                });
                saveSectionState(states);
            });
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────

    function init() {
        // Desktop collapse button (#sidebarCollapseBtn inside sidebar header)
        var collapseBtn = document.getElementById('sidebarCollapseBtn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function (e) {
                e.preventDefault();
                toggleDesktopCollapse();
            });
        }

        // Mobile toggle button (#sidebarToggleBtn in topbar)
        var toggleBtn = document.getElementById('sidebarToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (e) {
                e.preventDefault();
                toggleMobileSidebar();
            });
        }

        // Backdrop click closes mobile sidebar
        var backdrop = document.getElementById('sidebarBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeMobileSidebar);
        }

        // Restore saved collapsed state on desktop
        if (!isMobile() && loadCollapsed()) {
            document.body.classList.add('sidebar-collapsed');
        }

        // Highlight the active menu item
        setActiveMenuItem();

        // Initialize section expand/collapse
        initSectionToggle();

        // Responsive and keyboard listeners. Resize fires rapidly during a
        // drag, so coalesce with rAF to keep handleResize() at 1x per frame.
        var _resizeRaf = 0;
        window.addEventListener('resize', function () {
            if (_resizeRaf) return;
            _resizeRaf = requestAnimationFrame(function () {
                _resizeRaf = 0;
                handleResize();
            });
        }, { passive: true });
        document.addEventListener('keydown', handleKeydown);

        // Touch swipe to close mobile sidebar
        var sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
            sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        // Close mobile sidebar when a nav link is clicked
        var links = document.querySelectorAll('.sidebar-link');
        links.forEach(function (link) {
            link.addEventListener('click', function () {
                if (isMobile() && document.body.classList.contains('sidebar-open')) {
                    // Small delay so the click registers before closing
                    setTimeout(closeMobileSidebar, 150);
                }
            });
        });

        enableSidebarTransitions();
    }

    // ─── Public API ──────────────────────────────────────────────────────

    LE.toggleSidebar = function () {
        if (isMobile()) {
            toggleMobileSidebar();
        } else {
            toggleDesktopCollapse();
        }
    };

    LE.closeMobileSidebar = closeMobileSidebar;

    // ─── Boot ────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.LiquidElegance = window.LiquidElegance || {});
