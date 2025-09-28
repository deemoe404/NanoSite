// Early theme boot: set dark/light attribute ASAP and prepare theme pack
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (saved === 'light') document.documentElement.removeAttribute('data-theme');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) { /* ignore */ }

  // Compute pack href once so we can apply quickly when the link exists
  var pack = 'native';
  try { pack = (localStorage.getItem('themePack') || 'native'); } catch (_) {}
  // Sanitize pack to a safe slug and encode when building URL
  try {
    pack = String(pack || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'native';
  } catch (_) { pack = 'native'; }
  var href = 'assets/themes/' + encodeURIComponent(pack) + '/theme.css';
  window.__themePackHref = href;

  // If the link tag exists already, set it; otherwise try briefly until it does
  var tries = 0;
  function trySet() {
    var link = document.getElementById('theme-pack');
    if (link) {
      if (link.getAttribute('href') !== href) link.setAttribute('href', href);
      return;
    }
    if (tries++ < 20) requestAnimationFrame(trySet);
  }
  trySet();

  // Restore layout variables/classes as early as possible
  var LAYOUT_STATE_KEY = '__ns_theme_layout_state';
  function scheduleBodyWork(cb) {
    if (document.body) {
      try { cb(document.body); } catch (_) {}
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        try { cb(document.body); } catch (_) {}
      }, { once: true });
    }
  }
  function applySidebar(sidebar) {
    var value = String(sidebar || '').toLowerCase();
    if (value === 'right' || value === 'left' || value === 'hidden') {
      document.documentElement.setAttribute('data-layout-sidebar', value);
      scheduleBodyWork(function (body) {
        if (!body) return;
        if (value) body.setAttribute('data-layout-sidebar', value);
      });
    } else {
      document.documentElement.removeAttribute('data-layout-sidebar');
      scheduleBodyWork(function (body) {
        if (body) body.removeAttribute('data-layout-sidebar');
      });
    }
  }
  function applyBodyClasses(classes) {
    if (!Array.isArray(classes) || !classes.length) return;
    var root = document.documentElement;
    classes.forEach(function (cls) {
      if (typeof cls === 'string' && root && root.classList) {
        root.classList.add(cls);
      }
    });
    scheduleBodyWork(function (body) {
      if (!body || !body.classList) return;
      classes.forEach(function (cls) {
        if (typeof cls !== 'string') return;
        body.classList.add(cls);
      });
    });
  }
  function applyVariables(vars) {
    if (!vars || typeof vars !== 'object') return;
    var root = document.documentElement;
    Object.keys(vars).forEach(function (key) {
      if (typeof key !== 'string') return;
      if (!/^--/.test(key)) return;
      var val = vars[key];
      if (val == null) return;
      try { root.style.setProperty(key, String(val)); } catch (_) {}
    });
  }
  try {
    var raw = localStorage.getItem(LAYOUT_STATE_KEY);
    if (raw) {
      var state = JSON.parse(raw);
      if (state && state.pack) {
        var storedPack = String(state.pack || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'native';
        if (storedPack === pack) {
          applySidebar(state.sidebar);
          applyVariables(state.vars);
          applyBodyClasses(state.bodyClasses);
        }
      }
    }
  } catch (_) { /* ignore layout restore */ }
})();
