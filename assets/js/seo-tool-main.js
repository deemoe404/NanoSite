// Entry point: import submodules and run initial actions
import './seo-tool-state.js';
import './seo-tool-ui.js';
import './seo-tool-config.js';
import './seo-tool-generators.js?v=2';
import './seo-tool-github.js';
import { initSeoEditors } from './hieditor.js';

// Initialize code editors first to avoid any race with value injection
try { initSeoEditors(); } catch (_) {}

// Kick initial actions (after editors exist so values render highlighted immediately)
try { window.loadSiteConfig && window.loadSiteConfig(); } catch (_) {}
try { window.generateSitemap && window.generateSitemap(); } catch (_) {}
try { window.validateSlugAndLoadBranches && window.validateSlugAndLoadBranches(); } catch (_) {}
