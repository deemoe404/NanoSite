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
  var href = 'assets/themes/' + pack + '/theme.css';
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
})();

