// Entry point: import submodules and run initial actions
import './seo-tool-state.js';
import './seo-tool-ui.js';
import './seo-tool-config.js';
import './seo-tool-generators.js';
import './seo-tool-github.js';

// Kick initial actions
try { window.loadSiteConfig && window.loadSiteConfig(); } catch (_) {}
try { window.generateSitemap && window.generateSitemap(); } catch (_) {}
try { window.validateSlugAndLoadBranches && window.validateSlugAndLoadBranches(); } catch (_) {}

