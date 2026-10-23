// Applies the saved theme before first paint (light unless the person chose otherwise).
// Must match readThemeMode()/applyThemeMode() in src/lib/theme.ts.
(function () {
  var theme = 'light';
  try {
    var stored = localStorage.getItem('layerto_theme');
    if (stored === 'dark') theme = 'dark';
    else if (stored === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch (e) {
    // storage unavailable: stay light
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
// Accent colour and density (Settings → Appearance), also applied before first paint.
(function () {
  try {
    var accent = localStorage.getItem('layerto_accent');
    if (accent && /^[a-z]+$/.test(accent) && accent !== 'crimson') document.documentElement.setAttribute('data-accent', accent);
    if (localStorage.getItem('layerto_density') === 'compact') document.documentElement.setAttribute('data-density', 'compact');
  } catch (e) {
    // storage unavailable: defaults
  }
})();
