(function () {
  'use strict';

  // Mobile nav toggle
  var navToggle = document.querySelector('.fw-topnav-toggle');
  var navInner = document.querySelector('.fw-topnav-inner');

  function setNavOpen(open) {
    navInner.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (navToggle && navInner) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setNavOpen(!navInner.classList.contains('open'));
    });

    // Close on outside click. The tap only dismisses the menu (capture phase, swallowed) so it
    // doesn't also open the link or table row underneath.
    document.addEventListener('click', function (e) {
      if (navInner.classList.contains('open') && !navInner.contains(e.target) && !navToggle.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        setNavOpen(false);
      }
    }, true);

    // Close on item click
    navInner.addEventListener('click', function (e) {
      if (e.target.closest('.fw-topnav-item')) {
        setNavOpen(false);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navInner.classList.contains('open')) {
        setNavOpen(false);
        navToggle.focus();
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

    // Show the current section's name beside the mobile toggle so the collapsed bar says where you are.
    var currentLabel = navToggle ? navToggle.querySelector('.fw-topnav-current') : null;
    if (currentLabel && bestItem) {
      var labelText = '';
      bestItem.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          labelText += node.textContent;
        }
      });
      currentLabel.textContent = labelText.trim();
    }
  }

})();
