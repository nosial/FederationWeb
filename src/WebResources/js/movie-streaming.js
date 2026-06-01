(function () {
    "use strict";

    function refreshIcons() {
        if (window.feather && typeof window.feather.replace === "function") {
            window.feather.replace();
        }
    }

    /* ------------------------------------------------------------------
       Rail nav (prev/next chevron buttons on horizontal scroll rails)
    ------------------------------------------------------------------ */
    function bindRailNav() {
        var buttons = document.querySelectorAll("[data-rail-nav]");
        if (!buttons.length) return;

        function findTrack(btn) {
            var rail = btn.closest(".movie-rail");
            if (!rail) return null;
            return rail.querySelector(".movie-rail-track");
        }

        function updateButtons(track) {
            var rail = track.closest(".movie-rail");
            if (!rail) return;
            var prev = rail.querySelector('[data-rail-nav="prev"]');
            var next = rail.querySelector('[data-rail-nav="next"]');
            var max = track.scrollWidth - track.clientWidth - 1;
            if (prev) prev.classList.toggle("is-disabled", track.scrollLeft <= 0);
            if (next) next.classList.toggle("is-disabled", track.scrollLeft >= max);
        }

        buttons.forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var track = findTrack(btn);
                if (!track) return;
                var dir = btn.getAttribute("data-rail-nav") === "prev" ? -1 : 1;
                var step = Math.max(240, Math.round(track.clientWidth * 0.85));
                track.scrollBy({ left: dir * step, behavior: "smooth" });
            });
        });

        document.querySelectorAll(".movie-rail-track").forEach(function (track) {
            updateButtons(track);
            track.addEventListener("scroll", function () { updateButtons(track); }, { passive: true });
            window.addEventListener("resize", function () { updateButtons(track); });
        });
    }

    /* ------------------------------------------------------------------
       My List toggle
    ------------------------------------------------------------------ */
    function bindMyList() {
        document.querySelectorAll(".movie-mylist-btn").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var active = btn.classList.toggle("is-active");
                var label = btn.querySelector("span");
                var icon = btn.querySelector("[data-feather]");
                if (label) label.textContent = active ? "Added" : "My List";
                if (icon) icon.setAttribute("data-feather", active ? "check" : "plus");
                refreshIcons();
            });
        });
    }

    /* ------------------------------------------------------------------
       Like / Dislike (mutually exclusive)
    ------------------------------------------------------------------ */
    function bindRateButtons() {
        var groups = {};
        document.querySelectorAll(".movie-rate-btn").forEach(function (btn) {
            var group = btn.closest(".movie-title-hero-actions, .glass-card-body, body") || document.body;
            var key = group.dataset.rateGroupId || (group.dataset.rateGroupId = "g" + Math.random().toString(36).slice(2, 7));
            (groups[key] = groups[key] || []).push(btn);
        });
        Object.keys(groups).forEach(function (k) {
            var arr = groups[k];
            arr.forEach(function (btn) {
                btn.addEventListener("click", function (e) {
                    e.preventDefault();
                    var was = btn.classList.contains("is-active");
                    arr.forEach(function (b) { b.classList.remove("is-active"); });
                    if (!was) btn.classList.add("is-active");
                });
            });
        });
    }

    /* ------------------------------------------------------------------
       Share (clipboard with feedback)
    ------------------------------------------------------------------ */
    function bindShare() {
        document.querySelectorAll(".movie-share-btn").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var url = window.location.href;
                var done = function () {
                    btn.classList.add("is-active");
                    setTimeout(function () { btn.classList.remove("is-active"); }, 900);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(done, done);
                } else {
                    done();
                }
            });
        });
    }

    /* ------------------------------------------------------------------
       Tabs (smooth-scroll to target section)
    ------------------------------------------------------------------ */
    function bindMovieTabs() {
        var tabs = document.querySelectorAll(".movie-tab");
        if (!tabs.length) return;
        tabs.forEach(function (tab) {
            tab.addEventListener("click", function (e) {
                var href = tab.getAttribute("href") || "";
                if (href.charAt(0) !== "#" || href.length < 2) return;
                var target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                tabs.forEach(function (t) { t.classList.remove("is-active"); });
                tab.classList.add("is-active");
                var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: top, behavior: "smooth" });
            });
        });
    }

    /* ------------------------------------------------------------------
       Genre / filter chips
    ------------------------------------------------------------------ */
    function bindMovieChips() {
        var grid = document.getElementById("movGrid");
        var counter = document.getElementById("movGridCount");
        var empty = document.getElementById("movGridEmpty");

        document.querySelectorAll(".movie-chip-bar").forEach(function (bar) {
            var chips = bar.querySelectorAll(".movie-chip");
            chips.forEach(function (chip) {
                chip.addEventListener("click", function (e) {
                    e.preventDefault();
                    chips.forEach(function (c) { c.classList.remove("is-active"); });
                    chip.classList.add("is-active");
                    if (!grid) return;
                    var filter = chip.getAttribute("data-filter-genre") || "All";
                    var visible = 0;
                    grid.querySelectorAll(".movie-card").forEach(function (card) {
                        var match = filter === "All" || card.getAttribute("data-genre") === filter;
                        card.hidden = !match;
                        if (match) visible++;
                    });
                    if (counter) counter.textContent = visible + (visible === 1 ? " title" : " titles");
                    if (empty) empty.hidden = visible !== 0;
                });
            });
        });
    }

    /* ------------------------------------------------------------------
       Season selector (just visual, on title page)
    ------------------------------------------------------------------ */
    function bindSeasonSelect() {
        var sel = document.querySelector(".movie-season-select");
        if (!sel) return;
        sel.addEventListener("change", function () {
            var heading = document.querySelector("[data-season-heading]");
            if (heading) heading.textContent = sel.options[sel.selectedIndex].text;
        });
    }

    /* ------------------------------------------------------------------
       Init
    ------------------------------------------------------------------ */
    function init() {
        bindRailNav();
        bindMyList();
        bindRateButtons();
        bindShare();
        bindMovieTabs();
        bindMovieChips();
        bindSeasonSelect();
        refreshIcons();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
