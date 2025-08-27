// Entry point: import submodules and run initial actions
import './seo-tool-state.js';
import './seo-tool-ui.js';
import './seo-tool-config.js';
import './seo-tool-generators.js';
import './seo-tool-github.js';
import { initSeoEditors } from './hieditor.js';

// Kick initial actions
try { window.loadSiteConfig && window.loadSiteConfig(); } catch (_) {}
try { window.generateSitemap && window.generateSitemap(); } catch (_) {}
try { window.validateSlugAndLoadBranches && window.validateSlugAndLoadBranches(); } catch (_) {}

// Initialize code editors after DOM ready
try { initSeoEditors(); } catch (_) {}
