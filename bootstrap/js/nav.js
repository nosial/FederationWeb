(function () {
  'use strict';

  // Mobile nav toggle
  var navToggle = document.querySelector('.fw-topnav-toggle');
  var navInner = document.querySelector('.fw-topnav-inner');
  if (navToggle && navInner) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      navInner.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!navInner.contains(e.target) && e.target !== navToggle && !navToggle.contains(e.target)) {
        navInner.classList.remove('open');
      }
    });

    // Close on item click
    navInner.addEventListener('click', function (e) {
      if (e.target.closest('.fw-topnav-item')) {
        navInner.classList.remove('open');
      }
    });
  }

  // Correct active highlighting: ensure exactly one item is marked active,
  // matching the current path (Dashboard "/" must match only the root path,
  // not every page). Overrides any stale/duplicate server-rendered state.
  var navItems = document.querySelectorAll('.fw-topnav-item');
  if (navItems.length) {
    var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    var bestItem = null;
    var bestLen = -1;
    navItems.forEach(function (item) {
      var href = item.getAttribute('href');
      if (!href) {
        return;
      }
      var itemPath;
      try {
        itemPath = new URL(href, window.location.origin).pathname;
      } catch (err) {
        return;
      }
      itemPath = itemPath.replace(/\/+$/, '') || '/';
      var matches = itemPath === '/'
        ? currentPath === '/'
        : (currentPath === itemPath || currentPath.indexOf(itemPath + '/') === 0);
      if (matches && itemPath.length > bestLen) {
        bestItem = item;
        bestLen = itemPath.length;
      }
    });
    navItems.forEach(function (item) {
      item.classList.remove('active');
    });
    if (bestItem) {
      bestItem.classList.add('active');
    }
  }

})();
