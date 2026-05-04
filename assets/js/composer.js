import './cache-control.js';
import { getManualMarkdownSaveState, normalizeMarkdownDraftContent } from './composer-markdown-save.js';
import {
  fetchConfigWithYamlFallback,
  fetchSiteLocalOverride,
  fetchTrackedSiteConfig,
  mergeYamlConfig,
  resolveSiteRepoConfig,
  parseYAML
} from './yaml.js';
import { t, getAvailableLangs, getLanguageLabel } from './i18n.js?v=20260504saved';
import { generateSitemapData, resolveSiteBaseUrl } from './seo.js';
import { initSystemUpdates, getSystemUpdateSummaryEntries, getSystemUpdateCommitFiles, clearSystemUpdateState } from './system-updates.js';
import { buildEditorContentTree, findEditorContentTreeNode, flattenEditorContentTree } from './editor-content-tree.js';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const LANG_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
const LANGUAGE_POOL_CHANGED_EVENT = 'ns-composer-language-pool-changed';

function broadcastLanguagePoolChange() {
  if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
  try {
    document.dispatchEvent(new CustomEvent(LANGUAGE_POOL_CHANGED_EVENT));
  } catch (_) {}
}

function normalizeLangCode(code) {
  if (!code) return '';
  return String(code).trim().toLowerCase();
}

function isLanguageCode(value) {
  return LANG_CODE_PATTERN.test(String(value || '').trim());
}
const ORDER_LINE_COLORS = ['#2563eb', '#ec4899', '#f97316', '#10b981', '#8b5cf6', '#f59e0b', '#22d3ee'];

const tComposer = (suffix, params) => t(`editor.composer.${suffix}`, params);
const tComposerDiff = (suffix, params) => t(`editor.composer.diff.${suffix}`, params);
const tComposerLang = (suffix, params) => t(`editor.composer.languages.${suffix}`, params);
const tComposerEntryRow = (suffix, params) => t(`editor.composer.entryRow.${suffix}`, params);
const getMarkdownPushLabel = (kind) => {
  const key = MARKDOWN_PUSH_LABEL_KEYS[kind] || MARKDOWN_PUSH_LABEL_KEYS.default;
  return t(key);
};
const getMarkdownPushTooltip = (kind) => {
  const key = MARKDOWN_PUSH_TOOLTIP_KEYS[kind] || MARKDOWN_PUSH_TOOLTIP_KEYS.default;
  return t(key);
};
const getMarkdownDiscardLabel = () => t(MARKDOWN_DISCARD_LABEL_KEY);
const getMarkdownDiscardBusyLabel = () => t(MARKDOWN_DISCARD_BUSY_KEY);
const getMarkdownDiscardTooltip = (kind) => {
  const key = MARKDOWN_DISCARD_TOOLTIP_KEYS[kind] || MARKDOWN_DISCARD_TOOLTIP_KEYS.default;
  return t(key);
};
const getMarkdownSaveLabel = () => t(MARKDOWN_SAVE_LABEL_KEY);
const getMarkdownSaveBusyLabel = () => t(MARKDOWN_SAVE_BUSY_KEY);
const getMarkdownSaveTooltip = (kind) => {
  const key = MARKDOWN_SAVE_TOOLTIP_KEYS[kind] || MARKDOWN_SAVE_TOOLTIP_KEYS.default;
  return t(key);
};

// --- Persisted UI state keys ---
const LS_KEYS = {
  cfile: 'ns_composer_file',           // 'index' | 'tabs' | 'site'
  editorState: 'ns_composer_editor_state', // persisted dynamic editor info
  systemTreeExpanded: 'ns_editor_system_tree_expanded'
};
const EDITOR_STATE_VERSION = 3;
const EDITOR_SCROLL_SAVE_DELAY = 120;

// Track additional markdown editor tabs spawned from Composer
const dynamicEditorTabs = new Map();            // modeId -> { path, button, content, loaded, baseDir }
const dynamicEditorTabsByLookupKey = new Map(); // lookupKey -> modeId
let dynamicTabCounter = 0;
let currentMode = null;
let activeDynamicMode = null;
let activeMarkdownDocument = null;
let detachPrimaryEditorListener = null;
let detachPrimaryEditorTabsMetadataListener = null;
let allowEditorStatePersist = false;
let editorContentTree = [];
let activeEditorTreeNodeId = 'articles';
const expandedEditorTreeNodeIds = new Set(['articles', 'pages']);
let hasEditorStateV3Snapshot = false;
try {
  const rawEditorState = window.localStorage.getItem(LS_KEYS.editorState);
  const parsedEditorState = rawEditorState ? JSON.parse(rawEditorState) : null;
  hasEditorStateV3Snapshot = !!(parsedEditorState && parsedEditorState.v === EDITOR_STATE_VERSION);
} catch (_) {}
try {
  if (!hasEditorStateV3Snapshot && window.localStorage.getItem(LS_KEYS.systemTreeExpanded) === '1') {
    expandedEditorTreeNodeIds.add('system');
  }
} catch (_) {}
const collapsingEditorTreeNodeIds = new Set();
let expandingEditorTreeNodeId = null;
let activeEditorOverlayMode = null;
let editorOverlayReturnFocus = null;
let editorOverlayEscapeBound = false;
let editorRailResizeBound = false;
let editorMobileRailBound = false;
let editorStatePersistTimer = 0;
let editorStateScrollBound = false;
let editorContentScrollByKey = {};
const EDITOR_RAIL_WIDTH_KEY = 'ns_editor_rail_width';
const EDITOR_RAIL_DEFAULT_WIDTH = 340;
const EDITOR_RAIL_MIN_WIDTH = 280;
const EDITOR_RAIL_MAX_WIDTH = 520;

function getDynamicTabsContainer() {
  try {
    return document.getElementById('modeDynamicTabs');
  } catch (_) {
    return null;
  }
}

function updateDynamicTabsGroupState() {
  const container = getDynamicTabsContainer();
  if (!container) return;
  const hasTabs = !!container.querySelector('.mode-tab.dynamic-mode');
  container.hidden = !hasTabs;
  if (hasTabs) container.removeAttribute('aria-hidden');
  else container.setAttribute('aria-hidden', 'true');
}

const DRAFT_STORAGE_KEY = 'ns_composer_drafts_v1';
const MARKDOWN_DRAFT_STORAGE_KEY = 'ns_markdown_editor_drafts_v1';

// Track pending binary assets associated with markdown drafts
const markdownAssetStore = new Map();

const MARKDOWN_PUSH_LABEL_KEYS = {
  default: 'editor.composer.markdown.push.labelDefault',
  create: 'editor.composer.markdown.push.labelCreate',
  update: 'editor.composer.markdown.push.labelUpdate'
};

const MARKDOWN_PUSH_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.push.tooltips.default',
  noRepo: 'editor.composer.markdown.push.tooltips.noRepo',
  noFile: 'editor.composer.markdown.push.tooltips.noFile',
  error: 'editor.composer.markdown.push.tooltips.error',
  checking: 'editor.composer.markdown.push.tooltips.checking',
  loading: 'editor.composer.markdown.push.tooltips.loading',
  create: 'editor.composer.markdown.push.tooltips.create',
  update: 'editor.composer.markdown.push.tooltips.update'
};

const MARKDOWN_DISCARD_LABEL_KEY = 'editor.composer.markdown.discard.label';
const MARKDOWN_DISCARD_BUSY_KEY = 'editor.composer.markdown.discard.busy';

const MARKDOWN_DISCARD_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.discard.tooltips.default',
  noFile: 'editor.composer.markdown.discard.tooltips.noFile',
  reload: 'editor.composer.markdown.discard.tooltips.reload'
};
const MARKDOWN_SAVE_LABEL_KEY = 'editor.composer.markdown.save.label';
const MARKDOWN_SAVE_BUSY_KEY = 'editor.composer.markdown.save.busy';

const MARKDOWN_SAVE_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.save.tooltips.default',
  noFile: 'editor.composer.markdown.save.tooltips.noFile',
  empty: 'editor.composer.markdown.save.tooltips.empty',
  clean: 'editor.composer.markdown.save.tooltips.clean'
};
const GITHUB_PAT_STORAGE_KEY = 'ns_fg_pat_cache';

let markdownPushButton = null;
let markdownDiscardButton = null;
let markdownSaveButton = null;
let gitHubCommitInFlight = false;
let cachedFineGrainedTokenMemory = '';

let activeComposerState = null;
let remoteBaseline = { index: null, tabs: null, site: null };
let composerSiteLocalOverride = {};
let composerDiffCache = { index: null, tabs: null, site: null };
let composerDraftMeta = { index: null, tabs: null, site: null };
let composerAutoSaveTimers = { index: null, tabs: null, site: null };
let composerDiffModal = null;
let composerOrderState = null;
let composerDiffResizeHandler = null;
let composerOrderPreviewElements = { index: null, tabs: null };
let composerOrderPreviewState = { index: null, tabs: null };
let composerOrderPreviewActiveKind = 'index';
let composerOrderPreviewResizeHandler = null;
const composerOrderPreviewRelayoutTimers = { index: null, tabs: null };
let activeComposerFile = 'index';
let composerViewTransition = null;

let composerReduceMotionQuery = null;
const composerInlineVisibilityAnimations = new WeakMap();
const composerInlineVisibilityFallbacks = new WeakMap();
const composerListTransitions = new WeakMap();
const composerOrderMainTransitions = new WeakMap();
let composerSiteScrollAnimationId = null;
let composerSiteScrollCleanup = null;

function syncSiteEditorSingleLabelWidth(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  try {
    if (typeof root.__nsSiteSingleLabelWidthCleanup === 'function') root.__nsSiteSingleLabelWidthCleanup();
  } catch (_) {}
  try { root.__nsSiteSingleLabelWidthCleanup = null; } catch (_) {}

  const labels = Array.from(root.querySelectorAll('.cs-single-grid-title'));
  if (!labels.length) {
    try { root.style.removeProperty('--cs-editor-single-label-width'); } catch (_) {}
    return;
  }

  let frame = 0;
  let observer = null;
  const requestFrame = (fn) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(fn);
    }
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
    return setTimeout(fn, 0);
  };
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
      return;
    }
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };
  const measure = () => {
    frame = 0;
    let width = 88;
    labels.forEach((label) => {
      const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
      const target = cell || label;
      let measured = 0;
      try {
        const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
        const tooltipWidth = tooltip ? tooltip.scrollWidth || 0 : 0;
        const labelWidth = label.scrollWidth || 0;
        const targetStyle = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
          ? window.getComputedStyle(target)
          : null;
        const gap = targetStyle ? parseFloat(targetStyle.gap || targetStyle.columnGap || '0') || 0 : 0;
        measured = labelWidth + tooltipWidth + gap;
      } catch (_) {
        try {
          const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
          measured = (label.scrollWidth || 0) + (tooltip ? tooltip.scrollWidth || 0 : 0);
        } catch (_) {}
      }
      width = Math.max(width, measured);
    });
    try { root.style.setProperty('--cs-editor-single-label-width', `${Math.ceil(width)}px`); } catch (_) {}
  };
  const schedule = () => {
    if (frame) return;
    frame = requestFrame(measure);
  };

  if (typeof ResizeObserver === 'function') {
    try {
      observer = new ResizeObserver(schedule);
      observer.observe(root);
      labels.forEach((label) => {
        const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
        observer.observe(cell || label);
      });
    } catch (_) {
      observer = null;
    }
  }

  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') document.fonts.ready.then(schedule).catch(() => {});
  } catch (_) {}
  schedule();

  root.__nsSiteSingleLabelWidthCleanup = () => {
    cancelFrame(frame);
    frame = 0;
    try { if (observer) observer.disconnect(); } catch (_) {}
    observer = null;
  };
}

function applyComposerEffectiveSiteConfig(siteConfig) {
  const tracked = siteConfig && typeof siteConfig === 'object' ? siteConfig : {};
  const effective = mergeYamlConfig(tracked, composerSiteLocalOverride);
  const root = (effective && effective.contentRoot) ? String(effective.contentRoot) : 'wwwroot';
  try {
    window.__ns_content_root = root;
  } catch (_) {}
  try {
    const repo = (effective && effective.repo) || {};
    window.__ns_site_repo = {
      owner: String(repo.owner || ''),
      name: String(repo.name || ''),
      branch: String(repo.branch || 'main')
    };
  } catch (_) {
    try {
      window.__ns_site_repo = { owner: '', name: '', branch: 'main' };
    } catch (_) {}
  }
  return effective;
}

async function fetchComposerTrackedSiteConfig() {
  const tracked = await fetchTrackedSiteConfig();
  composerSiteLocalOverride = await fetchSiteLocalOverride();
  applyComposerEffectiveSiteConfig(tracked || {});
  return tracked || {};
}

const SITE_FIELD_LABEL_MAP = {
  siteTitle: { i18nKey: 'editor.composer.site.fields.siteTitle' },
  siteSubtitle: { i18nKey: 'editor.composer.site.fields.siteSubtitle' },
  siteDescription: { i18nKey: 'editor.composer.site.fields.siteDescription' },
  siteKeywords: { i18nKey: 'editor.composer.site.fields.siteKeywords' },
  avatar: { i18nKey: 'editor.composer.site.fields.avatar' },
  resourceURL: { i18nKey: 'editor.composer.site.fields.resourceURL' },
  contentRoot: { i18nKey: 'editor.composer.site.fields.contentRoot' },
  profileLinks: { i18nKey: 'editor.composer.site.fields.profileLinks' },
  contentOutdatedDays: { i18nKey: 'editor.composer.site.fields.contentOutdatedDays' },
  cardCoverFallback: { i18nKey: 'editor.composer.site.fields.cardCoverFallback' },
  errorOverlay: { i18nKey: 'editor.composer.site.fields.errorOverlay' },
  pageSize: { i18nKey: 'editor.composer.site.fields.pageSize' },
  defaultLanguage: { i18nKey: 'editor.composer.site.fields.defaultLanguage' },
  themeMode: { i18nKey: 'editor.composer.site.fields.themeMode' },
  themePack: { i18nKey: 'editor.composer.site.fields.themePack' },
  themeOverride: { i18nKey: 'editor.composer.site.fields.themeOverride' },
  showAllPosts: { i18nKey: 'editor.composer.site.fields.showAllPosts' },
  landingTab: { i18nKey: 'editor.composer.site.fields.landingTab' },
  repo: { i18nKey: 'editor.composer.site.fields.repo' },
  assetWarnings: { i18nKey: 'editor.composer.site.sections.assets.title', fallback: 'Asset warnings' },
  __extras: { i18nKey: 'editor.composer.site.fields.extras', fallback: 'Extras' }
};

function composerPrefersReducedMotion() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    if (!composerReduceMotionQuery) composerReduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!composerReduceMotionQuery.matches;
  } catch (_) {
    return false;
  }
}

function cancelComposerSiteScrollAnimation() {
  try {
    if (composerSiteScrollAnimationId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(composerSiteScrollAnimationId);
    }
  } catch (_) {}
  composerSiteScrollAnimationId = null;
  if (typeof composerSiteScrollCleanup === 'function') {
    try { composerSiteScrollCleanup(); }
    catch (_) {}
  }
  composerSiteScrollCleanup = null;
}

function createCubicBezierEasing(mX1, mY1, mX2, mY2) {
  const NEWTON_ITERATIONS = 8;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 1e-7;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const SPLINE_TABLE_SIZE = 11;
  const SAMPLE_STEP_SIZE = 1 / (SPLINE_TABLE_SIZE - 1);

  const sampleValues = new Float32Array(SPLINE_TABLE_SIZE);

  const calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + (3 * a1)) * t;
  const getSlope = (t, a1, a2) => (3 * (1 - 3 * a2 + 3 * a1) * t + 2 * (3 * a2 - 6 * a1)) * t + (3 * a1);

  for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
    sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, mX1, mX2);
  }

  const binarySubdivide = (x, lowerBound, upperBound) => {
    let currentX = 0;
    let currentT = 0;
    let i = 0;
    do {
      currentT = lowerBound + (upperBound - lowerBound) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0) {
        upperBound = currentT;
      } else {
        lowerBound = currentT;
      }
      i += 1;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  };

  const newtonRaphsonIterate = (x, guessT) => {
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = getSlope(guessT, mX1, mX2);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  };

  return (x) => {
    if (mX1 === mY1 && mX2 === mY2) return x;
    let currentSample = 0;
    const lastSample = SPLINE_TABLE_SIZE - 1;
    for (; currentSample !== lastSample && sampleValues[currentSample] <= x; currentSample += 1);
    currentSample -= 1;

    const segmentStart = sampleValues[currentSample];
    const segmentEnd = sampleValues[currentSample + 1];
    const segmentInterval = segmentEnd - segmentStart;
    const dist = segmentInterval > 0 ? (x - segmentStart) / segmentInterval : 0;
    const guessForT = currentSample * SAMPLE_STEP_SIZE + dist * SAMPLE_STEP_SIZE;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    const tCandidate = initialSlope >= NEWTON_MIN_SLOPE
      ? newtonRaphsonIterate(x, guessForT)
      : initialSlope === 0
        ? guessForT
        : binarySubdivide(x, currentSample * SAMPLE_STEP_SIZE, (currentSample + 1) * SAMPLE_STEP_SIZE);

    return calcBezier(tCandidate, mY1, mY2);
  };
}

const easeOutComposerScroll = (t) => Math.min(1, Math.max(0, t));

function resolveComposerScrollDuration(duration) {
  const maxDuration = 1600;
  const minDuration = 120;
  const fallbackDuration = 720;
  const numeric = Number(duration);
  if (Number.isFinite(numeric)) return Math.min(maxDuration, Math.max(minDuration, numeric));
  return fallbackDuration;
}

function animateComposerViewportScroll(targetY, duration, onComplete) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof window.requestAnimationFrame !== 'function' || typeof window.scrollTo !== 'function') return false;

  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const distance = targetY - startY;
  if (Math.abs(distance) < 0.5) {
    try { window.scrollTo(0, targetY); } catch (_) {}
    if (typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
    return true;
  }

  const resolvedDuration = resolveComposerScrollDuration(duration);

  const startTime = (() => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch (_) {}
    return Date.now();
  })();

  cancelComposerSiteScrollAnimation();

  let restoreScrollBehavior = null;
  const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
  if (rootEl && rootEl.style) {
    try {
      const previousBehavior = rootEl.style.scrollBehavior || '';
      const hadInlineBehavior = previousBehavior !== '';
      rootEl.style.scrollBehavior = 'auto';
      restoreScrollBehavior = () => {
        if (!rootEl || !rootEl.style) return;
        if (hadInlineBehavior) rootEl.style.scrollBehavior = previousBehavior;
        else rootEl.style.removeProperty('scroll-behavior');
      };
    } catch (_) {
      restoreScrollBehavior = null;
    }
  }

  if (typeof restoreScrollBehavior === 'function') {
    composerSiteScrollCleanup = () => {
      if (typeof restoreScrollBehavior === 'function') {
        try { restoreScrollBehavior(); }
        catch (_) {}
      }
      restoreScrollBehavior = null;
    };
  } else {
    composerSiteScrollCleanup = null;
  }

  const finalize = (shouldInvokeCallback) => {
    composerSiteScrollAnimationId = null;
    if (typeof composerSiteScrollCleanup === 'function') {
      try { composerSiteScrollCleanup(); }
      catch (_) {}
    }
    composerSiteScrollCleanup = null;
    if (shouldInvokeCallback && typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
  };

  const step = (timestamp) => {
    const now = (() => {
      if (typeof timestamp === 'number') return timestamp;
      try {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
          return performance.now();
        }
      } catch (_) {}
      return Date.now();
    })();

    const progress = Math.min(1, (now - startTime) / resolvedDuration);
    const eased = easeOutComposerScroll(progress);
    const nextY = startY + (distance * eased);
    try { window.scrollTo(0, nextY); } catch (_) {}

    if (progress < 1) {
      try {
        composerSiteScrollAnimationId = window.requestAnimationFrame(step);
        return;
      } catch (_) {}
    }

    finalize(true);
  };

  try {
    composerSiteScrollAnimationId = window.requestAnimationFrame(step);
    return true;
  } catch (_) {
    finalize(false);
    return false;
  }
}

function parseCssDuration(value, fallback) {
  const defaultValue = typeof fallback === 'number' ? fallback : 0;
  if (value == null) return defaultValue;
  const trimmed = String(value).trim();
  if (!trimmed) return defaultValue;
  const unit = trimmed.endsWith('ms') ? 'ms' : (trimmed.endsWith('s') ? 's' : '');
  const numeric = parseFloat(trimmed);
  if (Number.isNaN(numeric)) return defaultValue;
  if (unit === 's') return numeric * 1000;
  return numeric;
}

function getComposerInlineAnimConfig() {
  const defaults = { durationIn: 480, durationOut: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
  if (typeof window === 'undefined' || typeof document === 'undefined') return defaults;
  try {
    const styles = getComputedStyle(document.documentElement);
    const durationIn = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-in'), defaults.durationIn);
    const durationOut = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-out'), defaults.durationOut);
    const easing = (styles.getPropertyValue('--composer-inline-ease') || '').trim() || defaults.easing;
    return { durationIn, durationOut, easing };
  } catch (_) {
    return defaults;
  }
}

function cancelInlineVisibilityAnimation(element) {
  if (!element) return;
  const active = composerInlineVisibilityAnimations.get(element);
  if (active && typeof active.cancel === 'function') {
    try { active.cancel(); } catch (_) {}
  }
  if (active) composerInlineVisibilityAnimations.delete(element);
  const fallback = composerInlineVisibilityFallbacks.get(element);
  if (fallback != null) {
    clearTimeout(fallback);
    composerInlineVisibilityFallbacks.delete(element);
  }
  if (element.dataset && element.dataset.animState && !element.hidden) delete element.dataset.animState;
}

function animateComposerInlineVisibility(element, show, options = {}) {
  if (!element) return;
  const reduceMotion = composerPrefersReducedMotion();
  const config = getComposerInlineAnimConfig();
  const duration = show ? config.durationIn : config.durationOut;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  const force = !!options.force;
  const onFinish = typeof options.onFinish === 'function' ? options.onFinish : null;
  const finish = () => { if (onFinish) { try { onFinish(); } catch (_) {} } };

  if (!force) {
    if (show && !element.hidden) {
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
    if (!show && element.hidden) {
      element.setAttribute('aria-hidden', 'true');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
  }

  cancelInlineVisibilityAnimation(element);

  if (immediate) {
    element.hidden = !show;
    element.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (element.dataset && element.dataset.animState) delete element.dataset.animState;
    finish();
    return;
  }

  const keyframesIn = [
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ];
  const keyframesOut = [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' }
  ];

  const runFallback = () => {
    if (show) {
      element.hidden = false;
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset) element.dataset.animState = 'enter';
    } else if (element.dataset) {
      element.dataset.animState = 'exit';
    }
    const timer = window.setTimeout(() => {
      if (!show) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.setAttribute('aria-hidden', 'false');
      }
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      composerInlineVisibilityFallbacks.delete(element);
      finish();
    }, duration);
    composerInlineVisibilityFallbacks.set(element, timer);
  };

  if (typeof element.animate === 'function') {
    try {
      if (show) {
        element.hidden = false;
        element.setAttribute('aria-hidden', 'false');
        if (element.dataset) element.dataset.animState = 'enter';
        const animation = element.animate(keyframesIn, { duration, easing: config.easing, fill: 'both' });
        composerInlineVisibilityAnimations.set(element, animation);
        const finalize = () => {
          const active = composerInlineVisibilityAnimations.get(element);
          if (active !== animation) return;
          composerInlineVisibilityAnimations.delete(element);
          if (element.dataset && element.dataset.animState === 'enter') delete element.dataset.animState;
          finish();
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
      if (element.dataset) element.dataset.animState = 'exit';
      const animation = element.animate(keyframesOut, { duration, easing: config.easing, fill: 'both' });
      composerInlineVisibilityAnimations.set(element, animation);
      const finalize = () => {
        const active = composerInlineVisibilityAnimations.get(element);
        if (active !== animation) return;
        composerInlineVisibilityAnimations.delete(element);
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        if (element.dataset && element.dataset.animState === 'exit') delete element.dataset.animState;
        finish();
      };
      animation.finished.then(finalize).catch(finalize);
      animation.addEventListener('cancel', finalize, { once: true });
      return;
    } catch (_) {
      cancelInlineVisibilityAnimation(element);
    }
  }

  runFallback();
}

function captureElementRect(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;
  try {
    const rect = element.getBoundingClientRect();
    return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
  } catch (_) {
    return null;
  }
}

function cancelListTransition(list) {
  if (!list) return;
  const active = composerListTransitions.get(list);
  if (!active) return;
  composerListTransitions.delete(list);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimeout(active.timer);
  if (active.restoreTransition != null) list.style.transition = active.restoreTransition;
  list.style.transform = 'none';
  list.style.filter = 'none';
  if (list.style.opacity && list.style.opacity !== '1') list.style.opacity = '';
  delete list.dataset.animating;
}

function animateComposerListTransition(list, previousRect, options = {}) {
  if (!list || !previousRect || composerPrefersReducedMotion()) return;
  const immediate = !!options.immediate;
  const forceFallback = immediate || !!options.forceFallback;
  const onMeasured = typeof options.onMeasured === 'function' ? options.onMeasured : null;
  cancelListTransition(list);
  const run = () => {
    if (!list.isConnected) return;
    let nextRect = captureElementRect(list);
    if (!nextRect) return;
    if (onMeasured) {
      try {
        const override = onMeasured(nextRect);
        if (override && typeof override === 'object') nextRect = override;
      }
      catch (_) {}
    }
    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;
    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;
    const { durationIn, easing } = getComposerInlineAnimConfig();
    if (durationIn <= 0) return;
    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.96)', opacity: 0.98 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];
    list.dataset.animating = 'true';
    if (!forceFallback && typeof list.animate === 'function') {
      let animation = null;
      try {
        animation = list.animate(keyframes, { duration: durationIn, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerListTransitions.set(list, { animation });
        const finalize = () => {
          const active = composerListTransitions.get(list);
          if (!active || active.animation !== animation) return;
          composerListTransitions.delete(list);
          delete list.dataset.animating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }
    const previousTransition = list.style.transition;
    const transformsValue = transforms.join(' ');
    list.style.transition = 'none';
    list.style.transform = transformsValue;
    list.style.filter = 'brightness(0.96)';
    list.style.opacity = '0.98';
    requestAnimationFrame(() => {
      list.style.transition = `transform ${durationIn}ms ${easing}, filter ${durationIn}ms ${easing}, opacity ${durationIn}ms ${easing}`;
      list.style.transform = 'none';
      list.style.filter = 'none';
      list.style.opacity = '';
    });
    const timer = window.setTimeout(() => {
      const active = composerListTransitions.get(list);
      if (!active || active.timer !== timer) return;
      list.style.transition = previousTransition;
      composerListTransitions.delete(list);
      delete list.dataset.animating;
    }, durationIn + 40);
    composerListTransitions.set(list, { timer, restoreTransition: previousTransition });
  };

  if (immediate) run();
  else requestAnimationFrame(run);
}

function cancelComposerOrderMainTransition(main) {
  if (!main) return;
  const active = composerOrderMainTransitions.get(main);
  if (!active) return;
  composerOrderMainTransitions.delete(main);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimeout(active.timer);
  if (active.restoreTransition != null) main.style.transition = active.restoreTransition;
  main.style.transform = 'none';
  main.style.filter = 'none';
  if (main.style.opacity && main.style.opacity !== '1') main.style.opacity = '';
  delete main.dataset.orderMainAnimating;
}

function animateComposerOrderMainReset(host, previousRect, options = {}) {
  if (!host || !previousRect) return;
  const main = host.querySelector('.composer-order-main');
  if (!main || !main.isConnected) return;
  cancelComposerOrderMainTransition(main);

  const reduceMotion = composerPrefersReducedMotion();
  const { durationOut, easing } = getComposerInlineAnimConfig();
  const duration = typeof durationOut === 'number' ? durationOut : 0;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  if (immediate) return;

  const run = () => {
    if (!main.isConnected) return;
    const nextRect = captureElementRect(main);
    if (!nextRect) return;

    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;

    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;

    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.97)', opacity: 0.99 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];

    main.dataset.orderMainAnimating = 'true';

    if (typeof main.animate === 'function') {
      let animation = null;
      try {
        animation = main.animate(keyframes, { duration, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerOrderMainTransitions.set(main, { animation });
        const finalize = () => {
          const active = composerOrderMainTransitions.get(main);
          if (!active || active.animation !== animation) return;
          composerOrderMainTransitions.delete(main);
          delete main.dataset.orderMainAnimating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }

    const previousTransition = main.style.transition;
    const transformsValue = transforms.join(' ');
    main.style.transition = 'none';
    main.style.transform = transformsValue;
    main.style.filter = 'brightness(0.97)';
    main.style.opacity = '0.99';
    requestAnimationFrame(() => {
      if (!main.isConnected) return;
      main.style.transition = `transform ${duration}ms ${easing}, filter ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
      main.style.transform = 'none';
      main.style.filter = 'none';
      main.style.opacity = '';
    });
    const timer = window.setTimeout(() => {
      const active = composerOrderMainTransitions.get(main);
      if (!active || active.timer !== timer) return;
      main.style.transition = previousTransition;
      composerOrderMainTransitions.delete(main);
      delete main.dataset.orderMainAnimating;
    }, duration + 40);
    composerOrderMainTransitions.set(main, { timer, restoreTransition: previousTransition });
  };

  requestAnimationFrame(run);
}

function getActiveComposerFile() {
  if (activeComposerFile === 'tabs') return 'tabs';
  if (activeComposerFile === 'site') return 'site';
  return 'index';
}

function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

function safeString(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureToastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    root.style.position = 'fixed';
    root.style.right = '28px';
    root.style.bottom = '28px';
    root.style.left = 'auto';
    root.style.transform = 'none';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'flex-end';
    root.style.gap = '.55rem';
    root.style.zIndex = '10000';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
  }
  return root;
}

function prepareToastStackAnimation(container, excluded) {
  if (!container) return null;
  const items = Array.from(container.children || [])
    .filter((child) => child !== excluded && child.dataset && child.dataset.dismissed !== 'true');
  if (!items.length) return null;

  const initialRects = new Map();
  for (const item of items) {
    try {
      initialRects.set(item, item.getBoundingClientRect());
    } catch (_) {
      /* ignore */
    }
  }

  return () => {
    if (!items.length) return;
    requestAnimationFrame(() => {
      for (const item of items) {
        const first = initialRects.get(item);
        if (!first) continue;
        let last;
        try {
          last = item.getBoundingClientRect();
        } catch (_) {
          continue;
        }
        const deltaY = first.top - last.top;
        if (Math.abs(deltaY) < 0.5) continue;
        try {
          item.style.willChange = 'transform';
          const distance = Math.abs(deltaY);
          const baseDuration = distance > 1 ? Math.min(640, 320 + distance * 4) : 360;
          if (typeof item.animate === 'function') {
            const animation = item.animate(
              [
                { transform: `translateY(${deltaY}px)` },
                { transform: 'translateY(0)' }
              ],
              {
                duration: baseDuration,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'none'
              }
            );
            const cleanup = () => {
              item.style.transform = '';
              item.style.willChange = '';
            };
            animation.addEventListener('finish', cleanup, { once: true });
            animation.addEventListener('cancel', cleanup, { once: true });
          } else {
            const previousTransition = item.style.transition;
            item.style.transition = 'none';
            item.style.transform = `translateY(${deltaY}px)`;
            requestAnimationFrame(() => {
              item.style.transition = `transform ${baseDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
              item.style.transform = 'translateY(0)';
              setTimeout(() => {
                item.style.transition = previousTransition;
                item.style.transform = '';
                item.style.willChange = '';
              }, baseDuration + 80);
            });
          }
        } catch (_) {
          /* ignore */
        }
      }
    });
  };
}

function showToast(kind, text, options = {}) {
  try {
    const message = safeString(text);
    if (!message) return;
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = `toast ${kind || ''}`;
    el.style.pointerEvents = 'auto';
    el.style.background = 'color-mix(in srgb, var(--card) 94%, #000 6%)';
    el.style.color = 'var(--text)';
    el.style.borderRadius = '999px';
    el.style.padding = '.55rem 1.1rem';
    el.style.boxShadow = '0 10px 30px rgba(15,23,42,0.18)';
    el.style.border = '1px solid color-mix(in srgb, var(--border) 65%, #000 25%)';
    el.style.fontSize = '.94rem';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.minWidth = 'min(320px, 90vw)';
    el.style.maxWidth = '90vw';
    el.style.textAlign = 'center';
    el.style.transition = 'opacity .28s ease, transform .28s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.gap = '.7rem';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.flex = '1 1 auto';
    textSpan.style.textAlign = 'center';
    textSpan.style.minWidth = '0';
    el.appendChild(textSpan);

    const action = options && options.action;
    const hasAction = !!(action && (action.href || typeof action.onClick === 'function'));
    const shouldAutoDismiss = options.sticky !== true && !hasAction;

    const dismiss = () => {
      if (el.dataset.dismissed === 'true') return;
      el.dataset.dismissed = 'true';
      let toastRect = null;
      let rootRect = null;
      try {
        toastRect = el.getBoundingClientRect();
        rootRect = root.getBoundingClientRect();
      } catch (_) {
        /* ignore */
      }
      const animateStack = prepareToastStackAnimation(root, el);
      el.style.pointerEvents = 'none';
      if (toastRect && rootRect) {
        const offsetBottom = rootRect.bottom - toastRect.bottom;
        const offsetRight = rootRect.right - toastRect.right;
        el.style.position = 'absolute';
        el.style.bottom = `${offsetBottom}px`;
        el.style.right = `${offsetRight}px`;
        el.style.left = 'auto';
        el.style.top = 'auto';
        el.style.margin = '0';
        el.style.width = `${toastRect.width}px`;
        el.style.height = `${toastRect.height}px`;
        el.style.zIndex = '1';
      }
      if (typeof animateStack === 'function') {
        try { animateStack(); } catch (_) {}
      }
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      setTimeout(() => {
        try { el.remove(); } catch (_) {}
      }, 320);
    };

    if (hasAction) {
      el.style.justifyContent = 'space-between';
      textSpan.style.textAlign = 'left';
      const actionEl = document.createElement(action.href ? 'a' : 'button');
      actionEl.className = 'toast-action';
      const defaultLabel = t('editor.toast.openAction');
      actionEl.textContent = safeString(action.label) || defaultLabel;
      if (action.href) {
        actionEl.href = action.href;
        actionEl.target = action.target || '_blank';
        actionEl.rel = action.rel || 'noopener';
      } else {
        actionEl.type = 'button';
      }
      actionEl.style.flex = '0 0 auto';
      actionEl.style.marginLeft = '.35rem';
      actionEl.style.padding = '.35rem .85rem';
      actionEl.style.borderRadius = '999px';
      actionEl.style.border = '1px solid color-mix(in srgb, var(--primary) 28%, var(--border))';
      actionEl.style.background = 'color-mix(in srgb, var(--card) 88%, var(--primary) 10%)';
      actionEl.style.color = 'color-mix(in srgb, var(--primary) 85%, var(--text) 40%)';
      actionEl.style.fontWeight = '600';
      actionEl.style.fontSize = '.88rem';
      actionEl.style.pointerEvents = 'auto';
      actionEl.style.textDecoration = 'none';
      actionEl.style.display = 'inline-flex';
      actionEl.style.alignItems = 'center';
      actionEl.style.justifyContent = 'center';
      actionEl.style.gap = '.35rem';
      actionEl.style.cursor = 'pointer';
      if (typeof action.onClick === 'function') {
        actionEl.addEventListener('click', (event) => {
          try { action.onClick(event); } catch (_) {}
        });
      }
      el.appendChild(actionEl);
    }

    if (!shouldAutoDismiss) {
      el.style.justifyContent = 'space-between';
      textSpan.style.textAlign = 'left';
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'toast-close';
      closeButton.setAttribute('aria-label', t('editor.toast.closeAria'));
      closeButton.textContent = '\u00D7';
      closeButton.style.flex = '0 0 auto';
      closeButton.style.marginLeft = '.5rem';
      closeButton.style.width = '2rem';
      closeButton.style.height = '2rem';
      closeButton.style.borderRadius = '50%';
      closeButton.style.border = '1px solid color-mix(in srgb, var(--border) 70%, transparent)';
      closeButton.style.background = 'transparent';
      closeButton.style.color = 'inherit';
      closeButton.style.fontSize = '1.1rem';
      closeButton.style.lineHeight = '1';
      closeButton.style.display = 'inline-flex';
      closeButton.style.alignItems = 'center';
      closeButton.style.justifyContent = 'center';
      closeButton.style.cursor = 'pointer';
      closeButton.style.pointerEvents = 'auto';
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      });
      el.appendChild(closeButton);
    }

    if (kind === 'error') {
      el.style.borderColor = 'color-mix(in srgb, #dc2626 45%, transparent)';
    } else if (kind === 'success') {
      el.style.borderColor = 'color-mix(in srgb, #16a34a 45%, transparent)';
    } else if (kind === 'warn' || kind === 'warning') {
      el.style.borderColor = 'color-mix(in srgb, #f59e0b 45%, transparent)';
    }
    root.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    if (shouldAutoDismiss) {
      const ttl = typeof options.duration === 'number' ? Math.max(1200, options.duration) : 2300;
      setTimeout(dismiss, ttl);
    }
  } catch (_) {
    try { alert(text); } catch (__) {}
  }
}

// --- GitHub sync overlay and remote polling helpers ---

let syncOverlayElements = null;
let syncOverlayCancelHandler = null;
let activeSyncWatcher = null;

function ensureSyncOverlayElements() {
  if (syncOverlayElements) return syncOverlayElements;
  if (typeof document === 'undefined') return null;

  const overlay = document.createElement('div');
  overlay.id = 'nsSyncOverlay';
  overlay.className = 'sync-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'sync-overlay-panel';
  panel.setAttribute('role', 'document');

  const spinner = document.createElement('div');
  spinner.className = 'sync-overlay-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const title = document.createElement('h2');
  title.className = 'sync-overlay-title';
  title.id = 'nsSyncOverlayTitle';
  title.textContent = 'Waiting for GitHub…';
  title.tabIndex = -1;

  const message = document.createElement('p');
  message.className = 'sync-overlay-message';
  message.id = 'nsSyncOverlayMessage';

  const status = document.createElement('p');
  status.className = 'sync-overlay-status';
  status.id = 'nsSyncOverlayStatus';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary sync-overlay-cancel';
  cancelBtn.textContent = 'Stop waiting';

  panel.append(spinner, title, message, status, cancelBtn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  cancelBtn.addEventListener('click', () => {
    if (syncOverlayCancelHandler) syncOverlayCancelHandler('button');
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && syncOverlayCancelHandler) {
      syncOverlayCancelHandler('backdrop');
    }
  });

  overlay.addEventListener('keydown', (event) => {
    if ((event.key || '').toLowerCase() === 'escape' && syncOverlayCancelHandler) {
      event.preventDefault();
      syncOverlayCancelHandler('escape');
    }
  });

  syncOverlayElements = { overlay, panel, spinner, title, message, status, cancelBtn };
  return syncOverlayElements;
}

function setSyncOverlayTitle(text) {
  const els = syncOverlayElements || ensureSyncOverlayElements();
  if (!els || !els.title) return;
  els.title.textContent = text || 'Waiting for GitHub…';
}

function setSyncOverlayMessage(text) {
  const els = syncOverlayElements || ensureSyncOverlayElements();
  if (!els || !els.message) return;
  els.message.textContent = text ? String(text) : '';
}

function setSyncOverlayStatus(text) {
  const els = syncOverlayElements || ensureSyncOverlayElements();
  if (!els || !els.status) return;
  els.status.textContent = text ? String(text) : '';
}

function setSyncOverlayCancelHandler(handler, cancelable = true) {
  const els = syncOverlayElements || ensureSyncOverlayElements();
  if (!els || !els.cancelBtn) return;
  if (cancelable && typeof handler === 'function') {
    syncOverlayCancelHandler = handler;
    els.cancelBtn.hidden = false;
    els.cancelBtn.disabled = false;
  } else {
    syncOverlayCancelHandler = null;
    els.cancelBtn.hidden = true;
    els.cancelBtn.disabled = true;
  }
}

function showSyncOverlay(options = {}) {
  const els = ensureSyncOverlayElements();
  if (!els || !els.overlay) return;

  const title = options.title || 'Waiting for GitHub…';
  const message = options.message || '';
  const status = options.status || '';
  const cancelLabel = options.cancelLabel || 'Stop waiting';
  const cancelable = options.cancelable !== false;

  setSyncOverlayTitle(title);
  setSyncOverlayMessage(message);
  setSyncOverlayStatus(status);

  try {
    els.overlay.hidden = false;
    els.overlay.classList.add('is-visible');
    els.overlay.setAttribute('aria-hidden', 'false');
  } catch (_) {}

  if (els.cancelBtn) {
    els.cancelBtn.textContent = cancelLabel;
  }
  setSyncOverlayCancelHandler(null, cancelable);

  try { document.body.classList.add('ns-sync-overlay-open'); }
  catch (_) {}

  requestAnimationFrame(() => {
    try {
      if (cancelable && els.cancelBtn && !els.cancelBtn.hidden) {
        els.cancelBtn.focus();
      } else if (els.title) {
        els.title.focus({ preventScroll: true });
      }
    } catch (_) {}
  });
}

function hideSyncOverlay() {
  const els = syncOverlayElements || ensureSyncOverlayElements();
  if (!els || !els.overlay) return;
  try {
    els.overlay.classList.remove('is-visible');
    els.overlay.setAttribute('aria-hidden', 'true');
    els.overlay.hidden = true;
  } catch (_) {}
  setSyncOverlayCancelHandler(null, true);
  try { document.body.classList.remove('ns-sync-overlay-open'); }
  catch (_) {}
}

function preparePopupWindow() {
  try {
    const win = window.open('', '_blank');
    if (win) {
      try { win.opener = null; } catch (_) {}
    }
    return win;
  } catch (_) {
    return null;
  }
}

function closePopupWindow(win) {
  if (!win) return;
  try {
    if (!win.closed) win.close();
  } catch (_) {}
}

function finalizePopupWindow(win, href) {
  if (!href) {
    closePopupWindow(win);
    return null;
  }
  if (win && !win.closed) {
    try {
      win.location.replace(href);
      win.opener = null;
      return win;
    } catch (_) {
      closePopupWindow(win);
    }
  }
  let opened = null;
  try {
    opened = window.open(href, '_blank');
  } catch (_) {
    opened = null;
  }
  if (opened) {
    try { opened.opener = null; } catch (_) {}
    return opened;
  }
  return null;
}

function handlePopupBlocked(href, options = {}) {
  try {
    console.warn('Popup blocked while opening GitHub window', href);
  } catch (_) {}
  const message = safeString(options.message) || t('editor.toasts.popupBlocked');
  const kind = safeString(options.kind) || 'warn';
  const duration = typeof options.duration === 'number' ? Math.max(1600, options.duration) : 9000;
  const actionHref = safeString(options.actionHref || href);
  const actionLabel = safeString(options.actionLabel) || t('editor.toasts.openGithubAction');
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

  showToast(kind, message, {
    duration,
    action: actionHref
      ? {
          label: actionLabel,
          href: actionHref,
          target: safeString(options.actionTarget) || '_blank',
          rel: safeString(options.actionRel) || 'noopener',
          onClick: (event) => {
            if (onRetry) {
              setTimeout(() => {
                try { onRetry(event); } catch (_) {}
              }, 60);
            }
          }
        }
      : null
  });
}

function sleep(ms) {
  const timeout = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => { setTimeout(resolve, timeout); });
}

function getCachedFineGrainedToken() {
  try {
    const value = sessionStorage.getItem(GITHUB_PAT_STORAGE_KEY);
    if (typeof value === 'string' && value) {
      cachedFineGrainedTokenMemory = value;
      return value;
    }
  } catch (_) {
    /* ignore unavailable storage */
  }
  return cachedFineGrainedTokenMemory || '';
}

function setCachedFineGrainedToken(token) {
  const trimmed = String(token || '').trim();
  cachedFineGrainedTokenMemory = trimmed;
  try {
    if (trimmed) sessionStorage.setItem(GITHUB_PAT_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(GITHUB_PAT_STORAGE_KEY);
  } catch (_) {
    /* ignore storage errors */
  }
}

function clearCachedFineGrainedToken() {
  cachedFineGrainedTokenMemory = '';
  try { sessionStorage.removeItem(GITHUB_PAT_STORAGE_KEY); }
  catch (_) { /* ignore */ }
}

function getFineGrainedTokenValue() {
  const input = document.getElementById('syncGithubTokenInput');
  const value = input && typeof input.value === 'string' ? input.value.trim() : '';
  return value || getCachedFineGrainedToken();
}

function renderFineGrainedTokenSettings(host) {
  if (!host) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'cs-token-settings';

  const tokenField = document.createElement('label');
  tokenField.className = 'cs-repo-field-group cs-repo-field-group--token cs-token-field';
  const title = document.createElement('span');
  title.className = 'cs-repo-field-title';
  title.textContent = t('editor.composer.github.modal.tokenLabel');
  const field = document.createElement('div');
  field.className = 'cs-repo-field cs-repo-field--token';
  const affix = document.createElement('span');
  affix.className = 'cs-repo-affix cs-repo-icon-affix cs-token-affix';
  affix.setAttribute('aria-hidden', 'true');
  affix.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="M10.5 0a5.499 5.499 0 1 1-1.288 10.848l-.932.932a.749.749 0 0 1-.53.22H7v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22H5v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22h-2A1.75 1.75 0 0 1 0 14.25v-2c0-.199.079-.389.22-.53l4.932-4.932A5.5 5.5 0 0 1 10.5 0Zm-4 5.5c-.001.431.069.86.205 1.269a.75.75 0 0 1-.181.768L1.5 12.56v1.69c0 .138.112.25.25.25h1.69l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l1.023-1.025a.75.75 0 0 1 .768-.18A4 4 0 1 0 6.5 5.5ZM11 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>';
  const input = document.createElement('input');
  input.id = 'syncGithubTokenInput';
  input.type = 'password';
  input.className = 'cs-input cs-repo-input cs-repo-input--token';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = getCachedFineGrainedToken();
  const btnForget = document.createElement('span');
  btnForget.setAttribute('role', 'button');
  btnForget.tabIndex = input.value ? 0 : -1;
  btnForget.className = 'cs-token-clear';
  btnForget.textContent = '×';
  btnForget.setAttribute('aria-label', t('editor.composer.github.modal.forget'));
  btnForget.setAttribute('aria-disabled', input.value ? 'false' : 'true');
  field.append(affix, input, btnForget);
  tokenField.append(title, field);
  wrapper.appendChild(tokenField);

  const help = document.createElement('p');
  help.className = 'muted sync-token-help cs-token-help';
  help.innerHTML = t('editor.composer.github.modal.helpHtml');
  wrapper.appendChild(help);

  input.addEventListener('input', () => {
    setCachedFineGrainedToken(input.value);
    const hasValue = !!String(input.value || '').trim();
    btnForget.setAttribute('aria-disabled', hasValue ? 'false' : 'true');
    btnForget.tabIndex = hasValue ? 0 : -1;
  });

  const clearToken = () => {
    if (btnForget.getAttribute('aria-disabled') === 'true') return;
    clearCachedFineGrainedToken();
    input.value = '';
    btnForget.setAttribute('aria-disabled', 'true');
    btnForget.tabIndex = -1;
    try { input.focus({ preventScroll: true }); }
    catch (_) { input.focus(); }
  };

  btnForget.addEventListener('click', clearToken);
  btnForget.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    clearToken();
  });

  host.appendChild(wrapper);
  return { wrapper, input, btnForget };
}

function startRemoteSyncWatcher(config = {}) {
  if (!config || typeof config.fetch !== 'function') return null;
  if (activeSyncWatcher && typeof activeSyncWatcher.cancel === 'function') {
    try { activeSyncWatcher.cancel('replaced'); } catch (_) {}
  }

  const overlayTitle = config.title || t('editor.composer.remoteWatcher.waitingForGitHub');
  const overlayMessage = config.message || '';
  const overlayStatus = config.initialStatus || t('editor.composer.remoteWatcher.preparing');
  const cancelLabel = config.cancelLabel || t('editor.composer.remoteWatcher.stopWaiting');
  const cancelable = config.cancelable !== false;

  showSyncOverlay({ title: overlayTitle, message: overlayMessage, status: overlayStatus, cancelLabel, cancelable });
  setSyncOverlayStatus(overlayStatus);

  let aborted = false;
  let attempts = 0;
  let timer = null;

  const cancel = (reason) => {
    if (aborted) return;
    aborted = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    hideSyncOverlay();
    activeSyncWatcher = null;
    if (typeof config.onCancel === 'function') {
      try { config.onCancel(reason); } catch (_) {}
    }
  };

  setSyncOverlayCancelHandler(cancelable ? cancel : null, cancelable);

  const scheduleNext = (delay) => {
    if (aborted) return;
    const ms = Math.max(1200, Number(delay) || 0);
    if (timer) clearTimeout(timer);
    timer = setTimeout(runFetch, ms);
  };

  const runFetch = async () => {
    if (aborted) return;
    attempts += 1;
    let result;
    try {
      result = await config.fetch({ attempts, updateStatus: setSyncOverlayStatus });
    } catch (err) {
      if (aborted) return;
      const msg = (typeof config.onErrorStatus === 'function')
        ? config.onErrorStatus(err, attempts)
        : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
      setSyncOverlayStatus(msg);
      scheduleNext(config.errorDelay || 6000);
      return;
    }

    if (aborted) return;
    if (result && result.statusMessage) setSyncOverlayStatus(result.statusMessage);
    if (result && result.message) setSyncOverlayMessage(result.message);

    if (result && result.done) {
      aborted = true;
      hideSyncOverlay();
      activeSyncWatcher = null;
      if (typeof config.onSuccess === 'function') {
        try { config.onSuccess(result); } catch (_) {}
      }
      return;
    }

    const nextDelay = result && typeof result.retryDelay === 'number'
      ? result.retryDelay
      : config.interval || 5000;
    scheduleNext(nextDelay);
  };

  activeSyncWatcher = { cancel, attempts: () => attempts };

  const initialDelay = config.initialDelay != null ? config.initialDelay : 2400;
  scheduleNext(initialDelay);
  return activeSyncWatcher;
}

async function fetchMarkdownRemoteSnapshot(tab) {
  if (!tab || !tab.path) return null;
  const root = getContentRootSafe();
  const rel = normalizeRelPath(tab.path);
  if (!rel) return null;
  const url = `${root}/${rel}`.replace(/[\\]/g, '/');
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    return { state: 'error', status: 0, message: err && err.message ? err.message : t('editor.composer.remoteWatcher.networkError') };
  }

  const checkedAt = Date.now();

  if (res.status === 404) {
    return { state: 'missing', status: 404, content: '', signature: computeTextSignature(''), checkedAt };
  }

  if (!res.ok) {
    return { state: 'error', status: res.status, message: `HTTP ${res.status}`, checkedAt };
  }

  const text = normalizeMarkdownContent(await res.text());
  return {
    state: 'existing',
    status: res.status,
    content: text,
    signature: computeTextSignature(text),
    checkedAt
  };
}

function applyMarkdownRemoteSnapshot(tab, snapshot) {
  if (!tab) return;
  const normalized = normalizeMarkdownContent(snapshot && snapshot.content != null ? snapshot.content : '');
  tab.remoteContent = normalized;
  tab.remoteSignature = computeTextSignature(normalized);
  tab.loaded = true;

  const stateLabel = snapshot && snapshot.state === 'missing' ? 'missing' : 'existing';
  const statusCode = snapshot && snapshot.status;
  const statusMessage = snapshot && snapshot.state === 'missing'
    ? t('editor.composer.remoteWatcher.fileNotFoundOnServer')
    : t('editor.composer.remoteWatcher.remoteSnapshotUpdated');

  setDynamicTabStatus(tab, {
    state: stateLabel,
    checkedAt: Date.now(),
    code: statusCode,
    message: statusMessage
  });

  if (!tab.localDraft || !tab.localDraft.content) {
    const currentNormalized = normalizeMarkdownContent(tab.content || '');
    tab.content = currentNormalized;
    if (currentNormalized !== normalized) {
      tab.content = normalized;
      if (currentMode === tab.mode) {
        const editorApi = getPrimaryEditorApi();
        if (editorApi && typeof editorApi.setValue === 'function') {
          try { editorApi.setValue(normalized, { notify: false }); } catch (_) {}
        }
      }
    }
  }

  updateDynamicTabDirtyState(tab, { autoSave: false });
  updateComposerMarkdownDraftIndicators({ path: tab.path });
}

function startMarkdownSyncWatcher(tab, options = {}) {
  if (!tab || !tab.path) return;
  const expectedSignature = options.expectedSignature || computeTextSignature(tab.content || '');
  const label = options.label || tab.label || basenameFromPath(tab.path) || tab.path;
  const isCreate = !!options.isCreate;
  const message = isCreate
    ? t('editor.composer.remoteWatcher.waitingForCreate', { label })
    : t('editor.composer.remoteWatcher.waitingForUpdate', { label });

  const previousStatus = tab.fileStatus && typeof tab.fileStatus === 'object'
    ? { ...tab.fileStatus }
    : null;

  setDynamicTabStatus(tab, {
    state: 'checking',
    checkedAt: Date.now(),
    message: t('editor.composer.remoteWatcher.waitingForCommitStatus')
  });
  updateMarkdownPushButton(tab);

  startRemoteSyncWatcher({
    title: t('editor.composer.remoteWatcher.checkingRemoteChanges'),
    message,
    initialStatus: t('editor.composer.remoteWatcher.waitingForCommit'),
    cancelLabel: t('editor.composer.remoteWatcher.stopWaiting'),
    fetch: async ({ attempts }) => {
      const snapshot = await fetchMarkdownRemoteSnapshot(tab);
      if (!snapshot) {
        return { done: false, statusMessage: t('editor.composer.remoteWatcher.waitingForRemoteResponse'), retryDelay: 5000 };
      }
      if (snapshot.state === 'error') {
        const msg = snapshot.message
          ? t('editor.composer.remoteWatcher.errorWithDetail', { message: snapshot.message })
          : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
        return { done: false, statusMessage: msg, retryDelay: 6000 };
      }
      if (snapshot.state === 'missing') {
        const done = expectedSignature === computeTextSignature('');
        const statusMessage = isCreate
          ? t('editor.composer.remoteWatcher.remoteFileNotFoundYet')
          : t('editor.composer.remoteWatcher.remoteFileStillMissing');
        return { done, data: snapshot, statusMessage, retryDelay: 5600 };
      }
      const matches = snapshot.signature === expectedSignature;
      if (matches) {
        return { done: true, data: snapshot, statusMessage: t('editor.composer.remoteWatcher.updateDetectedRefreshing') };
      }
      const waitingStatus = attempts >= 3
        ? t('editor.composer.remoteWatcher.remoteFileDiffersWaiting')
        : t('editor.composer.remoteWatcher.remoteFileExistsDiffersWaiting');
      const response = {
        done: false,
        statusMessage: waitingStatus,
        retryDelay: 5200
      };
      if (attempts === 3) {
        response.message = t('editor.composer.remoteWatcher.mismatchAdvice');
      }
      return response;
    },
    onSuccess: (result) => {
      if (result && result.data) {
        applyMarkdownRemoteSnapshot(tab, result.data);
        if (result.mismatch) {
          showToast('warn', t('editor.toasts.remoteMarkdownMismatch'), { duration: 4200 });
        } else {
          showToast('success', t('editor.toasts.markdownSynced'));
        }
      }
      updateMarkdownPushButton(tab);
      updateMarkdownDiscardButton(tab);
      updateMarkdownSaveButton(tab);
    },
    onCancel: () => {
      const fallbackStatus = (previousStatus && previousStatus.state)
        ? previousStatus
        : { state: isCreate ? 'missing' : 'existing' };
      setDynamicTabStatus(tab, {
        ...fallbackStatus,
        checkedAt: Date.now(),
        message: t('editor.composer.remoteWatcher.remoteCheckCanceled')
      });
      updateMarkdownPushButton(tab);
      updateMarkdownDiscardButton(tab);
      updateMarkdownSaveButton(tab);
      showToast('info', t('editor.toasts.remoteCheckCanceledUseRefresh'));
    }
  });
}

async function fetchComposerRemoteSnapshot(kind) {
  const safeKind = kind === 'tabs' ? 'tabs' : (kind === 'site' ? 'site' : 'index');
  const root = getContentRootSafe();
  const base = safeKind === 'tabs' ? 'tabs' : (safeKind === 'site' ? 'site' : 'index');
  const urls = [`${root}/${base}.yaml`, `${root}/${base}.yml`];
  let lastStatus = 404;
  for (const url of urls) {
    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
      return { state: 'error', status: 0, message: err && err.message ? err.message : t('editor.composer.remoteWatcher.networkError') };
    }
    lastStatus = res.status;
    if (res.status === 404) continue;
    if (!res.ok) {
      return { state: 'error', status: res.status, message: `HTTP ${res.status}` };
    }
    const text = await res.text();
    let parsed = null;
    try { parsed = parseYAML(text); }
    catch (_) { parsed = null; }
    return {
      state: 'existing',
      status: res.status,
      text,
      parsed,
      signature: computeTextSignature(text)
    };
  }
  return { state: 'missing', status: lastStatus };
}

function applyComposerRemoteSnapshot(kind, snapshot) {
  const safeKind = kind === 'tabs' ? 'tabs' : (kind === 'site' ? 'site' : 'index');
  if (!snapshot || snapshot.state !== 'existing') return;
  let parsed = snapshot.parsed;
  if (!parsed || typeof parsed !== 'object') {
    try { parsed = parseYAML(snapshot.text || ''); }
    catch (_) { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') {
    const targetLabel = safeKind === 'tabs' ? 'tabs.yaml' : (safeKind === 'site' ? 'site.yaml' : 'index.yaml');
    showToast('warn', t('editor.toasts.yamlParseFailed', { label: targetLabel }), { duration: 4200 });
    return;
  }
  let prepared;
  if (safeKind === 'tabs') prepared = prepareTabsState(parsed || {});
  else if (safeKind === 'site') prepared = cloneSiteState(prepareSiteState(parsed || {}));
  else prepared = prepareIndexState(parsed || {});
  remoteBaseline[safeKind] = safeKind === 'site' ? prepared : deepClone(prepared);
  notifyComposerChange(safeKind, { skipAutoSave: true });
}

function startComposerSyncWatcher(kind, options = {}) {
  const safeKind = kind === 'tabs' ? 'tabs' : (kind === 'site' ? 'site' : 'index');
  const label = safeKind === 'tabs' ? 'tabs.yaml' : (safeKind === 'site' ? 'site.yaml' : 'index.yaml');
  const expectedText = options.expectedText != null ? String(options.expectedText) : '';
  const expectedSignature = computeTextSignature(expectedText);
  const message = options.message || t('editor.composer.remoteWatcher.waitingForLabel', { label });

  startRemoteSyncWatcher({
    title: options.title || t('editor.composer.remoteWatcher.waitingForGitHub'),
    message,
    initialStatus: options.initialStatus || t('editor.composer.remoteWatcher.waitingForCommit'),
    cancelLabel: options.cancelLabel || t('editor.composer.remoteWatcher.stopWaiting'),
    fetch: async ({ attempts }) => {
      const snapshot = await fetchComposerRemoteSnapshot(safeKind);
      if (!snapshot) {
        return { done: false, statusMessage: t('editor.composer.remoteWatcher.waitingForRemote'), retryDelay: 5200 };
      }
      if (snapshot.state === 'missing') {
        return { done: false, statusMessage: t('editor.composer.remoteWatcher.yamlNotFoundYet', { label }), retryDelay: 5600 };
      }
      if (snapshot.state === 'error') {
        const msg = snapshot.message
          ? t('editor.composer.remoteWatcher.errorWithDetail', { message: snapshot.message })
          : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
        return { done: false, statusMessage: msg, retryDelay: 6200 };
      }
      const matches = snapshot.signature === expectedSignature;
      if (matches) {
        return { done: true, data: snapshot, statusMessage: t('editor.composer.remoteWatcher.updateDetectedRefreshing') };
      }
      const waitingStatus = attempts >= 3
        ? t('editor.composer.remoteWatcher.remoteYamlDiffersWaiting')
        : t('editor.composer.remoteWatcher.remoteYamlExistsDiffersWaiting');
      const response = {
        done: false,
        statusMessage: waitingStatus,
        retryDelay: 5400
      };
      if (attempts === 3) {
        response.message = t('editor.composer.remoteWatcher.yamlMismatchAdvice');
      }
      return response;
    },
    onSuccess: (result) => {
      if (result && result.data) {
        applyComposerRemoteSnapshot(safeKind, result.data);
        if (result.mismatch) {
          showToast('warn', t('editor.toasts.yamlUpdatedDifferently', { label }), { duration: 4600 });
        } else {
          clearDraftStorage(safeKind);
          updateUnsyncedSummary();
          const modal = composerDiffModal;
          const matchesKind = modal && typeof modal.getActiveKind === 'function'
            ? modal.getActiveKind() === safeKind
            : true;
          const isOpen = modal && modal.modal && modal.modal.classList
            ? (modal.modal.classList.contains('is-open') && modal.modal.getAttribute('aria-hidden') !== 'true')
            : false;
          if (modal && typeof modal.close === 'function' && matchesKind && isOpen) {
            try { modal.close(); } catch (_) {}
          }
          showToast('success', t('editor.toasts.yamlSynced', { label }));
        }
      }
    },
    onCancel: () => {
      showToast('info', t('editor.toasts.remoteCheckCanceledClickRefresh'));
    }
  });
}

function setButtonLabel(btn, label) {
  if (!btn) return;
  const span = btn.querySelector('.btn-label');
  if (span) span.textContent = String(label || '');
  else btn.textContent = String(label || '');
}

function getButtonLabel(btn) {
  if (!btn) return '';
  const span = btn.querySelector('.btn-label');
  if (span) return span.textContent || '';
  return btn.textContent || '';
}

function truncateText(value, max = 60) {
  const str = safeString(value);
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

function prepareIndexState(raw) {
  const output = { __order: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return output;
  const seen = new Set();
  const order = Array.isArray(raw.__order) ? raw.__order.filter(k => typeof k === 'string' && k) : [];
  order.forEach(key => {
    if (seen.has(key)) return;
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeIndexEntry(raw[key]);
  });
  Object.keys(raw).forEach(key => {
    if (key === '__order') return;
    if (seen.has(key)) {
      if (!Object.prototype.hasOwnProperty.call(output, key)) output[key] = normalizeIndexEntry(raw[key]);
      return;
    }
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeIndexEntry(raw[key]);
  });
  return output;
}

function normalizeIndexEntry(entry) {
  const out = {};
  if (!entry || typeof entry !== 'object') return out;
  Object.keys(entry).forEach(lang => {
    if (lang === '__order') return;
    const value = entry[lang];
    if (Array.isArray(value)) {
      out[lang] = value.map(item => safeString(item));
    } else if (value != null && typeof value === 'object') {
      // Unexpected object -> stringify to keep placeholder
      out[lang] = safeString(value.location || value.path || '');
    } else {
      out[lang] = safeString(value);
    }
  });
  return out;
}

function prepareTabsState(raw) {
  const output = { __order: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return output;
  const seen = new Set();
  const order = Array.isArray(raw.__order) ? raw.__order.filter(k => typeof k === 'string' && k) : [];
  order.forEach(key => {
    if (seen.has(key)) return;
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeTabsEntry(raw[key]);
  });
  Object.keys(raw).forEach(key => {
    if (key === '__order') return;
    if (seen.has(key)) {
      if (!Object.prototype.hasOwnProperty.call(output, key)) output[key] = normalizeTabsEntry(raw[key]);
      return;
    }
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeTabsEntry(raw[key]);
  });
  return output;
}

function normalizeTabsEntry(entry) {
  const out = {};
  if (!entry || typeof entry !== 'object') return out;
  Object.keys(entry).forEach(lang => {
    if (lang === '__order') return;
    const value = entry[lang];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[lang] = {
        title: safeString(value.title),
        location: safeString(value.location)
      };
    } else {
      out[lang] = { title: '', location: safeString(value) };
    }
  });
  return out;
}

function normalizeLocalizedConfig(value, options = {}) {
  const ensureDefault = options.ensureDefault !== false;
  if (typeof value === 'string') {
    const out = {};
    if (value !== '' || ensureDefault) out.default = safeString(value);
    return out;
  }
  if (!value || typeof value !== 'object') {
    return ensureDefault ? { default: '' } : {};
  }
  const out = {};
  Object.keys(value).forEach((lang) => {
    const v = value[lang];
    if (v == null) {
      if (ensureDefault && lang === 'default' && !Object.prototype.hasOwnProperty.call(out, 'default')) out.default = '';
      return;
    }
    out[lang] = safeString(v);
  });
  if (ensureDefault && !Object.prototype.hasOwnProperty.call(out, 'default')) out.default = '';
  return out;
}

function normalizeLinkEntry(entry) {
  if (!entry || typeof entry !== 'object') return { label: '', href: '' };
  return { label: safeString(entry.label), href: safeString(entry.href) };
}

function normalizeLinkList(value) {
  if (Array.isArray(value)) return value.map(item => normalizeLinkEntry(item));
  if (value && typeof value === 'object') {
    return Object.keys(value).map(label => ({ label: safeString(label), href: safeString(value[label]) }));
  }
  return [];
}

function normalizeBoolean(value, fallback = null) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function normalizeNumber(value, fallback = null) {
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  return fallback;
}

function prepareSiteState(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const site = {};

  site.siteTitle = normalizeLocalizedConfig(src.siteTitle);
  site.siteSubtitle = normalizeLocalizedConfig(src.siteSubtitle);
  site.siteDescription = normalizeLocalizedConfig(src.siteDescription, { ensureDefault: false });
  site.siteKeywords = normalizeLocalizedConfig(src.siteKeywords, { ensureDefault: false });
  site.avatar = safeString(src.avatar || '');
  site.resourceURL = safeString(src.resourceURL || '');
  site.contentRoot = safeString(src.contentRoot || 'wwwroot');
  site.profileLinks = normalizeLinkList(src.profileLinks);
  site.contentOutdatedDays = normalizeNumber(src.contentOutdatedDays);
  site.cardCoverFallback = normalizeBoolean(src.cardCoverFallback);
  site.errorOverlay = normalizeBoolean(src.errorOverlay);
  const pageSize = src.pageSize != null ? src.pageSize : src.postsPerPage;
  site.pageSize = normalizeNumber(pageSize);
  site.defaultLanguage = safeString(src.defaultLanguage || '');
  site.themeMode = safeString(src.themeMode || '');
  site.themePack = safeString(src.themePack || '');
  site.themeOverride = normalizeBoolean(src.themeOverride);
  const enableAllPosts = normalizeBoolean(src.enableAllPosts);
  const disableAllPosts = normalizeBoolean(src.disableAllPosts);
  if (normalizeBoolean(src.showAllPosts) != null) site.showAllPosts = normalizeBoolean(src.showAllPosts);
  else if (enableAllPosts === true) site.showAllPosts = true;
  else if (disableAllPosts === true) site.showAllPosts = false;
  else site.showAllPosts = null;
  site.landingTab = safeString(src.landingTab || '');
  const repo = (src.repo && typeof src.repo === 'object') ? src.repo : {};
  site.repo = {
    owner: safeString(repo.owner || ''),
    name: safeString(repo.name || ''),
    branch: safeString(repo.branch || '')
  };
  const assetWarnings = (src.assetWarnings && typeof src.assetWarnings === 'object') ? src.assetWarnings : {};
  const largeImage = (assetWarnings.largeImage && typeof assetWarnings.largeImage === 'object') ? assetWarnings.largeImage : {};
  site.assetWarnings = {
    largeImage: {
      enabled: normalizeBoolean(largeImage.enabled),
      thresholdKB: normalizeNumber(largeImage.thresholdKB)
    }
  };

  const recognized = new Set([
    'siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords', 'avatar', 'resourceURL', 'contentRoot',
    'profileLinks', 'contentOutdatedDays', 'cardCoverFallback', 'errorOverlay', 'pageSize', 'postsPerPage',
    'defaultLanguage', 'themeMode', 'themePack', 'themeOverride', 'repo', 'assetWarnings', 'landingTab', 'showAllPosts',
    'enableAllPosts', 'disableAllPosts'
  ]);
  const deprecated = new Set(['links']);

  const extras = {};
  Object.keys(src).forEach((key) => {
    if (recognized.has(key)) return;
    if (deprecated.has(key)) return;
    extras[key] = deepClone(src[key]);
  });
  site.__extras = extras;

  return site;
}

function cloneSiteState(state) {
  if (!state || typeof state !== 'object') return { __extras: {} };
  return {
    siteTitle: deepClone(state.siteTitle || {}),
    siteSubtitle: deepClone(state.siteSubtitle || {}),
    siteDescription: deepClone(state.siteDescription || {}),
    siteKeywords: deepClone(state.siteKeywords || {}),
    avatar: safeString(state.avatar || ''),
    resourceURL: safeString(state.resourceURL || ''),
    contentRoot: safeString(state.contentRoot || ''),
    profileLinks: Array.isArray(state.profileLinks) ? deepClone(state.profileLinks) : [],
    contentOutdatedDays: state.contentOutdatedDays != null ? Number(state.contentOutdatedDays) : null,
    cardCoverFallback: normalizeBoolean(state.cardCoverFallback),
    errorOverlay: normalizeBoolean(state.errorOverlay),
    pageSize: state.pageSize != null ? Number(state.pageSize) : null,
    defaultLanguage: safeString(state.defaultLanguage || ''),
    themeMode: safeString(state.themeMode || ''),
    themePack: safeString(state.themePack || ''),
    themeOverride: normalizeBoolean(state.themeOverride),
    showAllPosts: normalizeBoolean(state.showAllPosts),
    landingTab: safeString(state.landingTab || ''),
    repo: deepClone(state.repo || { owner: '', name: '', branch: '' }),
    assetWarnings: deepClone(state.assetWarnings || { largeImage: { enabled: null, thresholdKB: null } }),
    __extras: deepClone(state.__extras || {})
  };
}

function localizedEntriesForOutput(localized, options = {}) {
  const source = localized && typeof localized === 'object' ? localized : {};
  const entries = Object.keys(source).map(key => ({ key, value: safeString(source[key]) }));
  const filtered = entries.filter(entry => entry.value != null && entry.value !== '');
  if (!filtered.length) {
    if (options.forceDefault && Object.prototype.hasOwnProperty.call(source, 'default')) {
      return { default: safeString(source.default) };
    }
    return null;
  }
  if (filtered.length === 1 && filtered[0].key === 'default') return filtered[0].value;
  filtered.sort((a, b) => {
    if (a.key === 'default') return -1;
    if (b.key === 'default') return 1;
    return a.key.localeCompare(b.key);
  });
  const out = {};
  filtered.forEach(entry => { out[entry.key] = entry.value; });
  return out;
}

function linkListForOutput(list) {
  if (!Array.isArray(list)) return null;
  const filtered = list.filter(item => item && (item.label || item.href));
  if (!filtered.length) return null;
  return filtered.map(item => ({ label: safeString(item.label || ''), href: safeString(item.href || '') }));
}

function assetWarningsForOutput(warnings) {
  if (!warnings || typeof warnings !== 'object') return null;
  const largeImage = warnings.largeImage && typeof warnings.largeImage === 'object' ? warnings.largeImage : {};
  const enabled = normalizeBoolean(largeImage.enabled);
  let threshold = null;
  if (Object.prototype.hasOwnProperty.call(largeImage, 'thresholdKB')) {
    const rawThreshold = largeImage.thresholdKB;
    const trimmed = typeof rawThreshold === 'string' ? rawThreshold.trim() : rawThreshold;
    if (trimmed !== '' && trimmed != null) {
      const normalized = normalizeNumber(trimmed);
      if (normalized != null && !Number.isNaN(normalized)) {
        threshold = normalized;
      }
    }
  }
  if (enabled == null && threshold == null) return null;
  const out = {};
  out.largeImage = {};
  if (enabled != null) out.largeImage.enabled = enabled;
  if (threshold != null) out.largeImage.thresholdKB = threshold;
  if (!Object.keys(out.largeImage).length) return null;
  return out;
}

function repoForOutput(repo) {
  if (!repo || typeof repo !== 'object') return null;
  const owner = safeString(repo.owner || '');
  const name = safeString(repo.name || '');
  const branch = safeString(repo.branch || '');
  if (!owner && !name && !branch) return null;
  const out = {};
  if (owner) out.owner = owner;
  if (name) out.name = name;
  if (branch) out.branch = branch;
  return Object.keys(out).length ? out : null;
}

function buildSiteSnapshot(state) {
  const site = cloneSiteState(state);
  const snapshot = {};

  const identityTitle = localizedEntriesForOutput(site.siteTitle, { forceDefault: true });
  if (identityTitle != null) snapshot.siteTitle = identityTitle;
  const identitySubtitle = localizedEntriesForOutput(site.siteSubtitle, { forceDefault: true });
  if (identitySubtitle != null) snapshot.siteSubtitle = identitySubtitle;
  const identityDescription = localizedEntriesForOutput(site.siteDescription);
  if (identityDescription != null) snapshot.siteDescription = identityDescription;
  const identityKeywords = localizedEntriesForOutput(site.siteKeywords);
  if (identityKeywords != null) snapshot.siteKeywords = identityKeywords;
  if (site.avatar) snapshot.avatar = site.avatar;
  if (site.profileLinks && site.profileLinks.length) {
    const links = linkListForOutput(site.profileLinks);
    if (links) snapshot.profileLinks = links;
  }
  if (site.resourceURL) snapshot.resourceURL = site.resourceURL;
  if (site.contentRoot) snapshot.contentRoot = site.contentRoot;
  if (site.contentOutdatedDays != null && !Number.isNaN(site.contentOutdatedDays)) snapshot.contentOutdatedDays = Number(site.contentOutdatedDays);
  if (site.cardCoverFallback != null) snapshot.cardCoverFallback = !!site.cardCoverFallback;
  if (site.errorOverlay != null) snapshot.errorOverlay = !!site.errorOverlay;
  if (site.pageSize != null && !Number.isNaN(site.pageSize)) snapshot.pageSize = Number(site.pageSize);
  if (site.defaultLanguage) snapshot.defaultLanguage = site.defaultLanguage;
  if (site.themeMode) snapshot.themeMode = site.themeMode;
  if (site.themePack) snapshot.themePack = site.themePack;
  if (site.themeOverride != null) snapshot.themeOverride = !!site.themeOverride;
  if (site.showAllPosts != null) snapshot.showAllPosts = !!site.showAllPosts;
  if (site.landingTab) snapshot.landingTab = site.landingTab;
  const repo = repoForOutput(site.repo);
  if (repo) snapshot.repo = repo;
  const warnings = assetWarningsForOutput(site.assetWarnings);
  if (warnings) snapshot.assetWarnings = warnings;

  const extras = site.__extras && typeof site.__extras === 'object' ? site.__extras : {};
  Object.keys(extras).forEach((key) => {
    if (snapshot[key] !== undefined) return;
    snapshot[key] = deepClone(extras[key]);
  });

  return snapshot;
}

function stableSerialize(value) {
  if (value == null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(item => stableSerialize(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',') + '}';
  }
  return '';
}

function computeSiteSignature(state) {
  const snapshot = buildSiteSnapshot(state);
  return stableSerialize(snapshot);
}

function compareLocalizedMaps(cur = {}, base = {}) {
  const langSet = new Set([...Object.keys(cur), ...Object.keys(base)]);
  const changedLangs = [];
  langSet.forEach((lang) => {
    if (safeString(cur[lang] || '') !== safeString(base[lang] || '')) changedLangs.push(lang);
  });
  return changedLangs;
}

function compareLinkListChanges(cur = [], base = []) {
  const max = Math.max(cur.length, base.length);
  const entries = {};
  for (let i = 0; i < max; i += 1) {
    const a = cur[i] || { label: '', href: '' };
    const b = base[i] || { label: '', href: '' };
    const changed = {};
    if (safeString(a.label) !== safeString(b.label)) changed.label = true;
    if (safeString(a.href) !== safeString(b.href)) changed.href = true;
    if (Object.keys(changed).length) entries[i] = changed;
  }
  return entries;
}

function compareLinkLists(cur = [], base = []) {
  return Object.keys(compareLinkListChanges(cur, base)).length > 0;
}

function computeSiteDiff(current, baseline) {
  const cur = cloneSiteState(current);
  const base = cloneSiteState(baseline);
  const diff = { hasChanges: false, fields: {} };

  const localizedFields = ['siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords'];
  localizedFields.forEach((key) => {
    const changed = compareLocalizedMaps(cur[key] || {}, base[key] || {});
    if (changed.length) {
      diff.fields[key] = { type: 'localized', languages: changed };
      diff.hasChanges = true;
    }
  });

  const stringFields = ['avatar', 'resourceURL', 'contentRoot', 'defaultLanguage', 'themeMode', 'themePack', 'landingTab'];
  stringFields.forEach((key) => {
    if (safeString(cur[key] || '') !== safeString(base[key] || '')) {
      diff.fields[key] = { type: 'text' };
      diff.hasChanges = true;
    }
  });

  const booleanFields = ['cardCoverFallback', 'errorOverlay', 'themeOverride', 'showAllPosts'];
  booleanFields.forEach((key) => {
    if (normalizeBoolean(cur[key]) !== normalizeBoolean(base[key])) {
      diff.fields[key] = { type: 'boolean' };
      diff.hasChanges = true;
    }
  });

  const numericFields = ['contentOutdatedDays', 'pageSize'];
  numericFields.forEach((key) => {
    const a = cur[key] != null ? Number(cur[key]) : null;
    const b = base[key] != null ? Number(base[key]) : null;
    if ((Number.isNaN(a) ? null : a) !== (Number.isNaN(b) ? null : b)) {
      diff.fields[key] = { type: 'number' };
      diff.hasChanges = true;
    }
  });

  const profileLinkChanges = compareLinkListChanges(cur.profileLinks || [], base.profileLinks || []);
  if (Object.keys(profileLinkChanges).length) {
    diff.fields.profileLinks = { type: 'list', entries: profileLinkChanges };
    diff.hasChanges = true;
  }

  const repoCur = cur.repo || {};
  const repoBase = base.repo || {};
  const repoFields = {};
  if (safeString(repoCur.owner) !== safeString(repoBase.owner)) repoFields.owner = true;
  if (safeString(repoCur.name) !== safeString(repoBase.name)) repoFields.name = true;
  if (safeString(repoCur.branch) !== safeString(repoBase.branch)) repoFields.branch = true;
  if (Object.keys(repoFields).length) {
    diff.fields.repo = { type: 'object', fields: repoFields };
    diff.hasChanges = true;
  }

  const curWarn = (cur.assetWarnings && cur.assetWarnings.largeImage) || {};
  const baseWarn = (base.assetWarnings && base.assetWarnings.largeImage) || {};
  const warningFields = {};
  if (normalizeBoolean(curWarn.enabled) !== normalizeBoolean(baseWarn.enabled)) warningFields.enabled = true;
  if (normalizeNumber(curWarn.thresholdKB) !== normalizeNumber(baseWarn.thresholdKB)) warningFields.thresholdKB = true;
  if (Object.keys(warningFields).length) {
    diff.fields.assetWarnings = { type: 'object', fields: warningFields };
    diff.hasChanges = true;
  }

  const extrasCur = cur.__extras || {};
  const extrasBase = base.__extras || {};
  if (stableSerialize(extrasCur) !== stableSerialize(extrasBase)) {
    diff.fields.__extras = { type: 'object' };
    diff.hasChanges = true;
  }

  return diff;
}

function applySiteDiffMarkers(diff) {
  const root = document.getElementById('composerSite');
  if (!root) return;
  const fields = diff && diff.fields ? diff.fields : {};
  const matchesFieldDiff = (el, key) => {
    const info = fields[key];
    if (!info) return false;
    const lang = el.getAttribute('data-lang');
    const subfield = el.getAttribute('data-subfield');
    const index = el.getAttribute('data-index');
    if (info.type === 'localized' && Array.isArray(info.languages)) {
      return lang ? info.languages.includes(lang) : true;
    }
    if (info.type === 'list' && info.entries) {
      if (index != null && subfield) return !!(info.entries[index] && info.entries[index][subfield]);
      return true;
    }
    if (info.type === 'object' && info.fields) {
      return subfield ? !!info.fields[subfield] : false;
    }
    return true;
  };
  const isChangedTarget = (el) => {
    const key = el.getAttribute('data-field');
    const keys = String(key || '').split('|').map(item => item.trim()).filter(Boolean);
    return keys.length ? keys.some(fieldKey => matchesFieldDiff(el, fieldKey)) : false;
  };
  const hasChangedDescendant = (el) => {
    return Array.from(el.querySelectorAll('[data-field]')).some(child => child !== el && isChangedTarget(child));
  };
  root.querySelectorAll('[data-field]').forEach((el) => {
    const key = el.getAttribute('data-field');
    const keys = String(key || '').split('|').map(item => item.trim()).filter(Boolean);
    if (hasChangedDescendant(el)) {
      el.removeAttribute('data-diff');
      return;
    }
    const changed = keys.length ? keys.some(fieldKey => matchesFieldDiff(el, fieldKey)) : false;
    if (key && changed) el.setAttribute('data-diff', 'changed');
    else el.removeAttribute('data-diff');
  });
  try {
    if (typeof root.__nsSiteNavRefresh === 'function') root.__nsSiteNavRefresh();
  } catch (_) {}
}

function yamlScalar(value) {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') {
    if (!value) return '""';
    if (/^[A-Za-z0-9_\-\/\.]+$/.test(value)) return value;
    return q(value);
  }
  return 'null';
}

function writeYamlValue(lines, indent, value) {
  const pad = '  '.repeat(indent);
  if (value == null) {
    lines.push(`${pad}null`);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    lines.push(`${pad}${yamlScalar(value)}`);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      lines.push(`${pad}[]`);
      return;
    }
    value.forEach((item) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        lines.push(`${pad}- ${yamlScalar(item)}`);
      } else {
        lines.push(`${pad}-`);
        writeYamlObject(lines, indent + 1, item);
      }
    });
    return;
  }
  if (typeof value === 'object') {
    writeYamlObject(lines, indent, value);
    return;
  }
  lines.push(`${pad}${yamlScalar(String(value))}`);
}

function writeYamlObject(lines, indent, obj) {
  const pad = '  '.repeat(indent);
  const keys = Object.keys(obj);
  if (!keys.length) {
    lines.push(`${pad}{}`);
    return;
  }
  keys.forEach((key) => {
    const value = obj[key];
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${pad}${key}: ${yamlScalar(value)}`);
    } else {
      lines.push(`${pad}${key}:`);
      writeYamlValue(lines, indent + 1, value);
    }
  });
}

function toSiteYaml(data) {
  const snapshot = buildSiteSnapshot(data || {});
  const keysInOrder = [
    'siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords', 'avatar', 'profileLinks', 'resourceURL',
    'contentRoot', 'contentOutdatedDays', 'cardCoverFallback', 'errorOverlay', 'pageSize', 'defaultLanguage',
    'themeMode', 'themePack', 'themeOverride', 'showAllPosts', 'landingTab', 'repo', 'assetWarnings'
  ];
  const ordered = {};
  keysInOrder.forEach((key) => {
    if (snapshot[key] !== undefined) ordered[key] = snapshot[key];
  });
  Object.keys(snapshot).forEach((key) => {
    if (ordered[key] !== undefined) return;
    ordered[key] = snapshot[key];
  });

  const lines = ['# yaml-language-server: $schema=./assets/schema/site.json', ''];
  Object.keys(ordered).forEach((key) => {
    const value = ordered[key];
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${yamlScalar(value)}`);
    } else {
      lines.push(`${key}:`);
      writeYamlValue(lines, 1, value);
    }
    lines.push('');
  });
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push('');
  return lines.join('\n');
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function computeIndexSignature(state) {
  if (!state) return '';
  const parts = [];
  const order = Array.isArray(state.__order) ? state.__order.slice() : [];
  parts.push(JSON.stringify(['order', order]));
  const keys = Object.keys(state).filter(k => k !== '__order').sort();
  keys.forEach(key => {
    const entry = state[key] || {};
    const langs = Object.keys(entry).sort();
    const langParts = langs.map(lang => {
      const value = entry[lang];
      if (Array.isArray(value)) return [lang, 'list', value.map(item => safeString(item))];
      return [lang, 'single', safeString(value)];
    });
    parts.push(JSON.stringify([key, langParts]));
  });
  return parts.join('|');
}

function computeTabsSignature(state) {
  if (!state) return '';
  const parts = [];
  const order = Array.isArray(state.__order) ? state.__order.slice() : [];
  parts.push(JSON.stringify(['order', order]));
  const keys = Object.keys(state).filter(k => k !== '__order').sort();
  keys.forEach(key => {
    const entry = state[key] || {};
    const langs = Object.keys(entry).sort();
    const langParts = langs.map(lang => {
      const value = entry[lang] || { title: '', location: '' };
      return [lang, safeString(value.title), safeString(value.location)];
    });
    parts.push(JSON.stringify([key, langParts]));
  });
  return parts.join('|');
}

function diffVersionLists(currentValue, baselineValue) {
  const normalize = (value) => {
    if (Array.isArray(value)) {
      const items = value.map(item => safeString(item));
      if (items.length === 0) {
        return { kind: 'list', items: [] };
      }
      if (items.length === 1) {
        return { kind: 'single', items: [items[0]] };
      }
      return { kind: 'list', items };
    }
    return { kind: 'single', items: [safeString(value)] };
  };
  const cur = normalize(currentValue);
  const base = normalize(baselineValue);
  const curItems = cur.items;
  const baseItems = base.items;
  const baseMatched = new Array(baseItems.length).fill(false);
  const entries = [];
  for (let i = 0; i < curItems.length; i += 1) {
    const value = curItems[i];
    let status = 'added';
    let prevIndex = -1;
    if (i < baseItems.length && baseItems[i] === value && !baseMatched[i]) {
      status = 'unchanged';
      prevIndex = i;
      baseMatched[i] = true;
    } else {
      let foundIndex = -1;
      for (let j = 0; j < baseItems.length; j += 1) {
        if (!baseMatched[j] && baseItems[j] === value) {
          foundIndex = j;
          break;
        }
      }
      if (foundIndex !== -1) {
        status = 'moved';
        prevIndex = foundIndex;
        baseMatched[foundIndex] = true;
      } else if (i < baseItems.length) {
        status = 'changed';
        prevIndex = i;
        baseMatched[i] = true;
      }
    }
    entries.push({ value, status, prevIndex });
  }
  const removed = [];
  for (let i = 0; i < baseItems.length; i += 1) {
    if (!baseMatched[i]) removed.push({ value: baseItems[i], index: i });
  }
  const changed = cur.kind !== base.kind
    || curItems.length !== baseItems.length
    || entries.some(item => item.status !== 'unchanged')
    || removed.length > 0;
  const orderChanged = entries.some(item => item.status === 'moved')
    || (curItems.length === baseItems.length && !arraysEqual(curItems, baseItems));
  return {
    entries,
    removed,
    changed,
    orderChanged,
    kindChanged: cur.kind !== base.kind,
    kind: cur.kind
  };
}

function computeIndexDiff(current, baseline) {
  const cur = current || { __order: [] };
  const base = baseline || { __order: [] };
  const diff = {
    hasChanges: false,
    keys: {},
    orderChanged: false,
    addedKeys: [],
    removedKeys: []
  };
  const curOrder = Array.isArray(cur.__order) ? cur.__order : [];
  const baseOrder = Array.isArray(base.__order) ? base.__order : [];
  diff.orderChanged = !arraysEqual(curOrder, baseOrder);

  const keySet = new Set();
  Object.keys(cur).forEach(key => { if (key !== '__order') keySet.add(key); });
  Object.keys(base).forEach(key => { if (key !== '__order') keySet.add(key); });

  keySet.forEach(key => {
    const curEntry = cur[key];
    const baseEntry = base[key];
    const info = { state: '', langs: {}, addedLangs: [], removedLangs: [] };
    if (!baseEntry && curEntry) {
      info.state = 'added';
      diff.addedKeys.push(key);
      diff.hasChanges = true;
    } else if (baseEntry && !curEntry) {
      info.state = 'removed';
      diff.removedKeys.push(key);
      diff.hasChanges = true;
    } else if (curEntry && baseEntry) {
      const langSet = new Set();
      Object.keys(curEntry).forEach(lang => langSet.add(lang));
      Object.keys(baseEntry).forEach(lang => langSet.add(lang));
      langSet.forEach(lang => {
        const curVal = curEntry[lang];
        const baseVal = baseEntry[lang];
        if (curVal == null && baseVal == null) return;
        if (curVal == null && baseVal != null) {
          info.langs[lang] = { state: 'removed' };
          info.removedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        if (curVal != null && baseVal == null) {
          info.langs[lang] = { state: 'added' };
          info.addedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        const versionDiff = diffVersionLists(curVal, baseVal);
        if (versionDiff.changed) {
          info.langs[lang] = { state: 'modified', versions: versionDiff };
          diff.hasChanges = true;
        }
      });
      if (!info.state) {
        if (Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
          info.state = 'modified';
        }
      }
    }
    if (info.state || Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
      diff.keys[key] = info;
    }
  });
  diff.hasChanges = diff.hasChanges || diff.orderChanged || diff.addedKeys.length > 0 || diff.removedKeys.length > 0;
  return diff;
}

function computeTabsDiff(current, baseline) {
  const cur = current || { __order: [] };
  const base = baseline || { __order: [] };
  const diff = {
    hasChanges: false,
    keys: {},
    orderChanged: false,
    addedKeys: [],
    removedKeys: []
  };
  const curOrder = Array.isArray(cur.__order) ? cur.__order : [];
  const baseOrder = Array.isArray(base.__order) ? base.__order : [];
  diff.orderChanged = !arraysEqual(curOrder, baseOrder);

  const keySet = new Set();
  Object.keys(cur).forEach(key => { if (key !== '__order') keySet.add(key); });
  Object.keys(base).forEach(key => { if (key !== '__order') keySet.add(key); });

  keySet.forEach(key => {
    const curEntry = cur[key];
    const baseEntry = base[key];
    const info = { state: '', langs: {}, addedLangs: [], removedLangs: [] };
    if (!baseEntry && curEntry) {
      info.state = 'added';
      diff.addedKeys.push(key);
      diff.hasChanges = true;
    } else if (baseEntry && !curEntry) {
      info.state = 'removed';
      diff.removedKeys.push(key);
      diff.hasChanges = true;
    } else if (curEntry && baseEntry) {
      const langSet = new Set();
      Object.keys(curEntry).forEach(lang => langSet.add(lang));
      Object.keys(baseEntry).forEach(lang => langSet.add(lang));
      langSet.forEach(lang => {
        const curVal = curEntry[lang];
        const baseVal = baseEntry[lang];
        if (!curVal && !baseVal) return;
        if (!curVal && baseVal) {
          info.langs[lang] = { state: 'removed' };
          info.removedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        if (curVal && !baseVal) {
          info.langs[lang] = { state: 'added' };
          info.addedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        const curTitle = safeString(curVal.title);
        const curLoc = safeString(curVal.location);
        const baseTitle = safeString(baseVal.title);
        const baseLoc = safeString(baseVal.location);
        const titleChanged = curTitle !== baseTitle;
        const locationChanged = curLoc !== baseLoc;
        if (titleChanged || locationChanged) {
          info.langs[lang] = { state: 'modified', titleChanged, locationChanged };
          diff.hasChanges = true;
        }
      });
      if (!info.state) {
        if (Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) info.state = 'modified';
      }
    }
    if (info.state || Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
      diff.keys[key] = info;
    }
  });
  diff.hasChanges = diff.hasChanges || diff.orderChanged || diff.addedKeys.length > 0 || diff.removedKeys.length > 0;
  return diff;
}

function readDraftStore() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeDraftStore(store) {
  try {
    if (!store || !Object.keys(store).length) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
    /* ignore storage errors */
  }
}

function normalizeMarkdownContent(text) {
  return normalizeMarkdownDraftContent(text);
}

function computeTextSignature(text) {
  const normalized = normalizeMarkdownContent(text || '');
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 131 + normalized.charCodeAt(i)) >>> 0; // simple rolling hash
  }
  return `${normalized.length}:${hash.toString(16)}`;
}

function ensureMarkdownAssetBucket(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return null;
  let bucket = markdownAssetStore.get(norm);
  if (!bucket) {
    bucket = new Map();
    markdownAssetStore.set(norm, bucket);
  }
  return bucket;
}

function getMarkdownAssetBucket(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return null;
  return markdownAssetStore.get(norm) || null;
}

function broadcastMarkdownAssetPreview(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return;
  const bucket = getMarkdownAssetBucket(norm);
  const assets = bucket && bucket.size
    ? Array.from(bucket.values()).map(asset => ({
      path: asset.path,
      relativePath: asset.relativePath,
      base64: asset.base64,
      mime: asset.mime
    }))
    : [];
  try {
    window.dispatchEvent(new CustomEvent('ns-editor-asset-preview', {
      detail: { markdownPath: norm, assets }
    }));
  } catch (_) {
    /* ignore */
  }
}

function normalizeAssetDescriptor(asset, markdownPath) {
  if (!asset) return null;
  const commitPath = normalizeRelPath(asset.path || asset.commitPath || '');
  const markdown = normalizeRelPath(markdownPath || asset.markdownPath || '');
  const base64 = typeof asset.base64 === 'string' ? asset.base64.trim() : '';
  if (!commitPath || !markdown || !base64) return null;
  const relativePath = asset.relativePath ? String(asset.relativePath).replace(/[\\]/g, '/') : '';
  const mime = asset.mime ? String(asset.mime) : '';
  const sizeRaw = Number(asset.size);
  const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
  const fileName = asset.fileName ? String(asset.fileName) : '';
  const originalName = asset.originalName ? String(asset.originalName) : '';
  const addedAtRaw = Number(asset.addedAt);
  const addedAt = Number.isFinite(addedAtRaw) ? addedAtRaw : Date.now();
  return {
    path: commitPath,
    relativePath: relativePath || commitPath,
    base64,
    mime,
    size,
    fileName,
    originalName,
    addedAt,
    markdownPath: markdown
  };
}

function importMarkdownAssetsForPath(path, assets = []) {
  const bucket = ensureMarkdownAssetBucket(path);
  if (!bucket) return null;
  bucket.clear();
  if (Array.isArray(assets)) {
    assets.forEach((entry) => {
      const normalized = normalizeAssetDescriptor(entry, path);
      if (normalized) bucket.set(normalized.path, normalized);
    });
  }
  broadcastMarkdownAssetPreview(path);
  return bucket;
}

function exportMarkdownAssetBucket(path) {
  const bucket = getMarkdownAssetBucket(path);
  if (!bucket || !bucket.size) return [];
  return Array.from(bucket.values()).map((asset) => ({
    path: asset.path,
    relativePath: asset.relativePath,
    base64: asset.base64,
    mime: asset.mime,
    size: asset.size,
    fileName: asset.fileName,
    originalName: asset.originalName,
    addedAt: asset.addedAt
  }));
}

function updateMarkdownDraftStoreAssets(path, assets = []) {
  const norm = normalizeRelPath(path);
  if (!norm) return;
  const store = readMarkdownDraftStore();
  const entry = store[norm];
  if (!entry || typeof entry !== 'object') return;
  const list = Array.isArray(assets) ? assets.filter(item => item && item.path && item.base64) : [];
  if (list.length) entry.assets = list;
  else delete entry.assets;
  store[norm] = entry;
  writeMarkdownDraftStore(store);
}

function clearMarkdownAssetsForPath(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return;
  const bucket = markdownAssetStore.get(norm);
  if (bucket) bucket.clear();
  markdownAssetStore.delete(norm);
  updateMarkdownDraftStoreAssets(norm, []);
  broadcastMarkdownAssetPreview(norm);
}

function removeMarkdownAsset(path, assetPath) {
  const norm = normalizeRelPath(path);
  const assetKey = normalizeRelPath(assetPath);
  if (!norm || !assetKey) return;
  const bucket = markdownAssetStore.get(norm);
  if (!bucket || !bucket.has(assetKey)) return;
  bucket.delete(assetKey);
  if (!bucket.size) markdownAssetStore.delete(norm);
  updateMarkdownDraftStoreAssets(norm, exportMarkdownAssetBucket(norm));
  broadcastMarkdownAssetPreview(norm);
}

function listMarkdownAssets(path) {
  const bucket = getMarkdownAssetBucket(path);
  if (!bucket || !bucket.size) return [];
  return Array.from(bucket.values());
}

function countMarkdownAssets(path) {
  const bucket = getMarkdownAssetBucket(path);
  if (bucket && bucket.size) return bucket.size;
  const entry = getMarkdownDraftEntry(path);
  if (entry && Array.isArray(entry.assets)) return entry.assets.length;
  return 0;
}

function isAssetReferencedInContent(content, asset) {
  if (!asset || !asset.relativePath) return false;
  const text = String(content || '');
  if (!text) return false;
  const rel = asset.relativePath;
  if (text.includes(rel)) return true;
  if (!rel.startsWith('./') && text.includes(`./${rel}`)) return true;
  return false;
}

function handleEditorToastEvent(event) {
  if (!event || !event.detail) return;
  const detail = event.detail;
  const message = detail && detail.message ? String(detail.message) : '';
  if (!message) return;
  const kind = detail && detail.kind ? String(detail.kind) : 'info';
  showToast(kind, message);
}

function handleEditorAssetAdded(event) {
  if (!event || !event.detail) return;
  const detail = event.detail;
  const markdownPath = normalizeRelPath(detail.markdownPath || '');
  if (!markdownPath) {
    showToast('warn', t('editor.toasts.markdownOpenBeforeInsert'));
    return;
  }
  const commitPath = normalizeRelPath(detail.commitPath || detail.assetPath || '');
  const base64 = typeof detail.base64 === 'string' ? detail.base64.trim() : '';
  if (!commitPath || !base64) return;
  const descriptor = normalizeAssetDescriptor({
    path: commitPath,
    relativePath: detail.relativePath || '',
    base64,
    mime: detail.mime || '',
    size: detail.size,
    fileName: detail.fileName || '',
    originalName: detail.originalName || '',
    addedAt: Date.now(),
    markdownPath
  }, markdownPath);
  if (!descriptor) return;
  const bucket = ensureMarkdownAssetBucket(markdownPath);
  bucket.set(descriptor.path, descriptor);
  updateMarkdownDraftStoreAssets(markdownPath, exportMarkdownAssetBucket(markdownPath));
  broadcastMarkdownAssetPreview(markdownPath);
  const tab = findDynamicTabByPath(markdownPath);
  if (tab) {
    tab.pendingAssets = bucket;
    try { scheduleMarkdownDraftSave(tab); }
    catch (_) {}
  }
  const relLabel = descriptor.relativePath || descriptor.path;
  if (!detail.silent) showToast('success', t('editor.toasts.assetAttached', { label: relLabel }));
  try { updateUnsyncedSummary(); }
  catch (_) {}
}

try {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('ns-editor-toast', handleEditorToastEvent);
    window.addEventListener('ns-editor-asset-added', handleEditorAssetAdded);
  }
} catch (_) {}

function readMarkdownDraftStore() {
  try {
    const raw = localStorage.getItem(MARKDOWN_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeMarkdownDraftStore(store) {
  try {
    if (!store || !Object.keys(store).length) {
      localStorage.removeItem(MARKDOWN_DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(MARKDOWN_DRAFT_STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
    /* ignore storage errors */
  }
}

function getMarkdownDraftEntry(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return null;
  const store = readMarkdownDraftStore();
  const entry = store[norm];
  if (!entry || typeof entry !== 'object') return null;
  const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
  const savedAt = Number(entry.savedAt);
  const remoteSignature = entry.remoteSignature ? String(entry.remoteSignature) : '';
  const assets = Array.isArray(entry.assets)
    ? entry.assets.map(item => normalizeAssetDescriptor(item, norm)).filter(Boolean)
    : [];
  return {
    path: norm,
    content,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
    remoteSignature,
    assets
  };
}

function saveMarkdownDraftEntry(path, content, remoteSignature = '', assets = []) {
  const norm = normalizeRelPath(path);
  if (!norm) return null;
  const text = normalizeMarkdownContent(content);
  const store = readMarkdownDraftStore();
  const savedAt = Date.now();
  const assetList = Array.isArray(assets)
    ? assets.map(item => normalizeAssetDescriptor(item, norm)).filter(Boolean)
    : [];
  store[norm] = {
    content: text,
    savedAt,
    remoteSignature: String(remoteSignature || ''),
    assets: assetList
  };
  writeMarkdownDraftStore(store);
  return {
    path: norm,
    content: text,
    savedAt,
    remoteSignature: String(remoteSignature || ''),
    assets: assetList
  };
}

function clearMarkdownDraftEntry(path) {
  const norm = normalizeRelPath(path);
  if (!norm) return;
  const store = readMarkdownDraftStore();
  if (store && Object.prototype.hasOwnProperty.call(store, norm)) {
    delete store[norm];
    writeMarkdownDraftStore(store);
  }
  clearMarkdownAssetsForPath(norm);
}

function restoreMarkdownDraftForTab(tab) {
  if (!tab || !tab.path) return false;
  try { clearTimeout(tab.markdownDraftTimer); } catch (_) {}
  tab.markdownDraftTimer = null;
  const entry = getMarkdownDraftEntry(tab.path);
  if (!entry) {
    tab.localDraft = null;
    tab.draftConflict = false;
    return false;
  }
  const assetsBucket = importMarkdownAssetsForPath(tab.path, entry.assets || []);
  tab.localDraft = {
    content: entry.content,
    savedAt: entry.savedAt,
    remoteSignature: entry.remoteSignature || '',
    manual: !!entry.manual,
    assets: exportMarkdownAssetBucket(tab.path)
  };
  tab.content = entry.content;
  tab.draftConflict = false;
  tab.isDirty = true;
  tab.pendingAssets = assetsBucket || ensureMarkdownAssetBucket(tab.path);
  updateDynamicTabDirtyState(tab, { autoSave: false });
  return true;
}

function saveMarkdownDraftForTab(tab, options = {}) {
  if (!tab || !tab.path) return null;
  const text = normalizeMarkdownContent(tab.content || '');
  const remoteSig = tab.remoteSignature || '';
  if (!text) {
    clearMarkdownDraftEntry(tab.path);
    tab.localDraft = null;
    tab.draftConflict = false;
    updateComposerMarkdownDraftIndicators({ path: tab.path });
    try { updateUnsyncedSummary(); } catch (_) {}
    return null;
  }
  const assets = exportMarkdownAssetBucket(tab.path);
  const saved = saveMarkdownDraftEntry(tab.path, text, remoteSig, assets);
  if (saved) {
    tab.localDraft = {
      content: saved.content,
      savedAt: saved.savedAt,
      remoteSignature: saved.remoteSignature,
      manual: !!options.markManual,
      assets: saved.assets || []
    };
    updateComposerMarkdownDraftIndicators({ path: tab.path });
    try { updateUnsyncedSummary(); } catch (_) {}
  }
  return saved;
}

function clearMarkdownDraftForTab(tab) {
  if (!tab || !tab.path) return;
  try {
    if (tab.markdownDraftTimer) {
      clearTimeout(tab.markdownDraftTimer);
      tab.markdownDraftTimer = null;
    }
  } catch (_) {
    tab.markdownDraftTimer = null;
  }
  clearMarkdownDraftEntry(tab.path);
  tab.localDraft = null;
  tab.draftConflict = false;
  tab.isDirty = false;
  tab.pendingAssets = ensureMarkdownAssetBucket(tab.path);
  if (tab.button) {
    try { tab.button.removeAttribute('data-dirty'); }
    catch (_) {}
    try { tab.button.removeAttribute('data-draft-state'); }
    catch (_) {}
  }
  updateComposerMarkdownDraftIndicators({ path: tab.path });
  try { updateUnsyncedSummary(); } catch (_) {}
}

function scheduleMarkdownDraftSave(tab) {
  if (!tab) return;
  if (tab.markdownDraftTimer) {
    clearTimeout(tab.markdownDraftTimer);
    tab.markdownDraftTimer = null;
  }
  tab.markdownDraftTimer = setTimeout(() => {
    tab.markdownDraftTimer = null;
    if (!tab.isDirty) {
      clearMarkdownDraftForTab(tab);
      return;
    }
    saveMarkdownDraftForTab(tab);
    if (currentMode === tab.mode) pushEditorCurrentFileInfo(tab);
  }, 720);
}

function flushMarkdownDraft(tab) {
  if (!tab) return;
  if (tab.markdownDraftTimer) {
    clearTimeout(tab.markdownDraftTimer);
    tab.markdownDraftTimer = null;
    if (tab.isDirty) {
      saveMarkdownDraftForTab(tab);
    }
  }
}

function updateDynamicTabDirtyState(tab, options = {}) {
  if (!tab || !tab.path) return;
  const normalizedContent = normalizeMarkdownContent(tab.content || '');
  const baseline = normalizeMarkdownContent(tab.remoteContent || '');
  const dirty = normalizedContent !== baseline;
  tab.isDirty = dirty;

  let conflict = false;

  if (dirty) {
    conflict = !!(tab.localDraft
      && tab.localDraft.remoteSignature
      && tab.remoteSignature
      && tab.localDraft.remoteSignature !== tab.remoteSignature);
    if (options.autoSave !== false) {
      scheduleMarkdownDraftSave(tab);
    }
  } else {
    clearMarkdownDraftForTab(tab);
  }

  tab.draftConflict = conflict;

  const btn = tab.button;
  if (btn) {
    if (dirty) btn.setAttribute('data-dirty', '1');
    else btn.removeAttribute('data-dirty');
    if (conflict) btn.setAttribute('data-draft-state', 'conflict');
    else if (tab.localDraft) btn.setAttribute('data-draft-state', 'saved');
    else btn.removeAttribute('data-draft-state');
  }

  if (currentMode === tab.mode) {
    pushEditorCurrentFileInfo(tab);
  } else {
    updateMarkdownPushButton(tab);
  }

  updateComposerMarkdownDraftIndicators({ path: tab.path });
  refreshEditorContentTree({ preserveStructure: currentMode === tab.mode });
  try { updateUnsyncedSummary(); } catch (_) {}
}

function hasUnsavedComposerChanges() {
  try {
    if (composerDiffCache && composerDiffCache.index && composerDiffCache.index.hasChanges) return true;
  } catch (_) {}
  try {
    if (composerDiffCache && composerDiffCache.tabs && composerDiffCache.tabs.hasChanges) return true;
  } catch (_) {}
  try {
    if (composerDiffCache && composerDiffCache.site && composerDiffCache.site.hasChanges) return true;
  } catch (_) {}
  return false;
}

function hasUnsavedMarkdownDrafts() {
  for (const tab of dynamicEditorTabs.values()) {
    if (!tab) continue;
    if (tab.isDirty) return true;
    if (tab.localDraft && normalizeMarkdownContent(tab.localDraft.content || '')) return true;
  }
  try {
    const store = readMarkdownDraftStore();
    if (store && Object.keys(store).length) return true;
  } catch (_) {}
  return false;
}

function handleBeforeUnload(event) {
  try {
    dynamicEditorTabs.forEach(tab => { flushMarkdownDraft(tab); });
  } catch (_) {}
  // Previously we attempted to warn users about unsaved changes. The editor now
  // performs automatic saving, so the confirmation dialog is no longer needed.
  // Keep flushing drafts but avoid setting `event.returnValue`, which would
  // trigger the browser prompt.
  void event;
}

try {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }
} catch (_) {}



function cssEscape(value) {
  try {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  } catch (_) {}
  return safeString(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function collectDynamicMarkdownDraftStates() {
  const map = new Map();
  dynamicEditorTabs.forEach(tab => {
    if (!tab || !tab.path) return;
    const norm = normalizeRelPath(tab.path);
    if (!norm) return;
    if (tab.draftConflict) map.set(norm, 'conflict');
    else if (tab.isDirty) map.set(norm, 'dirty');
    else if (tab.localDraft) map.set(norm, 'saved');
  });
  return map;
}

function getDraftIndicatorMessage(state) {
  if (!state) return '';
  const suffix = `markdown.draftIndicator.${state}`;
  const value = tComposer(suffix);
  const fallbackKey = `editor.composer.${suffix}`;
  if (!value || value === fallbackKey) return '';
  return value;
}

function updateComposerDraftContainerState(container) {
  if (!container) return;
  let childState = '';
  if (container.querySelector('.ct-lang[data-draft-state="conflict"], .ci-ver-item[data-draft-state="conflict"]')) {
    childState = 'conflict';
  } else if (container.querySelector('.ct-lang[data-draft-state="dirty"], .ci-ver-item[data-draft-state="dirty"]')) {
    childState = 'dirty';
  } else {
    childState = '';
  }
  if (childState) container.setAttribute('data-child-draft', childState);
  else container.removeAttribute('data-child-draft');
}

function updateComposerMarkdownDraftContainerState(container) {
  updateComposerDraftContainerState(container);
}

function applyComposerDraftIndicatorState(el, state) {
  if (!el) return;
  const indicator = el.querySelector('.ct-draft-indicator, .ci-draft-indicator');
  const value = state ? String(state) : '';
  if (value) el.setAttribute('data-draft-state', value);
  else el.removeAttribute('data-draft-state');
  if (!indicator) return;
  if (value) {
    indicator.hidden = false;
    indicator.dataset.state = value;
    const label = getDraftIndicatorMessage(value);
    if (label) {
      indicator.setAttribute('title', label);
      indicator.setAttribute('aria-label', label);
      indicator.setAttribute('role', 'img');
    } else {
      indicator.removeAttribute('title');
      indicator.removeAttribute('aria-label');
      indicator.removeAttribute('role');
    }
  } else {
    indicator.hidden = true;
    indicator.dataset.state = '';
    indicator.removeAttribute('title');
    indicator.removeAttribute('aria-label');
    indicator.removeAttribute('role');
  }
  updateComposerDraftContainerState(el.closest('.ct-item, .ci-item'));
}

function updateComposerMarkdownDraftIndicators(options = {}) {
  const store = options.store || readMarkdownDraftStore();
  const overrides = options.overrideMap || collectDynamicMarkdownDraftStates();
  const normalizedPath = options.path ? normalizeRelPath(options.path) : '';
  const selectors = ['.ct-lang', '.ci-ver-item'];

  const updateElement = (el) => {
    if (!el) return;
    const raw = el.dataset ? el.dataset.mdPath : '';
    const path = normalizeRelPath(raw);
    if (path) el.dataset.mdPath = path;
    else delete el.dataset.mdPath;
    let state = '';
    if (path) {
      if (overrides && overrides.has(path)) {
        state = overrides.get(path) || '';
      } else if (store && Object.prototype.hasOwnProperty.call(store, path)) {
        state = 'saved';
      }
    }
    applyComposerDraftIndicatorState(el, state);
  };

  if (options.element) {
    updateElement(options.element);
  }

  if (normalizedPath) {
    selectors.forEach(sel => {
      const query = `${sel}[data-md-path="${cssEscape(normalizedPath)}"]`;
      $$(query).forEach(el => {
        if (options.element && el === options.element) return;
        updateElement(el);
      });
    });
    return;
  }

  if (options.element) return;

  selectors.forEach(sel => {
    $$( `${sel}[data-md-path]` ).forEach(updateElement);
  });
  refreshEditorContentTree({ preserveStructure: currentMode && isDynamicMode(currentMode) });
}

function getStateSlice(kind) {
  if (!activeComposerState) return null;
  if (kind === 'tabs') return activeComposerState.tabs;
  if (kind === 'site') return activeComposerState.site;
  return activeComposerState.index;
}

function setStateSlice(kind, value) {
  if (!activeComposerState) return;
  if (kind === 'tabs') activeComposerState.tabs = value;
  else if (kind === 'site') activeComposerState.site = value;
  else activeComposerState.index = value;
}

function computeBaselineSignature(kind) {
  if (kind === 'tabs') return computeTabsSignature(remoteBaseline.tabs);
  if (kind === 'site') return computeSiteSignature(remoteBaseline.site);
  return computeIndexSignature(remoteBaseline.index);
}

function recomputeDiff(kind) {
  const slice = getStateSlice(kind) || { __order: [] };
  let baselineSlice;
  let diff;
  if (kind === 'tabs') {
    baselineSlice = remoteBaseline.tabs;
    diff = computeTabsDiff(slice, baselineSlice);
  } else if (kind === 'site') {
    baselineSlice = remoteBaseline.site;
    diff = computeSiteDiff(slice, baselineSlice);
  } else {
    baselineSlice = remoteBaseline.index;
    diff = computeIndexDiff(slice, baselineSlice);
  }
  composerDiffCache[kind] = diff;
  return diff;
}

function makeDiffBadge(label, type, scope) {
  const cls = scope ? `${scope}-diff-badge` : 'diff-badge';
  return `<span class="${cls} ${cls}-${type}">${escapeHtml(label)}</span>`;
}

function buildIndexDiffBadges(info) {
  if (!info) return '';
  const badges = [];
  if (info.state === 'added') badges.push(makeDiffBadge('New', 'added', 'ci'));
  if (info.state === 'removed') badges.push(makeDiffBadge('Removed', 'removed', 'ci'));
  const handledLang = new Set();
  Object.keys(info.langs || {}).forEach(lang => {
    const detail = info.langs[lang];
    const label = lang.toUpperCase();
    handledLang.add(lang);
    if (!detail) return;
    if (detail.state === 'added') badges.push(makeDiffBadge(`+${label}`, 'added', 'ci'));
    else if (detail.state === 'removed') badges.push(makeDiffBadge(`-${label}`, 'removed', 'ci'));
    else if (detail.state === 'modified') badges.push(makeDiffBadge(`~${label}`, 'changed', 'ci'));
  });
  (info.addedLangs || []).forEach(lang => {
    if (handledLang.has(lang)) return;
    badges.push(makeDiffBadge(`+${lang.toUpperCase()}`, 'added', 'ci'));
  });
  (info.removedLangs || []).forEach(lang => {
    if (handledLang.has(lang)) return;
    badges.push(makeDiffBadge(`-${lang.toUpperCase()}`, 'removed', 'ci'));
  });
  if (!badges.length && info.state === 'modified') badges.push(makeDiffBadge('Changed', 'changed', 'ci'));
  return badges.join(' ');
}

function buildTabsDiffBadges(info) {
  if (!info) return '';
  const badges = [];
  if (info.state === 'added') badges.push(makeDiffBadge('New', 'added', 'ct'));
  if (info.state === 'removed') badges.push(makeDiffBadge('Removed', 'removed', 'ct'));
  Object.keys(info.langs || {}).forEach(lang => {
    const detail = info.langs[lang];
    if (!detail) return;
    const label = lang.toUpperCase();
    if (detail.state === 'added') badges.push(makeDiffBadge(`+${label}`, 'added', 'ct'));
    else if (detail.state === 'removed') badges.push(makeDiffBadge(`-${label}`, 'removed', 'ct'));
    else if (detail.state === 'modified') {
      const parts = [];
      if (detail.titleChanged) parts.push('title');
      if (detail.locationChanged) parts.push('location');
      const text = parts.length ? `${label} (${parts.join('&')})` : `${label}`;
      badges.push(makeDiffBadge(text, 'changed', 'ct'));
    }
  });
  if (!badges.length && info.state === 'modified') badges.push(makeDiffBadge('Changed', 'changed', 'ct'));
  return badges.join(' ');
}

function applyIndexDiffMarkers(diff) {
  const list = document.getElementById('ciList');
  if (!list) return;
  const keyDiff = (diff && diff.keys) || {};
  list.querySelectorAll('.ci-item').forEach(row => {
    const key = row.getAttribute('data-key');
    const info = keyDiff[key];
    if (info) {
      row.classList.add('is-dirty');
      row.setAttribute('data-diff', info.state || 'modified');
    } else {
      row.classList.remove('is-dirty');
      row.removeAttribute('data-diff');
    }
    const diffHost = row.querySelector('.ci-diff');
    if (diffHost) diffHost.innerHTML = buildIndexDiffBadges(info);
    const body = row.querySelector('.ci-body-inner');
    if (!body) return;
    body.querySelectorAll('.ci-lang').forEach(block => {
      const lang = block.dataset.lang;
      const langInfo = info && info.langs ? info.langs[lang] : null;
      if (langInfo) {
        block.setAttribute('data-diff', langInfo.state || 'modified');
      } else {
        block.removeAttribute('data-diff');
      }
      const removedBox = block.querySelector('[data-role="removed"]');
      if (removedBox) {
        const removed = langInfo && langInfo.versions && Array.isArray(langInfo.versions.removed)
          ? langInfo.versions.removed.map(item => item.value).filter(Boolean)
          : [];
        if (removed.length) {
          removedBox.hidden = false;
          removedBox.textContent = tComposerLang('removedVersions', { versions: removed.join(', ') });
        } else {
          removedBox.hidden = true;
          removedBox.textContent = '';
        }
      }
      const entries = langInfo && langInfo.versions && Array.isArray(langInfo.versions.entries)
        ? langInfo.versions.entries
        : null;
      block.querySelectorAll('.ci-ver-item').forEach(item => {
        if (!entries) {
          item.removeAttribute('data-diff');
          return;
        }
        const idx = Number(item.dataset.index);
        const entryInfo = entries[idx];
        if (entryInfo && entryInfo.status && entryInfo.status !== 'unchanged') {
          item.setAttribute('data-diff', entryInfo.status);
        } else {
          item.removeAttribute('data-diff');
        }
      });
    });
  });
}

function applyTabsDiffMarkers(diff) {
  const list = document.getElementById('ctList');
  if (!list) return;
  const keyDiff = (diff && diff.keys) || {};
  list.querySelectorAll('.ct-item').forEach(row => {
    const key = row.getAttribute('data-key');
    const info = keyDiff[key];
    if (info) {
      row.classList.add('is-dirty');
      row.setAttribute('data-diff', info.state || 'modified');
    } else {
      row.classList.remove('is-dirty');
      row.removeAttribute('data-diff');
    }
    const diffHost = row.querySelector('.ct-diff');
    if (diffHost) diffHost.innerHTML = buildTabsDiffBadges(info);
    const body = row.querySelector('.ct-body-inner');
    if (!body) return;
    body.querySelectorAll('.ct-lang').forEach(block => {
      const lang = block.dataset.lang;
      const langInfo = info && info.langs ? info.langs[lang] : null;
      if (langInfo) block.setAttribute('data-diff', langInfo.state || 'modified');
      else block.removeAttribute('data-diff');
      const titleInput = block.querySelector('.ct-title');
      const locInput = block.querySelector('.ct-loc');
      if (titleInput) {
        if (langInfo && langInfo.titleChanged) titleInput.setAttribute('data-diff', 'changed');
        else titleInput.removeAttribute('data-diff');
      }
      if (locInput) {
        if (langInfo && langInfo.locationChanged) locInput.setAttribute('data-diff', 'changed');
        else locInput.removeAttribute('data-diff');
      }
    });
  });
}

function getComposerDiffChangeCount(diff) {
  if (!diff || !diff.hasChanges) return 0;
  if (diff.fields && typeof diff.fields === 'object') {
    return Object.keys(diff.fields).filter(Boolean).length;
  }
  let count = 0;
  if (diff.keys && typeof diff.keys === 'object') {
    count += Object.keys(diff.keys).filter(Boolean).length;
  }
  if (diff.orderChanged) count += 1;
  return Math.max(1, count);
}

function ensureFileDirtyBadgeElement(el) {
  if (!el) return null;
  let badge = el.querySelector('.vt-dirty-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'vt-dirty-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.hidden = true;
    el.appendChild(badge);
  }
  return badge;
}

function getFileToggleBaseLabel(el) {
  if (!el) return '';
  return Array.from(el.childNodes || [])
    .filter(node => !(node.nodeType === 1 && node.classList && node.classList.contains('vt-dirty-badge')))
    .map(node => node.textContent || '')
    .join('')
    .trim();
}

function updateFileDirtyBadge(kind) {
  const name = kind === 'tabs' ? 'tabs' : (kind === 'site' ? 'site' : 'index');
  const el = document.querySelector(`a.vt-btn[data-cfile="${name}"]`);
  if (!el) return;
  const diff = composerDiffCache[kind];
  const changeCount = getComposerDiffChangeCount(diff);
  const hasChanges = !!(diff && diff.hasChanges);
  const badge = ensureFileDirtyBadgeElement(el);
  const baseLabel = getFileToggleBaseLabel(el);
  el.classList.toggle('has-draft', hasChanges);
  if (hasChanges) {
    const displayValue = changeCount > 99 ? '99+' : String(changeCount);
    if (badge) {
      badge.textContent = displayValue;
      badge.hidden = false;
    }
    el.setAttribute('data-dirty', '1');
    if (el.dataset) el.dataset.dirtyCount = String(changeCount);
    if (baseLabel) {
      const accessibleCount = changeCount > 99 ? 'more than 99' : String(changeCount);
      const changeLabel = changeCount === 1 ? 'pending change' : 'pending changes';
      el.setAttribute('aria-label', `${baseLabel} (${accessibleCount} ${changeLabel})`);
    }
  } else {
    if (badge) {
      badge.hidden = true;
      badge.textContent = '';
    }
    el.removeAttribute('data-dirty');
    if (el.dataset) delete el.dataset.dirtyCount;
    if (baseLabel) el.setAttribute('aria-label', baseLabel);
    else el.removeAttribute('aria-label');
  }
}

function refreshFileDirtyBadges() {
  updateFileDirtyBadge('index');
  updateFileDirtyBadge('tabs');
  updateFileDirtyBadge('site');
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('ns-editor-language-applied', refreshFileDirtyBadges);
}

function collectUnsyncedMarkdownEntries() {
  const entries = [];
  const seen = new Set();

  dynamicEditorTabs.forEach((tab) => {
    if (!tab || !tab.path) return;
    const path = normalizeRelPath(tab.path);
    if (!path || seen.has(path)) return;
    const hasDraftContent = !!(tab.localDraft && normalizeMarkdownContent(tab.localDraft.content || ''));
    const hasDirtyChanges = !!tab.isDirty;
    if (!hasDirtyChanges && !hasDraftContent) return;
    let state = '';
    if (tab.draftConflict) state = 'conflict';
    else if (hasDirtyChanges) state = 'dirty';
    else if (hasDraftContent) state = 'saved';
    const entry = {
      kind: 'markdown',
      label: path,
      path,
      state,
    };
    const assetCount = countMarkdownAssets(path);
    if (assetCount) entry.assetCount = assetCount;
    entries.push(entry);
    seen.add(path);
  });

  const store = readMarkdownDraftStore();
  if (store && typeof store === 'object') {
    Object.keys(store).forEach((key) => {
      const path = normalizeRelPath(key);
      if (!path || seen.has(path)) return;
      const entry = store[key];
      if (!entry || typeof entry !== 'object') return;
      const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
      if (!content) return;
      importMarkdownAssetsForPath(path, entry.assets || []);
      const item = {
        kind: 'markdown',
        label: path,
        path,
        state: 'saved',
      };
      const assetCount = countMarkdownAssets(path);
      if (assetCount) item.assetCount = assetCount;
      entries.push(item);
      seen.add(path);
    });
  }

  entries.sort((a, b) => {
    try { return a.label.localeCompare(b.label); }
    catch (_) { return 0; }
  });
  return entries;
}

function computeUnsyncedSummary() {
  const entries = [];
  const indexDiff = composerDiffCache.index;
  const tabsDiff = composerDiffCache.tabs;
  const siteDiff = composerDiffCache.site;
  if (indexDiff && indexDiff.hasChanges) {
    entries.push({
      kind: 'index',
      label: 'index.yaml',
      hasOrderChange: !!indexDiff.orderChanged,
      hasContentChange: Object.keys(indexDiff.keys || {}).length > 0
        || indexDiff.addedKeys.length > 0
        || indexDiff.removedKeys.length > 0
    });
  }
  if (tabsDiff && tabsDiff.hasChanges) {
    entries.push({
      kind: 'tabs',
      label: 'tabs.yaml',
      hasOrderChange: !!tabsDiff.orderChanged,
      hasContentChange: Object.keys(tabsDiff.keys || {}).length > 0
        || tabsDiff.addedKeys.length > 0
        || tabsDiff.removedKeys.length > 0
    });
  }
  if (siteDiff && siteDiff.hasChanges) {
    entries.push({
      kind: 'site',
      label: 'site.yaml',
      hasContentChange: true
    });
  }
  const systemEntries = getSystemUpdateSummaryEntries();
  if (systemEntries && systemEntries.length) {
    systemEntries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      entries.push({ ...entry, kind: 'system' });
    });
  }
  const markdownEntries = collectUnsyncedMarkdownEntries();
  if (markdownEntries.length) entries.push(...markdownEntries);
  return entries;
}

function getModeTabButton(mode) {
  try {
    return document.querySelector(`.mode-tab[data-mode="${mode}"]:not(.dynamic-mode)`);
  } catch (_) {
    return null;
  }
}

function getModeTabBaseLabel(btn) {
  if (!btn) return '';
  if (btn.dataset && btn.dataset.tabLabel) return btn.dataset.tabLabel;
  const attr = btn.getAttribute('data-tab-label');
  if (attr) {
    const trimmed = attr.trim();
    if (btn.dataset) btn.dataset.tabLabel = trimmed;
    return trimmed;
  }
  if (btn.dataset && btn.dataset.baseLabel) return btn.dataset.baseLabel;
  const fallback = (btn.textContent || '').trim();
  if (fallback) {
    if (btn.dataset) btn.dataset.baseLabel = fallback;
    return fallback;
  }
  const mode = (btn.getAttribute('data-mode') || '').trim();
  if (!mode) return '';
  const formatted = mode.charAt(0).toUpperCase() + mode.slice(1);
  if (btn.dataset) btn.dataset.baseLabel = formatted;
  return formatted;
}

function ensureModeTabBadgeElement(btn) {
  if (!btn) return null;
  let badge = btn.querySelector('.mode-tab-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'mode-tab-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.hidden = true;
    btn.appendChild(badge);
  }
  return badge;
}

function applyModeTabBadgeState(mode, count) {
  const btn = getModeTabButton(mode);
  if (!btn) return;
  const baseLabel = getModeTabBaseLabel(btn);
  const badge = ensureModeTabBadgeElement(btn);
  if (baseLabel && btn.dataset) btn.dataset.tabLabel = baseLabel;

  let numericCount = 0;
  if (typeof count === 'number' && Number.isFinite(count)) {
    numericCount = Math.max(0, Math.floor(count));
  } else {
    const parsed = parseInt(count, 10);
    numericCount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  if (numericCount > 0) {
    const displayValue = numericCount > 99 ? '99+' : String(numericCount);
    if (badge) {
      badge.textContent = displayValue;
      badge.hidden = false;
    }
    btn.setAttribute('data-dirty', '1');
    if (btn.dataset) btn.dataset.badgeCount = String(numericCount);
    if (baseLabel) {
      const accessibleCount = numericCount > 99 ? 'more than 99' : String(numericCount);
      const changeLabel = numericCount === 1 ? 'pending change' : 'pending changes';
      btn.setAttribute('aria-label', `${baseLabel} (${accessibleCount} ${changeLabel})`);
    }
  } else {
    if (badge) {
      badge.hidden = true;
      badge.textContent = '';
    }
    btn.removeAttribute('data-dirty');
    if (btn.dataset) delete btn.dataset.badgeCount;
    if (baseLabel) {
      btn.setAttribute('aria-label', baseLabel);
    } else {
      btn.removeAttribute('aria-label');
    }
  }
}

function updateModeDirtyIndicators(summaryEntries) {
  let entries = Array.isArray(summaryEntries) ? summaryEntries : null;
  if (!entries) {
    if (summaryEntries && typeof summaryEntries === 'object') entries = [summaryEntries];
    else {
      try { entries = computeUnsyncedSummary(); }
      catch (_) { entries = []; }
    }
  }

  let composerCount = 0;
  let editorCount = 0;
  let updatesCount = 0;

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.kind === 'index' || entry.kind === 'tabs' || entry.kind === 'site') composerCount += 1;
    else if (entry.kind === 'markdown') editorCount += 1;
    else if (entry.kind === 'system') updatesCount += 1;
  }

  if (!composerCount) {
    try {
      if (hasUnsavedComposerChanges()) composerCount = Math.max(composerCount, 1);
      else if (composerDraftMeta && (composerDraftMeta.index || composerDraftMeta.tabs || composerDraftMeta.site)) composerCount = Math.max(composerCount, 1);
    } catch (_) { /* ignore */ }
  }

  if (!editorCount && !Array.isArray(summaryEntries)) {
    try {
      if (hasUnsavedMarkdownDrafts()) editorCount = Math.max(editorCount, 1);
    } catch (_) { editorCount = 0; }
  }

  applyModeTabBadgeState('composer', composerCount);
  applyModeTabBadgeState('editor', editorCount);
  applyModeTabBadgeState('updates', updatesCount);
  try {
    refreshEditorContentTree({ preserveStructure: currentMode && (isDynamicMode(currentMode) || currentMode === 'composer' || currentMode === 'updates' || currentMode === 'sync') });
  } catch (_) {}
}

function updateReviewButton(summaryEntries = []) {
  const btn = document.getElementById('btnReview');
  if (!btn) return;
  const activeKind = getActiveComposerFile();
  const normalizedKind = activeKind === 'tabs' ? 'tabs' : (activeKind === 'site' ? 'site' : 'index');
  if (normalizedKind === 'site') {
    btn.hidden = true;
    btn.style.display = 'none';
    btn.removeAttribute('data-kind');
    btn.setAttribute('aria-hidden', 'true');
    btn.removeAttribute('title');
    btn.removeAttribute('aria-label');
    return;
  }
  const targetEntry = summaryEntries.find(entry => entry && entry.kind === normalizedKind);
  if (targetEntry) {
    btn.hidden = false;
    btn.style.display = '';
    btn.dataset.kind = targetEntry.kind === 'tabs' ? 'tabs' : 'index';
    btn.setAttribute('aria-hidden', 'false');
    const label = targetEntry.label || (targetEntry.kind === 'tabs' ? 'tabs.yaml' : 'index.yaml');
    const description = `Review changes for ${label}`;
    btn.setAttribute('aria-label', description);
    btn.title = description;
  } else {
    btn.hidden = true;
    btn.style.display = 'none';
    btn.removeAttribute('data-kind');
    btn.setAttribute('aria-hidden', 'true');
    btn.removeAttribute('title');
    btn.removeAttribute('aria-label');
  }
}

function updateDiscardButtonVisibility() {
  const btn = document.getElementById('btnDiscard');
  if (!btn) return;
  const activeKind = getActiveComposerFile();
  const normalizedKind = activeKind === 'tabs' ? 'tabs' : activeKind === 'site' ? 'site' : 'index';
  const diff = composerDiffCache[normalizedKind];
  const meta = composerDraftMeta[normalizedKind];
  const hasLocalChanges = !!(diff && diff.hasChanges);
  const hasDraft = !!meta;
  const shouldShow = hasLocalChanges || hasDraft;
  btn.hidden = !shouldShow;
  btn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  btn.style.display = shouldShow ? '' : 'none';
}

function updateUnsyncedSummary(options = {}) {
  const summaryEntries = computeUnsyncedSummary();
  updateDiscardButtonVisibility();
  updateReviewButton(summaryEntries.length ? summaryEntries : []);
  updateModeDirtyIndicators(summaryEntries);
  refreshComposerInlineMeta(options);
  scheduleSyncCommitPanelRefresh();
}

function findDynamicTabByPath(path) {
  const normalized = normalizeRelPath(path);
  if (!normalized) return null;
  for (const tab of dynamicEditorTabs.values()) {
    if (tab && normalizeRelPath(tab.path) === normalized) return tab;
  }
  return null;
}

function encodeContentToBase64(text) {
  const input = String(text == null ? '' : text);
  if (typeof window !== 'undefined' && typeof window.TextEncoder === 'function') {
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(input);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, slice);
      }
      return btoa(binary);
    } catch (_) {
      /* fall through to fallback */
    }
  }
  try {
    return btoa(unescape(encodeURIComponent(input)));
  } catch (_) {
    let binary = '';
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      if (code > 0xFF) {
        binary += String.fromCharCode(code >> 8, code & 0xFF);
      } else {
        binary += String.fromCharCode(code);
      }
    }
    return btoa(binary);
  }
}

function exportIndexDataForSeo(state) {
  const output = {};
  if (!state || typeof state !== 'object') return output;
  const keys = Array.isArray(state.__order)
    ? state.__order.filter((key) => key && key !== '__order')
    : Object.keys(state);
  keys.forEach((key) => {
    if (key === '__order') return;
    const entry = state[key];
    if (!entry || typeof entry !== 'object') return;
    const langs = {};
    Object.keys(entry).forEach((lang) => {
      if (lang === '__order') return;
      const value = entry[lang];
      if (Array.isArray(value)) {
        const normalized = value
          .map((item) => (item == null ? '' : String(item)))
          .filter((item) => item);
        if (!normalized.length) return;
        if (normalized.length === 1) langs[lang] = normalized[0];
        else langs[lang] = normalized;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) langs[lang] = trimmed;
      }
    });
    if (Object.keys(langs).length) output[key] = langs;
  });
  return output;
}

function exportTabsDataForSeo(state) {
  const output = {};
  if (!state || typeof state !== 'object') return output;
  const keys = Array.isArray(state.__order)
    ? state.__order.filter((key) => key && key !== '__order')
    : Object.keys(state);
  keys.forEach((key) => {
    if (key === '__order') return;
    const entry = state[key];
    if (!entry || typeof entry !== 'object') return;
    const langs = {};
    Object.keys(entry).forEach((lang) => {
      if (lang === '__order') return;
      const value = entry[lang];
      if (!value || typeof value !== 'object') return;
      const title = value.title != null ? String(value.title) : '';
      const location = value.location != null ? String(value.location) : '';
      if (!title && !location) return;
      langs[lang] = { title, location };
    });
    if (Object.keys(langs).length) output[key] = langs;
  });
  return output;
}

function exportSiteConfigForSeo(state) {
  const base = cloneSiteState(state || {});
  if (!base.contentRoot) base.contentRoot = getContentRootSafe() || 'wwwroot';
  if (!base.defaultLanguage) {
    try {
      const baseline = remoteBaseline && remoteBaseline.site;
      if (baseline && baseline.defaultLanguage) base.defaultLanguage = baseline.defaultLanguage;
    } catch (_) { /* ignore */ }
  }
  return base;
}

function escapeSeoXml(str) {
  return String(str || '').replace(/[<>&'\"]/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

function escapeSeoHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function formatSeoXml(xml) {
  try {
    const formatted = [];
    let pad = 0;
    xml
      .replace(/>(\s*)</g, '>$1\n<')
      .split('\n')
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^<\//.test(trimmed)) pad = Math.max(pad - 1, 0);
        formatted.push(`${'  '.repeat(pad)}${trimmed}`);
        if (/^<[^!?][^>]*[^/]>/i.test(trimmed) && !/<.*<\/.*>/.test(trimmed)) pad += 1;
      });
    return formatted.join('\n');
  } catch (_) {
    return xml;
  }
}

function generateSeoSitemapXml(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  urls.forEach((url) => {
    if (!url || !url.loc) return;
    xml += '  <url>\n';
    xml += `    <loc>${escapeSeoXml(url.loc)}</loc>\n`;
    if (Array.isArray(url.alternates)) {
      url.alternates.forEach((alt) => {
        if (!alt || !alt.href || !alt.hreflang) return;
        xml += `    <xhtml:link rel="alternate" hreflang="${escapeSeoXml(alt.hreflang)}" href="${escapeSeoXml(alt.href)}"/>\n`;
      });
      if (url.xdefault) {
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeSeoXml(url.xdefault)}"/>\n`;
      }
    }
    if (url.lastmod) xml += `    <lastmod>${escapeSeoXml(url.lastmod)}</lastmod>\n`;
    if (url.changefreq) xml += `    <changefreq>${escapeSeoXml(url.changefreq)}</changefreq>\n`;
    if (url.priority) xml += `    <priority>${escapeSeoXml(url.priority)}</priority>\n`;
    xml += '  </url>\n';
  });
  xml += '</urlset>';
  return formatSeoXml(xml);
}

function computeSeoContentRoot(siteConfig) {
  const raw = siteConfig && siteConfig.contentRoot ? String(siteConfig.contentRoot) : 'wwwroot';
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed || 'wwwroot';
}

function generateSeoRobotsTxt(siteConfig) {
  const baseUrl = resolveSiteBaseUrl(siteConfig);
  const contentRoot = computeSeoContentRoot(siteConfig);
  const deriveBasePath = () => {
    if (!baseUrl) return '/';
    const ensureLeadingAndTrailingSlash = (value) => {
      if (!value) return '/';
      let normalized = value;
      if (!normalized.startsWith('/')) normalized = `/${normalized}`;
      normalized = normalized.replace(/\/+/g, '/');
      if (normalized !== '/' && !normalized.endsWith('/')) normalized = `${normalized}/`;
      return normalized === '//' ? '/' : normalized;
    };
    const resolvePathname = (raw) => {
      if (!raw) return '/';
      try {
        const parsed = new URL(raw);
        return parsed.pathname || '/';
      } catch (_) {
        try {
          if (typeof window !== 'undefined' && window.location && window.location.origin) {
            const parsed = new URL(raw, window.location.origin);
            return parsed.pathname || '/';
          }
        } catch (_) {
          /* noop */
        }
      }
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('/')) return trimmed;
      }
      return '/';
    };
    const pathname = resolvePathname(baseUrl);
    if (!pathname || pathname === '/') return '/';
    return ensureLeadingAndTrailingSlash(pathname);
  };
  const basePath = deriveBasePath();
  const withBasePath = (path) => {
    const input = String(path == null ? '' : path).trim();
    if (!input || input === '/') return basePath;
    const hasTrailingSlash = input.endsWith('/');
    const stripped = input.replace(/^\/+/, '');
    const prefix = basePath === '/' ? '/' : basePath;
    let combined = prefix === '/' ? `/${stripped}` : `${prefix}${stripped}`;
    if (hasTrailingSlash && !combined.endsWith('/')) combined += '/';
    if (!combined.startsWith('/')) combined = `/${combined}`;
    return combined === '//' ? '/' : combined;
  };
  let robots = 'User-agent: *\n';
  robots += `Allow: ${withBasePath('/')}\n\n`;
  robots += '# Sitemap\n';
  robots += `Sitemap: ${baseUrl}sitemap.xml\n\n`;
  robots += '# Allow crawling of main content\n';
  robots += `Allow: ${withBasePath(`${contentRoot}/`)}\n`;
  robots += `Allow: ${withBasePath('assets/')}\n\n`;
  robots += '# Disallow admin or internal directories\n';
  robots += `Disallow: ${withBasePath('admin/')}\n`;
  robots += `Disallow: ${withBasePath('.git/')}\n`;
  robots += `Disallow: ${withBasePath('node_modules/')}\n`;
  robots += `Disallow: ${withBasePath('.env')}\n`;
  robots += `Disallow: ${withBasePath('package.json')}\n`;
  robots += `Disallow: ${withBasePath('package-lock.json')}\n\n`;
  robots += '# SEO tools (allow but not priority)\n';
  robots += `Allow: ${withBasePath('sitemap-generator.html')}\n\n`;
  robots += '# Crawl delay (be nice to servers)\n';
  robots += 'Crawl-delay: 1\n\n';
  robots += '# Generated by NanoSite\n';
  robots += `# ${new Date().toISOString()}\n`;
  return robots;
}

function generateSeoMetaTags(siteConfig) {
  const baseUrl = resolveSiteBaseUrl(siteConfig);
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (val.default) return val.default;
    const langs = Object.keys(val);
    if (langs.length) return val[langs[0]];
    return fallback;
  };
  const siteTitle = getLocalizedValue(siteConfig.siteTitle, 'NanoSite');
  const siteDescription = getLocalizedValue(siteConfig.siteDescription, 'A pure front-end blog template');
  const siteKeywords = getLocalizedValue(siteConfig.siteKeywords, 'blog, static site, markdown');
  const avatar = siteConfig.avatar || 'assets/avatar.png';
  const fullAvatarUrl = avatar.startsWith('http') ? avatar : baseUrl + avatar.replace(/^\/+/, '');
  let html = '';
  html += `  <!-- Primary SEO Meta Tags -->\n`;
  html += `  <title>${escapeSeoHtml(siteTitle)}</title>\n`;
  html += `  <meta name="title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta name="description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta name="keywords" content="${escapeSeoHtml(siteKeywords)}">\n`;
  html += `  <meta name="author" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += '  <meta name="robots" content="index, follow">\n';
  html += `  <link rel="canonical" href="${baseUrl}">\n`;
  html += '  \n';
  html += '  <!-- Open Graph / Facebook -->\n';
  html += '  <meta property="og:type" content="website">\n';
  html += `  <meta property="og:url" content="${baseUrl}">\n`;
  html += `  <meta property="og:title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta property="og:description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta property="og:image" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += `  <meta property="og:logo" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += '  \n';
  html += '  <!-- Twitter -->\n';
  html += '  <meta property="twitter:card" content="summary_large_image">\n';
  html += `  <meta property="twitter:url" content="${baseUrl}">\n`;
  html += `  <meta property="twitter:title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta property="twitter:description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta property="twitter:image" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += '  \n';
  html += '  <!-- Initial meta tags - will be updated by dynamic SEO system -->\n';
  html += '  <meta name="theme-color" content="#1a1a1a">\n';
  html += '  <meta name="msapplication-TileColor" content="#1a1a1a">\n';
  html += `  <link rel="icon" type="image/png" href="${escapeSeoHtml(avatar)}">`;
  return html;
}

function normalizeSeoLangCode(value) {
  const raw = safeString(value).trim();
  if (!raw) return '';
  const sanitized = raw.replace(/[^0-9A-Za-z-]/g, '');
  return sanitized || '';
}

function computeSeoHtmlLang(siteConfig) {
  const fromConfig = siteConfig && siteConfig.defaultLanguage;
  const normalized = normalizeSeoLangCode(fromConfig);
  if (normalized) return normalized;
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const docLang = normalizeSeoLangCode(document.documentElement.lang);
      if (docLang) return docLang;
    }
  } catch (_) { /* ignore */ }
  return 'en';
}

function applySeoHtmlLang(html, lang) {
  const normalized = normalizeSeoLangCode(lang);
  if (!normalized) return html;
  const langAttrRegex = /(<html\b[^>]*\blang\s*=\s*)(["'])([^"']*)(\2)/i;
  if (langAttrRegex.test(html)) {
    return html.replace(langAttrRegex, `$1$2${normalized}$4`);
  }
  return html.replace(/<html\b([^>]*)>/i, `<html$1 lang="${normalized}">`);
}

function injectSeoMetaIntoIndexHtml(baseHtml, metaBlock) {
  if (!baseHtml) return '';
  const META_START = '  <!-- Primary SEO Meta Tags -->';
  const META_NOTE = '  <!-- Note: Structured data is dynamically generated by the SEO system -->';
  const startIndex = baseHtml.indexOf(META_START);
  const noteIndex = baseHtml.indexOf(META_NOTE);
  if (startIndex === -1 || noteIndex === -1 || noteIndex < startIndex) return '';
  const before = baseHtml.slice(0, startIndex);
  const after = baseHtml.slice(noteIndex + META_NOTE.length);
  const trimmedMeta = metaBlock.trimEnd();
  const replacement = `${trimmedMeta}\n\n${META_NOTE}`;
  return `${before}${replacement}${after}`;
}

function buildDefaultIndexHtml(metaBlock, lang) {
  const langAttr = normalizeSeoLangCode(lang) || 'en';
  const trimmedMeta = metaBlock.trimEnd();
  const metaSection = trimmedMeta ? `${trimmedMeta}\n\n` : '';
  let html = '<!DOCTYPE html>\n';
  html += `<html lang="${escapeSeoHtml(langAttr)}">\n\n`;
  html += '<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n\n';
  html += metaSection;
  html += '  <!-- Note: Structured data is dynamically generated by the SEO system -->\n\n';
  html += '  <script src="assets/js/theme-boot.js"></script>\n';
  html += '  <link rel="stylesheet" id="theme-pack">\n';
  html += '</head>\n\n';
  html += '<body>\n';
  html += '  <script type="module" src="assets/main.js?v=20260430state"></script>\n';
  html += '</body>\n\n';
  html += '</html>\n';
  return html;
}

function generateSeoIndexHtml(siteConfig, baseHtml) {
  const metaBlock = ensureTrailingNewline(generateSeoMetaTags(siteConfig)).trimEnd();
  const lang = computeSeoHtmlLang(siteConfig);
  let html = '';
  if (baseHtml) {
    html = injectSeoMetaIntoIndexHtml(baseHtml, metaBlock);
  }
  if (!html) {
    html = buildDefaultIndexHtml(metaBlock, lang);
  }
  html = applySeoHtmlLang(html, lang);
  return ensureTrailingNewline(html);
}

function ensureTrailingNewline(text) {
  const str = String(text == null ? '' : text);
  return str.endsWith('\n') ? str : `${str}\n`;
}

function normalizeSeoContent(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .trim();
}

async function fetchExistingSeoFile(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return '';
    return await response.text();
  } catch (_) {
    return '';
  }
}

async function generateSeoCommitFiles() {
  try {
    const siteState = exportSiteConfigForSeo(getStateSlice('site'));
    const indexState = exportIndexDataForSeo(getStateSlice('index'));
    const tabsState = exportTabsDataForSeo(getStateSlice('tabs'));
    const urls = generateSitemapData(indexState, tabsState, siteState) || [];
    const sitemapXml = ensureTrailingNewline(generateSeoSitemapXml(urls));
    const robotsTxt = ensureTrailingNewline(generateSeoRobotsTxt(siteState));
    const remoteIndexHtml = await fetchExistingSeoFile('index.html');
    const indexHtml = generateSeoIndexHtml(siteState, remoteIndexHtml);

    const candidates = [
      { seoType: 'sitemap', path: 'sitemap.xml', label: 'sitemap.xml', content: sitemapXml },
      { seoType: 'robots', path: 'robots.txt', label: 'robots.txt', content: robotsTxt },
      { seoType: 'index', path: 'index.html', label: 'index.html', content: indexHtml, remote: remoteIndexHtml }
    ];

    const files = [];
    for (const candidate of candidates) {
      const remote = Object.prototype.hasOwnProperty.call(candidate, 'remote')
        ? candidate.remote
        : await fetchExistingSeoFile(candidate.path);
      if (normalizeSeoContent(remote) === normalizeSeoContent(candidate.content)) continue;
      files.push({
        kind: 'seo',
        seoType: candidate.seoType,
        label: candidate.label,
        path: candidate.path,
        content: candidate.content,
        isSeo: true
      });
    }
    return files;
  } catch (err) {
    console.error('Failed to prepare SEO files for commit', err);
    return [];
  }
}

async function gatherCommitPayload(options = {}) {
  const { showSeoStatus = false } = options;
  const base = gatherLocalChangesForCommit(options);
  const files = Array.isArray(base.files) ? base.files.slice() : [];
  if (showSeoStatus) {
    try {
      if (typeof setSyncOverlayStatus === 'function') {
        setSyncOverlayStatus('Generating SEO files…');
      }
    } catch (_) { /* ignore */ }
  }
  const seoFiles = await generateSeoCommitFiles();
  if (seoFiles.length) files.push(...seoFiles);
  return { files, seoFiles };
}

function gatherLocalChangesForCommit(options = {}) {
  const { cleanupUnusedAssets = true } = options;
  const files = [];
  const seenPaths = new Set();
  const addFile = (entry) => {
    if (!entry || !entry.path) return;
    const key = entry.path.replace(/\\+/g, '/');
    if (seenPaths.has(key)) return;
    seenPaths.add(key);
    files.push({ ...entry, path: key });
  };

  try {
    dynamicEditorTabs.forEach((tab) => { flushMarkdownDraft(tab); });
  } catch (_) { /* ignore */ }

  const siteState = getStateSlice('site');
  let root;
  if (siteState && Object.prototype.hasOwnProperty.call(siteState, 'contentRoot')) {
    root = safeString(siteState.contentRoot);
  }
  if (!root) {
    root = getContentRootSafe();
  }
  const normalizedRoot = String(root || '')
    .replace(/\\+/g, '/').replace(/\/?$/, '');
  const rootPrefix = normalizedRoot ? `${normalizedRoot}/` : '';

  if (composerDiffCache.index && composerDiffCache.index.hasChanges) {
    const state = getStateSlice('index') || { __order: [] };
    const yaml = toIndexYaml(state);
    addFile({ kind: 'index', label: 'index.yaml', path: `${rootPrefix}index.yaml`, content: yaml });
  }
  if (composerDiffCache.tabs && composerDiffCache.tabs.hasChanges) {
    const state = getStateSlice('tabs') || { __order: [] };
    const yaml = toTabsYaml(state);
    addFile({ kind: 'tabs', label: 'tabs.yaml', path: `${rootPrefix}tabs.yaml`, content: yaml });
  }
  if (composerDiffCache.site && composerDiffCache.site.hasChanges) {
    const state = getStateSlice('site') || {};
    const yaml = toSiteYaml(state);
    addFile({ kind: 'site', label: 'site.yaml', path: 'site.yaml', content: yaml });
  }

  const markdownEntries = collectUnsyncedMarkdownEntries();
  if (markdownEntries && markdownEntries.length) {
    const editorApi = getPrimaryEditorApi();
    const activeTab = getActiveDynamicTab();
    let activeValue = null;
    if (editorApi && typeof editorApi.getValue === 'function' && activeTab && activeTab.mode === currentMode) {
      try { activeValue = String(editorApi.getValue() || ''); }
      catch (_) { activeValue = null; }
    }
    const draftStore = readMarkdownDraftStore();
    markdownEntries.forEach((entry) => {
      const rel = normalizeRelPath(entry.path);
      if (!rel) return;
      const repoPath = `${rootPrefix}${rel}`;
      const tab = findDynamicTabByPath(rel);
      let text = '';
      if (tab) {
        if (tab === activeTab && activeValue != null) {
          tab.content = activeValue;
        }
        if (tab.content != null && tab.content !== undefined) {
          text = normalizeMarkdownContent(tab.content);
        } else if (tab.localDraft && tab.localDraft.content != null) {
          text = normalizeMarkdownContent(tab.localDraft.content);
        }
      } else if (draftStore && draftStore[rel] && typeof draftStore[rel] === 'object') {
        const draft = draftStore[rel];
        if (draft.content != null) text = normalizeMarkdownContent(draft.content);
      }
      addFile({
        kind: 'markdown',
        label: rel,
        path: repoPath,
        content: text,
        markdownPath: rel,
        state: entry.state || ''
      });

      const assets = listMarkdownAssets(rel);
      if (assets.length) {
        const normalizedText = normalizeMarkdownContent(text);
        const unusedAssets = [];
        assets.forEach((asset) => {
          if (!asset || !asset.path || !asset.base64) return;
          const commitPath = `${rootPrefix}${asset.path}`.replace(/\\+/g, '/');
          if (!isAssetReferencedInContent(normalizedText, asset)) {
            unusedAssets.push(asset.path);
            return;
          }
          addFile({
            kind: 'asset',
            label: asset.relativePath || asset.path,
            path: commitPath,
            base64: asset.base64,
            binary: true,
            mime: asset.mime || 'application/octet-stream',
            size: Number.isFinite(asset.size) ? asset.size : 0,
            markdownPath: rel,
            assetPath: asset.path,
            assetRelativePath: asset.relativePath || ''
          });
        });
        if (cleanupUnusedAssets && unusedAssets.length) {
          unusedAssets.forEach((assetPath) => {
            removeMarkdownAsset(rel, assetPath);
          });
        }
      }
    });
  }

  const systemFiles = getSystemUpdateCommitFiles();
  if (systemFiles && systemFiles.length) {
    systemFiles.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      addFile({ ...entry, kind: 'system' });
    });
  }

  return { files };
}

async function githubGraphqlRequest(token, query, variables = {}) {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) throw new Error('GitHub token is required.');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${trimmedToken}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const body = JSON.stringify({ query, variables });
  let response;
  try {
    response = await fetch('https://api.github.com/graphql', { method: 'POST', headers, body });
  } catch (err) {
    const error = new Error('Network error while reaching GitHub.');
    error.cause = err;
    throw error;
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error((payload && payload.message) || `GitHub API error (${response.status})`);
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  if (payload && Array.isArray(payload.errors) && payload.errors.length) {
    const first = payload.errors[0];
    const error = new Error((first && first.message) || 'GitHub GraphQL error.');
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  return payload ? payload.data : null;
}

function describeSummaryEntry(entry) {
  if (!entry) return '';
  const base = entry.label || entry.path || entry.kind || '';
  if (entry.kind === 'markdown') {
    const status = entry.state ? ` (${entry.state})` : '';
    const assetLabel = entry.assetCount
      ? ` – ${entry.assetCount} image${entry.assetCount === 1 ? '' : 's'}`
      : '';
    return `${base}${status}${assetLabel}`;
  }
  if (entry.kind === 'index' || entry.kind === 'tabs') {
    const bits = [];
    if (entry.hasContentChange) bits.push('content');
    if (entry.hasOrderChange) bits.push('order');
    if (!bits.length) return base;
    return `${base} – ${bits.join(' & ')} changes`;
  }
  if (entry.kind === 'seo') {
    const type = entry.seoType === 'sitemap'
      ? 'Sitemap'
      : entry.seoType === 'robots'
        ? 'Robots.txt'
        : entry.seoType === 'index'
          ? 'Index HTML'
          : 'Meta tags';
    return `${base} – auto-generated SEO (${type})`;
  }
  if (entry.kind === 'system') {
    let label = '';
    try {
      const key = entry.state === 'added' ? 'added' : 'modified';
      label = t(`editor.systemUpdates.summary.${key}`);
    } catch (_) { label = ''; }
    if (label) return `${base} – ${label}`;
    return `${base} – system file update`;
  }
  return base;
}

let syncCommitPanelRenderSeq = 0;
let syncCommitPanelRefreshTimer = 0;

function openGithubCommitFilePreview(file, triggerEl) {
  if (!file) return;

  const previewModal = document.createElement('div');
  previewModal.className = 'ns-modal github-preview-modal';
  previewModal.setAttribute('aria-hidden', 'true');

  const previewDialog = document.createElement('div');
  previewDialog.className = 'ns-modal-dialog github-preview-dialog';
  previewDialog.setAttribute('role', 'dialog');
  previewDialog.setAttribute('aria-modal', 'true');

  const head = document.createElement('div');
  head.className = 'comp-guide-head';
  const headLeft = document.createElement('div');
  headLeft.className = 'comp-head-left';
  const previewTitleId = `nsGithubPreviewTitle-${Math.random().toString(36).slice(2, 8)}`;
  const title = document.createElement('strong');
  title.id = previewTitleId;
  title.textContent = file.label || file.path || t('editor.composer.github.preview.untitled');
  headLeft.appendChild(title);
  const subtitle = document.createElement('span');
  subtitle.className = 'muted';
  subtitle.textContent = t('editor.composer.github.preview.subtitle');
  headLeft.appendChild(subtitle);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ns-modal-close btn-secondary';
  const closeLabel = t('editor.composer.dialogs.close');
  closeBtn.textContent = closeLabel;
  closeBtn.setAttribute('aria-label', closeLabel);
  head.appendChild(headLeft);
  head.appendChild(closeBtn);
  previewDialog.appendChild(head);
  previewDialog.setAttribute('aria-labelledby', previewTitleId);

  const body = document.createElement('div');
  body.className = 'github-preview-body';
  const pathLine = document.createElement('p');
  pathLine.className = 'github-preview-path';
  pathLine.textContent = file.path || file.label || '';
  body.appendChild(pathLine);

  const contentWrap = document.createElement('div');
  contentWrap.className = 'github-preview-content';
  if (file.kind === 'asset') {
    if (file.base64) {
      const mime = file.mime || 'application/octet-stream';
      const img = document.createElement('img');
      img.className = 'github-preview-image';
      img.alt = file.label || file.path || '';
      img.src = `data:${mime};base64,${file.base64}`;
      contentWrap.appendChild(img);
      if (Number.isFinite(file.size)) {
        const meta = document.createElement('p');
        meta.className = 'github-preview-meta';
        const sizeKb = file.size > 0 ? (file.size / 1024).toFixed(1) : '0';
        meta.textContent = `${mime} · ${sizeKb} KB`;
        body.appendChild(meta);
      }
    } else {
      const notice = document.createElement('p');
      notice.className = 'github-preview-empty';
      notice.textContent = t('editor.composer.github.preview.unavailable');
      contentWrap.appendChild(notice);
    }
  } else if (typeof file.content === 'string') {
    const pre = document.createElement('pre');
    pre.className = 'github-preview-code';
    pre.textContent = file.content;
    contentWrap.appendChild(pre);
  } else {
    const notice = document.createElement('p');
    notice.className = 'github-preview-empty';
    notice.textContent = t('editor.composer.github.preview.unavailable');
    contentWrap.appendChild(notice);
  }

  body.appendChild(contentWrap);
  previewDialog.appendChild(body);
  previewModal.appendChild(previewDialog);
  document.body.appendChild(previewModal);

  let closing = false;
  const reduceMotion = (() => {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (_) { return false; }
  })();
  const hadModalOpen = document.body.classList.contains('ns-modal-open');
  const restoreFocus = () => {
    if (!triggerEl || typeof triggerEl.focus !== 'function') return;
    try { triggerEl.focus({ preventScroll: true }); }
    catch (_) { triggerEl.focus(); }
  };
  const closePreview = () => {
    if (closing) return;
    closing = true;
    const finish = () => {
      try { previewModal.remove(); } catch (_) {}
      if (!hadModalOpen) document.body.classList.remove('ns-modal-open');
      restoreFocus();
    };
    if (reduceMotion) { finish(); return; }
    try {
      previewModal.classList.remove('ns-anim-in');
      previewModal.classList.add('ns-anim-out');
    } catch (_) {}
    const onEnd = () => {
      previewDialog.removeEventListener('animationend', onEnd);
      try { previewModal.classList.remove('ns-anim-out'); } catch (_) {}
      finish();
    };
    try {
      previewDialog.addEventListener('animationend', onEnd, { once: true });
      setTimeout(onEnd, 200);
    } catch (_) { onEnd(); }
  };

  document.body.classList.add('ns-modal-open');
  previewModal.classList.add('is-open');
  previewModal.setAttribute('aria-hidden', 'false');
  if (!reduceMotion) {
    try {
      previewModal.classList.add('ns-anim-in');
      const onEnd = () => {
        previewDialog.removeEventListener('animationend', onEnd);
        try { previewModal.classList.remove('ns-anim-in'); } catch (_) {}
      };
      previewDialog.addEventListener('animationend', onEnd, { once: true });
    } catch (_) {}
  }
  try { closeBtn.focus({ preventScroll: true }); }
  catch (_) { closeBtn.focus(); }
  closeBtn.addEventListener('click', () => closePreview());
  previewModal.addEventListener('mousedown', (event) => {
    if (event.target === previewModal) closePreview();
  });
  previewModal.addEventListener('keydown', (event) => {
    if ((event.key || '').toLowerCase() === 'escape') {
      event.preventDefault();
      closePreview();
    }
  });
}

function appendGithubCommitSummary(summaryBlock, commitFiles = [], seoFiles = [], summaryEntries = []) {
  summaryBlock.innerHTML = '';
  const files = Array.isArray(commitFiles) ? commitFiles : [];
  if (files.length) {
    const systemFilesGroup = files.filter((file) => file && file.kind === 'system');
    const textFiles = files.filter((file) => file && file.kind !== 'asset' && file.kind !== 'seo' && file.kind !== 'system');
    const seoFilesGroup = files.filter((file) => file && file.kind === 'seo');
    const assetFiles = files.filter((file) => file && file.kind === 'asset');

    const renderGroup = (titleText, groupFiles) => {
      if (!groupFiles || !groupFiles.length) return;
      const group = document.createElement('div');
      group.className = 'gh-sync-file-group';
      const groupTitle = document.createElement('div');
      groupTitle.className = 'gh-sync-file-group-title';
      groupTitle.textContent = titleText;
      group.appendChild(groupTitle);

      const list = document.createElement('div');
      list.className = 'gh-sync-file-list';
      groupFiles.forEach((file) => {
        if (!file) return;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gh-sync-file-entry';
        item.textContent = describeSummaryEntry(file) || file.label || file.path || '';
        item.addEventListener('click', () => openGithubCommitFilePreview(file, item));
        list.appendChild(item);
      });
      group.appendChild(list);
      summaryBlock.appendChild(group);
    };

    renderGroup(t('editor.composer.github.modal.summaryTextFilesTitle'), textFiles);
    renderGroup(t('editor.composer.github.modal.summarySystemFilesTitle'), systemFilesGroup);
    renderGroup(t('editor.composer.github.modal.summarySeoFilesTitle'), seoFilesGroup);
    renderGroup(t('editor.composer.github.modal.summaryAssetFilesTitle'), assetFiles);
  } else if (Array.isArray(summaryEntries) && summaryEntries.length) {
    const list = document.createElement('ul');
    list.style.margin = '.4rem 0 0';
    list.style.paddingLeft = '1.25rem';
    summaryEntries.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = describeSummaryEntry(entry);
      list.appendChild(item);
    });
    summaryBlock.appendChild(list);
  } else {
    const info = document.createElement('p');
    info.className = 'muted';
    info.textContent = t('editor.composer.github.modal.summaryEmpty');
    summaryBlock.appendChild(info);
  }

  if (Array.isArray(seoFiles) && seoFiles.length) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'SEO files were generated automatically and will be included in this upload.';
    summaryBlock.appendChild(note);
  }
}

function getSyncCommitPanelHost() {
  const syncPanel = document.getElementById('mode-sync');
  if (!syncPanel) return null;
  let panel = document.getElementById('syncCommitPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'syncCommitPanel';
    panel.className = 'sync-commit-panel';
    syncPanel.appendChild(panel);
  }
  return panel;
}

async function refreshSyncCommitPanel(options = {}) {
  const panel = getSyncCommitPanelHost();
  if (!panel) return null;
  const headerSubmit = document.getElementById('btnSyncSubmit');
  if (headerSubmit) {
    headerSubmit.disabled = true;
    headerSubmit.removeAttribute('aria-busy');
  }
  const renderId = ++syncCommitPanelRenderSeq;
  panel.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'muted sync-commit-loading';
  loading.textContent = t('editor.status.checkingDrafts');
  panel.appendChild(loading);

  const summaryEntries = computeUnsyncedSummary();
  let commitPayload = { files: [], seoFiles: [] };
  try {
    commitPayload = await gatherCommitPayload({ cleanupUnusedAssets: false, showSeoStatus: false });
  } catch (err) {
    if (renderId !== syncCommitPanelRenderSeq) return null;
    panel.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'sync-commit-error';
    error.textContent = err && err.message ? err.message : t('editor.toasts.githubCommitFailed');
    panel.appendChild(error);
    return null;
  }
  if (renderId !== syncCommitPanelRenderSeq) return null;

  const commitFiles = Array.isArray(commitPayload.files) ? commitPayload.files : [];
  const seoFiles = Array.isArray(commitPayload.seoFiles) ? commitPayload.seoFiles : [];
  const hasPending = commitFiles.length || summaryEntries.length;

  panel.innerHTML = '';
  const form = document.createElement('form');
  form.id = 'syncCommitForm';
  form.className = 'sync-commit-form comp-guide';
  form.setAttribute('novalidate', 'novalidate');

  const errorText = document.createElement('p');
  errorText.className = 'sync-commit-error';
  errorText.hidden = true;
  form.appendChild(errorText);

  const btnSubmit = headerSubmit;
  if (btnSubmit) {
    btnSubmit.disabled = !hasPending;
    btnSubmit.textContent = t('editor.composer.github.modal.submit');
  }

  const summaryBlock = document.createElement('div');
  summaryBlock.className = 'sync-commit-summary';
  appendGithubCommitSummary(summaryBlock, commitFiles, seoFiles, summaryEntries);
  form.appendChild(summaryBlock);

  panel.appendChild(form);

  const showError = (message) => {
    errorText.textContent = message;
    errorText.hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    errorText.hidden = true;
    const currentSummary = computeUnsyncedSummary();
    if (!currentSummary.length && !commitFiles.length) {
      showToast('info', t('editor.composer.noLocalChangesToCommit'));
      refreshSyncCommitPanel();
      return;
    }
    const input = document.getElementById('syncGithubTokenInput');
    const value = getFineGrainedTokenValue();
    if (!value) {
      showError(t('editor.composer.github.modal.errorRequired'));
      if (input && input.offsetParent) {
        try { input.focus({ preventScroll: true }); }
        catch (_) { input.focus(); }
      }
      return;
    }
    setCachedFineGrainedToken(value);
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.setAttribute('aria-busy', 'true');
    }
    try {
      await performDirectGithubCommit(value, currentSummary);
    } finally {
      if (btnSubmit) btnSubmit.removeAttribute('aria-busy');
      refreshSyncCommitPanel();
    }
  });

  if (options.focusToken) {
    const input = document.getElementById('syncGithubTokenInput');
    if (input && input.offsetParent) {
      try { input.focus({ preventScroll: true }); }
      catch (_) { input.focus(); }
    }
  }
  return { panel, input: document.getElementById('syncGithubTokenInput'), form };
}

function scheduleSyncCommitPanelRefresh() {
  if (currentMode !== 'sync') return;
  try {
    if (syncCommitPanelRefreshTimer) window.clearTimeout(syncCommitPanelRefreshTimer);
    syncCommitPanelRefreshTimer = window.setTimeout(() => {
      syncCommitPanelRefreshTimer = 0;
      refreshSyncCommitPanel();
    }, 120);
  } catch (_) {
    refreshSyncCommitPanel();
  }
}

async function waitForRemotePropagation(files = []) {
  if (!Array.isArray(files) || !files.length) return { canceled: false };

  const normalizedRoot = (() => {
    try {
      const root = (window.__ns_content_root || 'wwwroot').replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
      return root;
    } catch (_) {
      return 'wwwroot';
    }
  })();

  const toLivePath = (path) => {
    const clean = String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!clean) return '';
    if (normalizedRoot && clean.startsWith(`${normalizedRoot}/`)) {
      return clean.slice(normalizedRoot.length + 1);
    }
    if (normalizedRoot && clean === normalizedRoot) return '';
    return clean;
  };

  const arrayBufferToBase64 = (buffer) => {
    if (!buffer) return '';
    try {
      const bytes = new Uint8Array(buffer);
      const chunk = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode.apply(null, slice);
      }
      return btoa(binary);
    } catch (_) {
      try {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
      } catch (err) {
        console.error('Failed to encode array buffer to base64', err);
        return '';
      }
    }
  };

  const buildCheckPaths = (file) => {
    const paths = [];
    const commitPath = String(file.path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
    const livePath = toLivePath(commitPath);
    if (file.assetRelativePath && file.markdownPath) {
      const base = String(file.markdownPath || '').replace(/\\+/g, '/').replace(/^\/+/, '');
      const idx = base.lastIndexOf('/');
      const baseDir = idx >= 0 ? base.slice(0, idx + 1) : '';
      const rel = String(file.assetRelativePath || '').replace(/\\+/g, '/').replace(/^\/+/, '');
      const combined = `${baseDir}${rel}`.replace(/\/+/g, '/').replace(/^\/+/, '');
      if (combined && !paths.includes(combined)) paths.push(combined);
    }
    if (livePath && !paths.includes(livePath)) paths.push(livePath);
    if (commitPath && !paths.includes(commitPath)) paths.push(commitPath);
    return paths;
  };

  const unique = [];
  const seen = new Set();
  files.forEach((file) => {
    if (!file || !file.path) return;
    const normalized = String(file.path).replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized === 'site.yaml' || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push({ ...file, path: normalized });
  });

  const checkIntervalMs = 30000;
  const countdownStepMs = 1000;
  const maxAttempts = 10;
  let canceled = false;
  let timedOut = false;

  const cancelHandler = () => {
    if (canceled) return;
    canceled = true;
    setSyncOverlayStatus('Stopping remote checks…');
  };
  setSyncOverlayCancelHandler(cancelHandler, true);

  for (const file of unique) {
    if (canceled || timedOut) break;
    const displayLabel = String(file.label || file.path || '').trim() || file.path;
    const expectedText = normalizeMarkdownContent(file.content || '');
    const expectedBase64 = typeof file.base64 === 'string'
      ? file.base64.replace(/\s+/g, '')
      : '';
    const candidates = buildCheckPaths(file);
    let attempt = 0;
    let confirmed = false;
    while (!canceled && attempt < maxAttempts) {
      attempt += 1;
      setSyncOverlayStatus(`Checking ${displayLabel} (attempt ${attempt})…`);
      let ok = false;
      for (const path of candidates) {
        if (!path) continue;
        try {
          const url = `${path}?ts=${Date.now()}`;
          const resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok) {
            ok = false;
            continue;
          }
          if (file.binary) {
            const buffer = await resp.arrayBuffer();
            const remoteBase64 = arrayBufferToBase64(buffer);
            if (remoteBase64 && expectedBase64 && remoteBase64 === expectedBase64) {
              ok = true;
              break;
            }
          } else {
            const text = normalizeMarkdownContent(await resp.text());
            if (text === expectedText) {
              ok = true;
              break;
            }
          }
        } catch (_) {
          ok = false;
        }
      }
      if (canceled) break;
      if (ok) {
        confirmed = true;
        break;
      }
      for (let remaining = checkIntervalMs; remaining > 0; remaining -= countdownStepMs) {
        if (canceled) break;
        const seconds = Math.ceil(remaining / 1000);
        setSyncOverlayStatus(`Attempt ${attempt} did not match for ${displayLabel}. Next check in ${seconds}s…`);
        await sleep(Math.min(countdownStepMs, remaining));
        if (canceled) break;
      }
    }
    if (!canceled && !confirmed) {
      timedOut = true;
      setSyncOverlayStatus(`Could not confirm ${displayLabel} after ${maxAttempts} attempts.`);
    }
  }
  setSyncOverlayCancelHandler(null, true);
  if (canceled) {
    return { canceled: true };
  }
  if (timedOut) {
    return { canceled: false, timedOut: true };
  }
  setSyncOverlayStatus('All files confirmed on site.');
  return { canceled: false, timedOut: false };
}

function getActiveSiteRepoConfig() {
  const site = getStateSlice('site');
  const fallback = window.__ns_site_repo && typeof window.__ns_site_repo === 'object'
    ? window.__ns_site_repo
    : {};
  return resolveSiteRepoConfig(site, composerSiteLocalOverride, fallback);
}

function applyLocalPostCommitState(files = []) {
  if (!Array.isArray(files) || !files.length) return;
  const handledMarkdown = new Set();
  let clearedSystem = false;
  files.forEach((file) => {
    if (!file || !file.kind) return;
    if (file.kind === 'index') {
      const state = getStateSlice('index') || { __order: [] };
      remoteBaseline.index = deepClone(prepareIndexState(state));
      notifyComposerChange('index', { skipAutoSave: true });
      clearDraftStorage('index');
    } else if (file.kind === 'tabs') {
      const state = getStateSlice('tabs') || { __order: [] };
      remoteBaseline.tabs = deepClone(prepareTabsState(state));
      notifyComposerChange('tabs', { skipAutoSave: true });
      clearDraftStorage('tabs');
    } else if (file.kind === 'site') {
      const state = getStateSlice('site');
      const snapshot = state ? cloneSiteState(state) : cloneSiteState(prepareSiteState({}));
      remoteBaseline.site = snapshot;

      const previousRoot = getContentRootSafe();
      const effectiveSnapshot = applyComposerEffectiveSiteConfig(snapshot);
      const rawNextRoot = effectiveSnapshot && typeof effectiveSnapshot === 'object' && Object.prototype.hasOwnProperty.call(effectiveSnapshot, 'contentRoot')
        ? safeString(effectiveSnapshot.contentRoot)
        : '';
      const normalizedNextRoot = (rawNextRoot ? rawNextRoot : 'wwwroot').trim().replace(/[\\]/g, '/').replace(/\/?$/, '');
      const rootChanged = normalizedNextRoot !== previousRoot;

      notifyComposerChange('site', { skipAutoSave: true });
      clearDraftStorage('site');

      if (rootChanged) {
        updateComposerMarkdownDraftIndicators();
        updateMarkdownPushButton(getActiveDynamicTab());
        updateMarkdownDiscardButton(getActiveDynamicTab());
        updateMarkdownSaveButton(getActiveDynamicTab());
      }
    } else if (file.kind === 'markdown') {
      const norm = normalizeRelPath(file.markdownPath || file.label || '');
      if (!norm) return;
      handledMarkdown.add(norm);
      const text = normalizeMarkdownContent(file.content || '');
      const tab = findDynamicTabByPath(norm);
      const commitSignature = computeTextSignature(text);
      const checkedAt = Date.now();
      if (tab) {
        const currentText = normalizeMarkdownContent(tab.content || '');
        const hasNewerLocalContent = currentText !== text;
        tab.remoteContent = text;
        tab.remoteSignature = commitSignature;
        tab.loaded = true;
        if (hasNewerLocalContent) {
          const saved = saveMarkdownDraftEntry(norm, tab.content, tab.remoteSignature, exportMarkdownAssetBucket(norm));
          if (saved) {
            tab.localDraft = { ...saved, manual: !!(tab.localDraft && tab.localDraft.manual) };
          } else if (tab.localDraft) {
            tab.localDraft = { ...tab.localDraft, remoteSignature: tab.remoteSignature };
          }
          updateDynamicTabDirtyState(tab, { autoSave: false });
          setDynamicTabStatus(tab, {
            state: 'existing',
            checkedAt,
            message: 'Local edits pending sync'
          });
        } else {
          clearMarkdownDraftEntry(norm);
          clearMarkdownAssetsForPath(norm);
          tab.content = text;
          tab.localDraft = null;
          tab.draftConflict = false;
          tab.isDirty = false;
          updateDynamicTabDirtyState(tab, { autoSave: false });
          setDynamicTabStatus(tab, {
            state: 'existing',
            checkedAt,
            message: 'Synchronized via NanoSite'
          });
        }
      } else {
        clearMarkdownDraftEntry(norm);
        clearMarkdownAssetsForPath(norm);
      }
      updateComposerMarkdownDraftIndicators({ path: norm });
    }
    else if (file.kind === 'system') {
      if (!clearedSystem) {
        clearSystemUpdateState({ keepStatus: false });
        clearedSystem = true;
      }
    }
    else if (file.kind === 'asset') {
      const norm = normalizeRelPath(file.markdownPath || '');
      if (!norm) return;
      const assetPath = normalizeRelPath(file.assetPath || '');
      if (assetPath) removeMarkdownAsset(norm, assetPath);
      else if (file.path) {
        const withoutRoot = file.path.replace(/^\/?(?:wwwroot\/)?/, '');
        removeMarkdownAsset(norm, normalizeRelPath(withoutRoot));
      }
    }
  });
  updateUnsyncedSummary();
  updateMarkdownPushButton(getActiveDynamicTab());
  updateMarkdownDiscardButton(getActiveDynamicTab());
  updateMarkdownSaveButton(getActiveDynamicTab());
}

async function performDirectGithubCommit(token, summaryEntries = []) {
  const { owner, name, branch } = getActiveSiteRepoConfig();
  if (!owner || !name) {
    throw new Error('GitHub repository information is missing in site.yaml.');
  }

  gitHubCommitInFlight = true;

  showSyncOverlay({
    title: 'Synchronizing with GitHub…',
    message: 'Preparing commit…',
    status: 'Gathering local changes…',
    cancelable: false
  });

  try {
    const { files } = await gatherCommitPayload({ showSeoStatus: true });
    if (!files.length) {
      hideSyncOverlay();
      showToast('info', t('editor.toasts.noPendingChanges'));
      return;
    }

    const branchRef = branch.startsWith('refs/') ? branch : `refs/heads/${branch}`;
    setSyncOverlayStatus('Fetching repository state…');
    const headQuery = `
      query($owner:String!, $name:String!, $ref:String!) {
        repository(owner:$owner, name:$name) {
          ref(qualifiedName:$ref) {
            target {
              ... on Commit { oid }
            }
          }
        }
      }
    `;
    const headData = await githubGraphqlRequest(token, headQuery, { owner, name, ref: branchRef });
    const refInfo = headData && headData.repository && headData.repository.ref;
    const expectedHeadOid = refInfo && refInfo.target && refInfo.target.oid;
    if (!expectedHeadOid) throw new Error('Unable to resolve the branch head on GitHub.');

    setSyncOverlayStatus('Encoding files…');
    const additions = files.map((file) => {
      const path = String(file.path || '').replace(/^\/+/, '');
      if (file.base64) {
        return { path, contents: String(file.base64) };
      }
      return { path, contents: encodeContentToBase64(file.content || '') };
    });

    const commitMutation = `
      mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid }
        }
      }
    `;
    const headline = `chore: sync ${files.length === 1 ? 'draft' : 'drafts'} via NanoSite`;
    const mutationInput = {
      branch: { repositoryNameWithOwner: `${owner}/${name}`, branchName: branch },
      message: { headline },
      expectedHeadOid,
      fileChanges: { additions }
    };

    setSyncOverlayStatus('Creating commit…');
    await githubGraphqlRequest(token, commitMutation, { input: mutationInput });

    setSyncOverlayStatus('Updating editor state…');
    applyLocalPostCommitState(files);

    const fileCount = files.length;
    const summaryLabel = fileCount === 1 ? describeSummaryEntry(summaryEntries[0] || files[0]) : `${fileCount} files`;
    setSyncOverlayMessage(`Commit pushed for ${summaryLabel}. Waiting for the site to update… This can take a few minutes. If you stop waiting, the commit stays on GitHub but the live site might not show the changes yet.`);
    const propagationResult = await waitForRemotePropagation(files);

    hideSyncOverlay();
    if (propagationResult && propagationResult.canceled) {
      showToast('info', t('editor.toasts.siteWaitStopped'));
    } else if (propagationResult && propagationResult.timedOut) {
      showToast('warning', t('editor.toasts.siteWaitTimedOut'));
    } else {
      showToast('success', t('editor.toasts.commitSuccess', { count: fileCount }));
    }
  } catch (err) {
    hideSyncOverlay();
    let message = err && err.message ? err.message : t('editor.toasts.githubCommitFailed');
    if (err && err.status === 401) {
      clearCachedFineGrainedToken();
      message = t('editor.toasts.githubTokenRejected');
    }
    console.error('NanoSite GitHub commit failed', err);
    showToast('error', message, { duration: 5200 });
  } finally {
    gitHubCommitInFlight = false;
  }
}

function computeOrderDiffDetails(kind) {
  const baseline = kind === 'tabs' ? remoteBaseline.tabs : remoteBaseline.index;
  const current = getStateSlice(kind) || { __order: [] };
  const baseOrder = Array.isArray(baseline && baseline.__order)
    ? baseline.__order.filter(key => typeof key === 'string')
    : [];
  const curOrder = Array.isArray(current && current.__order)
    ? current.__order.filter(key => typeof key === 'string')
    : [];
  const beforeMap = new Map();
  const afterMap = new Map();
  baseOrder.forEach((key, idx) => { if (!beforeMap.has(key)) beforeMap.set(key, idx); });
  curOrder.forEach((key, idx) => { if (!afterMap.has(key)) afterMap.set(key, idx); });

  const beforeEntries = baseOrder.map((key, index) => {
    if (!afterMap.has(key)) return { key, index, status: 'removed' };
    const toIndex = afterMap.get(key);
    return {
      key,
      index,
      status: toIndex === index ? 'same' : 'moved',
      toIndex
    };
  });

  const afterEntries = curOrder.map((key, index) => {
    if (!beforeMap.has(key)) return { key, index, status: 'added' };
    const fromIndex = beforeMap.get(key);
    return {
      key,
      index,
      status: fromIndex === index ? 'same' : 'moved',
      fromIndex
    };
  });

  const connectors = beforeEntries
    .filter(entry => entry.status !== 'removed')
    .map(entry => ({
      key: entry.key,
      status: entry.status === 'moved' ? 'moved' : 'same',
      fromIndex: entry.index,
      toIndex: entry.toIndex
    }));

  const stats = {
    moved: connectors.filter(c => c.status === 'moved').length,
    added: afterEntries.filter(entry => entry.status === 'added').length,
    removed: beforeEntries.filter(entry => entry.status === 'removed').length
  };

  return { beforeEntries, afterEntries, connectors, stats };
}

function renderOrderStatsChips(target, stats, options = {}) {
  if (!target) return;
  const safeStats = stats || { moved: 0, added: 0, removed: 0 };
  const emptyLabel = options.emptyLabel || tComposerDiff('orderStats.empty');
  const pieces = [];
  if (safeStats.moved) pieces.push({ label: tComposerDiff('orderStats.moved', { count: safeStats.moved }), status: 'moved' });
  if (safeStats.added) pieces.push({ label: tComposerDiff('orderStats.added', { count: safeStats.added }), status: 'added' });
  if (safeStats.removed) pieces.push({ label: tComposerDiff('orderStats.removed', { count: safeStats.removed }), status: 'removed' });
  target.innerHTML = '';
  if (!pieces.length) {
    pieces.push({ label: emptyLabel, status: 'neutral' });
  }
  pieces.forEach(info => {
    const chip = document.createElement('span');
    chip.className = 'composer-order-chip';
    chip.dataset.status = info.status;
    chip.textContent = info.label;
    target.appendChild(chip);
  });
}

function renderComposerInlineSummary(target, diff, options = {}) {
  if (!target) return;
  target.innerHTML = '';

  const summary = (diff && typeof diff === 'object') ? diff : null;
  if (!summary || !summary.hasChanges) {
    const empty = document.createElement('span');
    empty.className = 'composer-inline-summary-empty';
    empty.textContent = t('editor.composer.noLocalChangesYet');
    target.appendChild(empty);
    return;
  }

  const diffKeys = summary.keys || {};
  const modifiedKeys = Object.keys(diffKeys).filter(key => {
    const info = diffKeys[key];
    if (!info) return false;
    return info.state === 'modified'
      || (Array.isArray(info.addedLangs) && info.addedLangs.length)
      || (Array.isArray(info.removedLangs) && info.removedLangs.length);
  });

  const addedCount = Array.isArray(summary.addedKeys) ? summary.addedKeys.length : 0;
  const removedCount = Array.isArray(summary.removedKeys) ? summary.removedKeys.length : 0;
  const modifiedCount = modifiedKeys.length;
  const orderStats = options.orderStats || { moved: 0, added: 0, removed: 0 };
  const orderChanged = !!summary.orderChanged;
  const orderHasStats = !!(orderStats && (orderStats.moved || orderStats.added || orderStats.removed));

  const formatKeyList = (keys) => {
    if (!Array.isArray(keys) || !keys.length) return '';
    const clean = keys.filter(key => key != null && key !== '');
    if (!clean.length) return '';
    const max = Math.max(1, options.maxKeys || 3);
    const shown = clean.slice(0, max);
    let text = shown.join(', ');
    if (clean.length > shown.length) {
      const moreCount = clean.length - shown.length;
      text += ` ${tComposerDiff('lists.more', { count: moreCount })}`;
    }
    return text;
  };

  const chips = [];
  if (addedCount) chips.push({ variant: 'added', label: tComposerDiff('inlineChips.added', { count: addedCount }) });
  if (removedCount) chips.push({ variant: 'removed', label: tComposerDiff('inlineChips.removed', { count: removedCount }) });
  if (modifiedCount) chips.push({ variant: 'modified', label: tComposerDiff('inlineChips.modified', { count: modifiedCount }) });
  if (orderChanged) {
    let orderLabel = tComposerDiff('inlineChips.orderChanged');
    if (orderHasStats) {
      const parts = [];
      if (orderStats.moved) parts.push(tComposerDiff('inlineChips.orderParts.moved', { count: orderStats.moved }));
      if (orderStats.added) parts.push(tComposerDiff('inlineChips.orderParts.added', { count: orderStats.added }));
      if (orderStats.removed) parts.push(tComposerDiff('inlineChips.orderParts.removed', { count: orderStats.removed }));
      if (parts.length) {
        orderLabel = tComposerDiff('inlineChips.orderSummary', { parts: parts.join(', ') });
      }
    }
    chips.push({ variant: 'order', label: orderLabel });
  }

  const chipRow = document.createElement('div');
  chipRow.className = 'composer-inline-chip-row';

  const addChip = (chipInfo) => {
    const chip = document.createElement('span');
    chip.className = 'composer-inline-chip';
    if (chipInfo.variant) chip.dataset.variant = chipInfo.variant;
    chip.textContent = chipInfo.label;
    chipRow.appendChild(chip);
  };

  chips.forEach(addChip);
  const langSet = new Set();
  Object.values(diffKeys).forEach(info => {
    if (!info) return;
    Object.keys(info.langs || {}).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
    (info.addedLangs || []).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
    (info.removedLangs || []).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
  });
  if (langSet.size) {
    const langs = Array.from(langSet).filter(Boolean).sort();
    const summary = formatKeyList(langs);
    if (summary) addChip({ variant: 'langs', label: tComposerDiff('inlineChips.langs', { summary }) });
  }

  if (chipRow.children.length) target.appendChild(chipRow);

  if (!chipRow.children.length) {
    const empty = document.createElement('span');
    empty.className = 'composer-inline-summary-empty';
    empty.textContent = tComposerDiff('inlineChips.none');
    target.appendChild(empty);
  }
}

function getSiteFieldLabel(fieldKey) {
  if (!fieldKey) return '';
  const entry = SITE_FIELD_LABEL_MAP[fieldKey];
  if (!entry) return fieldKey;
  const key = entry.i18nKey || entry.key || entry;
  if (typeof key === 'string' && key) {
    try {
      const label = t(key);
      if (label && typeof label === 'string' && label.trim()) return label;
    } catch (_) {
      /* ignore */
    }
  }
  if (entry && typeof entry === 'object' && entry.fallback) return entry.fallback;
  if (typeof key === 'string' && key.trim()) return key;
  return fieldKey;
}

function renderComposerSiteInlineSummary(target, diff) {
  if (!target) return false;
  target.innerHTML = '';

  const summary = diff && typeof diff === 'object' ? diff : null;
  if (!summary || !summary.hasChanges) {
    const empty = document.createElement('span');
    empty.className = 'composer-inline-summary-empty';
    empty.textContent = tComposer('noLocalChangesYet');
    target.appendChild(empty);
    return false;
  }

  const fields = summary.fields && typeof summary.fields === 'object'
    ? Object.keys(summary.fields).filter(Boolean)
    : [];

  const row = document.createElement('div');
  row.className = 'composer-inline-chip-row';

  const countChip = document.createElement('span');
  countChip.className = 'composer-inline-chip';
  countChip.dataset.variant = 'modified';
  countChip.textContent = tComposerDiff('inlineChips.modified', { count: fields.length || 0 });
  row.appendChild(countChip);

  const labels = fields.map(getSiteFieldLabel).filter(Boolean);
  const maxFields = 3;
  labels.slice(0, maxFields).forEach(label => {
    const chip = document.createElement('span');
    chip.className = 'composer-inline-chip';
    chip.dataset.variant = 'langs';
    chip.textContent = label;
    row.appendChild(chip);
  });

  if (labels.length > maxFields) {
    const chip = document.createElement('span');
    chip.className = 'composer-inline-chip';
    chip.dataset.variant = 'langs';
    chip.textContent = tComposerDiff('lists.more', { count: labels.length - maxFields });
    row.appendChild(chip);
  }

  target.appendChild(row);
  return true;
}

function updateComposerSiteInlineMeta(meta, options = {}) {
  if (!meta) return;

  meta.__nsSiteMetaActive = true;
  try { meta.setAttribute('data-site-active', 'true'); } catch (_) {}
  if (meta.dataset) meta.dataset.kind = 'site';

  const title = meta.querySelector('.composer-order-inline-title');
  if (title) title.textContent = tComposerDiff('inline.title');
  const kindLabel = meta.querySelector('.composer-order-inline-kind');
  if (kindLabel) kindLabel.textContent = 'site.yaml';

  const openBtn = meta.querySelector('.composer-order-inline-open');
  if (openBtn) {
    if (!meta.__nsSiteMetaButtonState) {
      meta.__nsSiteMetaButtonState = {
        hidden: openBtn.hidden,
        ariaHidden: openBtn.getAttribute('aria-hidden'),
        display: openBtn.style.display,
        disabled: !!openBtn.disabled
      };
    }
    try { openBtn.dataset.kind = 'site'; } catch (_) {}
    openBtn.hidden = true;
    openBtn.disabled = true;
    openBtn.style.display = 'none';
    openBtn.setAttribute('aria-hidden', 'true');
  }

  const statsWrap = meta.querySelector('.composer-order-inline-stats');
  const diff = composerDiffCache.site || recomputeDiff('site');
  const hasChanges = !!(diff && diff.hasChanges);

  if (statsWrap) renderComposerSiteInlineSummary(statsWrap, diff);

  if (meta.dataset) meta.dataset.state = hasChanges ? 'changed' : 'clean';
  animateComposerInlineVisibility(meta, hasChanges, { immediate: !!options.immediate });
}

function refreshComposerInlineMeta(options = {}) {
  const meta = document.getElementById('composerOrderInlineMeta');
  if (!meta) return;
  const activeKind = getActiveComposerFile();
  if (activeKind === 'site') {
    updateComposerSiteInlineMeta(meta, options);
    return;
  }

  if (meta.__nsSiteMetaActive) {
    const stored = meta.__nsSiteMetaButtonState || null;
    const openBtn = meta.querySelector('.composer-order-inline-open');
    if (openBtn) {
      openBtn.disabled = stored ? !!stored.disabled : false;
      openBtn.hidden = stored ? !!stored.hidden : false;
      if (stored && stored.display != null) openBtn.style.display = stored.display;
      else openBtn.style.display = '';
      if (stored && stored.ariaHidden != null) openBtn.setAttribute('aria-hidden', stored.ariaHidden);
      else openBtn.removeAttribute('aria-hidden');
    }
    delete meta.__nsSiteMetaButtonState;
    delete meta.__nsSiteMetaActive;
    try { meta.removeAttribute('data-site-active'); } catch (_) {}
  }
}

function openComposerDiffModal(kind, initialTab = 'overview') {
  try {
    const modal = ensureComposerDiffModal();
    modal.open(kind, initialTab);
  } catch (err) {
    console.warn('Composer: failed to open composer diff modal', err);
  }
}

function openOrderDiffModal(kind) {
  openComposerDiffModal(kind, 'order');
}

function getComposerOrderHoverContainer(element) {
  if (!element || typeof element.closest !== 'function') return null;
  return element.closest('.composer-order-visual, .composer-order-host');
}

function applyComposerOrderHover(container, key) {
  if (!container) return;
  const state = container.__nsOrderHoverState || (container.__nsOrderHoverState = {});
  const normalizedKey = typeof key === 'string' ? key : '';
  let svg = state.svg;
  if (!svg || !svg.isConnected) {
    svg = container.querySelector('svg.composer-order-lines');
    if (svg) state.svg = svg;
  }
  const pathMap = state.pathMap instanceof Map ? state.pathMap : null;
  const leftMap = state.leftMap instanceof Map ? state.leftMap : null;
  const prevLeft = state.activeLeft;
  const nextLeft = normalizedKey && leftMap ? leftMap.get(normalizedKey) || null : null;
  if (prevLeft && prevLeft !== nextLeft) {
    try { prevLeft.classList.remove('is-hovered'); } catch (_) {}
  }
  if (nextLeft && nextLeft !== prevLeft) {
    try { nextLeft.classList.add('is-hovered'); } catch (_) {}
  }
  state.activeLeft = nextLeft || null;

  state.currentKey = normalizedKey;

  const activePathKey = (pathMap && normalizedKey && pathMap.has(normalizedKey)) ? normalizedKey : '';

  if (!svg) return;

  if (!pathMap) {
    if (normalizedKey) svg.classList.add('is-hovering');
    else svg.classList.remove('is-hovering');
    return;
  }

  pathMap.forEach((paths, pathKey) => {
    const isActive = !!activePathKey && pathKey === activePathKey;
    if (!Array.isArray(paths)) return;
    paths.forEach(path => {
      if (!path || !path.classList) return;
      if (isActive) path.classList.add('is-active');
      else path.classList.remove('is-active');
    });
  });

  if (activePathKey) svg.classList.add('is-hovering');
  else svg.classList.remove('is-hovering');
}

function bindComposerOrderHover(element, key) {
  if (!element) return;
  const hoverKey = typeof key === 'string' ? key : (element.getAttribute && element.getAttribute('data-key')) || '';
  const existing = element.__nsOrderHoverBound;
  if (existing && existing.key === hoverKey) return;
  if (existing) {
    element.removeEventListener('mouseenter', existing.enter);
    element.removeEventListener('mouseleave', existing.leave);
    element.removeEventListener('focusin', existing.enter);
    element.removeEventListener('focusout', existing.leave);
  }
  const handleEnter = () => {
    const container = getComposerOrderHoverContainer(element);
    if (!container) return;
    applyComposerOrderHover(container, hoverKey);
  };
  const handleLeave = () => {
    const container = getComposerOrderHoverContainer(element);
    if (!container) return;
    applyComposerOrderHover(container, '');
  };
  element.addEventListener('mouseenter', handleEnter);
  element.addEventListener('mouseleave', handleLeave);
  element.addEventListener('focusin', handleEnter);
  element.addEventListener('focusout', handleLeave);
  element.__nsOrderHoverBound = { key: hoverKey, enter: handleEnter, leave: handleLeave };
}

function buildOrderDiffItem(entry, side) {
  const item = document.createElement('div');
  item.className = 'composer-order-item';
  item.dataset.status = entry.status || 'same';
  item.dataset.side = side;
  item.setAttribute('data-key', entry.key || '');

  const idxEl = document.createElement('span');
  idxEl.className = 'composer-order-index';
  idxEl.textContent = `#${entry.index + 1}`;
  item.appendChild(idxEl);

  const keyEl = document.createElement('span');
  keyEl.className = 'composer-order-key';
  const keyText = entry.key || tComposerDiff('order.emptyKey');
  keyEl.textContent = keyText;
  keyEl.title = keyText;
  item.appendChild(keyEl);

  const badgeEl = document.createElement('span');
  badgeEl.className = 'composer-order-badge';
  let badgeText = '';
  if (entry.status === 'moved') {
    if (side === 'before') {
      badgeText = tComposerDiff('order.badges.to', { index: (entry.toIndex == null ? entry.index : entry.toIndex) + 1 });
    } else {
      badgeText = tComposerDiff('order.badges.from', { index: (entry.fromIndex == null ? entry.index : entry.fromIndex) + 1 });
    }
  } else if (entry.status === 'removed') {
    badgeText = tComposerDiff('order.badges.removed');
  } else if (entry.status === 'added') {
    badgeText = tComposerDiff('order.badges.added');
  }
  if (badgeText) {
    badgeEl.textContent = badgeText;
  } else {
    badgeEl.classList.add('is-hidden');
  }
  item.appendChild(badgeEl);
  bindComposerOrderHover(item, entry.key);
  return item;
}


function ensureComposerDiffModal() {
  if (composerDiffModal) return composerDiffModal;

  const modal = document.createElement('div');
  modal.id = 'composerOrderModal';
  modal.className = 'ns-modal composer-order-modal composer-diff-modal';

  const dialog = document.createElement('div');
  dialog.className = 'ns-modal-dialog composer-order-dialog composer-diff-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const head = document.createElement('div');
  head.className = 'composer-order-head';
  const title = document.createElement('h2');
  title.id = 'composerOrderTitle';
  title.textContent = tComposerDiff('heading');
  const subtitle = document.createElement('p');
  subtitle.className = 'composer-order-subtitle';
  subtitle.textContent = tComposerDiff('subtitle.default');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ns-modal-close btn-secondary composer-order-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', tComposerDiff('close'));
  closeBtn.textContent = tComposerDiff('close');
  head.appendChild(title);
  head.appendChild(subtitle);
  head.appendChild(closeBtn);

  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'composer-diff-tabs';
  tabsWrap.setAttribute('role', 'tablist');

  const tabDefs = [
    { id: 'overview', labelKey: 'tabs.overview' },
    { id: 'entries', labelKey: 'tabs.entries' },
    { id: 'order', labelKey: 'tabs.order' }
  ];
  const tabDefsById = new Map();
  tabDefs.forEach(def => { tabDefsById.set(def.id, def); });
  const tabButtons = new Map();
  const tabPanels = new Map();

  function handleTabKeydown(ev, currentId) {
    if (!tabDefs.length) return;
    let nextIndex = -1;
    const currentIndex = tabDefs.findIndex(def => def.id === currentId);
    if (ev.key === 'ArrowLeft') {
      nextIndex = (currentIndex <= 0 ? tabDefs.length - 1 : currentIndex - 1);
    } else if (ev.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabDefs.length;
    } else if (ev.key === 'Home') {
      nextIndex = 0;
    } else if (ev.key === 'End') {
      nextIndex = tabDefs.length - 1;
    } else {
      return;
    }
    ev.preventDefault();
    const nextId = tabDefs[nextIndex] && tabDefs[nextIndex].id;
    if (!nextId) return;
    setActiveTab(nextId);
    const btn = tabButtons.get(nextId);
    if (btn) btn.focus();
  }

  tabDefs.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'composer-diff-tab';
    btn.textContent = tComposerDiff(tab.labelKey);
    btn.dataset.i18nKey = tab.labelKey;
    btn.dataset.tab = tab.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
    btn.addEventListener('click', () => setActiveTab(tab.id));
    btn.addEventListener('keydown', (ev) => handleTabKeydown(ev, tab.id));
    tabButtons.set(tab.id, btn);
    tabsWrap.appendChild(btn);
  });

  const viewsWrap = document.createElement('div');
  viewsWrap.className = 'composer-diff-views';

  function createView(id, extraClass) {
    const view = document.createElement('section');
    view.className = `composer-diff-view ${extraClass}`;
    view.dataset.view = id;
    view.setAttribute('role', 'tabpanel');
    view.setAttribute('tabindex', '0');
    if (id !== 'overview') {
      view.hidden = true;
      view.style.display = 'none';
      view.setAttribute('aria-hidden', 'true');
    } else {
      view.style.display = '';
      view.setAttribute('aria-hidden', 'false');
    }
    tabPanels.set(id, view);
    viewsWrap.appendChild(view);
    return view;
  }

  const viewOverview = createView('overview', 'composer-diff-view-overview');
  const viewEntries = createView('entries', 'composer-diff-view-entries');
  const viewOrder = createView('order', 'composer-diff-view-order');

  const statsWrap = document.createElement('div');
  statsWrap.className = 'composer-order-stats';

  const body = document.createElement('div');
  body.className = 'composer-order-body';

  const viz = document.createElement('div');
  viz.className = 'composer-order-visual';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('composer-order-lines');
  svg.setAttribute('aria-hidden', 'true');

  const columns = document.createElement('div');
  columns.className = 'composer-order-columns';

  const beforeCol = document.createElement('div');
  beforeCol.className = 'composer-order-column composer-order-before';
  const beforeTitle = document.createElement('div');
  beforeTitle.className = 'composer-order-column-title';
  beforeTitle.textContent = tComposerDiff('order.remoteTitle');
  const beforeList = document.createElement('div');
  beforeList.className = 'composer-order-list';
  beforeCol.appendChild(beforeTitle);
  beforeCol.appendChild(beforeList);

  const afterCol = document.createElement('div');
  afterCol.className = 'composer-order-column composer-order-after';
  const afterTitle = document.createElement('div');
  afterTitle.className = 'composer-order-column-title';
  afterTitle.textContent = tComposerDiff('order.currentTitle');
  const afterList = document.createElement('div');
  afterList.className = 'composer-order-list';
  afterCol.appendChild(afterTitle);
  afterCol.appendChild(afterList);

  const emptyNotice = document.createElement('div');
  emptyNotice.className = 'composer-order-empty';
  emptyNotice.textContent = tComposerDiff('order.empty');

  columns.appendChild(beforeCol);
  columns.appendChild(afterCol);
  viz.appendChild(svg);
  viz.appendChild(columns);
  viz.appendChild(emptyNotice);
  body.appendChild(viz);
  viewOrder.appendChild(statsWrap);
  viewOrder.appendChild(body);

  dialog.setAttribute('aria-labelledby', title.id);
  dialog.appendChild(head);
  dialog.appendChild(tabsWrap);
  dialog.appendChild(viewsWrap);

  modal.appendChild(dialog);
  document.body.appendChild(modal);

  const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastActive = null;
  let activeTab = 'overview';
  let activeKind = 'index';
  let activeDiff = null;

  const subtitleKeys = {
    overview: 'subtitle.overview',
    entries: 'subtitle.entries',
    order: 'subtitle.order'
  };

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
      return false;
    }
  }

  function closeModal() {
    if (composerDiffResizeHandler) {
      window.removeEventListener('resize', composerDiffResizeHandler);
      composerDiffResizeHandler = null;
    }
    composerOrderState = null;
    activeDiff = null;
    const reduce = prefersReducedMotion();
    if (reduce) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('ns-modal-open');
      try { lastActive && lastActive.focus(); } catch (_) {}
      return;
    }
    try { modal.classList.remove('ns-anim-in'); } catch (_) {}
    try { modal.classList.add('ns-anim-out'); } catch (_) {}
    const finish = () => {
      try { modal.classList.remove('ns-anim-out'); } catch (_) {}
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('ns-modal-open');
      try { lastActive && lastActive.focus(); } catch (_) {}
    };
    try {
      const onEnd = () => { dialog.removeEventListener('animationend', onEnd); finish(); };
      dialog.addEventListener('animationend', onEnd, { once: true });
      setTimeout(finish, 220);
    } catch (_) {
      finish();
    }
  }

  function updateSubtitle(tabId) {
    const key = subtitleKeys[tabId] || subtitleKeys.overview;
    subtitle.textContent = tComposerDiff(key);
  }

  function setActiveTab(tabId) {
    if (!tabButtons.has(tabId)) tabId = 'overview';
    activeTab = tabId;
    tabButtons.forEach((btn, id) => {
      const selected = id === tabId;
      btn.classList.toggle('is-active', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.setAttribute('tabindex', selected ? '0' : '-1');
    });
    tabPanels.forEach((panel, id) => {
      const visible = id === tabId;
      panel.hidden = !visible;
      panel.style.display = visible ? '' : 'none';
      panel.classList.toggle('is-active', visible);
      panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
    updateSubtitle(tabId);
    if (tabId === 'order') {
      renderOrder(activeKind);
      if (!composerDiffResizeHandler) {
        composerDiffResizeHandler = () => drawOrderDiffLines();
        window.addEventListener('resize', composerDiffResizeHandler);
      }
      requestAnimationFrame(() => drawOrderDiffLines());
      setTimeout(drawOrderDiffLines, 140);
    } else if (composerDiffResizeHandler) {
      window.removeEventListener('resize', composerDiffResizeHandler);
      composerDiffResizeHandler = null;
      composerOrderState = null;
    }
  }

  function renderOverview(kind, diff) {
    viewOverview.innerHTML = '';
    if (!diff) {
      const empty = document.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('overview.empty');
      viewOverview.appendChild(empty);
      return;
    }
    const statWrap = document.createElement('div');
    statWrap.className = 'composer-diff-overview-stats';
    const diffKeys = diff.keys || {};
    const modifiedKeys = Object.keys(diffKeys).filter(key => {
      const info = diffKeys[key];
      if (!info) return false;
      return info.state === 'modified' || (info.addedLangs && info.addedLangs.length) || (info.removedLangs && info.removedLangs.length);
    });
    const statDefs = [
      { id: 'added', label: tComposerDiff('overview.stats.added'), value: diff.addedKeys.length },
      { id: 'removed', label: tComposerDiff('overview.stats.removed'), value: diff.removedKeys.length },
      { id: 'modified', label: tComposerDiff('overview.stats.modified'), value: modifiedKeys.length },
      { id: 'order', label: tComposerDiff('overview.stats.order'), value: diff.orderChanged ? tComposerDiff('overview.stats.changed') : tComposerDiff('overview.stats.unchanged'), state: diff.orderChanged ? 'changed' : 'clean' }
    ];
    statDefs.forEach(def => {
      const card = document.createElement('div');
      card.className = 'composer-diff-stat';
      card.dataset.id = def.id;
      if (typeof def.value === 'number') card.dataset.value = String(def.value);
      if (def.state) card.dataset.state = def.state;
      const valueEl = document.createElement('div');
      valueEl.className = 'composer-diff-stat-value';
      valueEl.textContent = typeof def.value === 'number' ? String(def.value) : def.value;
      const labelEl = document.createElement('div');
      labelEl.className = 'composer-diff-stat-label';
      labelEl.textContent = def.label;
      card.appendChild(valueEl);
      card.appendChild(labelEl);
      statWrap.appendChild(card);
    });
    viewOverview.appendChild(statWrap);

    const blocks = document.createElement('div');
    blocks.className = 'composer-diff-overview-blocks';
    function appendKeyBlock(title, keys) {
      if (!keys || !keys.length) return;
      const block = document.createElement('section');
      block.className = 'composer-diff-overview-block';
      const h3 = document.createElement('h3');
      h3.textContent = title;
      const list = document.createElement('ul');
      list.className = 'composer-diff-key-list';
      const max = 10;
      keys.slice(0, max).forEach(key => {
        const li = document.createElement('li');
        const code = document.createElement('code');
        code.textContent = key;
        li.appendChild(code);
        list.appendChild(li);
      });
      if (keys.length > max) {
        const more = document.createElement('li');
        more.className = 'composer-diff-key-more';
        more.textContent = tComposerDiff('lists.more', { count: keys.length - max });
        list.appendChild(more);
      }
      block.appendChild(h3);
      block.appendChild(list);
      blocks.appendChild(block);
    }
    appendKeyBlock(tComposerDiff('overview.blocks.added'), diff.addedKeys);
    appendKeyBlock(tComposerDiff('overview.blocks.removed'), diff.removedKeys);
    appendKeyBlock(tComposerDiff('overview.blocks.modified'), modifiedKeys);
    if (blocks.children.length) viewOverview.appendChild(blocks);

    const langSet = new Set();
    Object.values(diffKeys).forEach(info => {
      if (!info) return;
      Object.keys(info.langs || {}).forEach(lang => langSet.add(lang.toUpperCase()));
      (info.addedLangs || []).forEach(lang => langSet.add(lang.toUpperCase()));
      (info.removedLangs || []).forEach(lang => langSet.add(lang.toUpperCase()));
    });
    if (langSet.size) {
      const p = document.createElement('p');
      p.className = 'composer-diff-overview-langs';
      p.textContent = tComposerDiff('overview.languagesImpacted', { languages: Array.from(langSet).sort().join(', ') });
      viewOverview.appendChild(p);
    }
  }

  function describeEntrySnapshot(kind, key, source) {
    const state = source === 'baseline'
      ? (kind === 'tabs' ? remoteBaseline.tabs : remoteBaseline.index)
      : getStateSlice(kind);
    if (!state) return null;
    return state[key] || null;
  }

  function buildEntryDetails(kind, key, info, sectionType) {
    const list = document.createElement('ul');
    list.className = 'composer-diff-field-list';
    let hasContent = false;
    const push = (text) => {
      if (!text) return;
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
      hasContent = true;
    };
    if (sectionType === 'added' || sectionType === 'removed') {
      const snapshot = describeEntrySnapshot(kind, key, sectionType === 'added' ? 'current' : 'baseline');
      const langs = snapshot ? Object.keys(snapshot || {}).filter(lang => lang !== '__order') : [];
      if (!langs.length) {
        push(tComposerDiff('entries.noLanguageContent'));
      } else {
        langs.forEach(lang => {
          const label = lang.toUpperCase();
          if (kind === 'index') {
            const value = snapshot[lang];
            let count = 0;
            if (Array.isArray(value)) count = value.length;
            else if (value != null && value !== '') count = 1;
            const summary = count
              ? tComposerDiff('entries.snapshot.indexValue', { count })
              : tComposerDiff('entries.snapshot.emptyEntry');
            push(tComposerDiff('entries.summary', { lang: label, summary }));
          } else {
            const value = snapshot[lang] || { title: '', location: '' };
            const parts = [];
            if (value.title) parts.push(tComposerDiff('entries.snapshot.tabTitle', { title: truncateText(value.title, 32) }));
            if (value.location) parts.push(tComposerDiff('entries.snapshot.tabLocation', { location: truncateText(value.location, 40) }));
            if (!parts.length) parts.push(tComposerDiff('entries.snapshot.emptyEntry'));
            const joined = parts.join(tComposerDiff('entries.join.comma'));
            push(tComposerDiff('entries.summary', { lang: label, summary: joined }));
          }
        });
      }
    } else {
      const langSet = new Set([
        ...Object.keys(info.langs || {}),
        ...((info.addedLangs || [])),
        ...((info.removedLangs || []))
      ]);
      if (!langSet.size) return null;
      const addedLangs = new Set(info.addedLangs || []);
      const removedLangs = new Set(info.removedLangs || []);
      langSet.forEach(lang => {
        const detail = (info.langs || {})[lang];
        const label = lang.toUpperCase();
        if (!detail) {
          if (addedLangs.has(lang)) push(tComposerDiff('entries.state.added', { lang: label }));
          else if (removedLangs.has(lang)) push(tComposerDiff('entries.state.removed', { lang: label }));
          return;
        }
        if (detail.state === 'added') {
          push(tComposerDiff('entries.state.added', { lang: label }));
          return;
        }
        if (detail.state === 'removed') {
          push(tComposerDiff('entries.state.removed', { lang: label }));
          return;
        }
        if (detail.state === 'modified') {
          if (kind === 'index') {
            const versions = detail.versions || { entries: [], removed: [] };
            let addedCount = 0;
            let movedCount = 0;
            let changedCount = 0;
            (versions.entries || []).forEach(entry => {
              if (entry.status === 'added') addedCount += 1;
              else if (entry.status === 'moved') movedCount += 1;
              else if (entry.status === 'changed') changedCount += 1;
            });
            const removedCount = (versions.removed || []).length;
            const parts = [];
            if (versions.kindChanged) parts.push(tComposerDiff('entries.parts.typeChanged'));
            if (addedCount) parts.push(tComposerDiff('entries.parts.addedCount', { count: addedCount }));
            if (removedCount) parts.push(tComposerDiff('entries.parts.removedCount', { count: removedCount }));
            if (changedCount) parts.push(tComposerDiff('entries.parts.updatedCount', { count: changedCount }));
            if (versions.orderChanged || movedCount) parts.push(tComposerDiff('entries.parts.reordered'));
            if (!parts.length) parts.push(tComposerDiff('entries.parts.contentUpdated'));
            const joined = parts.join(tComposerDiff('entries.join.comma'));
            push(tComposerDiff('entries.summary', { lang: label, summary: joined }));
          } else {
            const changeFields = [];
            if (detail.titleChanged) changeFields.push(tComposerDiff('entries.fields.title'));
            if (detail.locationChanged) changeFields.push(tComposerDiff('entries.fields.location'));
            const fieldSummary = changeFields.length
              ? changeFields.join(tComposerDiff('entries.join.and'))
              : tComposerDiff('entries.fields.content');
            push(tComposerDiff('entries.state.updatedFields', { lang: label, fields: fieldSummary }));
          }
        }
      });
    }
    return hasContent ? list : null;
  }

  function renderEntries(kind, diff) {
    viewEntries.innerHTML = '';
    if (!diff) {
      const empty = document.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('entries.empty');
      viewEntries.appendChild(empty);
      return;
    }
    const diffKeys = diff.keys || {};
    const sections = [
      { type: 'added', title: tComposerDiff('entries.sections.added'), keys: diff.addedKeys || [] },
      { type: 'removed', title: tComposerDiff('entries.sections.removed'), keys: diff.removedKeys || [] },
      { type: 'modified', title: tComposerDiff('entries.sections.modified'), keys: Object.keys(diffKeys).filter(key => {
        const info = diffKeys[key];
        if (!info) return false;
        return info.state === 'modified' || (info.addedLangs && info.addedLangs.length) || (info.removedLangs && info.removedLangs.length);
      }) }
    ];
    const hasData = sections.some(section => section.keys && section.keys.length);
    if (!hasData) {
      const empty = document.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('entries.orderOnly');
      viewEntries.appendChild(empty);
      return;
    }
    sections.forEach(section => {
      if (!section.keys || !section.keys.length) return;
      const block = document.createElement('section');
      block.className = 'composer-diff-section';
      block.dataset.section = section.type;
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      block.appendChild(heading);
      const list = document.createElement('ul');
      list.className = 'composer-diff-entry-list';
      section.keys.forEach(key => {
        const info = diffKeys[key] || { state: section.type };
        const item = document.createElement('li');
        item.className = 'composer-diff-entry';
        const name = document.createElement('span');
        name.className = 'composer-diff-entry-key';
        name.textContent = key;
        item.appendChild(name);
        const badgeWrap = document.createElement('span');
        badgeWrap.className = 'composer-diff-entry-badges';
        const badgesHtml = kind === 'tabs' ? buildTabsDiffBadges(info) : buildIndexDiffBadges(info);
        if (badgesHtml) {
          badgeWrap.innerHTML = badgesHtml;
          item.appendChild(badgeWrap);
        }
        const details = buildEntryDetails(kind, key, info, section.type);
        if (details) item.appendChild(details);
        list.appendChild(item);
      });
      block.appendChild(list);
      viewEntries.appendChild(block);
    });
  }

  function renderOrder(kind) {
    const label = kind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
    title.textContent = tComposerDiff('title', { label });
    const details = computeOrderDiffDetails(kind);
    const { beforeEntries, afterEntries, connectors, stats } = details;

    beforeList.innerHTML = '';
    afterList.innerHTML = '';
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const leftMap = new Map();
    beforeEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'before');
      leftMap.set(entry.key, item);
      beforeList.appendChild(item);
    });

    const rightMap = new Map();
    afterEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'after');
      rightMap.set(entry.key, item);
      afterList.appendChild(item);
    });

    const hoverState = viz.__nsOrderHoverState || {};
    if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
      try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
      hoverState.activeLeft = null;
    }
    hoverState.leftMap = leftMap;
    hoverState.rightMap = rightMap;
    hoverState.svg = svg;
    hoverState.pathMap = null;
    viz.__nsOrderHoverState = hoverState;

    const hasItems = beforeEntries.length || afterEntries.length;
    if (hasItems) {
      emptyNotice.hidden = true;
      emptyNotice.style.display = 'none';
      emptyNotice.setAttribute('aria-hidden', 'true');
    } else {
      emptyNotice.hidden = false;
      emptyNotice.style.display = 'flex';
      emptyNotice.setAttribute('aria-hidden', 'false');
    }
    viz.classList.toggle('is-empty', !hasItems);

    renderOrderStatsChips(statsWrap, stats, { emptyLabel: tComposerDiff('orderStats.empty') });

    composerOrderState = hasItems
      ? { container: viz, svg, connectors, leftMap, rightMap }
      : null;
    if (!hasItems) {
      applyComposerOrderHover(viz, '');
    }
    if (activeTab === 'order') {
      drawOrderDiffLines();
      requestAnimationFrame(drawOrderDiffLines);
      setTimeout(drawOrderDiffLines, 120);
    }
  }

  function openModal(kind, initialTab = 'overview') {
    lastActive = document.activeElement;
    const reduce = prefersReducedMotion();
    try { modal.classList.remove('ns-anim-out'); } catch (_) {}
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ns-modal-open');
    if (!reduce) {
      try {
        modal.classList.add('ns-anim-in');
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); try { modal.classList.remove('ns-anim-in'); } catch (_) {}; };
        dialog.addEventListener('animationend', onEnd, { once: true });
      } catch (_) {}
    }
    const safeKind = kind === 'tabs' ? 'tabs' : 'index';
    activeKind = safeKind;
    const label = safeKind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
    title.textContent = tComposerDiff('title', { label });
    activeDiff = composerDiffCache[safeKind] || recomputeDiff(safeKind);
    renderOverview(safeKind, activeDiff);
    renderEntries(safeKind, activeDiff);
    renderOrder(safeKind);
    const targetTab = tabButtons.has(initialTab) ? initialTab : 'overview';
    setActiveTab(targetTab);
    setTimeout(() => {
      try { closeBtn.focus(); } catch (_) {}
    }, 0);
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('mousedown', (ev) => { if (ev.target === modal) closeModal(); });
  modal.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
    if (ev.key === 'Tab') {
      const focusables = Array.from(dialog.querySelectorAll(focusableSelector))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  composerDiffModal = {
    open: openModal,
    close: closeModal,
    activate: setActiveTab,
    getActiveKind: () => activeKind,
    isOpen: () => modal.classList.contains('is-open') && modal.getAttribute('aria-hidden') !== 'true',
    modal,
    dialog,
    title,
    subtitle,
    views: { overview: viewOverview, entries: viewEntries, order: viewOrder },
    statsWrap,
    beforeList,
    afterList,
    svg,
    emptyNotice,
    tabsWrap
  };

  const refreshLocale = () => {
    title.textContent = tComposerDiff('heading');
    subtitle.textContent = tComposerDiff(subtitleKeys[activeTab] || subtitleKeys.overview);
    closeBtn.textContent = tComposerDiff('close');
    closeBtn.setAttribute('aria-label', tComposerDiff('close'));
    if (beforeTitle) beforeTitle.textContent = tComposerDiff('order.remoteTitle');
    if (afterTitle) afterTitle.textContent = tComposerDiff('order.currentTitle');
    if (emptyNotice) emptyNotice.textContent = tComposerDiff('order.empty');
    tabButtons.forEach((btn, id) => {
      const def = tabDefsById.get(id);
      if (!btn || !def) return;
      btn.textContent = tComposerDiff(def.labelKey);
    });
  };
  if (!modal.__nsLangBound) {
    modal.__nsLangBound = true;
    document.addEventListener('ns-editor-language-applied', refreshLocale);
  }

  return composerDiffModal;
}

function drawOrderDiffLines(state) {
  let ctx = state;
  if (!ctx || typeof ctx !== 'object' || !ctx.container) ctx = composerOrderState;
  if (!ctx) return;
  const { container, svg, connectors, leftMap, rightMap } = ctx;
  if (!container || !svg) return;

  const hoverState = container.__nsOrderHoverState || (container.__nsOrderHoverState = {});
  hoverState.svg = svg;
  if (leftMap instanceof Map) hoverState.leftMap = leftMap;
  if (rightMap instanceof Map) hoverState.rightMap = rightMap;

  if (leftMap && typeof leftMap.forEach === 'function') {
    leftMap.forEach(el => {
      if (!el || !el.style) return;
      el.style.removeProperty('min-height');
      el.style.removeProperty('height');
      el.style.removeProperty('margin-top');
      el.style.removeProperty('margin-bottom');
    });
  }

  const rect = container.getBoundingClientRect();
  const width = container.clientWidth;
  const height = Math.max(container.scrollHeight, rect.height);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const existingPathCache = (svg.__nsPathCache instanceof Map) ? svg.__nsPathCache : new Map();
  const nextPathCache = new Map();

  const offsetX = rect.left;
  const offsetY = rect.top;
  const scrollTop = container.scrollTop || 0;

  const segments = Array.isArray(connectors) ? connectors : [];
  let movedIdx = 0;
  let fallbackHeight = 0;
  let fallbackMarginTop = '';
  let fallbackMarginBottom = '';
  const layoutSegments = [];
  const pathMap = new Map();
  segments.forEach(info => {
    const leftEl = leftMap.get(info.key);
    const rightRow = rightMap.get(info.key);
    if (!leftEl) return;

    let anchor = null;
    if (rightRow && typeof rightRow.querySelector === 'function') {
      anchor = rightRow.querySelector('.ci-head, .ct-head');
    }
    if (!anchor) anchor = rightRow || null;

    const rowRect = rightRow && typeof rightRow.getBoundingClientRect === 'function'
      ? rightRow.getBoundingClientRect()
      : null;
    const anchorRect = anchor && typeof anchor.getBoundingClientRect === 'function'
      ? anchor.getBoundingClientRect()
      : rowRect;
    const cs = (typeof window !== 'undefined' && window.getComputedStyle && rightRow)
      ? window.getComputedStyle(rightRow)
      : null;

    if (leftEl.style) {
      const anchorHeight = anchorRect && typeof anchorRect.height === 'number' ? anchorRect.height : 0;
      const rowHeight = rowRect && typeof rowRect.height === 'number' ? rowRect.height : 0;
      const heightPx = Math.max(anchorHeight, rowHeight, 0);
      const heightValue = `${heightPx}px`;
      leftEl.style.height = heightValue;
      leftEl.style.minHeight = heightValue;
      if (heightPx > fallbackHeight) fallbackHeight = heightPx;
      if (cs) {
        leftEl.style.marginTop = cs.marginTop;
        leftEl.style.marginBottom = cs.marginBottom;
        if (!fallbackMarginTop) fallbackMarginTop = cs.marginTop;
        if (!fallbackMarginBottom) fallbackMarginBottom = cs.marginBottom;
      }
    }

    if (!anchorRect || !anchor) return;

    let anchorCenter = null;
    if (anchorRect && rowRect) {
      anchorCenter = (anchorRect.top - rowRect.top) + (anchorRect.height / 2);
    } else if (anchorRect) {
      anchorCenter = anchorRect.height / 2;
    } else if (rowRect) {
      anchorCenter = rowRect.height / 2;
    }

    layoutSegments.push({ info, leftEl, rightEl: anchor, rightRect: anchorRect, rightRow, anchorCenter });
  });

  if (fallbackHeight > 0 && leftMap && typeof leftMap.forEach === 'function') {
    leftMap.forEach(el => {
      if (!el || !el.style) return;
      const status = (el.dataset && typeof el.dataset.status === 'string')
        ? el.dataset.status
        : '';
      if (status === 'removed') return;
      const fallbackValue = `${fallbackHeight}px`;
      if (!el.style.minHeight) {
        el.style.minHeight = fallbackValue;
      }
      if (!el.style.height) {
        el.style.height = fallbackValue;
      }
      if (fallbackMarginTop !== '' && !el.style.marginTop) {
        el.style.marginTop = fallbackMarginTop;
      }
      if (fallbackMarginBottom !== '' && !el.style.marginBottom) {
        el.style.marginBottom = fallbackMarginBottom;
      }
    });
  }

  layoutSegments.forEach(segment => {
    const { info, leftEl, rightEl, rightRect, rightRow, anchorCenter } = segment;
    const lRect = leftEl.getBoundingClientRect();
    const row = rightRow && typeof rightRow.getBoundingClientRect === 'function' ? rightRow : null;
    const rowRect = row ? row.getBoundingClientRect() : null;
    const anchorEl = rightEl && typeof rightEl.getBoundingClientRect === 'function' ? rightEl : row;
    let rRect = anchorEl ? anchorEl.getBoundingClientRect() : null;
    if (!rRect && rightRect) rRect = rightRect;
    const baseRect = rowRect || rRect || rightRect;
    if (!rRect || !baseRect) return;

    let anchorOffset = anchorCenter;
    if (anchorOffset == null) {
      if (rRect && rowRect) {
        anchorOffset = (rRect.top - rowRect.top) + (rRect.height / 2);
      } else if (rRect) {
        anchorOffset = rRect.height / 2;
      } else if (rowRect) {
        anchorOffset = rowRect.height / 2;
      } else {
        anchorOffset = lRect.height / 2;
      }
    }

    const clampOffset = (offset, size) => {
      if (offset == null) return 0;
      if (size == null || size <= 0) return Math.max(offset, 0);
      if (offset < 0) return 0;
      if (offset > size) return size;
      return offset;
    };

    const leftOffset = clampOffset(anchorOffset, lRect.height || anchorOffset);
    const rightOffset = clampOffset(anchorOffset, baseRect.height || anchorOffset);

    let startX = (lRect.right - offsetX);
    const startY = (lRect.top - offsetY) + leftOffset + scrollTop;
    let endX = (rRect.left - offsetX);
    const endY = (baseRect.top - offsetY) + rightOffset + scrollTop;
    if (endX <= startX) {
      const mid = (startX + endX) / 2;
      startX = mid - 1;
      endX = mid + 1;
    }
    const curve = Math.max(36, (endX - startX) * 0.35);
    const pathKey = `${info.key || ''}::${info.fromIndex ?? ''}::${info.toIndex ?? ''}`;
    const cached = existingPathCache.get(pathKey);
    let path = cached && cached.path ? cached.path : null;
    if (!path || !path.isConnected) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('composer-order-path');
    }

    const status = (info && typeof info.status === 'string' && info.status) ? info.status : 'same';
    let strokeColor = '#94a3b8';
    if (status === 'same') {
      strokeColor = '#94a3b8';
    } else if (cached && cached.color) {
      strokeColor = cached.color;
    } else {
      strokeColor = ORDER_LINE_COLORS[movedIdx % ORDER_LINE_COLORS.length];
      movedIdx += 1;
    }

    path.setAttribute('d', `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
    path.dataset.status = status;
    if (info.key) path.dataset.key = info.key;
    else path.removeAttribute('data-key');
    path.dataset.pathKey = pathKey;
    path.setAttribute('stroke', strokeColor);
    svg.appendChild(path);

    const key = info.key || '';
    if (!pathMap.has(key)) pathMap.set(key, []);
    pathMap.get(key).push(path);

    nextPathCache.set(pathKey, { path, color: strokeColor, key });
  });

  existingPathCache.forEach((entry, cacheKey) => {
    if (!nextPathCache.has(cacheKey)) {
      const el = entry && entry.path;
      if (el && el.parentNode === svg) {
        svg.removeChild(el);
      }
    }
  });

  svg.__nsPathCache = nextPathCache;

  hoverState.pathMap = pathMap;
  if (typeof hoverState.currentKey === 'string' && hoverState.currentKey) {
    applyComposerOrderHover(container, hoverState.currentKey);
  } else {
    applyComposerOrderHover(container, '');
  }
}

function scheduleComposerOrderPreviewRelayout(kind) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const timers = composerOrderPreviewRelayoutTimers[normalized];
  if (timers) {
    if (typeof cancelAnimationFrame === 'function' && typeof timers.raf === 'number') {
      try { cancelAnimationFrame(timers.raf); } catch (_) {}
    }
    if (timers.timeout != null) {
      clearTimeout(timers.timeout);
    }
  }

  const pending = { raf: null, timeout: null };
  const run = () => {
    const active = composerOrderPreviewState && composerOrderPreviewState[normalized];
    if (active) drawOrderDiffLines(active);
  };
  const finalize = () => { composerOrderPreviewRelayoutTimers[normalized] = null; };

  const delayBase = Math.max(SLIDE_OPEN_DUR, SLIDE_CLOSE_DUR, 260) + 80;

  const scheduleTrailing = () => {
    pending.timeout = setTimeout(() => {
      pending.timeout = null;
      run();
      finalize();
    }, delayBase);
  };

  const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
  if (!state) {
    finalize();
    return;
  }

  if (typeof requestAnimationFrame === 'function') {
    pending.raf = requestAnimationFrame(() => {
      pending.raf = null;
      run();
      scheduleTrailing();
    });
  } else {
    run();
    scheduleTrailing();
  }

  composerOrderPreviewRelayoutTimers[normalized] = pending;
}

function ensureComposerOrderPreview(kind) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  if (!composerOrderPreviewElements) composerOrderPreviewElements = { index: null, tabs: null };
  if (composerOrderPreviewElements[normalized]) return composerOrderPreviewElements[normalized];

  const host = document.querySelector(`.composer-order-host[data-kind="${normalized}"]`);
  if (!host) return null;
  const root = host.querySelector('.composer-order-inline');
  if (!root) return null;

  let svg = host.querySelector('svg.composer-order-inline-lines');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('composer-order-lines', 'composer-order-inline-lines');
    svg.setAttribute('aria-hidden', 'true');
    host.appendChild(svg);
  }

  const meta = document.getElementById('composerOrderInlineMeta');
  const statsWrap = meta ? meta.querySelector('.composer-order-inline-stats') : null;
  const list = root.querySelector('.composer-order-inline-list');
  const emptyNotice = root.querySelector('.composer-order-inline-empty');
  const kindLabel = meta ? meta.querySelector('.composer-order-inline-kind') : null;
  const title = meta ? meta.querySelector('.composer-order-inline-title') : null;
  const openBtn = meta ? meta.querySelector('.composer-order-inline-open') : null;

  if (openBtn && !openBtn.__nsBound) {
    openBtn.__nsBound = true;
    openBtn.addEventListener('click', () => {
      const target = openBtn.dataset && openBtn.dataset.kind ? openBtn.dataset.kind : normalized;
      openComposerDiffModal(target, 'overview');
    });
  }

  if (typeof ResizeObserver === 'function' && !host.__nsOrderResizeObserver) {
    try {
      const ro = new ResizeObserver(() => {
        const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
        if (state) drawOrderDiffLines(state);
      });
      ro.observe(host);
      host.__nsOrderResizeObserver = ro;
    } catch (_) {}
  }

  if (!composerOrderPreviewResizeHandler) {
    composerOrderPreviewResizeHandler = () => {
      if (!composerOrderPreviewState) return;
      ['index', 'tabs'].forEach(key => {
        const state = composerOrderPreviewState[key];
        if (state) drawOrderDiffLines(state);
      });
    };
    try { window.addEventListener('resize', composerOrderPreviewResizeHandler); } catch (_) {}
  }

  const preview = { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta };
  composerOrderPreviewElements[normalized] = preview;
  return preview;
}

function updateComposerOrderPreview(kind, options = {}) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const preview = ensureComposerOrderPreview(normalized);
  if (!preview) return;
  composerOrderPreviewActiveKind = normalized;

  const { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta } = preview;
  const label = normalized === 'tabs' ? 'tabs.yaml' : 'index.yaml';
  const allowReveal = options.reveal !== false;
  const primaryList = normalized === 'tabs' ? document.getElementById('ctList') : document.getElementById('ciList');
  const primaryListRectBefore = captureElementRect(primaryList);
  let listAnimationScheduled = false;
  const collapseImmediately = !!options.collapseImmediately
    || !!(composerViewTransition
      && composerViewTransition.panels
      && composerViewTransition.panels.classList.contains('is-hidden'));
  const runListAnimation = (opts = {}) => {
    if (listAnimationScheduled) return;
    listAnimationScheduled = true;
    if (!primaryList || !primaryListRectBefore) return;
    const originalOnMeasured = typeof opts.onMeasured === 'function' ? opts.onMeasured : null;
    const config = { ...opts };
    config.onMeasured = (rect) => {
      if (originalOnMeasured) {
        try {
          const result = originalOnMeasured(rect);
          if (result && typeof result === 'object') return result;
        }
        catch (_) {}
      }
      return rect;
    };
    animateComposerListTransition(primaryList, primaryListRectBefore, config);
  };
  const applyInlineActive = (value) => {
    if (!host) return;
    host.dataset.inlineActive = value ? 'true' : 'false';
  };

  if (title) title.textContent = tComposerDiff('inline.title');
  if (kindLabel) kindLabel.textContent = label;
  if (meta) meta.dataset.kind = normalized;
  if (root) {
    root.dataset.kind = normalized;
    root.setAttribute('aria-label', tComposerDiff('inline.ariaOrder', { label }));
  }
  if (host) host.dataset.kind = normalized;
  if (openBtn) {
    openBtn.dataset.kind = normalized;
    openBtn.setAttribute('aria-label', tComposerDiff('inline.openAria', { label }));
  }

  const diff = composerDiffCache[normalized] || recomputeDiff(normalized);

  const details = computeOrderDiffDetails(normalized) || {};
  const beforeEntries = Array.isArray(details.beforeEntries) ? details.beforeEntries : [];
  const afterEntries = Array.isArray(details.afterEntries) ? details.afterEntries : [];
  const connectors = Array.isArray(details.connectors) ? details.connectors : [];
  const stats = details.stats || { moved: 0, added: 0, removed: 0 };

  if (statsWrap) {
    renderComposerInlineSummary(statsWrap, diff, { orderStats: stats });
  }

  if (list) {
    list.innerHTML = '';
  }

  const leftMap = new Map();
  beforeEntries.forEach(entry => {
    const item = buildOrderDiffItem(entry, 'before');
    item.classList.add('composer-order-inline-item');
    leftMap.set(entry.key, item);
    if (list) list.appendChild(item);
  });

  const main = host ? host.querySelector('.composer-order-main') : null;
  if (main) cancelComposerOrderMainTransition(main);
  const mainRectBefore = main ? captureElementRect(main) : null;
  const rightMap = new Map();
  if (main) {
    const selector = normalized === 'tabs' ? '.ct-item' : '.ci-item';
    afterEntries.forEach(entry => {
      if (!entry || !entry.key) return;
      const row = main.querySelector(`${selector}[data-key="${cssEscape(entry.key)}"]`);
      if (!row) return;
      rightMap.set(entry.key, row);
      bindComposerOrderHover(row, entry.key);
      observeComposerOrderRow(row, normalized);
    });
  }

  if (svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  const hasBaseline = leftMap.size > 0;
  const hasOrderChanges = (stats.moved || stats.added || stats.removed) > 0;
  const hasDiffChanges = !!(diff && diff.hasChanges);

  if (host) {
    const hoverState = host.__nsOrderHoverState || {};
    if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
      try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
      hoverState.activeLeft = null;
    }
    hoverState.leftMap = leftMap;
    hoverState.rightMap = rightMap;
    hoverState.svg = svg;
    if (!hasOrderChanges) hoverState.pathMap = null;
    host.__nsOrderHoverState = hoverState;
  }

  if (emptyNotice) {
    if (!hasBaseline) {
      emptyNotice.hidden = !hasOrderChanges;
      emptyNotice.setAttribute('aria-hidden', hasOrderChanges ? 'false' : 'true');
      if (hasOrderChanges && stats.added && !hasBaseline) {
        emptyNotice.textContent = tComposerDiff('order.inlineAllNew');
      } else {
        emptyNotice.textContent = tComposer('inlineEmpty');
      }
    } else {
      emptyNotice.hidden = true;
      emptyNotice.setAttribute('aria-hidden', 'true');
    }
  }

  if (!hasDiffChanges) {
    if (meta) {
      animateComposerInlineVisibility(meta, false, collapseImmediately ? { immediate: true } : undefined);
    }
    if (host) host.dataset.state = 'clean';

    let collapseApplied = false;
    const finalizeCollapse = () => {
      if (collapseApplied) return;
      collapseApplied = true;
      applyInlineActive(false);
      animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
      runListAnimation({ immediate: true });
    };

    if (root) {
      root.dataset.state = 'clean';
      const collapseOptions = collapseImmediately
        ? { onFinish: finalizeCollapse, immediate: true }
        : { onFinish: finalizeCollapse };
      animateComposerInlineVisibility(root, false, collapseOptions);
    } else {
      finalizeCollapse();
    }

    if (svg) svg.style.display = 'none';
    if (host) {
      const hoverState = host.__nsOrderHoverState || {};
      hoverState.pathMap = null;
      hoverState.currentKey = '';
      host.__nsOrderHoverState = hoverState;
      applyComposerOrderHover(host, '');
    }
    composerOrderPreviewState[normalized] = null;
    return;
  }

  if (meta) {
    if (allowReveal) animateComposerInlineVisibility(meta, true);
    else meta.setAttribute('aria-hidden', meta.hidden ? 'true' : 'false');
  }

  if (host) host.dataset.state = 'changed';

  const inlineShouldShow = hasOrderChanges && allowReveal;
  if (inlineShouldShow) {
    applyInlineActive(true);
    if (root) {
      root.dataset.state = 'changed';
      animateComposerInlineVisibility(root, true);
    }
    runListAnimation();
  } else {
    let collapseApplied = false;
    const finalizeCollapse = () => {
      if (collapseApplied) return;
      collapseApplied = true;
      applyInlineActive(false);
      animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
      runListAnimation({ immediate: true });
    };
    if (root) {
      root.dataset.state = hasOrderChanges ? 'changed' : 'clean';
      const collapseOptions = collapseImmediately
        ? { onFinish: finalizeCollapse, immediate: true }
        : { onFinish: finalizeCollapse };
      animateComposerInlineVisibility(root, false, collapseOptions);
    } else {
      finalizeCollapse();
    }
  }

  const state = hasOrderChanges && svg && (leftMap.size || connectors.length)
    ? { container: host, svg, connectors, leftMap, rightMap }
    : null;
  composerOrderPreviewState[normalized] = state;
  if (svg) svg.style.display = state ? '' : 'none';
  if (!state && host) {
    const hoverState = host.__nsOrderHoverState || {};
    hoverState.pathMap = null;
    hoverState.currentKey = '';
    host.__nsOrderHoverState = hoverState;
    applyComposerOrderHover(host, '');
  }
  if (state) {
    if (host && host.__nsOrderHoverState && typeof host.__nsOrderHoverState.currentKey === 'string') {
      applyComposerOrderHover(host, host.__nsOrderHoverState.currentKey);
    }
    drawOrderDiffLines(state);
    requestAnimationFrame(() => drawOrderDiffLines(state));
    setTimeout(() => drawOrderDiffLines(state), 120);
  }
}

function observeComposerOrderRow(row, kind) {
  if (!row || typeof ResizeObserver !== 'function') return;
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const existing = row.__nsOrderResize;
  if (existing && existing.kind === normalized) return;
  try {
    if (existing && existing.observer) {
      existing.observer.disconnect();
    }
  } catch (_) {}
  try {
    const observer = new ResizeObserver(() => {
      scheduleComposerOrderPreviewRelayout(normalized);
    });
    observer.observe(row);
    row.__nsOrderResize = { observer, kind: normalized };
  } catch (_) {}
}

function setComposerOrderPreviewActiveKind(kind) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  if (composerOrderPreviewActiveKind === normalized) {
    updateComposerOrderPreview(normalized);
    return;
  }
  composerOrderPreviewActiveKind = normalized;
  updateComposerOrderPreview(normalized);
}




function scheduleAutoDraft(kind) {
  if (composerAutoSaveTimers[kind]) {
    clearTimeout(composerAutoSaveTimers[kind]);
    composerAutoSaveTimers[kind] = null;
  }
  const diff = composerDiffCache[kind];
  if (!diff || !diff.hasChanges) {
    clearDraftStorage(kind);
    updateUnsyncedSummary();
    return;
  }
  composerAutoSaveTimers[kind] = setTimeout(() => {
    composerAutoSaveTimers[kind] = null;
    saveDraftToStorage(kind, { manual: false });
  }, 800);
}

function saveDraftToStorage(kind, opts = {}) {
  const slice = getStateSlice(kind);
  if (!slice) return null;
  let snapshot;
  if (kind === 'tabs') snapshot = prepareTabsState(slice);
  else if (kind === 'site') snapshot = cloneSiteState(slice);
  else snapshot = prepareIndexState(slice);
  const store = readDraftStore();
  const savedAt = Date.now();
  const baseSignature = computeBaselineSignature(kind);
  store[kind] = { savedAt, data: snapshot, baseSignature };
  writeDraftStore(store);
  composerDraftMeta[kind] = { savedAt, baseSignature, lastManual: !!opts.manual };
  updateUnsyncedSummary();
  
  return composerDraftMeta[kind];
}

function clearDraftStorage(kind) {
  const store = readDraftStore();
  if (store && Object.prototype.hasOwnProperty.call(store, kind)) {
    delete store[kind];
    writeDraftStore(store);
  }
  composerDraftMeta[kind] = null;

}

function notifyComposerChange(kind, options = {}) {
  const diff = recomputeDiff(kind);
  if (kind === 'tabs') applyTabsDiffMarkers(diff);
  else if (kind === 'site') applySiteDiffMarkers(diff);
  else applyIndexDiffMarkers(diff);
  updateFileDirtyBadge(kind);
  if (!options.skipAutoSave) scheduleAutoDraft(kind);

  updateUnsyncedSummary();
  if ((kind === 'index' || kind === 'tabs') && composerOrderPreviewActiveKind === kind) updateComposerOrderPreview(kind);
  refreshEditorContentTree({
    preserveStructure: currentMode && (isDynamicMode(currentMode) || currentMode === 'composer' || currentMode === 'updates' || currentMode === 'sync')
  });
}

function rebuildIndexUI(preserveOpen = true) {
  const root = document.getElementById('composerIndex');
  if (!root) return;
  const openKeys = preserveOpen
    ? Array.from(root.querySelectorAll('.ci-item.is-open')).map(el => el.getAttribute('data-key')).filter(Boolean)
    : [];
  buildIndexUI(root, activeComposerState);
  openKeys.forEach(key => {
    if (!key) return;
    const row = root.querySelector(`.ci-item[data-key="${cssEscape(key)}"]`);
    if (!row) return;
    const body = row.querySelector('.ci-body');
    const btn = row.querySelector('.ci-expand');
    row.classList.add('is-open');
    if (body) {
      body.style.display = 'block';
      body.dataset.open = '1';
      clearInlineSlideStyles(body);
    }
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
  notifyComposerChange('index', { skipAutoSave: true });
  updateComposerMarkdownDraftIndicators();
}

function rebuildTabsUI(preserveOpen = true) {
  const root = document.getElementById('composerTabs');
  if (!root) return;
  const openKeys = preserveOpen
    ? Array.from(root.querySelectorAll('.ct-item.is-open')).map(el => el.getAttribute('data-key')).filter(Boolean)
    : [];
  buildTabsUI(root, activeComposerState);
  openKeys.forEach(key => {
    if (!key) return;
    const row = root.querySelector(`.ct-item[data-key="${cssEscape(key)}"]`);
    if (!row) return;
    const body = row.querySelector('.ct-body');
    const btn = row.querySelector('.ct-expand');
    row.classList.add('is-open');
    if (body) {
      body.style.display = 'block';
      body.dataset.open = '1';
      clearInlineSlideStyles(body);
    }
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
  notifyComposerChange('tabs', { skipAutoSave: true });
  updateComposerMarkdownDraftIndicators();
}

function loadDraftSnapshotsIntoState(state) {
  const restored = [];
  const store = readDraftStore();
  if (!store) return restored;
  ['index', 'tabs', 'site'].forEach(kind => {
    const entry = store[kind];
    if (!entry || !entry.data) return;
    let snapshot;
    if (kind === 'tabs') snapshot = prepareTabsState(entry.data);
    else if (kind === 'site') snapshot = cloneSiteState(entry.data);
    else snapshot = prepareIndexState(entry.data);
    if (kind === 'tabs') state.tabs = snapshot;
    else if (kind === 'site') state.site = snapshot;
    else state.index = snapshot;
    setStateSlice(kind, snapshot);
    composerDraftMeta[kind] = {
      savedAt: Number(entry.savedAt) || Date.now(),
      baseSignature: entry.baseSignature ? String(entry.baseSignature) : '',
      lastManual: false
    };
    restored.push(kind);
  });
  return restored;
}



async function handleComposerRefresh(btn) {
  const target = getActiveComposerFile();
  const button = btn;
  const resetButton = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    button.textContent = t('editor.composer.refresh');
  };
  try {
    if (button) {
      button.disabled = true;
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.textContent = t('editor.composer.refreshing');
    }
    const contentRoot = getContentRootSafe();
    const fileBase = target === 'tabs' ? 'tabs' : target === 'site' ? 'site' : 'index';
    const remote = target === 'site'
      ? await fetchComposerTrackedSiteConfig()
      : await fetchConfigWithYamlFallback([`${contentRoot}/${fileBase}.yaml`, `${contentRoot}/${fileBase}.yml`]);
    let prepared;
    if (target === 'tabs') prepared = prepareTabsState(remote || {});
    else if (target === 'site') prepared = cloneSiteState(prepareSiteState(remote || {}));
    else prepared = prepareIndexState(remote || {});
    const baselineSignatureBefore = computeBaselineSignature(target);
    remoteBaseline[target] = prepared;
    const diffBefore = composerDiffCache[target];
    const hadLocalChanges = diffBefore && diffBefore.hasChanges;
    if (!hadLocalChanges) {
      setStateSlice(target, deepClone(prepared));
      if (target === 'site') applyComposerEffectiveSiteConfig(prepared);
      if (target === 'tabs') rebuildTabsUI();
      else if (target === 'site') rebuildSiteUI();
      else rebuildIndexUI();
      showStatus(
        t('editor.composer.statusMessages.refreshSuccess', {
          name: `${fileBase}.yaml`
        })
      );
    } else {
      notifyComposerChange(target, { skipAutoSave: true });
      const baselineSignatureAfter = computeBaselineSignature(target);
      if (baselineSignatureAfter !== baselineSignatureBefore) {
        showStatus(t('editor.composer.statusMessages.remoteUpdated'));
      } else {
        showStatus(t('editor.composer.statusMessages.remoteUnchanged'));
      }
    }
  } catch (err) {
    console.error('Refresh failed', err);
    showStatus(t('editor.composer.statusMessages.refreshFailed'));
  } finally {
    resetButton();
    setTimeout(() => { showStatus(''); }, 2000);
  }
}

let discardConfirmElements = null;
let discardConfirmActiveClose = null;
let discardConfirmHideTimer = null;

let addEntryPromptElements = null;
let addEntryPromptActiveClose = null;
let addEntryPromptHideTimer = null;

function ensureComposerAddEntryPromptElements() {
  if (addEntryPromptElements) return addEntryPromptElements;
  if (typeof document === 'undefined') return null;

  const popover = document.createElement('div');
  popover.id = 'composerAddEntryPrompt';
  popover.className = 'composer-confirm-popover composer-key-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.hidden = true;

  const fieldWrap = document.createElement('div');
  fieldWrap.className = 'composer-key-form';

  const label = document.createElement('label');
  label.className = 'composer-confirm-message';
  label.id = 'composerAddEntryPromptLabel';
  label.setAttribute('for', 'composerAddEntryKeyInput');
  fieldWrap.appendChild(label);

  popover.setAttribute('aria-labelledby', label.id);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'composerAddEntryKeyInput';
  input.className = 'composer-key-input';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.setAttribute('spellcheck', 'false');
  fieldWrap.appendChild(input);

  const hint = document.createElement('div');
  hint.className = 'composer-key-hint';
  hint.id = 'composerAddEntryPromptHint';
  hint.textContent = t('editor.composer.addEntryPrompt.hint');
  fieldWrap.appendChild(hint);

  const error = document.createElement('div');
  error.className = 'composer-key-error';
  error.id = 'composerAddEntryPromptError';
  error.setAttribute('role', 'alert');
  fieldWrap.appendChild(error);

  input.setAttribute('aria-describedby', `${hint.id} ${error.id}`);
  popover.setAttribute('aria-describedby', `${hint.id} ${error.id}`);

  popover.appendChild(fieldWrap);

  const actions = document.createElement('div');
  actions.className = 'composer-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary composer-confirm-cancel';
  cancelBtn.textContent = t('editor.composer.dialogs.cancel');

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-secondary composer-confirm-confirm';
  confirmBtn.textContent = t('editor.composer.addEntryPrompt.confirm');

  actions.append(cancelBtn, confirmBtn);
  popover.appendChild(actions);

  document.body.appendChild(popover);
  addEntryPromptElements = { popover, label, input, hint, error, cancelBtn, confirmBtn };
  return addEntryPromptElements;
}

function showComposerAddEntryPrompt(anchor, options) {
  const elements = ensureComposerAddEntryPromptElements();
  if (!elements) return Promise.resolve({ confirmed: false, value: '' });

  const { popover, label, input, hint, error, cancelBtn, confirmBtn } = elements;
  const typeLabel = options && options.typeLabel
    ? String(options.typeLabel)
    : t('editor.composer.addEntryPrompt.defaultType');
  const confirmLabel = options && options.confirmLabel
    ? String(options.confirmLabel)
    : t('editor.composer.addEntryPrompt.confirm');
  const cancelLabel = options && options.cancelLabel
    ? String(options.cancelLabel)
    : t('editor.composer.dialogs.cancel');
  const placeholder = options && options.placeholder
    ? String(options.placeholder)
    : t('editor.composer.addEntryPrompt.placeholder');
  const existingKeys = options && options.existingKeys ? new Set(options.existingKeys) : new Set();
  const hintText = options && Object.prototype.hasOwnProperty.call(options, 'hint')
    ? String(options.hint || '')
    : t('editor.composer.addEntryPrompt.hint');
  const customValidator = options && typeof options.validate === 'function'
    ? options.validate
    : null;

  label.textContent = options && options.message
    ? String(options.message)
    : t('editor.composer.addEntryPrompt.message', { label: typeLabel });
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;
  hint.textContent = hintText;
  input.value = options && options.initialValue ? String(options.initialValue).trim() : '';
  input.placeholder = placeholder;
  input.setAttribute('aria-invalid', 'false');
  error.textContent = '';

  if (anchor && typeof anchor.setAttribute === 'function') {
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.setAttribute('aria-controls', popover.id);
  }

  if (typeof addEntryPromptActiveClose === 'function') {
    try { addEntryPromptActiveClose(false); } catch (_) {}
  }

  if (addEntryPromptHideTimer) {
    window.clearTimeout(addEntryPromptHideTimer);
    addEntryPromptHideTimer = null;
  }

  popover.hidden = false;
  popover.style.visibility = 'hidden';
  popover.classList.remove('is-visible');
  popover.dataset.placement = 'bottom';

  const setError = (message) => {
    const text = String(message || '');
    error.textContent = text;
    if (text) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.setAttribute('aria-invalid', 'false');
    }
  };

  const validateValue = () => {
    const raw = input.value || '';
    const value = raw.trim();
    if (customValidator) {
      const result = customValidator(value);
      if (result && typeof result === 'object') {
        if (result.ok === false) {
          setError(result.error || t('editor.composer.addEntryPrompt.errorInvalid'));
          try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
          return null;
        }
        const nextValue = Object.prototype.hasOwnProperty.call(result, 'value')
          ? String(result.value || '').trim()
          : value;
        setError('');
        return nextValue;
      }
      if (typeof result === 'string' && result) {
        setError(result);
        try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
        return null;
      }
      if (result === false) {
        setError(t('editor.composer.addEntryPrompt.errorInvalid'));
        try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
        return null;
      }
      setError('');
      return value;
    }
    if (!value) {
      setError(t('editor.composer.addEntryPrompt.errorEmpty'));
      try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
      return null;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      setError(t('editor.composer.addEntryPrompt.errorInvalid'));
      try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
      return null;
    }
    if (existingKeys.has(value)) {
      setError(t('editor.composer.addEntryPrompt.errorDuplicate'));
      try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
      return null;
    }
    setError('');
    return value;
  };

  let resolve;
  let closed = false;

  const finish = (result, value) => {
    if (closed) return;
    closed = true;
    addEntryPromptActiveClose = null;

    popover.classList.remove('is-visible');
    popover.style.visibility = 'hidden';

    if (addEntryPromptHideTimer) {
      window.clearTimeout(addEntryPromptHideTimer);
      addEntryPromptHideTimer = null;
    }
    addEntryPromptHideTimer = window.setTimeout(() => {
      popover.hidden = true;
      popover.style.visibility = '';
      popover.style.left = '';
      popover.style.top = '';
      addEntryPromptHideTimer = null;
    }, 200);

    cancelBtn.removeEventListener('click', onCancel);
    confirmBtn.removeEventListener('click', onConfirm);
    input.removeEventListener('keydown', onInputKeyDown, true);
    input.removeEventListener('input', onInputChange);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('touchstart', onOutside, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);

    if (anchor && typeof anchor.setAttribute === 'function') {
      anchor.setAttribute('aria-expanded', 'false');
    }

    if (!result && anchor && typeof anchor.focus === 'function') {
      window.setTimeout(() => {
        try { anchor.focus({ preventScroll: true }); } catch (_) {}
      }, 120);
    }

    setError('');
    input.value = '';

    if (typeof resolve === 'function') {
      resolve({ confirmed: !!result, value: result ? String(value || '') : '' });
    }
    resolve = null;
  };

  const onCancel = (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    finish(false, '');
  };

  const onConfirm = (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const value = validateValue();
    if (value == null) return;
    finish(true, value);
  };

  const onInputKeyDown = (event) => {
    if (!event) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = validateValue();
      if (value == null) return;
      finish(true, value);
    }
  };

  const onInputChange = () => {
    if (error.textContent) setError('');
  };

  const onOutside = (event) => {
    const target = event && event.target;
    if (!target) return;
    if (popover.contains(target) || target === anchor) return;
    finish(false, '');
  };

  const onKeyDown = (event) => {
    if (!event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(false, '');
      return;
    }
    if (event.key === 'Tab') {
      const focusables = [input, confirmBtn, cancelBtn];
      const active = document.activeElement;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (active === first || !focusables.includes(active)) {
          event.preventDefault();
          if (last) last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          event.preventDefault();
          if (first) first.focus({ preventScroll: true });
        } else if (!focusables.includes(active)) {
          event.preventDefault();
          if (first) first.focus({ preventScroll: true });
        }
      }
    }
  };

  const reposition = () => {
    if (!anchor || !popover.isConnected) {
      finish(false, '');
      return;
    }
    if (typeof anchor.getBoundingClientRect !== 'function') {
      finish(false, '');
      return;
    }
    const rect = anchor.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      finish(false, '');
      return;
    }
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const viewportWidth = document.documentElement && document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : (window.innerWidth || 0);
    const viewportHeight = document.documentElement && document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : (window.innerHeight || 0);
    const margin = 12;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;

    let left = scrollX + rect.right - width;
    const minLeft = scrollX + margin;
    const maxLeft = scrollX + Math.max(margin, viewportWidth - margin - width);
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    let placement = 'bottom';
    let top = scrollY + rect.bottom + 12;
    const viewportBottom = scrollY + viewportHeight;
    const fitsBelow = top + height <= viewportBottom - margin;
    if (!fitsBelow && rect.top >= height + margin) {
      placement = 'top';
      top = scrollY + rect.top - height - 12;
    } else if (!fitsBelow) {
      top = Math.max(scrollY + margin, viewportBottom - height - margin);
    }
    if (placement === 'bottom') {
      top = Math.max(top, scrollY + rect.bottom + 4);
    } else {
      top = Math.min(top, scrollY + rect.top - 4);
    }

    popover.dataset.placement = placement;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  };

  cancelBtn.addEventListener('click', onCancel);
  confirmBtn.addEventListener('click', onConfirm);
  input.addEventListener('keydown', onInputKeyDown, true);
  input.addEventListener('input', onInputChange);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('touchstart', onOutside, true);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);

  return new Promise((res) => {
    resolve = res;
    addEntryPromptActiveClose = () => finish(false, '');

    const runShow = () => {
      reposition();
      if (closed) return;
      popover.style.visibility = '';
      popover.classList.add('is-visible');
      if (anchor && typeof anchor.setAttribute === 'function') {
        anchor.setAttribute('aria-expanded', 'true');
      }
      try { input.focus({ preventScroll: true }); input.select(); } catch (_) {}
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(runShow);
    } else {
      runShow();
    }
  });
}

function ensureComposerDiscardConfirmElements() {
  if (discardConfirmElements) return discardConfirmElements;
  if (typeof document === 'undefined') return null;
  const popover = document.createElement('div');
  popover.className = 'composer-confirm-popover';
  popover.id = 'composerDiscardConfirm';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.hidden = true;

  const message = document.createElement('div');
  message.className = 'composer-confirm-message';
  message.id = 'composerDiscardConfirmMessage';
  popover.setAttribute('aria-labelledby', message.id);
  popover.appendChild(message);

  const actions = document.createElement('div');
  actions.className = 'composer-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary composer-confirm-cancel';
  cancelBtn.textContent = t('editor.composer.dialogs.cancel');

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-secondary composer-confirm-confirm';
  confirmBtn.textContent = t('editor.composer.dialogs.confirm');

  actions.append(cancelBtn, confirmBtn);
  popover.appendChild(actions);

  document.body.appendChild(popover);
  discardConfirmElements = { popover, message, cancelBtn, confirmBtn };
  return discardConfirmElements;
}

function showComposerDiscardConfirm(anchor, messageText, options) {
  const elements = ensureComposerDiscardConfirmElements();
  if (!elements) return Promise.resolve(true);
  const { popover, message, cancelBtn, confirmBtn } = elements;
  const confirmLabel = options && options.confirmLabel
    ? String(options.confirmLabel)
    : t('editor.composer.dialogs.confirm');
  const cancelLabel = options && options.cancelLabel
    ? String(options.cancelLabel)
    : t('editor.composer.dialogs.cancel');

  message.textContent = String(messageText || '');
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;

  if (anchor && typeof anchor.setAttribute === 'function') {
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.setAttribute('aria-controls', popover.id);
  }

  if (typeof discardConfirmActiveClose === 'function') {
    try { discardConfirmActiveClose(false); } catch (_) {}
  }

  if (discardConfirmHideTimer) {
    window.clearTimeout(discardConfirmHideTimer);
    discardConfirmHideTimer = null;
  }

  popover.hidden = false;
  popover.style.visibility = 'hidden';
  popover.classList.remove('is-visible');
  popover.dataset.placement = 'bottom';

  return new Promise((resolve) => {
    let closed = false;

    const finish = (result) => {
      if (closed) return;
      closed = true;
      discardConfirmActiveClose = null;

      popover.classList.remove('is-visible');
      popover.style.visibility = 'hidden';
      if (discardConfirmHideTimer) {
        window.clearTimeout(discardConfirmHideTimer);
        discardConfirmHideTimer = null;
      }
      discardConfirmHideTimer = window.setTimeout(() => {
        popover.hidden = true;
        popover.style.visibility = '';
        popover.style.left = '';
        popover.style.top = '';
        discardConfirmHideTimer = null;
      }, 200);

      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('touchstart', onOutside, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);

      if (anchor && typeof anchor.setAttribute === 'function') {
        anchor.setAttribute('aria-expanded', 'false');
      }

      if (!result && anchor && typeof anchor.focus === 'function') {
        window.setTimeout(() => {
          try { anchor.focus({ preventScroll: true }); } catch (_) {}
        }, 120);
      }

      resolve(!!result);
    };

    const onCancel = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      finish(false);
    };
    const onConfirm = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      finish(true);
    };
    const onOutside = (event) => {
      const target = event && event.target;
      if (!target) return;
      if (popover.contains(target) || target === anchor) return;
      finish(false);
    };
    const onKeyDown = (event) => {
      if (!event) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key === 'Tab') {
        const focusables = [cancelBtn, confirmBtn];
        const active = document.activeElement;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (active === first || !focusables.includes(active)) {
            event.preventDefault();
            if (last) last.focus({ preventScroll: true });
          }
        } else {
          if (active === last) {
            event.preventDefault();
            if (first) first.focus({ preventScroll: true });
          } else if (!focusables.includes(active)) {
            event.preventDefault();
            if (first) first.focus({ preventScroll: true });
          }
        }
      }
    };

    const reposition = () => {
      if (closed) return;
      if (!anchor || !popover.isConnected) {
        finish(false);
        return;
      }
      if (typeof anchor.getBoundingClientRect !== 'function') {
        finish(false);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        finish(false);
        return;
      }
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const viewportWidth = document.documentElement && document.documentElement.clientWidth
        ? document.documentElement.clientWidth
        : (window.innerWidth || 0);
      const viewportHeight = document.documentElement && document.documentElement.clientHeight
        ? document.documentElement.clientHeight
        : (window.innerHeight || 0);
      const margin = 12;
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;

      let left = scrollX + rect.right - width;
      const minLeft = scrollX + margin;
      const maxLeft = scrollX + Math.max(margin, viewportWidth - margin - width);
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;

      let placement = 'bottom';
      let top = scrollY + rect.bottom + 12;
      const viewportBottom = scrollY + viewportHeight;
      const fitsBelow = top + height <= viewportBottom - margin;
      if (!fitsBelow && rect.top >= height + margin) {
        placement = 'top';
        top = scrollY + rect.top - height - 12;
      } else if (!fitsBelow) {
        top = Math.max(scrollY + margin, viewportBottom - height - margin);
      }
      if (placement === 'bottom') {
        top = Math.max(top, scrollY + rect.bottom + 4);
      } else {
        top = Math.min(top, scrollY + rect.top - 4);
      }

      popover.dataset.placement = placement;
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('touchstart', onOutside, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    discardConfirmActiveClose = finish;

    const runShow = () => {
      if (closed) return;
      reposition();
      if (closed) return;
      popover.style.visibility = '';
      popover.classList.add('is-visible');
      if (anchor && typeof anchor.setAttribute === 'function') {
        anchor.setAttribute('aria-expanded', 'true');
      }
      try { confirmBtn.focus({ preventScroll: true }); } catch (_) {}
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(runShow);
    } else {
      runShow();
    }
  });
}

async function handleComposerDiscard(btn) {
  const target = getActiveComposerFile();
  const label = target === 'tabs' ? 'tabs.yaml' : target === 'site' ? 'site.yaml' : 'index.yaml';
  const diff = composerDiffCache[target];
  const meta = composerDraftMeta[target];
  const hasChanges = !!(diff && diff.hasChanges);
  const hasDraft = !!meta;
  if (!hasChanges && !hasDraft) {
    return;
  }

  const promptMessage = t('editor.composer.discardConfirm.messageReload', { label });
  let proceed = true;
  try {
    proceed = await showComposerDiscardConfirm(btn, promptMessage);
  } catch (err) {
    console.warn('Custom discard prompt failed, falling back to native confirm', err);
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        proceed = window.confirm(promptMessage);
      }
    } catch (_) {
      proceed = true;
    }
  }
  if (!proceed) return;

  const button = btn;
  const resetButton = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    button.textContent = t('editor.composer.discardConfirm.discard');
  };

  try {
    if (button) {
      button.disabled = true;
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.textContent = t('editor.composer.discardConfirm.discarding');
    }

    let prepared = null;
    let fetchedFresh = false;
    try {
      const contentRoot = getContentRootSafe();
      const fileBase = target === 'tabs' ? 'tabs' : target === 'site' ? 'site' : 'index';
      const remote = target === 'site'
        ? await fetchComposerTrackedSiteConfig()
        : await fetchConfigWithYamlFallback([`${contentRoot}/${fileBase}.yaml`, `${contentRoot}/${fileBase}.yml`]);
      if (remote != null) {
        if (target === 'tabs') prepared = prepareTabsState(remote);
        else if (target === 'site') prepared = cloneSiteState(prepareSiteState(remote));
        else prepared = prepareIndexState(remote);
        fetchedFresh = true;
      }
    } catch (err) {
      console.warn('Discard: failed to fetch fresh remote snapshot', err);
    }

    if (!prepared) {
      const baseline = remoteBaseline[target];
      if (target === 'site') prepared = baseline ? cloneSiteState(baseline) : cloneSiteState(prepareSiteState({}));
      else prepared = baseline ? deepClone(baseline) : { __order: [] };
    }

    const normalized = target === 'site' ? cloneSiteState(prepared) : deepClone(prepared);
    remoteBaseline[target] = target === 'site' ? cloneSiteState(prepared) : deepClone(prepared);
    setStateSlice(target, normalized);
    if (target === 'site') applyComposerEffectiveSiteConfig(normalized);

    if (composerAutoSaveTimers[target]) {
      clearTimeout(composerAutoSaveTimers[target]);
      composerAutoSaveTimers[target] = null;
    }

    if (target === 'tabs') rebuildTabsUI();
    else if (target === 'site') rebuildSiteUI();
    else rebuildIndexUI();

    clearDraftStorage(target);

    const msg = fetchedFresh
      ? t('editor.composer.discardConfirm.successFresh', { label })
      : t('editor.composer.discardConfirm.successCached', { label });
    showStatus(msg);
    setTimeout(() => { showStatus(''); }, 2000);
  } catch (err) {
    console.error('Discard failed', err);
    showStatus(t('editor.composer.discardConfirm.failed'));
    setTimeout(() => { showStatus(''); }, 2000);
  } finally {
    resetButton();
  }
}

function getPrimaryEditorApi() {
  try {
    const api = window.__ns_primary_editor;
    return api && typeof api === 'object' ? api : null;
  } catch (_) {
    return null;
  }
}

function restorePrimaryEditorMarkdownView(editorApi) {
  if (!editorApi) return;
  try {
    if (typeof editorApi.restorePersistedView === 'function') {
      editorApi.restorePersistedView();
      return;
    }
    if (typeof editorApi.setView === 'function') editorApi.setView('edit');
  } catch (_) {}
}

function ensurePrimaryEditorListener() {
  if (detachPrimaryEditorListener) return;
  const api = getPrimaryEditorApi();
  if (!api || typeof api.onChange !== 'function') return;
  detachPrimaryEditorListener = api.onChange((value) => {
    if (!activeDynamicMode) return;
    const tab = dynamicEditorTabs.get(activeDynamicMode);
    if (tab) {
      tab.content = value;
      updateDynamicTabDirtyState(tab);
    }
  });
}

function getTabsMetadataForPath(path) {
  const node = getEditorTreeFileNodeByPath(path);
  if (!node || node.source !== 'tabs' || !node.key || !node.lang) return { title: '' };
  const entry = getTabsEntry(node.key);
  const langEntry = entry && entry[node.lang] && typeof entry[node.lang] === 'object'
    ? entry[node.lang]
    : {};
  return { title: String(langEntry.title || '') };
}

function getTabsMetadataForTab(tab) {
  if (tab && tab.tabsKey && tab.tabsLang) {
    const entry = getTabsEntry(tab.tabsKey);
    const langEntry = entry && entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
      ? entry[tab.tabsLang]
      : {};
    return { title: String(langEntry.title || '') };
  }
  return getTabsMetadataForPath(tab && tab.path ? tab.path : '');
}

function updateTabsEntryTitleFromPath(path, metadata) {
  const node = getEditorTreeFileNodeByPath(path);
  if (!node || node.source !== 'tabs' || !node.key || !node.lang) return false;
  const entry = getTabsEntry(node.key);
  entry[node.lang] = entry[node.lang] && typeof entry[node.lang] === 'object'
    ? entry[node.lang]
    : {};
  const nextTitle = metadata && typeof metadata === 'object'
    ? String(metadata.title || '')
    : '';
  if (String(entry[node.lang].title || '') === nextTitle) return false;
  entry[node.lang].title = nextTitle;
  notifyComposerChange('tabs');
  return true;
}

function updateTabsEntryTitleForTab(tab, metadata) {
  if (tab && tab.tabsKey && tab.tabsLang) {
    const entry = getTabsEntry(tab.tabsKey);
    entry[tab.tabsLang] = entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
      ? entry[tab.tabsLang]
      : {};
    const nextTitle = metadata && typeof metadata === 'object'
      ? String(metadata.title || '')
      : '';
    if (String(entry[tab.tabsLang].title || '') === nextTitle) return false;
    entry[tab.tabsLang].title = nextTitle;
    notifyComposerChange('tabs');
    return true;
  }
  return updateTabsEntryTitleFromPath(tab && tab.path ? tab.path : '', metadata);
}

function ensurePrimaryEditorTabsMetadataListener() {
  if (detachPrimaryEditorTabsMetadataListener) return;
  const api = getPrimaryEditorApi();
  if (!api || typeof api.onTabsMetadataChange !== 'function') return;
  detachPrimaryEditorTabsMetadataListener = api.onTabsMetadataChange((metadata) => {
    if (!activeDynamicMode) return;
    const tab = dynamicEditorTabs.get(activeDynamicMode);
    if (tab && tab.source === 'tabs') {
      updateTabsEntryTitleForTab(tab, metadata);
    }
  });
}

function normalizeRelPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/[\\]/g, '/')
    .replace(/^\//, '')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
  const parts = cleaned.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function basenameFromPath(relPath) {
  const norm = normalizeRelPath(relPath);
  if (!norm) return '';
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

function dirnameFromPath(relPath) {
  const norm = normalizeRelPath(relPath);
  if (!norm) return '';
  const idx = norm.lastIndexOf('/');
  if (idx <= 0) return '';
  return norm.slice(0, idx);
}

function findExplicitArticleVersionSegmentIndex(segments) {
  const parts = Array.isArray(segments) ? segments : [];
  if (parts.length < 3) return -1;
  if (String(parts[0] || '').trim().toLowerCase() !== 'post') return -1;
  const candidateIndex = parts.length - 1;
  if (candidateIndex < 2) return -1;
  if (!isComposerVersionSegment(parts[candidateIndex])) return -1;
  return candidateIndex;
}

function extractVersionFromPath(relPath) {
  try {
    const normalized = normalizeRelPath(relPath);
    if (!normalized) return '';
    const segments = normalized.split('/');
    if (segments.length <= 1) return '';
    segments.pop();
    const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
    return versionIndex >= 0 ? String(segments[versionIndex] || '') : '';
  } catch (_) {
    return '';
  }
}

function getContentRootSafe() {
  try {
    const root = window.__ns_content_root;
    if (root && typeof root === 'string' && root.trim()) {
      return root.trim().replace(/[\\]/g, '/').replace(/\/?$/, '');
    }
  } catch (_) {}
  return 'wwwroot';
}

function computeBaseDirForPath(relPath) {
  const root = getContentRootSafe();
  const rel = normalizeRelPath(relPath);
  const idx = rel.lastIndexOf('/');
  const dir = idx >= 0 ? rel.slice(0, idx + 1) : '';
  const base = `${root}/${dir}`.replace(/[\\]/g, '/');
  return base.endsWith('/') ? base : `${base}/`;
}

function encodeGitHubPath(path) {
  const clean = String(path || '')
    .replace(/[\\]/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/?$/, '');
  if (!clean) return '';
  return clean.split('/').map(part => encodeURIComponent(part)).join('/');
}

function isDynamicMode(mode) {
  return !!(mode && dynamicEditorTabs.has(mode));
}

function getFirstDynamicModeId() {
  try {
    const iterator = dynamicEditorTabs.keys();
    const first = iterator.next();
    return first && !first.done ? first.value : null;
  } catch (_) {
    return null;
  }
}

function getActiveDynamicTab() {
  if (activeMarkdownDocument && activeMarkdownDocument.mode === activeDynamicMode) return activeMarkdownDocument;
  if (!activeDynamicMode) return null;
  const tab = dynamicEditorTabs.get(activeDynamicMode);
  return tab || null;
}

function deriveDynamicTabIdentity(path, options = {}) {
  const normalizedPath = normalizeRelPath(path);
  const opts = options && typeof options === 'object' ? options : {};
  const node = opts.node && typeof opts.node === 'object' ? opts.node : null;
  const explicitLookupKey = String(opts.lookupKey || '').trim();
  const lookupKeyParts = explicitLookupKey.startsWith('tabs:') ? explicitLookupKey.split(':') : null;
  const source = String(
    opts.source
    || (node && node.source)
    || (lookupKeyParts && lookupKeyParts.length >= 3 ? 'tabs' : '')
    || inferMarkdownSourceFromPath(normalizedPath)
    || ''
  ).trim().toLowerCase();
  const key = String(
    opts.key
    || (node && node.key)
    || (lookupKeyParts && lookupKeyParts.length >= 3 ? lookupKeyParts.slice(1, -1).join(':') : '')
    || ''
  ).trim();
  const lang = normalizeLangCode(
    opts.lang
    || (node && node.lang)
    || (lookupKeyParts && lookupKeyParts.length >= 3 ? lookupKeyParts[lookupKeyParts.length - 1] : '')
  );
  const editorTreeNodeId = String(opts.editorTreeNodeId || opts.nodeId || (node && node.id) || '').trim();
  const lookupKey = explicitLookupKey || ((source === 'tabs' && key && lang)
    ? `tabs:${key}:${lang}`
    : normalizedPath);
  return {
    path: normalizedPath,
    source,
    key,
    lang,
    editorTreeNodeId,
    lookupKey
  };
}

function getEditorContentPane() {
  try { return document.getElementById('editorContentPane'); }
  catch (_) { return null; }
}

function scrollEditorContentToTop(behavior = 'smooth') {
  const pane = getEditorContentScrollElement(currentMode) || getEditorContentPane();
  if (pane && typeof pane.scrollTo === 'function') {
    try {
      pane.scrollTo({ top: 0, behavior });
      captureEditorContentScroll(currentMode);
      return;
    } catch (_) {
      try {
        pane.scrollTop = 0;
        captureEditorContentScroll(currentMode);
        return;
      } catch (__) {}
    }
  }
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try { window.scrollTo({ top: 0, behavior }); }
    catch (_) { try { window.scrollTo(0, 0); } catch (__) {} }
  }
}

function persistSystemTreeExpandedState() {
  try {
    window.localStorage.setItem(
      LS_KEYS.systemTreeExpanded,
      expandedEditorTreeNodeIds.has('system') ? '1' : '0'
    );
  } catch (_) {}
}

function normalizeEditorScrollTop(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function normalizeEditorScrollMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.entries(value).forEach(([key, top]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    out[normalizedKey] = normalizeEditorScrollTop(top);
  });
  return out;
}

function getEditorRailScrollElement() {
  try { return document.querySelector('.editor-rail-tree-scroll'); }
  catch (_) { return null; }
}

function getEditorRailScrollTop() {
  const rail = getEditorRailScrollElement();
  try { return rail ? normalizeEditorScrollTop(rail.scrollTop || 0) : 0; }
  catch (_) { return 0; }
}

function setEditorRailScrollTop(top) {
  const rail = getEditorRailScrollElement();
  if (!rail) return;
  try { rail.scrollTop = normalizeEditorScrollTop(top); } catch (_) {}
}

function getEditorContentScrollKey(mode = currentMode) {
  if (mode && isDynamicMode(mode)) {
    const tab = dynamicEditorTabs.get(mode);
    const path = tab && tab.path ? normalizeRelPath(tab.path) : '';
    return path ? `markdown:${path}` : 'markdown';
  }
  if (mode === 'composer') return 'composer';
  if (mode === 'updates') return 'updates';
  if (mode === 'sync') return 'sync';
  return 'structure';
}

function getEditorContentScrollElement(mode = currentMode) {
  try {
    if (mode === 'composer') {
      const siteViewport = document.querySelector('#composerSite .cs-viewport');
      if (siteViewport && siteViewport.getClientRects && siteViewport.getClientRects().length) {
        return siteViewport;
      }
    }
  } catch (_) {}
  return getEditorContentPane();
}

function getEditorContentScrollTop(mode = currentMode) {
  const scroller = getEditorContentScrollElement(mode);
  try { return scroller ? normalizeEditorScrollTop(scroller.scrollTop || 0) : 0; }
  catch (_) { return 0; }
}

function setEditorContentScrollTopForMode(mode, top) {
  const scroller = getEditorContentScrollElement(mode);
  if (!scroller) return false;
  try {
    scroller.scrollTop = normalizeEditorScrollTop(top);
    return true;
  } catch (_) {
    return false;
  }
}

function captureEditorContentScroll(mode = currentMode) {
  const key = getEditorContentScrollKey(mode);
  if (!key) return;
  editorContentScrollByKey[key] = getEditorContentScrollTop(mode);
}

function restoreEditorContentScrollForMode(mode = currentMode) {
  const key = getEditorContentScrollKey(mode);
  if (!key || !Object.prototype.hasOwnProperty.call(editorContentScrollByKey, key)) return;
  const top = editorContentScrollByKey[key];
  const apply = () => setEditorContentScrollTopForMode(mode, top);
  try {
    requestAnimationFrame(() => requestAnimationFrame(apply));
  } catch (_) {
    setTimeout(apply, 0);
  }
}

function scheduleEditorStatePersist() {
  if (!allowEditorStatePersist) return;
  try {
    if (editorStatePersistTimer) window.clearTimeout(editorStatePersistTimer);
    editorStatePersistTimer = window.setTimeout(() => {
      editorStatePersistTimer = 0;
      persistDynamicEditorState();
    }, EDITOR_SCROLL_SAVE_DELAY);
  } catch (_) {
    persistDynamicEditorState();
  }
}

function bindEditorStatePersistenceListeners() {
  if (editorStateScrollBound) return;
  editorStateScrollBound = true;
  const onScroll = (event) => {
    const target = event && event.target;
    try {
      if (target === getEditorRailScrollElement()) {
        scheduleEditorStatePersist();
        return;
      }
      if (target === getEditorContentPane() || target === getEditorContentScrollElement(currentMode)) {
        captureEditorContentScroll(currentMode);
        scheduleEditorStatePersist();
      }
    } catch (_) {}
  };
  try { document.addEventListener('scroll', onScroll, true); } catch (_) {}
  try { window.addEventListener('pagehide', () => persistDynamicEditorState()); } catch (_) {}
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistDynamicEditorState();
    });
  } catch (_) {}
}

function mountEditorSystemPanels() {
  const body = document.getElementById('editorSystemBody');
  if (!body || body.__nsSystemPanelsMounted) return;
  body.__nsSystemPanelsMounted = true;
  const composerPanel = document.getElementById('mode-composer');
  const updatesPanel = document.getElementById('mode-updates');
  let syncPanel = document.getElementById('mode-sync');
  if (!syncPanel) {
    syncPanel = document.createElement('div');
    syncPanel.id = 'mode-sync';
    syncPanel.className = 'sync-layout editor-overlay-panel';
    syncPanel.hidden = true;
    syncPanel.setAttribute('aria-hidden', 'true');
  }
  if (composerPanel) body.appendChild(composerPanel);
  if (updatesPanel) body.appendChild(updatesPanel);
  if (syncPanel) body.appendChild(syncPanel);
}

function setEditorSystemPanelVisible(visible) {
  const panel = document.getElementById('editorSystemPanel');
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
  } else {
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-content-entering');
  }
}

function animateEditorSystemPanelContent() {
  const panel = document.getElementById('editorSystemPanel');
  if (!panel) return;
  try {
    const previousTimer = panel.__nsSystemAnimationTimer;
    if (previousTimer) window.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__nsSystemAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__nsSystemAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

function showEditorSystemPanel(mode) {
  const nextMode = mode === 'sync' ? 'sync' : (mode === 'updates' ? 'updates' : 'composer');
  mountEditorSystemPanels();
  const panel = document.getElementById('editorSystemPanel');
  const title = document.getElementById('editorSystemTitle');
  const kicker = document.getElementById('editorSystemKicker');
  const meta = document.getElementById('editorSystemMeta');
  const actions = document.getElementById('editorSystemActions');
  const composerActions = document.getElementById('editorModalComposerActions');
  const updateActions = document.getElementById('editorModalUpdateActions');
  const syncActions = document.getElementById('editorModalSyncActions');
  const composerPanel = document.getElementById('mode-composer');
  const updatesPanel = document.getElementById('mode-updates');
  const syncPanel = document.getElementById('mode-sync');
  if (!panel) return;

  setEditorSystemPanelVisible(true);
  if (kicker) kicker.textContent = treeText('system', 'System');
  if (title) {
    title.textContent = nextMode === 'sync'
      ? treeText('sync', 'Publish')
      : (nextMode === 'updates'
        ? treeText('nanoSiteUpdates', 'NanoSite Updates')
        : treeText('siteSettings', 'Site Settings'));
  }
  if (meta) {
    meta.textContent = nextMode === 'sync'
      ? treeText('syncMeta', 'Publish local changes to GitHub.')
      : (nextMode === 'updates'
        ? treeText('systemUpdatesMeta', 'Review and apply NanoSite updates.')
        : treeText('siteSettingsMeta', 'Edit site.yaml settings.'));
  }

  if (actions) {
    [
      ['composer', composerActions],
      ['updates', updateActions],
      ['sync', syncActions]
    ].forEach(([key, actionSet]) => {
      if (!actionSet) return;
      if (actionSet.parentElement !== actions) actions.appendChild(actionSet);
      const active = key === nextMode;
      actionSet.hidden = !active;
      actionSet.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  [
    ['composer', composerPanel],
    ['updates', updatesPanel],
    ['sync', syncPanel]
  ].forEach(([key, modePanel]) => {
    const active = key === nextMode;
    if (!modePanel) return;
    modePanel.hidden = !active;
    modePanel.setAttribute('aria-hidden', active ? 'false' : 'true');
    modePanel.style.display = active ? '' : 'none';
  });

  if (nextMode === 'composer') {
    try {
      if (getActiveComposerFile() !== 'site') applyComposerFile('site', { force: true, immediate: true });
    } catch (_) {}
    resetSiteSettingsNavOnOpen();
  } else if (nextMode === 'sync') {
    refreshSyncCommitPanel();
  }
  animateEditorSystemPanelContent();
}

function getEditorOverlayTitle(mode) {
  if (mode === 'sync') return treeText('sync', 'Publish');
  if (mode === 'updates') return t('editor.systemUpdates.tabLabel');
  return t('editor.modes.composer');
}

function syncEditorOverlayUi() {
  const layer = document.getElementById('editorModalLayer');
  const dialog = document.querySelector('.editor-modal-dialog');
  const title = document.getElementById('editorModalTitle');
  const modalBody = document.querySelector('.editor-modal-body');
  const hasOverlay = false;

  if (layer) {
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
  }
  if (title) title.textContent = '';
  if (dialog) dialog.removeAttribute('aria-label');
  if (modalBody) {
    modalBody.classList.remove('is-composer-overlay');
    modalBody.classList.remove('is-updates-overlay');
  }

  try {
    document.body.classList.toggle('ns-editor-modal-open', hasOverlay);
  } catch (_) {}
}

function focusEditorOverlay() {
  const dialog = document.querySelector('.editor-modal-dialog');
  if (!dialog) return;
  const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let target = null;
  try {
    target = dialog.querySelector(selector);
  } catch (_) {
    target = null;
  }
  const focusTarget = target || dialog;
  try { focusTarget.focus({ preventScroll: true }); }
  catch (_) { try { focusTarget.focus(); } catch (__) {} }
}

function resetSiteSettingsNavOnOpen() {
  const root = document.getElementById('composerSite');
  if (!root) return;
  try {
    const viewport = root.querySelector('.cs-viewport');
    if (viewport) viewport.scrollTop = 0;
  } catch (_) {}
  try {
    const modalBody = typeof root.closest === 'function' ? root.closest('.editor-modal-body') : null;
    if (modalBody) modalBody.scrollTop = 0;
  } catch (_) {}
  const firstSectionId = (() => {
    try { return String(root.__nsSiteFirstSectionId || '').trim(); }
    catch (_) { return ''; }
  })();
  const setActive = (() => {
    try { return typeof root.__nsSiteNavSetActive === 'function' ? root.__nsSiteNavSetActive : null; }
    catch (_) { return null; }
  })();
  if (!firstSectionId || !setActive) return;
  const activateFirst = () => {
    try {
      setActive(firstSectionId, {
        focusPanel: false,
        scrollViewport: false,
        skipScrollLock: true
      });
    } catch (_) {}
  };
  activateFirst();
  try {
    requestAnimationFrame(() => requestAnimationFrame(activateFirst));
  } catch (_) {
    activateFirst();
  }
}

function openEditorOverlay(mode, trigger = null) {
  const nextMode = mode === 'updates' ? 'updates' : mode === 'composer' ? 'composer' : null;
  if (!nextMode) return;
  editorOverlayReturnFocus = trigger && typeof trigger.focus === 'function' ? trigger : document.activeElement;
  activeEditorOverlayMode = null;
  applyMode(nextMode, { trigger });
}

function closeEditorOverlay() {
  if (!activeEditorOverlayMode) return;
  activeEditorOverlayMode = null;
  syncEditorOverlayUi();
  const restore = editorOverlayReturnFocus;
  editorOverlayReturnFocus = null;
  if (restore && typeof restore.focus === 'function') {
    try { restore.focus({ preventScroll: true }); }
    catch (_) { try { restore.focus(); } catch (__) {} }
  }
}

function initEditorOverlay() {
  const layer = document.getElementById('editorModalLayer');
  if (!layer || layer.__editorOverlayBound) return;
  layer.__editorOverlayBound = true;
  layer.addEventListener('click', (event) => {
    const target = event.target;
    if (target && target.closest && target.closest('[data-editor-modal-close]')) closeEditorOverlay();
  });
  const closeBtn = document.getElementById('editorModalClose');
  if (closeBtn && !closeBtn.__editorOverlayCloseBound) {
    closeBtn.__editorOverlayCloseBound = true;
    closeBtn.addEventListener('click', closeEditorOverlay);
  }
  if (!editorOverlayEscapeBound) {
    editorOverlayEscapeBound = true;
    document.addEventListener('keydown', (event) => {
      if (!activeEditorOverlayMode) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditorOverlay();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector('.editor-modal-dialog');
      if (!dialog) return;
      let focusables = [];
      try {
        focusables = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          .filter((el) => el && el.offsetParent !== null);
      } catch (_) {
        focusables = [];
      }
      if (!focusables.length) {
        event.preventDefault();
        try { dialog.focus({ preventScroll: true }); } catch (_) { try { dialog.focus(); } catch (__) {} }
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        try { last.focus({ preventScroll: true }); } catch (_) { last.focus(); }
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); }
      }
    });
  }
  syncEditorOverlayUi();
}

function computeEditorRailMaxWidth() {
  let viewportLimit = EDITOR_RAIL_MAX_WIDTH;
  try {
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth)) {
      viewportLimit = Math.min(EDITOR_RAIL_MAX_WIDTH, window.innerWidth * 0.46);
    }
  } catch (_) {}
  return Math.max(EDITOR_RAIL_MIN_WIDTH, viewportLimit);
}

function clampEditorRailWidth(value) {
  const numeric = Number(value);
  const fallback = EDITOR_RAIL_DEFAULT_WIDTH;
  const width = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(EDITOR_RAIL_MIN_WIDTH, Math.min(computeEditorRailMaxWidth(), width));
}

function setEditorRailWidth(value, options = {}) {
  const width = clampEditorRailWidth(value);
  try {
    document.documentElement.style.setProperty('--editor-rail-width', `${Math.round(width)}px`);
  } catch (_) {}
  const resizer = document.getElementById('editorRailResizer');
  if (resizer) {
    resizer.setAttribute('aria-valuemin', String(EDITOR_RAIL_MIN_WIDTH));
    resizer.setAttribute('aria-valuemax', String(Math.round(computeEditorRailMaxWidth())));
    resizer.setAttribute('aria-valuenow', String(Math.round(width)));
  }
  if (options.persist) {
    try { window.localStorage.setItem(EDITOR_RAIL_WIDTH_KEY, String(Math.round(width))); } catch (_) {}
  }
  return width;
}

function initEditorRailResize() {
  if (editorRailResizeBound) return;
  const resizer = document.getElementById('editorRailResizer');
  const shell = document.getElementById('editorAppShell');
  if (!resizer || !shell) return;
  editorRailResizeBound = true;

  let stored = EDITOR_RAIL_DEFAULT_WIDTH;
  try {
    const value = window.localStorage.getItem(EDITOR_RAIL_WIDTH_KEY);
    if (value) stored = Number(value);
  } catch (_) {}
  setEditorRailWidth(stored, { persist: false });

  const isMobile = () => {
    try {
      return !!(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);
    } catch (_) {
      return false;
    }
  };

  let dragState = null;
  const finishDrag = () => {
    if (!dragState) return;
    const width = dragState.width;
    dragState = null;
    shell.classList.remove('is-resizing-rail');
    try { document.body.style.removeProperty('cursor'); } catch (_) {}
    setEditorRailWidth(width, { persist: true });
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', finishDrag);
    document.removeEventListener('pointercancel', finishDrag);
  };
  const onMove = (event) => {
    if (!dragState || isMobile()) return;
    const delta = Number(event.clientX) - dragState.startX;
    dragState.width = setEditorRailWidth(dragState.startWidth + delta, { persist: false });
  };

  resizer.addEventListener('pointerdown', (event) => {
    if (isMobile()) return;
    event.preventDefault();
    dragState = {
      startX: Number(event.clientX) || 0,
      startWidth: setEditorRailWidth(resizer.getAttribute('aria-valuenow') || EDITOR_RAIL_DEFAULT_WIDTH, { persist: false }),
      width: EDITOR_RAIL_DEFAULT_WIDTH,
    };
    dragState.width = dragState.startWidth;
    shell.classList.add('is-resizing-rail');
    try { document.body.style.cursor = 'col-resize'; } catch (_) {}
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);
  });

  resizer.addEventListener('keydown', (event) => {
    if (isMobile()) return;
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -16;
    else if (event.key === 'ArrowRight') delta = 16;
    else if (event.key === 'Home') {
      event.preventDefault();
      setEditorRailWidth(EDITOR_RAIL_DEFAULT_WIDTH, { persist: true });
      return;
    } else {
      return;
    }
    event.preventDefault();
    const current = Number(resizer.getAttribute('aria-valuenow')) || EDITOR_RAIL_DEFAULT_WIDTH;
    setEditorRailWidth(current + delta, { persist: true });
  });

  window.addEventListener('resize', () => {
    const current = Number(resizer.getAttribute('aria-valuenow')) || EDITOR_RAIL_DEFAULT_WIDTH;
    setEditorRailWidth(current, { persist: false });
  });
}

function isEditorMobileRailLayout() {
  try {
    return !!(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);
  } catch (_) {
    return false;
  }
}

function setEditorRailOpen(open) {
  const shell = document.getElementById('editorAppShell');
  const toggle = document.getElementById('editorMobileRailToggle');
  const scrim = document.getElementById('editorRailScrim');
  if (!shell) return;
  const shouldOpen = !!open && isEditorMobileRailLayout();
  shell.classList.toggle('is-rail-open', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (scrim) {
    scrim.hidden = !shouldOpen;
    scrim.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  }
}

function closeEditorRailDrawer() {
  setEditorRailOpen(false);
}

function initMobileEditorRail() {
  if (editorMobileRailBound) return;
  const toggle = document.getElementById('editorMobileRailToggle');
  const scrim = document.getElementById('editorRailScrim');
  if (!toggle) return;
  editorMobileRailBound = true;
  toggle.addEventListener('click', () => {
    const shell = document.getElementById('editorAppShell');
    const isOpen = !!(shell && shell.classList.contains('is-rail-open'));
    setEditorRailOpen(!isOpen);
  });
  if (scrim) scrim.addEventListener('click', closeEditorRailDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeEditorRailDrawer();
  });
  window.addEventListener('resize', () => {
    if (!isEditorMobileRailLayout()) closeEditorRailDrawer();
  });
}

function persistDynamicEditorState() {
  if (!allowEditorStatePersist) return;
  try {
    const store = window.localStorage;
    if (!store) return;
    captureEditorContentScroll(currentMode);
    const open = Array.from(dynamicEditorTabs.values())
      .map((tab) => {
        if (!tab || !tab.path) return null;
        return {
          lookupKey: tab.lookupKey || tab.path,
          path: tab.path,
          source: tab.source || '',
          key: tab.tabsKey || '',
          lang: tab.tabsLang || '',
          editorTreeNodeId: tab.editorTreeNodeId || ''
        };
      })
      .filter(Boolean);
    const active = currentMode && isDynamicMode(currentMode) ? dynamicEditorTabs.get(currentMode) : null;
    const systemMode = (currentMode === 'composer' || currentMode === 'updates' || currentMode === 'sync')
      ? currentMode
      : 'structure';
    const state = {
      v: EDITOR_STATE_VERSION,
      mode: active ? 'markdown' : systemMode,
      activeNodeId: activeEditorTreeNodeId || 'articles',
      activeLookupKey: active && (active.lookupKey || active.path) ? (active.lookupKey || active.path) : null,
      activePath: active && active.path ? active.path : null,
      open,
      expandedNodeIds: Array.from(expandedEditorTreeNodeIds).filter(Boolean),
      railScrollTop: getEditorRailScrollTop(),
      contentScrollByKey: { ...editorContentScrollByKey },
      updatedAt: Date.now()
    };
    if (currentMode && isDynamicMode(currentMode)) {
      state.activeLookupKey = active && (active.lookupKey || active.path) ? (active.lookupKey || active.path) : null;
      state.activePath = active && active.path ? active.path : null;
    }
    store.setItem(LS_KEYS.editorState, JSON.stringify(state));
  } catch (_) {}
}

function restoreDynamicEditorState() {
  let raw = null;
  try {
    const store = window.localStorage;
    if (!store) return false;
    raw = store.getItem(LS_KEYS.editorState);
  } catch (_) {
    return false;
  }
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); }
  catch (_) { return false; }
  if (!data || typeof data !== 'object') return false;

  const isV3 = data.v === EDITOR_STATE_VERSION;
  editorContentScrollByKey = normalizeEditorScrollMap(data.contentScrollByKey);

  const open = Array.isArray(data.open) ? data.open : [];
  const seen = new Set();
  open.forEach((item) => {
    const lookupKey = item && typeof item === 'object'
      ? String(item.lookupKey || '').trim()
      : '';
    const path = item && typeof item === 'object'
      ? normalizeRelPath(item.path)
      : normalizeRelPath(item);
    const seenKey = lookupKey || path;
    if (!path || !seenKey || seen.has(seenKey)) return;
    seen.add(seenKey);
    getOrCreateDynamicMode(path, {
      source: item && typeof item === 'object' ? item.source : '',
      key: item && typeof item === 'object' ? item.key : '',
      lang: item && typeof item === 'object' ? item.lang : '',
      editorTreeNodeId: item && typeof item === 'object' ? item.editorTreeNodeId : '',
      lookupKey
    });
  });

  if (isV3 && Array.isArray(data.expandedNodeIds)) {
    expandedEditorTreeNodeIds.clear();
    data.expandedNodeIds.forEach((item) => {
      const id = String(item || '').trim();
      if (id) expandedEditorTreeNodeIds.add(id);
    });
  }

  const restoredNodeId = isV3 ? String(data.activeNodeId || '').trim() : '';
  if (restoredNodeId) {
    activeEditorTreeNodeId = restoredNodeId;
    if (!findEditorContentTreeNode(editorContentTree, activeEditorTreeNodeId)) {
      activeEditorTreeNodeId = 'articles';
    }
    refreshEditorContentTree({ preserveStructure: true });
  }

  const finishRestore = (mode) => {
    try {
      setEditorRailScrollTop(data.railScrollTop || 0);
      restoreEditorContentScrollForMode(mode || currentMode);
      requestAnimationFrame(() => setEditorRailScrollTop(data.railScrollTop || 0));
    } catch (_) {}
    return true;
  };

  const activeLookupKey = String(data.activeLookupKey || '').trim();
  const activePath = data.activePath ? normalizeRelPath(data.activePath) : '';
  if ((isV3 ? data.mode === 'markdown' : true) && (activeLookupKey || activePath)) {
    const modeId = (activeLookupKey && dynamicEditorTabsByLookupKey.get(activeLookupKey))
      || (activePath && dynamicEditorTabsByLookupKey.get(activePath))
      || (activePath ? getOrCreateDynamicMode(activePath) : null);
    if (modeId) {
      applyMode(modeId, { preserveTreeExpansion: true, restoreScroll: true });
      return finishRestore(modeId);
    }
  }

  if (isV3 && data.mode === 'composer') {
    applyMode('composer', { preserveTreeExpansion: true, restoreScroll: true });
    return finishRestore('composer');
  }
  if (isV3 && data.mode === 'updates') {
    applyMode('updates', { preserveTreeExpansion: true, restoreScroll: true });
    return finishRestore('updates');
  }
  if (isV3 && data.mode === 'sync') {
    applyMode('sync', { preserveTreeExpansion: true, restoreScroll: true });
    return finishRestore('sync');
  }

  applyMode('editor', { forceStructure: true, preserveTreeExpansion: true, restoreScroll: true });
  return finishRestore('editor');
}

function setTabLoadingState(tab, isLoading) {
  if (!tab || !tab.button) return;
  try {
    tab.button.classList.toggle('is-busy', !!isLoading);
    if (isLoading) tab.button.setAttribute('data-loading', '1');
    else tab.button.removeAttribute('data-loading');
    tab.button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  } catch (_) {}
}

const TAB_STATE_VALUES = new Set(['checking', 'existing', 'missing', 'error']);

function updateMarkdownPushButton(tab) {
  if (!markdownPushButton) {
    markdownPushButton = document.getElementById('btnPushMarkdown');
  }
  if (!markdownPushButton) return;

  const btn = markdownPushButton;
  const repo = getActiveSiteRepoConfig();
  const hasRepo = !!(repo.owner && repo.name);

  const active = (tab && tab.mode && tab.mode === currentMode) ? tab : getActiveDynamicTab();
  const hasDraftContent = !!(active && active.localDraft && normalizeMarkdownContent(active.localDraft.content || ''));
  const hasDirty = !!(active && active.isDirty);
  const hasLocalChanges = !!(active && active.path && (hasDirty || hasDraftContent));

  if (!hasLocalChanges) {
    try { btn.classList.remove('is-busy'); } catch (_) {}
    btn.hidden = true;
    btn.setAttribute('aria-hidden', 'true');
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('data-state');
    btn.removeAttribute('title');
    return;
  }

  btn.hidden = false;
  btn.removeAttribute('aria-hidden');
  btn.removeAttribute('aria-busy');

  const state = active && active.fileStatus && active.fileStatus.state
    ? String(active.fileStatus.state)
    : '';

  let label = getMarkdownPushLabel('default');
  if (state === 'missing') label = getMarkdownPushLabel('create');
  else if (state) label = getMarkdownPushLabel('update');
  else if (active && active.path) label = getMarkdownPushLabel('update');

  let disabled = false;
  let tooltip = '';

  if (!hasRepo) {
    disabled = true;
    tooltip = getMarkdownPushTooltip('noRepo');
  } else if (!active || !active.path) {
    disabled = true;
    tooltip = getMarkdownPushTooltip('noFile');
  } else if (state === 'error') {
    disabled = true;
    tooltip = getMarkdownPushTooltip('error');
  } else if (!active.loaded) {
    tooltip = active.pending
      ? getMarkdownPushTooltip('checking')
      : getMarkdownPushTooltip('loading');
  } else {
    tooltip = state === 'missing'
      ? getMarkdownPushTooltip('create')
      : getMarkdownPushTooltip('update');
  }

  const busy = btn.classList.contains('is-busy');
  if (busy) disabled = true;

  btn.disabled = disabled;
  btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  if (!busy && label) setButtonLabel(btn, label);
  if (tooltip) btn.title = tooltip;
  else btn.removeAttribute('title');
  btn.setAttribute('aria-label', tooltip || label);

  if (state) btn.setAttribute('data-state', state);
  else btn.removeAttribute('data-state');
}

function updateMarkdownDiscardButton(tab) {
  if (!markdownDiscardButton) {
    markdownDiscardButton = document.getElementById('btnDiscardMarkdown');
  }
  if (!markdownDiscardButton) return;

  const btn = markdownDiscardButton;
  const active = (tab && tab.mode && tab.mode === currentMode) ? tab : getActiveDynamicTab();
  const hasBusy = btn.classList.contains('is-busy');

  const hasDraftContent = !!(active && active.localDraft && normalizeMarkdownContent(active.localDraft.content || ''));
  const dirty = !!(active && active.isDirty);
  const hasLocalChanges = !!(active && active.path && active.mode === currentMode && (dirty || hasDraftContent));

  if (!hasLocalChanges) {
    if (!hasBusy) setButtonLabel(btn, getMarkdownDiscardLabel());
    try { btn.classList.remove('is-busy'); } catch (_) {}
    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('aria-busy');
    const tooltip = active && active.path
      ? t('editor.toasts.noLocalMarkdownChanges')
      : getMarkdownDiscardTooltip('noFile');
    if (tooltip) btn.title = tooltip;
    else btn.removeAttribute('title');
    btn.setAttribute('aria-label', tooltip || getMarkdownDiscardLabel());
    return;
  }

  btn.hidden = false;
  btn.removeAttribute('aria-hidden');
  btn.removeAttribute('aria-busy');

  let disabled = false;
  let tooltip = getMarkdownDiscardTooltip('default');

  if (!active || !active.path) {
    disabled = true;
    tooltip = getMarkdownDiscardTooltip('noFile');
  } else if (!active.loaded && !active.pending) {
    tooltip = getMarkdownDiscardTooltip('reload');
  }

  if (hasBusy) disabled = true;

  btn.disabled = disabled;
  btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  if (!hasBusy) setButtonLabel(btn, getMarkdownDiscardLabel());
  if (tooltip) btn.title = tooltip;
  else btn.removeAttribute('title');
  btn.setAttribute('aria-label', tooltip || getMarkdownDiscardLabel());
}

function updateMarkdownSaveButton(tab) {
  if (!markdownSaveButton) {
    markdownSaveButton = document.getElementById('btnSaveMarkdown');
  }
  if (!markdownSaveButton) return;

  const btn = markdownSaveButton;
  const active = (tab && tab.mode && tab.mode === currentMode) ? tab : getActiveDynamicTab();
  const hasBusy = btn.classList.contains('is-busy');

  const hasActive = !!(active && active.path && active.mode === currentMode);
  const saveState = hasActive
    ? getManualMarkdownSaveState(active.content, active.isDirty)
    : null;

  let disabled = false;
  let tooltip = getMarkdownSaveTooltip('default');

  if (!hasActive) {
    tooltip = getMarkdownSaveTooltip('noFile');
  } else if (!saveState.canSave) {
    tooltip = getMarkdownSaveTooltip(saveState.reason);
  }

  if (hasBusy) disabled = true;

  btn.hidden = false;
  btn.removeAttribute('aria-hidden');
  btn.disabled = disabled;
  btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  if (!hasBusy) setButtonLabel(btn, getMarkdownSaveLabel());
  if (tooltip) btn.title = tooltip;
  else btn.removeAttribute('title');
  btn.setAttribute('aria-label', tooltip || getMarkdownSaveLabel());
}

function manualSaveActiveMarkdown(triggerButton) {
  const active = getActiveDynamicTab();
  if (!active || !active.path) {
    showToast('info', getMarkdownSaveTooltip('noFile'));
    updateMarkdownSaveButton(null);
    return;
  }

  const saveState = getManualMarkdownSaveState(active.content, active.isDirty);
  if (!saveState.canSave) {
    showToast('info', getMarkdownSaveTooltip(saveState.reason));
    updateMarkdownSaveButton(active);
    return;
  }

  const button = triggerButton || markdownSaveButton;
  const originalLabel = button ? (getButtonLabel(button) || getMarkdownSaveLabel()) : '';
  const setBusyState = (busy, text) => {
    if (!button) return;
    if (busy) {
      button.classList.add('is-busy');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-disabled', 'true');
      if (text) setButtonLabel(button, text);
    } else {
      button.classList.remove('is-busy');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-disabled', 'false');
      if (text) setButtonLabel(button, text);
    }
  };

  setBusyState(true, getMarkdownSaveBusyLabel());

  try {
    if (active.markdownDraftTimer) {
      try { clearTimeout(active.markdownDraftTimer); }
      catch (_) {}
      active.markdownDraftTimer = null;
    }

    const saved = saveMarkdownDraftForTab(active, { markManual: true });
    if (saved) {
      pushEditorCurrentFileInfo(active);
      showToast('success', t('editor.composer.markdown.save.toastSuccess'));
    } else {
      showToast('info', getMarkdownSaveTooltip('empty'));
    }
  } catch (err) {
    console.error('Manual markdown save failed', err);
    showToast('error', t('editor.composer.markdown.save.toastError'));
  } finally {
    setBusyState(false, originalLabel || getMarkdownSaveLabel());
    updateMarkdownSaveButton(active);
    updateMarkdownDiscardButton(active);
    updateMarkdownPushButton(active);
    try { updateUnsyncedSummary(); }
    catch (_) {}
  }
}

async function openMarkdownPushOnGitHub(tab) {
  if (!tab || !tab.path) {
    showToast('info', t('editor.toasts.markdownOpenBeforePush'));
    return;
  }

  const { owner, name, branch } = getActiveSiteRepoConfig();
  if (!owner || !name) {
    showToast('info', t('editor.toasts.repoConfigMissing'));
    return;
  }

  const root = getContentRootSafe();
  const rel = normalizeRelPath(tab.path);
  if (!rel) {
    showToast('error', t('editor.toasts.invalidMarkdownPath'));
    return;
  }

  const popup = preparePopupWindow();

  try {
    if (tab.pending) {
      await tab.pending;
    } else if (!tab.loaded) {
      await loadDynamicTabContent(tab);
    }
  } catch (err) {
    closePopupWindow(popup);
    console.error('Failed to prepare markdown before pushing to GitHub', err);
    showToast('error', t('editor.toasts.unableLoadLatestMarkdown'));
    updateMarkdownPushButton(tab);
    return;
  }

  if (!tab.loaded) {
    closePopupWindow(popup);
    showToast('error', t('editor.toasts.markdownNotReady'));
    return;
  }

  const contentPath = `${root}/${rel}`.replace(/[\\]+/g, '/').replace(/^\/+/g, '');
  const encodedContentPath = encodeGitHubPath(contentPath);
  const folder = dirnameFromPath(rel);
  const fullFolder = [root, folder].filter(Boolean).join('/');
  const encodedFolder = encodeGitHubPath(fullFolder);
  const filename = basenameFromPath(rel) || 'main.md';

  const base = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const branchPart = encodeURIComponent(branch);
  const remoteState = tab.fileStatus && tab.fileStatus.state ? String(tab.fileStatus.state) : '';
  const isCreate = remoteState === 'missing';

  let href = '';
  if (isCreate) {
    href = encodedFolder
      ? `${base}/new/${branchPart}/${encodedFolder}?filename=${encodeURIComponent(filename)}`
      : `${base}/new/${branchPart}?filename=${encodeURIComponent(filename)}`;
  } else {
    href = encodedContentPath
      ? `${base}/edit/${branchPart}/${encodedContentPath}`
      : `${base}/edit/${branchPart}`;
  }

  if (!href) {
    closePopupWindow(popup);
    showToast('error', t('editor.toasts.unableResolveGithubFile'));
    return;
  }

  const editorApi = getPrimaryEditorApi();
  if (editorApi && typeof editorApi.getValue === 'function' && currentMode === tab.mode) {
    try { tab.content = String(editorApi.getValue() || ''); }
    catch (_) {}
  }

  try { nsCopyToClipboard(tab.content != null ? String(tab.content) : ''); }
  catch (_) {}

  const expectedSignature = computeTextSignature(tab.content != null ? String(tab.content) : '');
  const successMessage = isCreate
    ? t('editor.composer.markdown.toastCopiedCreate')
    : t('editor.composer.markdown.toastCopiedUpdate');
  const blockedMessage = isCreate
    ? t('editor.composer.markdown.blockedCreate')
    : t('editor.composer.markdown.blockedUpdate');

  const startWatcher = () => {
    startMarkdownSyncWatcher(tab, {
      expectedSignature,
      isCreate,
      label: filename || tab.path || t('editor.composer.markdown.fileFallback')
    });
  };

  const opened = finalizePopupWindow(popup, href);
  if (opened) {
    showToast('info', successMessage);
    startWatcher();
  } else {
    closePopupWindow(popup);
    handlePopupBlocked(href, {
      message: blockedMessage,
      actionLabel: t('editor.toasts.openGithubAction'),
      onRetry: () => {
        showToast('info', successMessage);
        startWatcher();
      }
    });
  }

  updateMarkdownPushButton(tab);
}

async function discardMarkdownLocalChanges(tab, anchor) {
  const active = (tab && tab.path) ? tab : getActiveDynamicTab();
  if (!active || !active.path) {
    showToast('info', t('editor.toasts.markdownOpenBeforeDiscard'));
    updateMarkdownDiscardButton(null);
    updateMarkdownSaveButton(null);
    return;
  }

  flushMarkdownDraft(active);
  const hasDraftContent = !!(active.localDraft && normalizeMarkdownContent(active.localDraft.content || ''));
  const dirty = !!active.isDirty;
  if (!dirty && !hasDraftContent) {
    showToast('info', t('editor.toasts.noLocalMarkdownChanges'));
    updateMarkdownDiscardButton(active);
    updateMarkdownSaveButton(active);
    return;
  }

  const label = active.path || t('editor.composer.markdown.currentFile');
  const trigger = anchor && typeof anchor.closest === 'function' ? anchor.closest('button') : anchor;
  const control = trigger || markdownDiscardButton;
  const promptMessage = t('editor.composer.discardConfirm.messageSimple', { label });

  let proceed = true;
  try {
    proceed = await showComposerDiscardConfirm(control, promptMessage, {
      confirmLabel: t('editor.composer.discardConfirm.discard'),
      cancelLabel: t('editor.composer.dialogs.cancel')
    });
  } catch (err) {
    console.warn('Markdown discard prompt failed, falling back to native confirm', err);
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        proceed = window.confirm(promptMessage);
      }
    } catch (_) {
      proceed = true;
    }
  }
  if (!proceed) return;

  const button = control || markdownDiscardButton;
  const originalLabel = getButtonLabel(button) || getMarkdownDiscardLabel();
  const setBusyState = (busy, text) => {
    if (!button) return;
    if (busy) {
      button.classList.add('is-busy');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-disabled', 'true');
      if (text) setButtonLabel(button, text);
    } else {
      button.classList.remove('is-busy');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-disabled', 'false');
      if (text) setButtonLabel(button, text);
    }
  };

  setBusyState(true, getMarkdownDiscardBusyLabel());

  try {
    if (active.pending) {
      try { await active.pending; }
      catch (_) {}
    } else if (!active.loaded) {
      try { await loadDynamicTabContent(active); }
      catch (err) { console.warn('Discard: failed to refresh markdown before reset', err); }
    }

    try {
      if (active.markdownDraftTimer) {
        clearTimeout(active.markdownDraftTimer);
        active.markdownDraftTimer = null;
      }
    } catch (_) {}

    const baseline = normalizeMarkdownContent(active.remoteContent != null ? active.remoteContent : '');
    active.content = baseline;
    clearMarkdownDraftForTab(active);
    active.isDirty = false;
    active.draftConflict = false;

    const editorApi = getPrimaryEditorApi();
    if (editorApi && currentMode === active.mode) {
      editorApi.setValue(baseline, { notify: true });
      try { editorApi.focus(); } catch (_) {}
    } else {
      updateDynamicTabDirtyState(active, { autoSave: false });
    }

    showToast('success', t('editor.toasts.discardSuccess', { label }));
  } catch (err) {
    console.error('Failed to discard markdown changes', err);
    showToast('error', t('editor.toasts.discardFailed'));
  } finally {
    setBusyState(false, originalLabel || getMarkdownDiscardLabel());
    updateMarkdownDiscardButton(active);
    updateMarkdownPushButton(active);
    updateMarkdownSaveButton(active);
  }
}

function pushEditorCurrentFileInfo(tab) {
  const editorApi = getPrimaryEditorApi();
  if (!editorApi || typeof editorApi.setCurrentFileLabel !== 'function') return;
  const payload = tab
    ? {
        path: tab.path || '',
        source: tab.source || inferMarkdownSourceFromPath(tab.path),
        breadcrumb: buildCurrentFileBreadcrumb(tab),
        status: tab.fileStatus || null,
        dirty: !!tab.isDirty,
        loaded: !!tab.loaded,
        draft: tab.localDraft
          ? {
              savedAt: Number(tab.localDraft.savedAt) || Date.now(),
              conflict: !!tab.draftConflict,
              hasContent: true,
              remoteSignature: tab.localDraft.remoteSignature || ''
            }
          : null
      }
    : { path: '', status: null, dirty: false, draft: null };
  try { editorApi.setCurrentFileLabel(payload); }
  catch (_) {}
  if (typeof editorApi.setTabsMetadata === 'function') {
    try {
      editorApi.setTabsMetadata(tab && tab.source === 'tabs' ? getTabsMetadataForTab(tab) : null, { silent: true });
    } catch (_) {}
  }
  const activeTab = (tab && tab.mode && tab.mode === currentMode) ? tab : getActiveDynamicTab();
  updateMarkdownPushButton(activeTab);
  updateMarkdownDiscardButton(activeTab);
  updateMarkdownSaveButton(activeTab);
}

function setDynamicTabStatus(tab, status) {
  if (!tab) return;
  const next = status && typeof status === 'object' ? { ...status } : {};
  const rawState = String(next.state || '').trim().toLowerCase();
  const state = TAB_STATE_VALUES.has(rawState) ? rawState : '';
  let checkedAt = next.checkedAt;
  if (checkedAt instanceof Date) checkedAt = checkedAt.getTime();
  if (checkedAt != null && !Number.isFinite(checkedAt)) checkedAt = Number(checkedAt);
  if (Number.isFinite(checkedAt)) checkedAt = Math.max(0, Math.floor(checkedAt));
  else checkedAt = null;

  const normalized = {
    state,
    checkedAt,
  };
  if (next.message) normalized.message = String(next.message || '');
  if (next.code != null) normalized.code = Number(next.code);

  tab.fileStatus = normalized;

  const btn = tab.button;
  if (btn) {
    if (state) btn.setAttribute('data-file-state', state);
    else btn.removeAttribute('data-file-state');
    if (checkedAt != null) btn.setAttribute('data-checked-at', String(checkedAt));
    else btn.removeAttribute('data-checked-at');
  }

  if (currentMode === tab.mode) pushEditorCurrentFileInfo(tab);
  refreshEditorContentTree({ preserveStructure: currentMode === tab.mode });
}

async function closeDynamicTab(modeId, options = {}) {
  const tab = dynamicEditorTabs.get(modeId);
  if (!tab) return false;

  const opts = options && typeof options === 'object' ? options : {};
  const hasLocalDraft = !!(tab.localDraft && normalizeMarkdownContent(tab.localDraft.content || ''));
  const hasDirty = !!tab.isDirty;

  const resolveAnchor = (candidate) => {
    if (!candidate) return null;
    if (typeof candidate.getBoundingClientRect === 'function') return candidate;
    if (typeof candidate.closest === 'function') {
      const btnEl = candidate.closest('button');
      if (btnEl && typeof btnEl.getBoundingClientRect === 'function') return btnEl;
    }
    return null;
  };

  let anchorEl = resolveAnchor(opts.anchor);
  if (!anchorEl && tab.button && typeof tab.button.getBoundingClientRect === 'function') {
    anchorEl = tab.button;
  }

  if (!opts.force && (hasDirty || hasLocalDraft)) {
    const ref = tab.path || tab.label || t('editor.composer.discardConfirm.closeTabFallback');
    const promptMessage = t('editor.composer.discardConfirm.closeTabMessage', { label: ref });
    let proceed = true;
    const runNativeConfirm = () => {
      try {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          return window.confirm(promptMessage);
        }
      } catch (_) {
        return true;
      }
      return true;
    };

    if (anchorEl) {
      try {
        proceed = await showComposerDiscardConfirm(anchorEl, promptMessage, {
          confirmLabel: t('editor.composer.discardConfirm.discard'),
          cancelLabel: t('editor.composer.dialogs.cancel')
        });
      } catch (err) {
        console.warn('Markdown tab close prompt failed, falling back to native confirm', err);
        proceed = runNativeConfirm();
      }
    } else {
      proceed = runNativeConfirm();
    }

    if (!proceed) return false;
  }

  clearMarkdownDraftForTab(tab);

  dynamicEditorTabs.delete(modeId);
  if (tab.lookupKey) dynamicEditorTabsByLookupKey.delete(tab.lookupKey);
  try { tab.button?.remove(); } catch (_) {}
  updateDynamicTabsGroupState();

  const wasActive = (currentMode === modeId);
  if (activeDynamicMode === modeId) activeDynamicMode = null;

  if (!dynamicEditorTabs.size && detachPrimaryEditorListener) {
    try { detachPrimaryEditorListener(); } catch (_) {}
    detachPrimaryEditorListener = null;
  }
  if (!dynamicEditorTabs.size && detachPrimaryEditorTabsMetadataListener) {
    try { detachPrimaryEditorTabsMetadataListener(); } catch (_) {}
    detachPrimaryEditorTabsMetadataListener = null;
  }

  if (wasActive) {
    const remainingModes = Array.from(dynamicEditorTabs.keys());
    const fallbackMode = remainingModes.length ? remainingModes[remainingModes.length - 1] : 'editor';
    applyMode(fallbackMode);
  } else {
    persistDynamicEditorState();
  }
  updateMarkdownPushButton(getActiveDynamicTab());
  updateMarkdownDiscardButton(getActiveDynamicTab());
  updateMarkdownSaveButton(getActiveDynamicTab());
  updateComposerMarkdownDraftIndicators({ path: tab.path });
  return true;
}

function getOrCreateDynamicMode(path, options = {}) {
  const identity = deriveDynamicTabIdentity(path, options);
  const normalized = identity.path;
  if (!normalized) return null;
  const existing = dynamicEditorTabsByLookupKey.get(identity.lookupKey);
  if (existing) return existing;

  dynamicTabCounter += 1;
  const modeId = `editor-tab-${dynamicTabCounter}`;
  const label = basenameFromPath(normalized) || normalized;

  const data = {
    mode: modeId,
    path: normalized,
    source: identity.source,
    tabsKey: identity.key || '',
    tabsLang: identity.lang || '',
    editorTreeNodeId: identity.editorTreeNodeId || '',
    lookupKey: identity.lookupKey,
    button: null,
    label,
    baseDir: computeBaseDirForPath(normalized),
    content: '',
    remoteContent: '',
    remoteSignature: '',
    loaded: false,
    pending: null,
    fileStatus: null,
    localDraft: null,
    draftConflict: false,
    markdownDraftTimer: null,
    isDirty: false,
    pendingAssets: ensureMarkdownAssetBucket(normalized)
  };
  restoreMarkdownDraftForTab(data);
  dynamicEditorTabs.set(modeId, data);
  dynamicEditorTabsByLookupKey.set(identity.lookupKey, modeId);

  loadDynamicTabContent(data).catch(() => {});

  persistDynamicEditorState();
  return modeId;
}

async function loadDynamicTabContent(tab) {
  if (!tab) return '';
  if (tab.loaded && typeof tab.content === 'string') return tab.content;
  if (tab.pending) return tab.pending;

  const root = getContentRootSafe();
  const rel = normalizeRelPath(tab.path);
  if (!rel) throw new Error('Invalid markdown path');
  const url = `${root}/${rel}`.replace(/[\\]/g, '/');

  const runner = async () => {
    setDynamicTabStatus(tab, { state: 'checking', checkedAt: Date.now(), message: 'Checking file…' });

    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
      setDynamicTabStatus(tab, {
        state: 'error',
        checkedAt: Date.now(),
        message: err && err.message ? err.message : 'Network error'
      });
      throw err;
    }

    const checkedAt = Date.now();

    if (res.status === 404) {
      tab.remoteContent = '';
      tab.remoteSignature = computeTextSignature('');
      tab.loaded = true;
      if (!tab.localDraft || !tab.localDraft.content) {
        const template = getDefaultMarkdownForPath(rel);
        tab.content = template || '';
      }
      setDynamicTabStatus(tab, {
        state: 'missing',
        checkedAt,
        message: 'File not found on server',
        code: 404
      });
      updateDynamicTabDirtyState(tab, { autoSave: !tab.localDraft });
      return tab.content;
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      setDynamicTabStatus(tab, {
        state: 'error',
        checkedAt,
        message: err.message || `HTTP ${res.status}`,
        code: res.status
      });
      throw err;
    }

    const text = normalizeMarkdownContent(await res.text());
    tab.remoteContent = text;
    tab.remoteSignature = computeTextSignature(text);
    tab.loaded = true;
    if (!tab.localDraft || !tab.localDraft.content) {
      tab.content = text;
    }
    setDynamicTabStatus(tab, {
      state: 'existing',
      checkedAt,
      code: res.status
    });
    updateDynamicTabDirtyState(tab, { autoSave: !tab.localDraft });
    return tab.content;
  };

  tab.pending = runner().finally(() => {
    tab.pending = null;
  });

  return tab.pending;
}

function openMarkdownInEditor(path, options = {}) {
  const active = getActiveDynamicTab();
  if (active && active.path && normalizeRelPath(active.path) !== normalizeRelPath(path)) {
    try { flushMarkdownDraft(active); } catch (_) {}
  }
  const modeId = getOrCreateDynamicMode(path, options);
  if (!modeId) {
    alert('Unable to open editor tab.');
    return;
  }
  applyMode(modeId);
  try { selectEditorTreeNodeByPath(path); } catch (_) {}
}

// Default Markdown template for new post files (index.yaml related flows)
function makeDefaultMdTemplate(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local date
  const lines = [
    '---',
    'title: ',
    `date: ${dateStr}`,
  ];
  if (options.version) lines.push(`version: ${String(options.version)}`);
  lines.push(
    'tags: ',
    'excerpt: ',
    'author: ',
    'ai: false',
    'draft: true',
    '---',
    ''
  );
  return lines.join('\n');
}

function getDefaultMarkdownForPath(relPath) {
  try {
    const normalized = normalizeRelPath(relPath);
    if (!normalized) return '';
    const clean = normalized.replace(/^\/+/, '');
    if (!clean.toLowerCase().startsWith('post/')) return '';
    const version = extractVersionFromPath(clean);
    return makeDefaultMdTemplate(version ? { version } : undefined);
  } catch (_) {
    return '';
  }
}

function applyMode(mode, options = {}) {
  if (mode === 'editor' && dynamicEditorTabs.size && !options.forceStructure) {
    const firstDynamicMode = getFirstDynamicModeId();
    if (firstDynamicMode) {
      applyMode(firstDynamicMode, options);
      return;
    }
  }

  const candidate = mode || 'editor';
  const isSystemMode = (value) => value === 'composer' || value === 'updates' || value === 'sync';
  const systemModeNodeId = (value) => {
    if (value === 'updates') return 'system:updates';
    if (value === 'sync') return 'system:sync';
    return 'system:site-settings';
  };
  const nextMode = (candidate === 'editor' || isSystemMode(candidate) || isDynamicMode(candidate))
    ? candidate
    : 'editor';

  const previousMode = currentMode;
  if (previousMode === nextMode) {
    try {
      const layout = $('#mode-editor');
      if (layout) layout.classList.toggle('is-dynamic', isDynamicMode(nextMode));
    } catch (_) {}
    if (nextMode === 'editor' && options.forceStructure) {
      activeDynamicMode = null;
      activeMarkdownDocument = null;
      setEditorDetailPanelMode('structure');
      pushEditorCurrentFileInfo(null);
      if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    } else if (isSystemMode(nextMode)) {
      activeDynamicMode = null;
      activeMarkdownDocument = null;
      activeEditorTreeNodeId = systemModeNodeId(nextMode);
      if (!options.preserveTreeExpansion) {
        expandEditorAncestors(getEditorTreeNodeById(activeEditorTreeNodeId) || { id: activeEditorTreeNodeId, source: 'system' });
      }
      setEditorDetailPanelMode(nextMode);
      pushEditorCurrentFileInfo(null);
      refreshEditorContentTree({ preserveStructure: true });
      if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    } else if (isDynamicMode(nextMode)) {
      activeDynamicMode = nextMode;
      const tab = dynamicEditorTabs.get(nextMode);
      activeMarkdownDocument = tab || null;
      if (tab) {
        try { selectEditorTreeNodeForTab(tab, { expandAncestors: !options.preserveTreeExpansion }); } catch (_) {}
      }
      setEditorDetailPanelMode('markdown');
      if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    }
    scheduleEditorStatePersist();
    return;
  }

  if (previousMode) captureEditorContentScroll(previousMode);

  const editorApi = getPrimaryEditorApi();
  if (previousMode && isDynamicMode(previousMode) && editorApi && typeof editorApi.getValue === 'function') {
    const prevTab = dynamicEditorTabs.get(previousMode);
    if (prevTab) {
      try {
        prevTab.content = String(editorApi.getValue() || '');
      } catch (_) {}
    }
  }

  currentMode = nextMode;

  const showEditor = nextMode === 'editor' || isSystemMode(nextMode) || isDynamicMode(nextMode);
  try { $('#mode-editor').style.display = showEditor ? '' : 'none'; } catch (_) {}
  try {
    const layout = $('#mode-editor');
    if (layout) layout.classList.toggle('is-dynamic', isDynamicMode(nextMode));
  } catch (_) {}

  const isDynamic = isDynamicMode(nextMode);
  try {
    $$('.mode-tab').forEach((b) => {
      const baseMode = b.dataset ? b.dataset.mode : '';
      if (isSystemMode(baseMode)) {
        b.classList.toggle('is-active', nextMode === baseMode);
        b.setAttribute('aria-selected', nextMode === baseMode ? 'true' : 'false');
        return;
      }
      const targetMode = b.classList.contains('dynamic-mode')
        ? nextMode
        : (isDynamic ? 'editor' : nextMode);
      const isOn = (b.dataset.mode === targetMode);
      b.classList.toggle('is-active', isOn);
      b.setAttribute('aria-selected', isOn ? 'true' : 'false');
    });
  } catch (_) {}

  const scheduleEditorLayoutRefresh = () => {
    if (!editorApi || typeof editorApi.requestLayout !== 'function') return;
    const run = () => {
      if (currentMode !== nextMode) return;
      try { editorApi.requestLayout(); } catch (_) {}
    };
    try { requestAnimationFrame(run); }
    catch (_) { setTimeout(run, 0); }
  };

  if (showEditor) scheduleEditorLayoutRefresh();

  if (isDynamicMode(nextMode)) {
    activeDynamicMode = nextMode;
    ensurePrimaryEditorListener();
    ensurePrimaryEditorTabsMetadataListener();
    const tab = dynamicEditorTabs.get(nextMode);
    activeMarkdownDocument = tab || null;
    setEditorDetailPanelMode('markdown');
    if (tab && editorApi) {
      try { selectEditorTreeNodeForTab(tab, { expandAncestors: !options.preserveTreeExpansion }); } catch (_) {}
      restorePrimaryEditorMarkdownView(editorApi);
      try {
        const baseDir = computeBaseDirForPath(tab.path);
        tab.baseDir = baseDir;
        editorApi.setBaseDir(baseDir);
      } catch (_) {}
      pushEditorCurrentFileInfo(tab);
      animateEditorMarkdownPanelContent();

      const applyContent = (text) => {
        tab.content = String(text || '');
        if (currentMode === nextMode) {
          editorApi.setValue(tab.content, { notify: false });
          scheduleEditorLayoutRefresh();
          try { editorApi.focus(); } catch (_) {}
          if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
          else scrollEditorContentToTop('smooth');
          updateDynamicTabDirtyState(tab, { autoSave: false });
        }
      };

      if (tab.loaded || (tab.localDraft && tab.localDraft.content)) {
        applyContent(tab.content);
      } else {
        setTabLoadingState(tab, true);
        loadDynamicTabContent(tab).then((text) => {
          setTabLoadingState(tab, false);
          if (currentMode !== nextMode) return;
          applyContent(text);
        }).catch((err) => {
          setTabLoadingState(tab, false);
          if (currentMode === nextMode) {
            console.error('Composer editor: failed to load markdown', err);
            const message = (tab.fileStatus && tab.fileStatus.message)
              ? tab.fileStatus.message
              : (err && err.message) ? err.message : 'Unknown error';
            alert(`Failed to load file\n${tab.path}\n${message}`);
          }
        });
      }
    }
  } else if (nextMode === 'editor') {
    activeDynamicMode = null;
    activeMarkdownDocument = null;
    setEditorDetailPanelMode('structure');
    if (editorApi) {
      try { editorApi.setView('edit'); } catch (_) {}
      scheduleEditorLayoutRefresh();
    }
    pushEditorCurrentFileInfo(null);
    if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
  } else if (isSystemMode(nextMode)) {
    activeDynamicMode = null;
    activeMarkdownDocument = null;
    activeEditorTreeNodeId = systemModeNodeId(nextMode);
    if (!options.preserveTreeExpansion) {
      expandEditorAncestors(getEditorTreeNodeById(activeEditorTreeNodeId) || { id: activeEditorTreeNodeId, source: 'system' });
    }
    setEditorDetailPanelMode(nextMode);
    pushEditorCurrentFileInfo(null);
    refreshEditorContentTree({ preserveStructure: true });
    if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    else scrollEditorContentToTop('smooth');
  } else {
    activeDynamicMode = null;
    activeMarkdownDocument = null;
    setEditorDetailPanelMode('structure');
    pushEditorCurrentFileInfo(null);
    if (options.restoreScroll) restoreEditorContentScrollForMode(nextMode);
  }

  try { document.documentElement.removeAttribute('data-init-mode'); } catch (_) {}

  persistDynamicEditorState();
}

function getInitialComposerFile() {
  try {
    const v = (localStorage.getItem(LS_KEYS.cfile) || '').toLowerCase();
    if (v === 'site') return v;
  } catch (_) {}
  return 'site';
}

function cancelComposerViewTransition() {
  if (!composerViewTransition) return;
  const { panels, cleanup } = composerViewTransition;
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (_) {}
  }
  if (panels) {
    panels.classList.remove('is-hidden');
    panels.classList.remove('is-transitioning');
  }
  composerViewTransition = null;
}

function applyComposerFile(name, options = {}) {
  const target = name === 'tabs' ? 'tabs' : (name === 'site' ? 'site' : 'index');
  const force = !!options.force;
  const immediate = !!options.immediate;
  if (!force && activeComposerFile === target) {
    if (immediate) cancelComposerViewTransition();
    return;
  }

  const panels = document.getElementById('composerPanels');
  const reduceMotion = immediate || composerPrefersReducedMotion();

  activeComposerFile = target;

  const updateToggleUi = () => {
    const normalized = getActiveComposerFile();
    try {
      $$('a.vt-btn[data-cfile]').forEach(a => {
        a.classList.toggle('active', a.dataset.cfile === normalized);
      });
    } catch (_) {}
    try {
      const btn = $('#btnAddItem');
      if (btn) {
        if (normalized === 'index') {
          const key = 'editor.composer.addPost';
          btn.hidden = false;
          btn.style.display = '';
          btn.setAttribute('data-i18n', key);
          btn.textContent = t(key);
        } else if (normalized === 'tabs') {
          const key = 'editor.composer.addTab';
          btn.hidden = false;
          btn.style.display = '';
          btn.setAttribute('data-i18n', key);
          btn.textContent = t(key);
        } else {
          btn.hidden = true;
          btn.style.display = 'none';
        }
      }
    } catch (_) {}
  };

  updateToggleUi();

  const applyState = () => {
    const normalized = getActiveComposerFile();
    const showIndex = normalized === 'index';
    const showTabs = normalized === 'tabs';
    const showSite = normalized === 'site';
    try {
      const hostIndex = document.getElementById('composerIndexHost');
      if (hostIndex) hostIndex.style.display = showIndex ? '' : 'none';
    } catch (_) {}
    try {
      const hostTabs = document.getElementById('composerTabsHost');
      if (hostTabs) hostTabs.style.display = showTabs ? '' : 'none';
    } catch (_) {}
    try {
      const hostSite = document.getElementById('composerSiteHost');
      if (hostSite) hostSite.style.display = showSite ? '' : 'none';
    } catch (_) {}
    try { $('#composerIndex').style.display = showIndex ? 'block' : 'none'; } catch (_) {}
    try { $('#composerTabs').style.display = showTabs ? 'block' : 'none'; } catch (_) {}
    try { $('#composerSite').style.display = showSite ? 'block' : 'none'; } catch (_) {}
    // Sync preload attribute to avoid CSS forcing the wrong sub-file
    try {
      if (normalized === 'tabs' || normalized === 'site') document.documentElement.setAttribute('data-init-cfile', normalized);
      else document.documentElement.removeAttribute('data-init-cfile');
    } catch (_) {}

    try {
      if (normalized === 'site') setComposerOrderPreviewActiveKind('index');
      else setComposerOrderPreviewActiveKind(normalized);
    } catch (_) {}
    const summaryOptions = normalized === 'site' ? { immediate: true } : undefined;
    try { updateUnsyncedSummary(summaryOptions); } catch (_) {}
  };

  if (!panels || reduceMotion) {
    cancelComposerViewTransition();
    applyState();
    if (panels) {
      panels.classList.remove('is-hidden');
      panels.classList.remove('is-transitioning');
    }
    return;
  }

  cancelComposerViewTransition();

  const duration = 200;
  const state = { panels };
  composerViewTransition = state;
  let switched = false;
  let finished = false;
  let timerOut = null;
  let timerIn = null;

  const clearTimerOut = () => {
    if (timerOut != null) {
      clearTimeout(timerOut);
      timerOut = null;
    }
  };

  const clearTimerIn = () => {
    if (timerIn != null) {
      clearTimeout(timerIn);
      timerIn = null;
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimerIn();
    panels.classList.remove('is-transitioning');
    panels.classList.remove('is-hidden');
    panels.removeEventListener('transitionend', handleFadeOut);
    panels.removeEventListener('transitionend', handleFadeIn);
    composerViewTransition = null;
  };

  const handleFadeIn = (event) => {
    if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
    clearTimerIn();
    finish();
  };

  const startFadeIn = () => {
    if (switched) return;
    switched = true;
    panels.removeEventListener('transitionend', handleFadeOut);
    clearTimerOut();
    applyState();
    requestAnimationFrame(() => {
      if (finished) return;
      panels.addEventListener('transitionend', handleFadeIn);
      panels.classList.remove('is-hidden');
      timerIn = window.setTimeout(() => handleFadeIn({ target: panels, propertyName: 'opacity' }), duration + 80);
    });
  };

  const handleFadeOut = (event) => {
    if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
    startFadeIn();
  };

  state.cleanup = () => {
    clearTimerOut();
    clearTimerIn();
    panels.removeEventListener('transitionend', handleFadeOut);
    panels.removeEventListener('transitionend', handleFadeIn);
  };

  panels.addEventListener('transitionend', handleFadeOut);
  panels.classList.add('is-transitioning');

  requestAnimationFrame(() => {
    if (finished) return;
    panels.classList.add('is-hidden');
    timerOut = window.setTimeout(() => startFadeIn(), duration + 80);
  });
}

// Apply initial state as early as possible to avoid flash on reload
(() => {
  try { applyMode('editor'); } catch (_) {}
  try { applyComposerFile(getInitialComposerFile(), { immediate: true, force: true }); } catch (_) {}
  try { updateDynamicTabsGroupState(); } catch (_) {}
})();

// Robust clipboard helper available to all composer flows
async function nsCopyToClipboard(text) {
  const val = String(text || '');
  // Prefer async Clipboard API when in a secure context
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Intentionally do not await in callers to better preserve user-activation
      await navigator.clipboard.writeText(val);
      return true;
    }
  } catch (_) { /* fall through to legacy */ }
  // Legacy fallback: temporary textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = val;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    try { document.body.removeChild(ta); } catch (_) {}
    return ok;
  } catch (_) { return false; }
}

// Smooth expand/collapse for details panels
const __activeAnims = new WeakMap();
const SLIDE_OPEN_DUR = 420;   // slower, smoother
const SLIDE_CLOSE_DUR = 360;  // slightly faster than open

function parsePx(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function getSlidePadding(el) {
  const cs = window.getComputedStyle(el);
  return {
    top: parsePx(cs.paddingTop),
    bottom: parsePx(cs.paddingBottom)
  };
}

function clearInlineSlideStyles(el) {
  el.style.overflow = '';
  el.style.height = '';
  el.style.opacity = '';
  el.style.paddingTop = '';
  el.style.paddingBottom = '';
}

function forgetActiveAnim(el, anim) {
  const stored = __activeAnims.get(el);
  if (stored && stored.anim === anim) __activeAnims.delete(el);
}

function finalizeAnimation(el, anim) {
  if (!anim) return;
  try { anim.onfinish = null; } catch (_) {}
  try { anim.oncancel = null; } catch (_) {}
  try { anim.commitStyles(); } catch (_) {}
  try { anim.cancel(); } catch (_) {}
  forgetActiveAnim(el, anim);
}

function slideToggle(el, toOpen) {
  if (!el) return;
  const isReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let computedDisplay = '';
  try { computedDisplay = window.getComputedStyle(el).display; } catch (_) { computedDisplay = el.style.display; }
  const running = __activeAnims.get(el);
  const runningTarget = running && typeof running.target === 'boolean' ? running.target : null;
  const currentState = (runningTarget !== null)
    ? runningTarget
    : (el.dataset.open === '1' ? true : el.dataset.open === '0' ? false : (computedDisplay !== 'none'));
  const open = (typeof toOpen === 'boolean') ? toOpen : !currentState;

  if (runningTarget !== null) {
    if (open === runningTarget) return;
    try { running.anim?.cancel(); } catch (_) {}
    __activeAnims.delete(el);
  } else if (open === currentState) {
    return;
  }

  if (isReduced) {
    el.style.display = open ? 'block' : 'none';
    el.dataset.open = open ? '1' : '0';
    clearInlineSlideStyles(el);
    return;
  }

  if (open) {
    el.dataset.open = '1';
    el.style.display = 'block';
    const pad = getSlidePadding(el);
    const totalEnd = el.scrollHeight;
    const contentTarget = Math.max(0, totalEnd - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.paddingTop = '0px';
      el.style.paddingBottom = '0px';
      el.style.height = '0px';
      el.style.opacity = '0';
      void el.offsetWidth;
      const anim = el.animate([
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
        { height: contentTarget + 'px', opacity: 1, paddingTop: pad.top + 'px', paddingBottom: pad.bottom + 'px' }
      ], { duration: SLIDE_OPEN_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, { target: true, anim });
      anim.onfinish = () => {
        finalizeAnimation(el, anim);
        el.dataset.open = '1';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveAnim(el, anim);
      };
    } catch (_) {
      clearInlineSlideStyles(el);
      el.dataset.open = '1';
    }
  } else {
    el.dataset.open = '0';
    const pad = getSlidePadding(el);
    const totalStart = el.scrollHeight;
    const contentStart = Math.max(0, totalStart - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.display = 'block';
      el.style.paddingTop = pad.top + 'px';
      el.style.paddingBottom = pad.bottom + 'px';
      el.style.height = contentStart + 'px';
      el.style.opacity = '1';
      void el.offsetHeight;
      const anim = el.animate([
        { height: contentStart + 'px', opacity: 1, paddingTop: pad.top + 'px', paddingBottom: pad.bottom + 'px' },
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }
      ], { duration: SLIDE_CLOSE_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, { target: false, anim });
      anim.onfinish = () => {
        finalizeAnimation(el, anim);
        el.style.display = 'none';
        el.dataset.open = '0';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveAnim(el, anim);
      };
    } catch (_) {
      el.style.display = 'none';
      clearInlineSlideStyles(el);
      el.dataset.open = '0';
    }
  }
}

function sortLangKeys(obj) {
  const keys = Object.keys(obj || {});
  return keys.sort((a, b) => {
    const ia = PREFERRED_LANG_ORDER.indexOf(normalizeLangCode(a));
    const ib = PREFERRED_LANG_ORDER.indexOf(normalizeLangCode(b));
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
}

// Localized display names for languages in UI menus
function displayLangName(code) {
  const normalized = normalizeLangCode(code);
  if (!normalized) return '';
  try {
    const label = getLanguageLabel(normalized);
    if (label && String(label).trim()) return String(label).trim();
  } catch (_) {}
  return normalized.toUpperCase();
}

function langFlag(code) {
  const c = normalizeLangCode(code);
  if (c === 'en') return '🇺🇸';
  if (c === 'chs') return '🇨🇳';
  if (c === 'cht-tw') return '🇹🇼';
  if (c === 'cht-hk') return '🇭🇰';
  if (c === 'ja') return '🇯🇵';
  return '';
}

function q(s) {
  // Double-quoted YAML scalar with basic escapes
  const str = String(s ?? '');
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\"/g, '\\"') + '"';
}

function toIndexYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/index.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(key => {
    const entry = data[key];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${key}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (Array.isArray(v)) {
        if (v.length <= 1) {
          const one = v[0] ?? '';
          lines.push(`  ${lang}: ${one ? one : '""'}`);
        } else {
          lines.push(`  ${lang}:`);
          v.forEach(p => lines.push(`    - ${p}`));
        }
      } else if (typeof v === 'string') {
        lines.push(`  ${lang}: ${v}`);
      }
    });
  });
  return lines.join('\n') + '\n';
}

function toTabsYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/tabs.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(tab => {
    const entry = data[tab];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${tab}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (v && typeof v === 'object') {
        const title = v.title ?? '';
        const loc = v.location ?? '';
        lines.push(`  ${lang}:`);
        lines.push(`    title: ${q(title)}`);
        lines.push(`    location: ${loc ? loc : '""'}`);
      }
    });
    lines.push('');
  });
  // Remove extra trailing blank line
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

function makeDragList(container, onReorder) {
  // Pointer-driven drag that moves the original element; siblings animate via FLIP
  const keySelector = '[data-key]';
  const getKey = (el) => el && el.getAttribute && el.getAttribute('data-key');
  const childItems = () => Array.from(container.querySelectorAll(keySelector));

  let dragging = null;
  let placeholder = null;
  let offsetX = 0, offsetY = 0;
  let dragOriginParent = null;
  let dragOriginNext = null;

  // Utility: snapshot and animate siblings (ignore the dragged element)
  const snapshotRects = () => {
    const m = new Map();
    childItems().forEach(el => { m.set(getKey(el), el.getBoundingClientRect()); });
    return m;
  };
  const animateFrom = (prevRects) => {
    childItems().forEach(el => {
      if (el === dragging) return;
      const key = getKey(el);
      const prev = prevRects.get(key);
      if (!prev) return;
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (dx || dy) {
        try {
          el.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ], { duration: 360, easing: 'ease', composite: 'replace' });
        } catch (_) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform 360ms ease';
            el.style.transform = '';
            const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear); };
            el.addEventListener('transitionend', clear);
          });
        }
      }
    });
  };

  const getAfterByY = (c, y) => {
    const els = [...c.querySelectorAll(`${keySelector}:not(.dragging)`)];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return; // left click or touch only
    const target = e.target;
    const handle = target.closest('.ci-grip,.ct-grip');
    if (!handle || !container.contains(handle)) return;
    if (target.closest('button, input, textarea, select, a')) return; // don't start drag from controls
    const li = handle.closest(keySelector);
    if (!li || !container.contains(li)) return;

    e.preventDefault();

    dragging = li;
    cancelListTransition(container);
    container.style.transform = 'none';
    container.style.filter = 'none';
    if (container.style.opacity && container.style.opacity !== '1') container.style.opacity = '';

    const initialRect = li.getBoundingClientRect();
    const styles = window.getComputedStyle(li);

    dragOriginParent = li.parentNode;
    dragOriginNext = li.nextSibling;

    // placeholder keeps layout while dragged element floats
    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = initialRect.height + 'px';
    placeholder.style.margin = styles.margin;
    dragOriginParent.insertBefore(placeholder, dragOriginNext);

    li.dataset.nsDragPrevMargin = styles.margin;
    li.dataset.nsDragPrevTransform = li.style.transform || '';
    li.style.margin = '0';
    li.style.transform = 'none';

    const rect = li.getBoundingClientRect();
    offsetX = e.pageX - (rect.left + window.scrollX);
    offsetY = e.pageY - (rect.top + window.scrollY);

    // elevate original element and follow pointer
    li.style.width = rect.width + 'px';
    li.style.height = rect.height + 'px';
    li.style.position = 'absolute';
    li.style.left = (rect.left + window.scrollX) + 'px';
    li.style.top = (rect.top + window.scrollY) + 'px';
    li.style.zIndex = '2147483646';
    li.style.pointerEvents = 'none';
    li.style.willChange = 'transform, top, left';
    li.classList.add('dragging');
    container.classList.add('is-dragging-list');
    document.body.classList.add('ns-noselect');
    document.body.appendChild(li);

    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    dragging.style.left = (e.pageX - offsetX) + 'px';
    dragging.style.top = (e.pageY - offsetY) + 'px';

    const prev = snapshotRects();
    const after = getAfterByY(container, e.clientY);
    if (after == null) container.appendChild(placeholder);
    else container.insertBefore(placeholder, after);
    animateFrom(prev);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    // current visual position of the fixed element (origin)
    const origin = dragging.getBoundingClientRect();
    // target position equals the placeholder's rect
    const target = placeholder.getBoundingClientRect();
    const dx = origin.left - target.left;
    const dy = origin.top - target.top;

    // place the element where the placeholder sits in DOM order
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(dragging, placeholder);
      placeholder.remove();
    }
    placeholder = null;
    dragOriginParent = null;
    dragOriginNext = null;

    // reset positioning to re-enter normal flow
    dragging.style.position = '';
    dragging.style.left = '';
    dragging.style.top = '';
    dragging.style.width = '';
    dragging.style.height = '';
    dragging.style.zIndex = '';
    dragging.style.pointerEvents = '';
    dragging.style.willChange = '';
    dragging.style.margin = dragging.dataset.nsDragPrevMargin || '';
    dragging.style.transform = dragging.dataset.nsDragPrevTransform || '';
    delete dragging.dataset.nsDragPrevMargin;
    delete dragging.dataset.nsDragPrevTransform;
    dragging.classList.remove('dragging');

    // animate the snap from origin -> target (FLIP on the dragged element)
    try {
      dragging.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: 360, easing: 'ease' });
    } catch (_) {
      // Fallback: CSS transition
      dragging.style.transition = 'none';
      dragging.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        dragging.style.transition = 'transform 360ms ease';
        dragging.style.transform = '';
        const clear = () => { dragging.style.transition = ''; dragging.removeEventListener('transitionend', clear); };
        dragging.addEventListener('transitionend', clear);
      });
    }

    container.classList.remove('is-dragging-list');
    document.body.classList.remove('ns-noselect');
    window.removeEventListener('pointermove', onPointerMove);

    const order = childItems().map(el => el.dataset.key);
    if (onReorder) onReorder(order);
    dragging = null;
  };

  // Disable native HTML5 DnD on this container
  container.addEventListener('dragstart', (e) => e.preventDefault());
  container.addEventListener('pointerdown', onPointerDown);
}

function treeText(key, fallback, params) {
  const fullKey = `editor.tree.${key}`;
  const value = t(fullKey, params);
  return value && value !== fullKey ? value : fallback;
}

function setEditorStructurePanelVisible(visible) {
  const panel = document.getElementById('editorStructurePanel');
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
  } else {
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function setEditorMarkdownPanelVisible(visible) {
  const panel = document.getElementById('editorMarkdownPanel');
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
  } else {
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-content-entering');
  }
}

function setEditorDetailPanelMode(mode) {
  const showMarkdown = mode === 'markdown';
  const showStructure = mode === 'structure';
  const showSystem = mode === 'composer' || mode === 'updates' || mode === 'sync';
  setEditorStructurePanelVisible(showStructure);
  setEditorMarkdownPanelVisible(showMarkdown);
  setEditorSystemPanelVisible(showSystem);
  if (showSystem) showEditorSystemPanel(mode);
}

function animateEditorStructurePanelContent(panel) {
  if (!panel) return;
  try {
    const previousTimer = panel.__nsStructureAnimationTimer;
    if (previousTimer) window.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__nsStructureAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__nsStructureAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

function animateEditorMarkdownPanelContent() {
  const panel = document.getElementById('editorMarkdownPanel');
  if (!panel) return;
  try {
    const previousTimer = panel.__nsMarkdownAnimationTimer;
    if (previousTimer) window.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__nsMarkdownAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__nsMarkdownAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

function collectEditorDraftStatusMap() {
  const map = new Map();
  try {
    const store = readMarkdownDraftStore();
    Object.keys(store || {}).forEach((key) => {
      const path = normalizeRelPath(key);
      if (path && store[key] && store[key].content) map.set(path, 'saved');
    });
  } catch (_) {}
  try {
    collectDynamicMarkdownDraftStates().forEach((value, key) => {
      if (key && value) map.set(key, value);
    });
  } catch (_) {}
  return map;
}

function collectEditorFileStatusMap() {
  const map = new Map();
  try {
    dynamicEditorTabs.forEach((tab) => {
      if (!tab || !tab.path || !tab.fileStatus) return;
      const state = tab.fileStatus.state || '';
      if (state) map.set(normalizeRelPath(tab.path), state);
    });
  } catch (_) {}
  return map;
}

function collectEditorDiffStatusMap() {
  const map = new Map();
  const add = (id, value) => {
    if (id && value) map.set(id, value);
  };
  const applyDiff = (source, diff) => {
    if (!diff) return;
    (diff.addedKeys || []).forEach(key => add(`${source}:${key}`, 'added'));
    (diff.removedKeys || []).forEach(key => add(`${source}:${key}`, 'removed'));
    Object.keys(diff.keys || {}).forEach((key) => {
      const info = diff.keys[key] || {};
      add(`${source}:${key}`, info.state || 'modified');
      Object.keys(info.langs || {}).forEach((lang) => {
        const detail = info.langs[lang] || {};
        add(`${source}:${key}:${lang}`, detail.state || 'modified');
      });
    });
  };
  applyDiff('index', composerDiffCache.index);
  applyDiff('tabs', composerDiffCache.tabs);
  try {
    const siteDiff = composerDiffCache.site || recomputeDiff('site');
    if (siteDiff && siteDiff.hasChanges) add('system:site-settings', 'modified');
    else if (composerDraftMeta && composerDraftMeta.site) add('system:site-settings', 'saved');
  } catch (_) {
    try {
      if (composerDraftMeta && composerDraftMeta.site) add('system:site-settings', 'saved');
    } catch (__) {}
  }
  try {
    if (getSystemUpdateSummaryEntries().length) add('system:updates', 'modified');
  } catch (_) {}
  return map;
}

function buildCurrentEditorTree() {
  return buildEditorContentTree({
    index: getStateSlice('index') || { __order: [] },
    tabs: getStateSlice('tabs') || { __order: [] }
  }, {
    preferredLangs: PREFERRED_LANG_ORDER,
    systemLabel: treeText('system', 'System'),
    siteSettingsLabel: treeText('siteSettings', 'Site Settings'),
    updatesLabel: treeText('nanoSiteUpdates', 'NanoSite Updates'),
    syncLabel: treeText('sync', 'Publish'),
    articlesLabel: treeText('articles', 'Articles'),
    pagesLabel: treeText('pages', 'Pages'),
    draftStates: collectEditorDraftStatusMap(),
    diffStates: collectEditorDiffStatusMap(),
    fileStates: collectEditorFileStatusMap(),
    indexDiff: composerDiffCache.index || null,
    tabsDiff: composerDiffCache.tabs || null,
    indexBaseline: remoteBaseline.index || null,
    tabsBaseline: remoteBaseline.tabs || null
  });
}

function getActiveEditorTreeNode() {
  return findEditorContentTreeNode(editorContentTree, activeEditorTreeNodeId)
    || findEditorContentTreeNode(editorContentTree, 'articles')
    || (editorContentTree[0] || null);
}

function inferMarkdownSourceFromPath(path) {
  const normalized = normalizeRelPath(path);
  if (!normalized) return '';
  try {
    const node = flattenEditorContentTree(editorContentTree)
      .find(item => item && item.kind === 'file' && item.path === normalized);
    if (node && node.source) return String(node.source);
  } catch (_) {}
  return normalized.toLowerCase().startsWith('tab/') ? 'tabs' : 'index';
}

function getEditorTreeNodeById(nodeId) {
  return findEditorContentTreeNode(editorContentTree, nodeId);
}

function getEditorTreeFileNodeByPath(path) {
  const normalized = normalizeRelPath(path);
  if (!normalized) return null;
  return flattenEditorContentTree(editorContentTree)
    .find(item => item && item.kind === 'file' && item.path === normalized) || null;
}

function getEditorTreeFileNodeForTab(tab) {
  if (tab && tab.editorTreeNodeId) {
    const byId = getEditorTreeNodeById(tab.editorTreeNodeId);
    if (byId && byId.kind === 'file') return byId;
  }
  if (tab && tab.tabsKey && tab.tabsLang) {
    const byIdentity = getEditorTreeNodeById(`tabs:${tab.tabsKey}:${tab.tabsLang}`);
    if (byIdentity && byIdentity.kind === 'file') return byIdentity;
  }
  return getEditorTreeFileNodeByPath(tab && tab.path ? tab.path : '');
}

function buildCurrentFileBreadcrumb(tab) {
  if (!tab || !tab.path) return [];
  const normalizedPath = normalizeRelPath(tab.path);
  const node = getEditorTreeFileNodeForTab(tab);
  if (!node) return normalizedPath ? [{ label: normalizedPath, path: normalizedPath }] : [];
  const ids = [];
  if (node.source === 'tabs') {
    ids.push('pages', `tabs:${node.key}`, node.id);
  } else {
    ids.push('articles', `index:${node.key}`, `index:${node.key}:${node.lang}`, node.id);
  }
  return ids
    .map((id) => {
      const crumbNode = getEditorTreeNodeById(id);
      if (!crumbNode) return null;
      return {
        label: crumbNode.label || crumbNode.key || crumbNode.id,
        nodeId: crumbNode.id,
        path: crumbNode.path || ''
      };
    })
    .filter(item => item && item.label);
}

function expandEditorAncestors(node) {
  if (!node) return;
  if (node.source === 'system' || node.id === 'system') {
    expandedEditorTreeNodeIds.add('system');
    persistSystemTreeExpandedState();
    return;
  }
  if (node.id === 'articles' || node.id === 'pages') {
    expandedEditorTreeNodeIds.add(node.id);
    return;
  }
  const parts = String(node.id || '').split(':');
  const root = parts[0] === 'tabs' ? 'pages' : 'articles';
  expandedEditorTreeNodeIds.add(root);
  if (parts.length >= 2) expandedEditorTreeNodeIds.add(`${parts[0]}:${parts[1]}`);
  if (parts.length >= 3 && parts[0] === 'index') expandedEditorTreeNodeIds.add(`${parts[0]}:${parts[1]}:${parts[2]}`);
}

function selectEditorTreeNodeByPath(path, options = {}) {
  const normalized = normalizeRelPath(path);
  if (!normalized) return null;
  const node = flattenEditorContentTree(editorContentTree).find(item => item && item.path === normalized);
  if (!node) return null;
  activeEditorTreeNodeId = node.id;
  if (!options || options.expandAncestors !== false) expandEditorAncestors(node);
  refreshEditorContentTree({ preserveStructure: currentMode && isDynamicMode(currentMode) });
  return node;
}

function selectEditorTreeNodeForTab(tab, options = {}) {
  const node = getEditorTreeFileNodeForTab(tab);
  if (node && node.id) {
    activeEditorTreeNodeId = node.id;
    if (!options || options.expandAncestors !== false) expandEditorAncestors(node);
    refreshEditorContentTree({ preserveStructure: currentMode && isDynamicMode(currentMode) });
    return node;
  }
  return selectEditorTreeNodeByPath(tab && tab.path ? tab.path : '', options);
}

function refreshEditorContentTree(options = {}) {
  const treeEl = document.getElementById('editorFileTree');
  if (!treeEl) return;
  const preserveStructure = !!options.preserveStructure
    || !!(currentMode && (isDynamicMode(currentMode) || currentMode === 'composer' || currentMode === 'updates' || currentMode === 'sync'));
  editorContentTree = buildCurrentEditorTree();
  if (!findEditorContentTreeNode(editorContentTree, activeEditorTreeNodeId)) activeEditorTreeNodeId = 'articles';
  renderEditorFileTree(treeEl);
  if (preserveStructure) {
    if (currentMode && isDynamicMode(currentMode)) setEditorDetailPanelMode('markdown');
    return;
  }
  renderEditorStructurePanel(getActiveEditorTreeNode());
}

function isEditorTreeFileKind(kind) {
  return kind === 'file' || kind === 'deleted-file';
}

function createEditorTreeIcon(node) {
  if (!node || node.kind === 'root') return null;
  const icon = document.createElement('span');
  const isFile = isEditorTreeFileKind(node.kind);
  let iconKind = isFile ? 'document' : 'folder';
  let iconSvg = '';
  if (node.id === 'system:site-settings') {
    iconKind = 'settings';
    iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  } else if (node.id === 'system:updates') {
    iconKind = 'updates';
    iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>';
  } else if (node.id === 'system:sync') {
    iconKind = 'publish';
    iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 13v8"></path><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="m8 17 4-4 4 4"></path></svg>';
  }
  icon.className = `editor-tree-icon editor-tree-icon-${iconKind}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconSvg || (isFile
    ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 3.75h7.25L18 7.5v12.75H7z"></path><path d="M14.25 3.75V7.5H18"></path><path d="M9.75 12h5.5M9.75 15h5.5"></path></svg>'
    : '<svg viewBox="0 0 24 24" focusable="false"><path d="M3.75 6.75h5.5l1.7 2h9.3v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2z"></path><path d="M3.75 8.75h16.5"></path></svg>');
  return icon;
}

function getEditorTreeChangeLabel(state) {
  if (state === 'issue') return treeText('status.issue', 'Issue');
  if (state === 'added') return treeText('status.added', 'Added');
  if (state === 'deleted') return treeText('status.deleted', 'Deleted');
  return treeText('status.modified', 'Modified');
}

function getEditorTreeIssueState(node) {
  if (!node) return '';
  if (node.draftState === 'conflict' || node.fileState === 'error' || node.diffState === 'error') return 'issue';
  return '';
}

function getEditorTreeCountTone(counts) {
  const safeCounts = counts || {};
  if (safeCounts.deleted) return 'deleted';
  if (safeCounts.added && !safeCounts.modified) return 'added';
  return 'modified';
}

function getEditorTreeChangedSummary(counts) {
  const safeCounts = counts || {};
  const parts = [];
  if (safeCounts.added) parts.push(`${safeCounts.added} ${treeText('status.added', 'added').toLowerCase()}`);
  if (safeCounts.modified) parts.push(`${safeCounts.modified} ${treeText('status.modified', 'modified').toLowerCase()}`);
  if (safeCounts.deleted) parts.push(`${safeCounts.deleted} ${treeText('status.deleted', 'deleted').toLowerCase()}`);
  const fallback = parts.length
    ? `${safeCounts.total} changed: ${parts.join(', ')}`
    : `${safeCounts.total || 0} changed`;
  return treeText('status.changedSummary', fallback, {
    total: safeCounts.total || 0,
    added: safeCounts.added || 0,
    modified: safeCounts.modified || 0,
    deleted: safeCounts.deleted || 0
  });
}

function getEditorTreeStatusSummaries(node) {
  if (!node) return [];
  const summaries = [];
  const counts = node.changeCounts || {};
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const issueState = getEditorTreeIssueState(node);
  const directBadge = (!hasChildren || node.kind === 'system') && node.changeState;
  if (issueState) {
    summaries.push(getEditorTreeChangeLabel(issueState));
  } else if (directBadge) {
    summaries.push(getEditorTreeChangeLabel(node.changeState));
  } else if (counts.total > 0) {
    summaries.push(getEditorTreeChangedSummary(counts));
  } else if (node.isDeleted) {
    summaries.push(treeText('status.deletedSummary', 'Deleted item'));
  }
  if (node.orderChanged) summaries.push(treeText('status.orderChanged', 'Order changed'));
  if (node.checkingCount > 0) {
    const checking = treeText('status.checking', 'Checking');
    summaries.push(node.checkingCount > 1 ? `${checking} (${node.checkingCount})` : checking);
  }
  return summaries;
}

function getEditorTreeAccessibleLabel(node, labelText, accessiblePath) {
  const base = accessiblePath ? `${labelText} - ${accessiblePath}` : labelText;
  const summaries = getEditorTreeStatusSummaries(node);
  return summaries.length ? `${base} - ${summaries.join(', ')}` : base;
}

function createEditorTreeStatusElement(node) {
  const status = document.createElement('span');
  status.className = 'editor-tree-status';
  status.setAttribute('aria-hidden', 'true');
  const counts = node && node.changeCounts ? node.changeCounts : {};
  const hasChildren = !!(node && Array.isArray(node.children) && node.children.length);
  const issueState = getEditorTreeIssueState(node);
  const directBadge = node && (!hasChildren || node.kind === 'system') && node.changeState;
  if (issueState) {
    const badge = document.createElement('span');
    badge.className = 'editor-tree-change-badge';
    badge.dataset.state = issueState;
    badge.textContent = getEditorTreeChangeLabel(issueState);
    status.appendChild(badge);
  } else if (directBadge) {
    const badge = document.createElement('span');
    badge.className = 'editor-tree-change-badge';
    badge.dataset.state = node.changeState;
    badge.textContent = getEditorTreeChangeLabel(node.changeState);
    status.appendChild(badge);
  } else if (counts.total > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'editor-tree-count-badge';
    countBadge.dataset.state = getEditorTreeCountTone(counts);
    countBadge.textContent = String(counts.total);
    status.appendChild(countBadge);
  }
  if (node && node.orderChanged) {
    const orderBadge = document.createElement('span');
    orderBadge.className = 'editor-tree-order-badge';
    orderBadge.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 9l4 -4l4 4m-4 -4v14"></path><path d="M21 15l-4 4l-4 -4m4 4v-14"></path></svg>';
    status.appendChild(orderBadge);
  }
  if (node && node.checkingCount > 0) {
    const spinner = document.createElement('span');
    spinner.className = 'editor-tree-spinner';
    spinner.dataset.count = String(node.checkingCount);
    status.appendChild(spinner);
  }
  if (!status.childElementCount) status.hidden = true;
  return status;
}

function getEditorTreeRowDepth(row) {
  const raw = row && row.dataset ? Number(row.dataset.depth) : 0;
  return Number.isFinite(raw) ? raw : 0;
}

function collectEditorTreeDescendantRows(row) {
  const rows = [];
  const depth = getEditorTreeRowDepth(row);
  let next = row && row.nextElementSibling ? row.nextElementSibling : null;
  while (next) {
    const nextDepth = getEditorTreeRowDepth(next);
    if (nextDepth <= depth) break;
    rows.push(next);
    next = next.nextElementSibling;
  }
  return rows;
}

function animateEditorTreeCollapse(root, node, row) {
  if (!root || !node || !row || !expandedEditorTreeNodeIds.has(node.id)) return false;
  if (collapsingEditorTreeNodeIds.has(node.id)) return true;
  const descendants = collectEditorTreeDescendantRows(row);
  if (!descendants.length) return false;
  collapsingEditorTreeNodeIds.add(node.id);
  row.classList.add('is-collapsing-parent');
  descendants.forEach((descendant) => {
    const height = (() => {
      try {
        const rect = descendant.getBoundingClientRect();
        if (rect && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
      } catch (_) {}
      return descendant.offsetHeight || 28;
    })();
    descendant.classList.add('is-collapsing');
    descendant.style.minHeight = `${height}px`;
    descendant.style.maxHeight = `${height}px`;
    descendant.style.opacity = '1';
    descendant.style.transform = 'translateY(0)';
  });
  try { root.getBoundingClientRect(); } catch (_) {}
  const collapseRows = () => {
    descendants.forEach((descendant) => {
      descendant.style.minHeight = '0px';
      descendant.style.maxHeight = '0px';
      descendant.style.opacity = '0';
      descendant.style.transform = 'translateY(-4px)';
    });
  };
  try {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(collapseRows);
    } else {
      window.setTimeout(collapseRows, 0);
    }
  } catch (_) {
    collapseRows();
  }
  const finish = () => {
    if (!collapsingEditorTreeNodeIds.has(node.id)) return;
    collapsingEditorTreeNodeIds.delete(node.id);
    expandedEditorTreeNodeIds.delete(node.id);
    if (node.id === 'system') persistSystemTreeExpandedState();
    refreshEditorContentTree({ preserveStructure: true });
    scheduleEditorStatePersist();
  };
  try { window.setTimeout(finish, 340); }
  catch (_) { finish(); }
  return true;
}

function renderEditorFileTree(root) {
  root.innerHTML = '';
  const selectedId = activeEditorTreeNodeId;
  const expandingNodeId = expandingEditorTreeNodeId;
  const renderNode = (node, depth, ancestorIds = []) => {
    if (!node) return;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const row = document.createElement('div');
    row.className = 'editor-tree-row';
    row.dataset.nodeId = node.id;
    row.dataset.kind = node.kind || '';
    row.dataset.source = node.source || '';
    row.dataset.depth = String(Math.max(0, depth));
    if (node.isDeleted) row.dataset.deleted = '1';
    row.classList.toggle('is-leaf', !hasChildren);
    const rowIndent = hasChildren
      ? Math.max(0, depth) * 1.12
      : Math.max(0, depth - 1) * 1.12 + 1.35;
    row.style.paddingLeft = `${rowIndent}rem`;
    row.classList.toggle('is-selected', node.id === selectedId);
    if (expandingNodeId && ancestorIds.includes(expandingNodeId)) {
      row.classList.add('is-expanding');
    }

    if (depth > 0) {
      const guides = document.createElement('span');
      guides.className = 'editor-tree-guides';
      guides.setAttribute('aria-hidden', 'true');
      for (let guideIndex = 0; guideIndex < depth; guideIndex += 1) {
        const guide = document.createElement('span');
        guide.className = 'editor-tree-guide';
        guide.style.setProperty('--tree-guide-index', String(guideIndex));
        guides.appendChild(guide);
      }
      row.appendChild(guides);
    }

    let toggle = null;
    if (hasChildren) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'editor-tree-toggle';
      toggle.tabIndex = 0;
      toggle.setAttribute('aria-label', treeText('toggle', 'Toggle'));
      toggle.setAttribute('aria-expanded', expandedEditorTreeNodeIds.has(node.id) ? 'true' : 'false');
      const caret = document.createElement('span');
      caret.className = 'editor-tree-caret';
      caret.setAttribute('aria-hidden', 'true');
      toggle.appendChild(caret);
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (expandedEditorTreeNodeIds.has(node.id)) {
          if (animateEditorTreeCollapse(root, node, row)) return;
          expandedEditorTreeNodeIds.delete(node.id);
        } else {
          expandingEditorTreeNodeId = node.id;
          expandedEditorTreeNodeIds.add(node.id);
        }
        if (node.id === 'system') persistSystemTreeExpandedState();
        refreshEditorContentTree({ preserveStructure: true });
        scheduleEditorStatePersist();
      });
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-tree-node';
    button.setAttribute('role', 'treeitem');
    button.setAttribute('aria-selected', node.id === selectedId ? 'true' : 'false');
    button.dataset.nodeId = node.id;
    const labelText = node.label || node.id;
    const accessiblePath = node.path || '';
    button.setAttribute('aria-label', getEditorTreeAccessibleLabel(node, labelText, accessiblePath));
    const icon = createEditorTreeIcon(node);
    if (icon) button.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'editor-tree-label';
    label.textContent = labelText;
    button.appendChild(label);
    button.addEventListener('click', () => handleEditorTreeSelection(node.id));
    button.appendChild(createEditorTreeStatusElement(node));
    if (toggle) row.appendChild(toggle);
    row.appendChild(button);
    root.appendChild(row);

    if (hasChildren && expandedEditorTreeNodeIds.has(node.id)) {
      const childAncestors = ancestorIds.concat(node.id);
      node.children.forEach(child => renderNode(child, depth + 1, childAncestors));
    }
  };
  editorContentTree.forEach(node => renderNode(node, 0));
  if (expandingNodeId) {
    const clearExpandingRows = () => {
      try {
        root.querySelectorAll('.editor-tree-row.is-expanding').forEach(row => {
          row.classList.remove('is-expanding');
        });
      } catch (_) {}
    };
    try { window.setTimeout(clearExpandingRows, 220); }
    catch (_) { clearExpandingRows(); }
  }
  expandingEditorTreeNodeId = null;
}

function handleEditorTreeSelection(nodeId) {
  const node = findEditorContentTreeNode(editorContentTree, nodeId);
  if (!node) return;
  activeEditorTreeNodeId = node.id;
  expandEditorAncestors(node);
  if (node.source === 'system') {
    refreshEditorContentTree({ preserveStructure: true });
    if (node.id === 'system:site-settings') {
      applyMode('composer');
    } else if (node.id === 'system:updates') {
      applyMode('updates');
    } else if (node.id === 'system:sync') {
      applyMode('sync');
    } else {
      applyMode('editor', { forceStructure: true });
      setEditorStructurePanelVisible(true);
      refreshEditorContentTree();
    }
    scrollEditorContentToTop('smooth');
    closeEditorRailDrawer();
    scheduleEditorStatePersist();
    return;
  }
  if (node.isDeleted) {
    applyMode('editor', { forceStructure: true });
    setEditorStructurePanelVisible(true);
    refreshEditorContentTree();
    scrollEditorContentToTop('smooth');
    closeEditorRailDrawer();
    scheduleEditorStatePersist();
    return;
  }
  if (node.kind === 'file' && node.path) {
    refreshEditorContentTree({ preserveStructure: true });
    openMarkdownInEditor(node.path, { node });
    closeEditorRailDrawer();
    scheduleEditorStatePersist();
    return;
  }
  applyMode('editor', { forceStructure: true });
  setEditorStructurePanelVisible(true);
  refreshEditorContentTree();
  scrollEditorContentToTop('smooth');
  closeEditorRailDrawer();
  scheduleEditorStatePersist();
}

try {
  document.addEventListener('ns-editor-current-file-breadcrumb-select', (event) => {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    const nodeId = String(detail.nodeId || '').trim();
    if (!nodeId) return;
    handleEditorTreeSelection(nodeId);
  });
} catch (_) {}

function getIndexEntry(key) {
  const state = getStateSlice('index') || {};
  if (!state[key] || typeof state[key] !== 'object') state[key] = {};
  return state[key];
}

function getTabsEntry(key) {
  const state = getStateSlice('tabs') || {};
  if (!state[key] || typeof state[key] !== 'object') state[key] = {};
  return state[key];
}

function validateEntryKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : '';
}

function renameEditorEntry(source, oldKey, nextKeyRaw) {
  const nextKey = validateEntryKey(nextKeyRaw);
  if (!nextKey || nextKey === oldKey) return false;
  const state = getStateSlice(source) || {};
  if (Object.prototype.hasOwnProperty.call(state, nextKey)) {
    showToast('warn', treeText('duplicateKey', 'That key already exists.'));
    return false;
  }
  state[nextKey] = state[oldKey];
  delete state[oldKey];
  if (Array.isArray(state.__order)) state.__order = state.__order.map(key => (key === oldKey ? nextKey : key));
  notifyComposerChange(source);
  activeEditorTreeNodeId = `${source}:${nextKey}`;
  refreshEditorContentTree();
  return true;
}

function deleteEditorEntry(source, key) {
  const state = getStateSlice(source) || {};
  const label = source === 'tabs' ? treeText('page', 'page') : treeText('article', 'article');
  const message = treeText('deleteEntryConfirm', `Delete this ${label}?`, { label: key });
  let ok = true;
  try { ok = window.confirm(message); } catch (_) {}
  if (!ok) return;
  delete state[key];
  if (Array.isArray(state.__order)) state.__order = state.__order.filter(item => item !== key);
  notifyComposerChange(source);
  activeEditorTreeNodeId = source === 'tabs' ? 'pages' : 'articles';
  refreshEditorContentTree();
}

function addEditorLanguage(source, key, lang) {
  const code = normalizeLangCode(lang);
  if (!code) return;
  if (source === 'tabs') {
    const entry = getTabsEntry(key);
    if (entry[code]) return;
    entry[code] = { title: key, location: buildDefaultLanguagePathFromEntry('tabs', key, code, entry) };
    notifyComposerChange('tabs');
    activeEditorTreeNodeId = `tabs:${key}`;
  } else {
    const entry = getIndexEntry(key);
    if (entry[code]) return;
    entry[code] = [buildDefaultLanguagePathFromEntry('index', key, code, entry)];
    notifyComposerChange('index');
    activeEditorTreeNodeId = `index:${key}:${code}`;
  }
  expandedEditorTreeNodeIds.add(`${source}:${key}`);
  refreshEditorContentTree();
}

function removeEditorLanguage(source, key, lang) {
  const entry = source === 'tabs' ? getTabsEntry(key) : getIndexEntry(key);
  if (!entry[lang]) return;
  const message = treeText('deleteLanguageConfirm', 'Remove this language?', { lang: lang.toUpperCase() });
  let ok = true;
  try { ok = window.confirm(message); } catch (_) {}
  if (!ok) return;
  delete entry[lang];
  notifyComposerChange(source);
  activeEditorTreeNodeId = `${source}:${key}`;
  refreshEditorContentTree();
}

function addEditorVersion(key, lang, anchor = null) {
  const entry = getIndexEntry(key);
  const arr = normalizeComposerVersionPaths(entry[lang]);
  return promptArticleVersionValue(key, lang, entry, anchor).then((version) => {
    if (!version) return false;
    arr.push(buildArticleVersionPath(key, lang, version, entry));
    entry[lang] = arr;
    notifyComposerChange('index');
    expandedEditorTreeNodeIds.add(`index:${key}`);
    expandedEditorTreeNodeIds.add(`index:${key}:${lang}`);
    activeEditorTreeNodeId = `index:${key}:${lang}`;
    refreshEditorContentTree();
    return true;
  });
}

function removeEditorVersion(key, lang, index) {
  const entry = getIndexEntry(key);
  const arr = Array.isArray(entry[lang]) ? entry[lang] : [];
  if (!arr[index]) return;
  arr.splice(index, 1);
  entry[lang] = arr;
  notifyComposerChange('index');
  activeEditorTreeNodeId = `index:${key}:${lang}`;
  refreshEditorContentTree();
}

function normalizeRestoreIndex(value, length) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return length;
  return Math.max(0, Math.min(Math.trunc(raw), length));
}

function ensureRestoredEntryOrder(source, key, restoreOrderIndex, options = {}) {
  const state = getStateSlice(source);
  if (!state || !key) return null;
  if (!Array.isArray(state.__order)) state.__order = Object.keys(state).filter(item => item && item !== '__order' && item !== key);
  if (state.__order.includes(key) && !options.reposition) return state;
  state.__order = state.__order.filter(item => item !== key);
  state.__order.splice(normalizeRestoreIndex(restoreOrderIndex, state.__order.length), 0, key);
  return state;
}

function ensureRestoredEntry(source, key, restoreOrderIndex) {
  const state = ensureRestoredEntryOrder(source, key, restoreOrderIndex);
  if (!state) return null;
  if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  return state[key];
}

function restoreDeletedEditorTreeNode(node) {
  if (!node || !node.isDeleted || (node.source !== 'index' && node.source !== 'tabs')) return false;
  const state = getStateSlice(node.source);
  if (!state || !node.key) return false;
  const restoreValue = deepClone(node.restoreValue);
  let nextNodeId = '';

  if (node.deletedKind === 'entry') {
    state[node.key] = restoreValue && typeof restoreValue === 'object' && !Array.isArray(restoreValue) ? restoreValue : {};
    ensureRestoredEntryOrder(node.source, node.key, node.restoreOrderIndex, { reposition: true });
    nextNodeId = `${node.source}:${node.key}`;
  } else if (node.deletedKind === 'language') {
    const entry = ensureRestoredEntry('index', node.key, node.restoreOrderIndex);
    if (!entry || !node.lang) return false;
    entry[node.lang] = restoreValue == null ? [] : restoreValue;
    nextNodeId = `index:${node.key}:${node.lang}`;
  } else if (node.deletedKind === 'version') {
    const entry = ensureRestoredEntry('index', node.key, node.restoreOrderIndex);
    if (!entry || !node.lang) return false;
    const path = normalizeRelPath(restoreValue || node.path);
    if (!path) return false;
    const arr = normalizeComposerVersionPaths(entry[node.lang]);
    let targetIndex = arr.indexOf(path);
    if (targetIndex === -1) {
      targetIndex = normalizeRestoreIndex(node.restoreIndex, arr.length);
      arr.splice(targetIndex, 0, path);
    }
    entry[node.lang] = arr;
    nextNodeId = `index:${node.key}:${node.lang}:${targetIndex}`;
  } else if (node.deletedKind === 'page-language') {
    const entry = ensureRestoredEntry('tabs', node.key, node.restoreOrderIndex);
    if (!entry || !node.lang) return false;
    entry[node.lang] = restoreValue == null ? { title: node.key, location: normalizeRelPath(node.path) } : restoreValue;
    nextNodeId = `tabs:${node.key}:${node.lang}`;
  } else {
    return false;
  }

  expandedEditorTreeNodeIds.add(node.source === 'tabs' ? 'pages' : 'articles');
  expandedEditorTreeNodeIds.add(`${node.source}:${node.key}`);
  if (node.source === 'index' && node.lang) expandedEditorTreeNodeIds.add(`index:${node.key}:${node.lang}`);
  activeEditorTreeNodeId = nextNodeId || `${node.source}:${node.key}`;
  notifyComposerChange(node.source);
  refreshEditorContentTree();
  return true;
}

function moveEditorVersion(key, lang, index, delta) {
  return moveEditorVersionTo(key, lang, index, index + delta);
}

function moveEditorVersionTo(key, lang, from, to) {
  const entry = getIndexEntry(key);
  const arr = Array.isArray(entry[lang]) ? entry[lang] : [];
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return false;
  const [path] = arr.splice(from, 1);
  arr.splice(to, 0, path);
  entry[lang] = arr;
  notifyComposerChange('index');
  activeEditorTreeNodeId = `index:${key}:${lang}`;
  refreshEditorContentTree();
  return true;
}

function availableLanguageCodes(entry) {
  return PREFERRED_LANG_ORDER.filter(code => !entry || !entry[code]);
}

function makeStructureButton(label, className = 'btn-secondary') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function renderStructureItem(label, detail, onOpen) {
  const item = document.createElement('div');
  item.className = 'editor-structure-item';
  const main = document.createElement('div');
  main.className = 'editor-structure-item-main';
  const title = document.createElement('span');
  title.className = 'editor-structure-item-title';
  title.textContent = label || '';
  const meta = document.createElement('span');
  meta.className = 'editor-structure-item-meta';
  meta.textContent = detail || '';
  main.appendChild(title);
  main.appendChild(meta);
  item.appendChild(main);
  if (typeof onOpen === 'function') {
    const controls = document.createElement('div');
    controls.className = 'editor-structure-item-actions';
    const open = makeStructureButton(treeText('select', 'Select'));
    open.addEventListener('click', onOpen);
    controls.appendChild(open);
    item.appendChild(controls);
  }
  return item;
}

function createEditorStructureDragController(list, onMove) {
  let dragState = null;

  const getAnimatedRows = () => Array.from(list.children)
    .filter((row) => row !== dragState?.placeholder && row.classList?.contains('editor-structure-item--draggable') && row !== dragState?.dragItem);

  const animateRows = (callback) => {
    const previousRects = new Map();
    getAnimatedRows().forEach((row) => {
      previousRects.set(row, row.getBoundingClientRect());
    });

    callback();

    getAnimatedRows().forEach((row) => {
      const previous = previousRects.get(row);
      if (!previous) return;
      const next = row.getBoundingClientRect();
      const deltaY = previous.top - next.top;
      if (!deltaY) return;
      row.style.transition = 'none';
      row.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      requestAnimationFrame(() => {
        row.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
        row.style.transform = '';
      });
    });
  };

  const createPlaceholder = (item) => {
    const itemRect = item.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'editor-structure-drop-placeholder';
    placeholder.style.height = `${itemRect.height}px`;
    return placeholder;
  };

  const getDropIndex = () => {
    if (!dragState || !dragState.placeholder) return -1;
    const rows = Array.from(list.children)
      .filter((childNode) => childNode === dragState.placeholder || (childNode !== dragState.dragItem && childNode.classList?.contains('editor-structure-item--draggable')));
    return rows.indexOf(dragState.placeholder);
  };

  const updateDragItemState = () => {
    list.querySelectorAll('.editor-structure-item--draggable').forEach((item) => {
      item.classList.toggle('is-dragging', !!dragState && item === dragState.dragItem);
    });
  };

  const applyDragPreview = (clientY) => {
    if (!dragState) return;
    dragState.dragItem.style.transform = `translate3d(0, ${clientY - dragState.startY}px, 0)`;
    const rows = getAnimatedRows();
    let nextNode = null;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        nextNode = row;
        break;
      }
    }
    if (nextNode === dragState.placeholder.nextSibling) return;
    animateRows(() => {
      list.insertBefore(dragState.placeholder, nextNode);
    });
  };

  const handlePointerMove = (event) => {
    if (!dragState) return;
    event.preventDefault();
    applyDragPreview(event.clientY);
  };

  const endDrag = () => {
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', endDrag, true);
    document.removeEventListener('pointercancel', endDrag, true);
    if (dragState) {
      const { fromIndex, dragItem, placeholder } = dragState;
      const toIndex = getDropIndex();
      dragItem.classList.remove('is-dragging');
      dragItem.style.position = '';
      dragItem.style.left = '';
      dragItem.style.top = '';
      dragItem.style.width = '';
      dragItem.style.zIndex = '';
      dragItem.style.transform = '';
      if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      if (toIndex >= 0) onMove(fromIndex, toIndex);
    }
    dragState = null;
    updateDragItemState();
  };

  return {
    createHandle(index, ariaLabel) {
      const handle = document.createElement('span');
      handle.setAttribute('role', 'button');
      handle.tabIndex = 0;
      handle.className = 'editor-structure-drag-handle';
      handle.setAttribute('aria-label', ariaLabel);
      handle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
      handle.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const item = handle.closest('.editor-structure-item--draggable');
        if (!item) return;
        const itemRect = item.getBoundingClientRect();
        const placeholder = createPlaceholder(item);
        list.insertBefore(placeholder, item);
        dragState = {
          fromIndex: index,
          dragItem: item,
          placeholder,
          startY: event.clientY
        };
        item.classList.add('is-dragging');
        item.style.position = 'fixed';
        item.style.left = `${itemRect.left}px`;
        item.style.top = `${itemRect.top}px`;
        item.style.width = `${itemRect.width}px`;
        item.style.zIndex = '1000';
        item.style.transform = 'translate3d(0, 0, 0)';
        updateDragItemState();
        document.addEventListener('pointermove', handlePointerMove, true);
        document.addEventListener('pointerup', endDrag, true);
        document.addEventListener('pointercancel', endDrag, true);
      });
      handle.addEventListener('keydown', (event) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        onMove(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
      });
      return handle;
    }
  };
}

const moveStructureRootEntry = (source, from, to) => {
  const state = getStateSlice(source) || {};
  const order = Array.isArray(state.__order) ? state.__order : [];
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return false;
  const [key] = order.splice(from, 1);
  order.splice(to, 0, key);
  activeEditorTreeNodeId = source === 'tabs' ? 'pages' : 'articles';
  notifyComposerChange(source);
  refreshEditorContentTree();
  return true;
};

function appendEditorLanguageControl(body) {
  if (!body) return;
  const item = document.createElement('div');
  item.className = 'editor-structure-item editor-system-language-item';

  const main = document.createElement('div');
  main.className = 'editor-structure-item-main';
  const title = document.createElement('span');
  title.className = 'editor-structure-item-title';
  title.textContent = treeText('editorLanguage', t('editor.languageLabel') || 'Language');
  const meta = document.createElement('span');
  meta.className = 'editor-structure-item-meta';
  meta.textContent = treeText('editorLanguageMeta', 'Change the editor interface language.');
  main.appendChild(title);
  main.appendChild(meta);

  const controls = document.createElement('div');
  controls.className = 'editor-structure-item-actions';
  const switcher = document.createElement('div');
  switcher.className = 'editor-lang-switcher editor-lang-switcher-inline';
  switcher.id = 'editorLangSwitcher';
  const label = document.createElement('label');
  label.setAttribute('for', 'editorLangSelect');
  label.setAttribute('data-i18n', 'editor.languageLabel');
  label.textContent = t('editor.languageLabel') || 'Language';
  const select = document.createElement('select');
  select.id = 'editorLangSelect';
  select.setAttribute('data-i18n-aria-label', 'editor.languageLabel');
  select.setAttribute('aria-label', t('editor.languageLabel') || 'Language');
  switcher.appendChild(label);
  switcher.appendChild(select);
  controls.appendChild(switcher);

  item.appendChild(main);
  item.appendChild(controls);
  body.appendChild(item);

  try {
    if (typeof window.__nsPopulateEditorLanguageSelect === 'function') window.__nsPopulateEditorLanguageSelect();
    document.dispatchEvent(new CustomEvent('ns-editor-language-control-mounted'));
  } catch (_) {}
}

function appendLanguageSelector(actions, source, key, entry) {
  const available = availableLanguageCodes(entry);
  if (!available.length) return;
  const select = document.createElement('select');
  select.setAttribute('aria-label', treeText('language', 'Language'));
  available.forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = displayLangName(code);
    select.appendChild(opt);
  });
  const add = makeStructureButton(treeText('addLanguage', 'Add language'));
  add.addEventListener('click', () => addEditorLanguage(source, key, select.value));
  actions.appendChild(select);
  actions.appendChild(add);
}

function getDeletedEditorTreeKicker(node) {
  if (!node) return treeText('deletedKicker', 'Deleted item');
  if (node.deletedKind === 'entry') return node.source === 'tabs' ? treeText('pageEntry', 'Page') : treeText('articleEntry', 'Article');
  if (node.deletedKind === 'language') return treeText('languageKicker', 'Article language');
  if (node.deletedKind === 'page-language') return treeText('pageFile', 'Page file');
  return node.source === 'tabs' ? treeText('pageFile', 'Page file') : treeText('articleFile', 'Article file');
}

function getDeletedEditorTreeTitle(node) {
  if (!node) return treeText('deletedKicker', 'Deleted item');
  if (node.deletedKind === 'language') return `${node.key} / ${displayLangName(node.lang)}`;
  if (node.deletedKind === 'version' || node.deletedKind === 'page-language') return node.path || node.label || node.id;
  return node.key || node.label || node.id;
}

function getDeletedEditorTreeMeta(node) {
  if (!node) return treeText('deletedMeta', 'This item was removed from the current draft. Restore it before publishing if you want to keep it.');
  if (node.deletedKind === 'entry') return treeText('deletedEntryMeta', 'This entry was removed from the current draft. Restore it before publishing if you want to keep it.');
  if (node.deletedKind === 'language') return treeText('deletedLanguageMeta', 'This language was removed from the current draft. Restore it before publishing if you want to keep it.');
  if (node.deletedKind === 'page-language') return treeText('deletedPageLanguageMeta', 'This page language file was removed from the current draft. Restore it before publishing if you want to keep it.');
  return treeText('deletedFileMeta', 'This file was removed from the current draft. Restore it before publishing if you want to keep it.');
}

function renderEditorDeletedPanel(node, refs) {
  refs.kicker.textContent = getDeletedEditorTreeKicker(node);
  refs.title.textContent = getDeletedEditorTreeTitle(node);
  refs.meta.textContent = getDeletedEditorTreeMeta(node);

  const restore = makeStructureButton(treeText('restoreDeleted', 'Restore'));
  restore.addEventListener('click', () => restoreDeletedEditorTreeNode(node));
  refs.actions.appendChild(restore);

  const list = document.createElement('div');
  list.className = 'editor-structure-list';
  const restoreDetail = node && node.path
    ? node.path
    : treeText('deletedRestoreHint', 'Restore writes back the last loaded baseline value for this deleted item.');
  list.appendChild(renderStructureItem(treeText('status.deleted', 'Deleted'), restoreDetail));
  if (node && Array.isArray(node.children) && node.children.length) {
    node.children.forEach((child) => {
      const detail = child.path || (child.children ? `${child.children.length} ${treeText('versions', 'versions')}` : '');
      list.appendChild(renderStructureItem(child.label, detail, () => handleEditorTreeSelection(child.id)));
    });
  }
  refs.body.appendChild(list);
}

function renderEditorStructurePanel(node) {
  const panel = document.getElementById('editorStructurePanel');
  const title = document.getElementById('editorStructureTitle');
  const kicker = document.getElementById('editorStructureKicker');
  const meta = document.getElementById('editorStructureMeta');
  const actions = document.getElementById('editorStructureActions');
  const body = document.getElementById('editorStructureBody');
  if (!panel || !title || !kicker || !meta || !actions || !body) return;
  const animate = () => animateEditorStructurePanelContent(panel);
  actions.innerHTML = '';
  body.innerHTML = '';
  setEditorDetailPanelMode('structure');

  if (!node) {
    kicker.textContent = treeText('kicker', 'Content structure');
    title.textContent = treeText('emptyTitle', 'Select a node');
    meta.textContent = treeText('emptyMeta', 'Choose an item in the tree to manage its structure or edit a Markdown file.');
    animate();
    return;
  }

  if (node.isDeleted) {
    renderEditorDeletedPanel(node, { title, kicker, meta, actions, body });
    animate();
    return;
  }

  if (node.kind === 'root') {
    if (node.source === 'system') {
      kicker.textContent = treeText('rootKicker', 'Collection');
      title.textContent = node.label || treeText('system', 'System');
      meta.textContent = treeText('rootMeta', `${node.children.length} items`, { count: node.children.length });
      appendEditorLanguageControl(body);
      const list = document.createElement('div');
      list.className = 'editor-structure-list';
      node.children.forEach((child) => {
        const detail = child.id === 'system:sync'
          ? treeText('syncMeta', 'Publish local changes to GitHub.')
          : (child.id === 'system:updates'
            ? treeText('systemUpdatesMeta', 'Review and apply NanoSite updates.')
            : treeText('siteSettingsMeta', 'Edit site.yaml settings.'));
        list.appendChild(renderStructureItem(child.label, detail, () => handleEditorTreeSelection(child.id)));
      });
      body.appendChild(list);
      animate();
      return;
    }
    const isPages = node.source === 'tabs';
    const visibleChildren = node.children.filter(child => !child.isDeleted);
    kicker.textContent = treeText('rootKicker', 'Collection');
    title.textContent = node.label || (isPages ? treeText('pages', 'Pages') : treeText('articles', 'Articles'));
    meta.textContent = treeText('rootMeta', `${visibleChildren.length} items`, { count: visibleChildren.length });
    const add = makeStructureButton(isPages ? treeText('addPage', 'Page') : treeText('addArticle', 'Article'));
    add.addEventListener('click', () => {
      const kind = isPages ? 'tabs' : 'index';
      addComposerEntry(kind, add).then((key) => {
        if (key) handleEditorTreeSelection(`${kind}:${key}`);
      }).catch((err) => console.error('Failed to add entry from structure panel', err));
    });
    actions.appendChild(add);
    const list = document.createElement('div');
    list.className = 'editor-structure-list';
    if (node.source === 'index' || node.source === 'tabs') {
      const dragController = createEditorStructureDragController(list, (fromIndex, toIndex) => moveStructureRootEntry(node.source, fromIndex, toIndex));

      const createStructureDragHandle = (child, index, source) => {
        const labelKey = source === 'tabs' ? 'reorderPage' : 'reorderArticle';
        return dragController.createHandle(index, treeText(labelKey, source === 'tabs' ? 'Reorder page' : 'Reorder article'));
      };

      const renderStructureDraggableItem = (child, detail, index, source) => {
        const item = document.createElement('div');
        item.className = 'editor-structure-item editor-structure-item--draggable';
        item.dataset.index = String(index);
        const handle = createStructureDragHandle(child, index, source);
        const main = document.createElement('div');
        main.className = 'editor-structure-item-main';
        const title = document.createElement('span');
        title.className = 'editor-structure-item-title';
        title.textContent = child.label || '';
        const metaText = document.createElement('span');
        metaText.className = 'editor-structure-item-meta';
        metaText.textContent = detail || '';
        main.append(title, metaText);
        const controls = document.createElement('div');
        controls.className = 'editor-structure-item-actions';
        const open = makeStructureButton(treeText('select', 'Select'));
        open.addEventListener('click', () => handleEditorTreeSelection(child.id));
        controls.appendChild(open);
        item.append(handle, main, controls);
        return item;
      };

      visibleChildren.forEach((child, index) => {
        list.appendChild(renderStructureDraggableItem(child, `${child.children.length} ${treeText('languages', 'languages')}`, index, node.source));
      });
    } else {
      visibleChildren.forEach((child) => list.appendChild(renderStructureItem(child.label, `${child.children.length} ${treeText('languages', 'languages')}`, () => handleEditorTreeSelection(child.id))));
    }
    body.appendChild(list);
    animate();
    return;
  }

  if (node.kind === 'entry') {
    renderEditorEntryPanel(node, { title, kicker, meta, actions, body });
    animate();
    return;
  }

  if (node.kind === 'language') {
    renderEditorLanguagePanel(node, { title, kicker, meta, actions, body });
    animate();
    return;
  }

  if (node.kind === 'file') {
    kicker.textContent = node.source === 'tabs' ? treeText('pageFile', 'Page file') : treeText('articleFile', 'Article file');
    title.textContent = node.label || basenameFromPath(node.path);
    meta.textContent = node.path || '';
    animate();
  }
}

function renderEditorEntryPanel(node, refs) {
  const isPages = node.source === 'tabs';
  const entry = isPages ? getTabsEntry(node.key) : getIndexEntry(node.key);
  refs.kicker.textContent = isPages ? treeText('pageEntry', 'Page') : treeText('articleEntry', 'Article');
  refs.title.textContent = node.key;
  refs.meta.textContent = isPages
    ? treeText('pageEntryMeta', 'Manage page languages and open files for editing.')
    : treeText('articleEntryMeta', 'Manage article languages and versions.');
  appendLanguageSelector(refs.actions, node.source, node.key, entry);
  const del = makeStructureButton(treeText('delete', 'Delete'));
  del.addEventListener('click', () => deleteEditorEntry(node.source, node.key));
  refs.actions.appendChild(del);

  const list = document.createElement('div');
  list.className = 'editor-structure-list';
  sortLangKeys(entry).forEach((lang) => {
    if (isPages) list.appendChild(renderPageLanguageStructure(node.key, lang, entry[lang]));
    else {
      const arr = Array.isArray(entry[lang]) ? entry[lang] : (entry[lang] ? [entry[lang]] : []);
      list.appendChild(renderStructureItem(displayLangName(lang), `${arr.length} ${treeText('versions', 'versions')}`, () => handleEditorTreeSelection(`index:${node.key}:${lang}`)));
    }
  });
  refs.body.appendChild(list);
}

function renderPageLanguageStructure(key, lang, value) {
  const entry = value && typeof value === 'object' ? value : { title: '', location: String(value || '') };
  const item = document.createElement('div');
  item.className = 'editor-structure-item';
  const main = document.createElement('div');
  main.className = 'editor-structure-item-main';
  const label = document.createElement('span');
  label.className = 'editor-structure-item-title';
  label.textContent = displayLangName(lang);
  const meta = document.createElement('span');
  meta.className = 'editor-structure-item-meta';
  meta.textContent = entry.location || '';
  main.appendChild(label);
  main.appendChild(meta);
  const controls = document.createElement('div');
  controls.className = 'editor-structure-item-actions';
  const open = makeStructureButton(treeText('open', 'Open'));
  open.addEventListener('click', () => {
    const rel = normalizeRelPath(entry.location);
    if (!rel) {
      alert(tComposer('markdown.openBeforeEditor'));
      return;
    }
    openMarkdownInEditor(rel, {
      source: 'tabs',
      key,
      lang,
      editorTreeNodeId: `tabs:${key}:${lang}`
    });
  });
  const remove = makeStructureButton(treeText('remove', 'Remove'));
  remove.addEventListener('click', () => removeEditorLanguage('tabs', key, lang));
  controls.appendChild(open);
  controls.appendChild(remove);
  item.appendChild(main);
  item.appendChild(controls);
  return item;
}

function renderEditorLanguagePanel(node, refs) {
  const entry = getIndexEntry(node.key);
  const arr = Array.isArray(entry[node.lang]) ? entry[node.lang] : (entry[node.lang] ? [entry[node.lang]] : []);
  entry[node.lang] = arr;
  refs.kicker.textContent = treeText('languageKicker', 'Article language');
  refs.title.textContent = `${node.key} / ${displayLangName(node.lang)}`;
  refs.meta.textContent = treeText('languageMeta', `${arr.length} versions`, { count: arr.length });
  const add = makeStructureButton(treeText('addVersion', 'Add version'));
  add.addEventListener('click', () => { void addEditorVersion(node.key, node.lang, add); });
  const removeLang = makeStructureButton(treeText('removeLanguage', 'Remove language'));
  removeLang.addEventListener('click', () => removeEditorLanguage('index', node.key, node.lang));
  refs.actions.appendChild(add);
  refs.actions.appendChild(removeLang);

  const list = document.createElement('div');
  list.className = 'editor-structure-list';
  const dragController = createEditorStructureDragController(list, (fromIndex, toIndex) => moveEditorVersionTo(node.key, node.lang, fromIndex, toIndex));
  arr.forEach((path, index) => {
    const item = document.createElement('div');
    item.className = 'editor-structure-item editor-structure-item--draggable';
    item.dataset.index = String(index);
    const handle = dragController.createHandle(index, treeText('reorderVersion', 'Reorder version'));
    const main = document.createElement('div');
    main.className = 'editor-structure-item-main';
    const label = document.createElement('span');
    label.className = 'editor-structure-item-title';
    label.textContent = extractVersionFromPath(path) || `${treeText('version', 'Version')} ${index + 1}`;
    main.appendChild(label);
    const controls = document.createElement('div');
    controls.className = 'editor-structure-item-actions';
    const open = makeStructureButton(treeText('open', 'Open'));
    open.addEventListener('click', () => openMarkdownInEditor(arr[index], {
      source: 'index',
      key: node.key,
      lang: node.lang,
      editorTreeNodeId: `index:${node.key}:${node.lang}:${index}`
    }));
    const remove = makeStructureButton(treeText('remove', 'Remove'));
    remove.addEventListener('click', () => removeEditorVersion(node.key, node.lang, index));
    controls.appendChild(open);
    controls.appendChild(remove);
    item.append(handle, main, controls);
    list.appendChild(item);
  });
  refs.body.appendChild(list);
}

function buildIndexUI(root, state) {
  root.innerHTML = '';
  const list = document.createElement('div');
  list.id = 'ciList';
  root.appendChild(list);

  const markDirty = () => { try { notifyComposerChange('index'); } catch (_) {}; };

  const order = state.index.__order;
  order.forEach(key => {
    const entry = state.index[key] || {};
    const row = document.createElement('div');
    row.className = 'ci-item';
    row.setAttribute('data-key', key);
    row.setAttribute('draggable', 'true');
    const langCount = Object.keys(entry).length;
    const langCountText = tComposerLang('count', { count: langCount });
    const detailsLabel = tComposerEntryRow('details');
    const deleteLabel = tComposerEntryRow('delete');
    const gripHint = tComposerEntryRow('gripHint');
    row.innerHTML = `
      <div class="ci-head">
        <span class="ci-grip" title="${escapeHtml(gripHint)}" aria-hidden="true">⋮⋮</span>
        <strong class="ci-key">${escapeHtml(key)}</strong>
        <span class="ci-meta">${escapeHtml(langCountText)}</span>
        <span class="ci-diff" aria-live="polite"></span>
        <span class="ci-actions">
          <button class="btn-secondary ci-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>${escapeHtml(detailsLabel)}</button>
          <span class="ci-head-add-lang-slot"></span>
          <button class="btn-secondary ci-del">${escapeHtml(deleteLabel)}</button>
        </span>
      </div>
      <div class="ci-body"><div class="ci-body-inner"></div></div>
    `;
    list.appendChild(row);

    const body = $('.ci-body', row);
    const bodyInner = $('.ci-body-inner', row);
    const headAddLangSlot = $('.ci-head-add-lang-slot', row);
    const btnExpand = $('.ci-expand', row);
    const btnDel = $('.ci-del', row);
    if (btnExpand) btnExpand.setAttribute('title', detailsLabel);
    if (btnDel) {
      btnDel.setAttribute('title', deleteLabel);
      btnDel.setAttribute('aria-label', deleteLabel);
    }

    body.dataset.open = '0';
    body.style.display = 'none';

    const renderBody = () => {
      bodyInner.innerHTML = '';
      if (headAddLangSlot) headAddLangSlot.innerHTML = '';
      const langs = sortLangKeys(entry);
      const addVersionLabel = tComposerLang('addVersion');
      const removeLangLabel = tComposerLang('removeLanguage');
      const editLabel = tComposerLang('actions.edit');
      const openLabel = tComposerLang('actions.open');
      const moveUpLabel = tComposerLang('actions.moveUp');
      const moveDownLabel = tComposerLang('actions.moveDown');
      const removeLabel = tComposerLang('actions.remove');
      langs.forEach(lang => {
        const block = document.createElement('div');
        block.className = 'ci-lang';
        block.dataset.lang = lang;
        const flag = langFlag(lang);
        const langLabel = displayLangName(lang);
        const safeLabel = escapeHtml(langLabel || '');
        const flagSpan = flag ? `<span class="ci-lang-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : '';
        const val = entry[lang];
        // Normalize to array for UI
        const arr = Array.isArray(val) ? val.slice() : (val ? [val] : []);
        block.innerHTML = `
          <div class="ci-lang-head">
            <strong class="ci-lang-label" aria-label="${safeLabel}" title="${safeLabel}">
              ${flagSpan}
              <span class="ci-lang-code">${escapeHtml(lang.toUpperCase())}</span>
            </strong>
            <span class="ci-lang-actions">
              <button type="button" class="btn-secondary ci-lang-addver">${escapeHtml(addVersionLabel)}</button>
              <button type="button" class="btn-secondary ci-lang-del">${escapeHtml(removeLangLabel)}</button>
            </span>
          </div>
          <div class="ci-ver-list"></div>
          <div class="ci-ver-removed" data-role="removed" hidden></div>
        `;
        const verList = $('.ci-ver-list', block);
        const removedBox = block.querySelector('[data-role="removed"]');
        // Stable IDs for FLIP animations across re-renders
        let verIds = arr.map(() => Math.random().toString(36).slice(2));

        const snapRects = () => {
          const map = new Map();
          verList.querySelectorAll('.ci-ver-item').forEach(el => {
            const id = el.getAttribute('data-id');
            if (!id) return;
            map.set(id, el.getBoundingClientRect());
          });
          return map;
        };

        const animateFrom = (prev) => {
          if (!prev) return;
          verList.querySelectorAll('.ci-ver-item').forEach(el => {
            const id = el.getAttribute('data-id');
            const r0 = id && prev.get(id);
            if (!r0) return;
            const r1 = el.getBoundingClientRect();
            const dx = r0.left - r1.left;
            const dy = r0.top - r1.top;
            if (dx || dy) {
              try {
                el.animate([
                  { transform: `translate(${dx}px, ${dy}px)` },
                  { transform: 'translate(0, 0)' }
                ], { duration: 360, easing: 'ease', composite: 'replace' });
              } catch (_) {
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(() => {
                  el.style.transition = 'transform 360ms ease';
                  el.style.transform = '';
                  const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear); };
                  el.addEventListener('transitionend', clear);
                });
              }
            }
          });
        };

        const renderVers = (prevRects = null) => {
          verList.innerHTML = '';
          arr.forEach((p, i) => {
            const id = verIds[i] || (verIds[i] = Math.random().toString(36).slice(2));
            const row = document.createElement('div');
            row.className = 'ci-ver-item';
            row.setAttribute('data-id', id);
            row.dataset.lang = lang;
            row.dataset.index = String(i);
            row.dataset.value = p || '';
            const normalizedPath = normalizeRelPath(p);
            if (normalizedPath) row.dataset.mdPath = normalizedPath;
            else delete row.dataset.mdPath;
            row.innerHTML = `
              <span class="ci-draft-indicator" aria-hidden="true" hidden></span>
              <span class="ci-ver-label">${escapeHtml(extractVersionFromPath(p) || `${treeText('version', 'Version')} ${i + 1}`)}</span>
              <span class="ci-ver-actions">
                <button type="button" class="btn-secondary ci-edit" title="${escapeHtml(openLabel)}">${escapeHtml(editLabel)}</button>
                <button type="button" class="btn-secondary ci-up" title="${escapeHtml(moveUpLabel)}" aria-label="${escapeHtml(moveUpLabel)}"><span aria-hidden="true">↑</span></button>
                <button type="button" class="btn-secondary ci-down" title="${escapeHtml(moveDownLabel)}" aria-label="${escapeHtml(moveDownLabel)}"><span aria-hidden="true">↓</span></button>
                <button type="button" class="btn-secondary ci-remove" title="${escapeHtml(removeLabel)}" aria-label="${escapeHtml(removeLabel)}"><span aria-hidden="true">✕</span></button>
              </span>
            `;
            const up = $('.ci-up', row);
            const down = $('.ci-down', row);
            // Disable ↑ for first, ↓ for last
            if (i === 0) up.setAttribute('disabled', ''); else up.removeAttribute('disabled');
            if (i === arr.length - 1) down.setAttribute('disabled', ''); else down.removeAttribute('disabled');
            updateComposerMarkdownDraftIndicators({ element: row, path: normalizedPath });
            $('.ci-edit', row).addEventListener('click', () => {
              const rel = normalizeRelPath(arr[i]);
              if (!rel) {
                alert(tComposer('markdown.openBeforeEditor'));
                return;
              }
              openMarkdownInEditor(rel);
            });
            up.addEventListener('click', () => {
              if (i <= 0) return;
              const prev = snapRects();
              [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
              [verIds[i - 1], verIds[i]] = [verIds[i], verIds[i - 1]];
              entry[lang] = arr.slice();
              renderVers(prev);
              markDirty();
            });
            down.addEventListener('click', () => {
              if (i >= arr.length - 1) return;
              const prev = snapRects();
              [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
              [verIds[i + 1], verIds[i]] = [verIds[i], verIds[i + 1]];
              entry[lang] = arr.slice();
              renderVers(prev);
              markDirty();
            });
            $('.ci-remove', row).addEventListener('click', () => {
              const prev = snapRects();
              arr.splice(i, 1);
              verIds.splice(i, 1);
              entry[lang] = arr.slice();
              renderVers(prev);
              markDirty();
            });
            verList.appendChild(row);
          });
          animateFrom(prevRects);
          updateComposerMarkdownDraftContainerState(verList.closest('.ci-item'));
        };
        renderVers();
        $('.ci-lang-addver', block).addEventListener('click', async (event) => {
          const version = await promptArticleVersionValue(key, lang, entry, event.currentTarget);
          if (!version) return;
          const prev = snapRects();
          arr.push(buildArticleVersionPath(key, lang, version, entry));
          verIds.push(Math.random().toString(36).slice(2));
          entry[lang] = arr.slice();
          renderVers(prev);
          markDirty();
        });
        $('.ci-lang-del', block).addEventListener('click', () => {
          delete entry[lang];
          const meta = row.querySelector('.ci-meta');
          if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
          renderBody();
          broadcastLanguagePoolChange();
          markDirty();
        });
        bodyInner.appendChild(block);
      });

      // Add-language via custom dropdown showing only missing languages
      const supportedLangs = PREFERRED_LANG_ORDER.slice();
      const available = supportedLangs.filter(l => !entry[l]);
      if (available.length > 0) {
        const addLangLabel = tComposerLang('addLanguage');
        const addLangWrap = document.createElement('span');
        addLangWrap.className = 'ci-add-lang has-menu';
        addLangWrap.innerHTML = `
          <button type="button" class="btn-secondary ci-add-lang-btn" aria-haspopup="listbox" aria-expanded="false">${escapeHtml(addLangLabel)}</button>
          <div class="ci-lang-menu ns-menu" role="listbox" hidden>
            ${available.map(l => `<button type="button" role="option" class="ns-menu-item" data-lang="${l}">${escapeHtml(displayLangName(l))}</button>`).join('')}
          </div>
        `;
        const btn = $('.ci-add-lang-btn', addLangWrap);
        const menu = $('.ci-lang-menu', addLangWrap);
        if (btn) {
          btn.setAttribute('title', addLangLabel);
          btn.setAttribute('aria-label', addLangLabel);
        }
        function closeMenu(){
          if (menu.hidden) return;
          // animate out, then hide
          const finish = () => {
            menu.hidden = true;
            btn.classList.remove('is-open');
            addLangWrap.classList.remove('is-open');
            btn.setAttribute('aria-expanded','false');
            document.removeEventListener('mousedown', onDocDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            menu.classList.remove('is-closing');
          };
          try {
            menu.classList.add('is-closing');
            const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
            menu.addEventListener('animationend', onEnd, { once: true });
            // safety timeout
            setTimeout(finish, 180);
          } catch(_) { finish(); }
        }
        function openMenu(){
          if (!menu.hidden) return;
          menu.hidden = false;
          try { menu.classList.remove('is-closing'); } catch(_){}
          btn.classList.add('is-open');
          addLangWrap.classList.add('is-open');
          btn.setAttribute('aria-expanded','true');
          try { menu.querySelector('.ns-menu-item')?.focus(); } catch(_){}
          document.addEventListener('mousedown', onDocDown, true);
          document.addEventListener('keydown', onKeyDown, true);
        }
        function onDocDown(e){ if (!addLangWrap.contains(e.target)) closeMenu(); }
        function onKeyDown(e){ if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } }
        btn.addEventListener('click', () => { btn.classList.contains('is-open') ? closeMenu() : openMenu(); });
        menu.querySelectorAll('.ns-menu-item').forEach(it => {
          it.addEventListener('click', () => {
            const code = String(it.getAttribute('data-lang')||'').trim();
            if (!code || entry[code]) return;
            const defaultPath = buildDefaultLanguagePathFromEntry('index', key, code, entry);
            entry[code] = defaultPath ? [defaultPath] : [''];
            const meta = row.querySelector('.ci-meta');
            if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
            closeMenu();
            renderBody();
            broadcastLanguagePoolChange();
            markDirty();
          });
        });
        (headAddLangSlot || bodyInner).appendChild(addLangWrap);
      }
      updateComposerDraftContainerState(row);
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const isOpen = body.dataset.open === '1';
      const next = !isOpen;
      row.classList.toggle('is-open', next);
      btnExpand.setAttribute('aria-expanded', String(next));
      slideToggle(body, next);
      scheduleComposerOrderPreviewRelayout('index');
    });
    btnDel.addEventListener('click', () => {
      const i = state.index.__order.indexOf(key);
      if (i >= 0) state.index.__order.splice(i, 1);
      delete state.index[key];
      row.remove();
      markDirty();
    });
  });

  makeDragList(list, (newOrder) => {
    state.index.__order = newOrder;
    markDirty();
  });

  try {
    if (composerOrderPreviewActiveKind === 'index') updateComposerOrderPreview('index');
  } catch (_) {}
}

function buildTabsUI(root, state) {
  root.innerHTML = '';
  const list = document.createElement('div');
  list.id = 'ctList';
  root.appendChild(list);

  const markDirty = () => { try { notifyComposerChange('tabs'); } catch (_) {}; };

  const order = state.tabs.__order;
  order.forEach(tab => {
    const entry = state.tabs[tab] || {};
    const row = document.createElement('div');
    row.className = 'ct-item';
    row.setAttribute('data-key', tab);
    row.setAttribute('draggable', 'true');
    const langCount = Object.keys(entry).length;
    const langCountText = tComposerLang('count', { count: langCount });
    const detailsLabel = tComposerEntryRow('details');
    const deleteLabel = tComposerEntryRow('delete');
    const gripHint = tComposerEntryRow('gripHint');
    row.innerHTML = `
      <div class="ct-head">
        <span class="ct-grip" title="${escapeHtml(gripHint)}" aria-hidden="true">⋮⋮</span>
        <strong class="ct-key">${escapeHtml(tab)}</strong>
        <span class="ct-meta">${escapeHtml(langCountText)}</span>
        <span class="ct-diff" aria-live="polite"></span>
        <span class="ct-actions">
          <button class="btn-secondary ct-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>${escapeHtml(detailsLabel)}</button>
          <button class="btn-secondary ct-del">${escapeHtml(deleteLabel)}</button>
        </span>
      </div>
      <div class="ct-body"><div class="ct-body-inner"></div></div>
    `;
    list.appendChild(row);

    const body = $('.ct-body', row);
    const bodyInner = $('.ct-body-inner', row);
    const btnExpand = $('.ct-expand', row);
    const btnDel = $('.ct-del', row);
    if (btnExpand) btnExpand.setAttribute('title', detailsLabel);
    if (btnDel) {
      btnDel.setAttribute('title', deleteLabel);
      btnDel.setAttribute('aria-label', deleteLabel);
    }

    body.dataset.open = '0';
    body.style.display = 'none';

    const renderBody = () => {
      bodyInner.innerHTML = '';
      const langs = sortLangKeys(entry);
      const editLabel = tComposerLang('actions.edit');
      const openLabel = tComposerLang('actions.open');
      const removeLangLabel = tComposerLang('removeLanguage');
      const addLangLabel = tComposerLang('addLanguage');
      langs.forEach(lang => {
        const v = entry[lang] || { title: '', location: '' };
        const flag = langFlag(lang);
        const langLabel = displayLangName(lang);
        const safeLabel = escapeHtml(langLabel || '');
        const flagSpan = flag ? `<span class="ct-lang-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : '';
        const block = document.createElement('div');
        block.className = 'ct-lang';
        block.dataset.lang = lang;
        const initialPath = normalizeRelPath(v.location);
        if (initialPath) block.dataset.mdPath = initialPath;
        else delete block.dataset.mdPath;
        block.innerHTML = `
          <div class="ct-lang-label" aria-label="${safeLabel}" title="${safeLabel}">
            <span class="ct-draft-indicator" aria-hidden="true" hidden></span>
            ${flagSpan}
            <span class="ct-lang-code" aria-hidden="true">${escapeHtml(lang.toUpperCase())}</span>
          </div>
          <div class="ct-lang-main">
            <div class="ct-field ct-field-location"><span class="ct-field-label">${escapeHtml(v.location || '')}</span></div>
            <div class="ct-lang-actions">
              <button type="button" class="btn-secondary ct-edit" title="${escapeHtml(openLabel)}">${escapeHtml(editLabel)}</button>
              <button type="button" class="btn-secondary ct-lang-del">${escapeHtml(removeLangLabel)}</button>
            </div>
          </div>
        `;
        const langRemoveBtn = $('.ct-lang-del', block);
        if (langRemoveBtn) {
          langRemoveBtn.setAttribute('title', removeLangLabel);
          langRemoveBtn.setAttribute('aria-label', removeLangLabel);
        }
        updateComposerMarkdownDraftIndicators({ element: block, path: initialPath });
        $('.ct-edit', block).addEventListener('click', () => {
          const rel = normalizeRelPath(v.location);
          if (!rel) {
            alert(tComposer('markdown.openBeforeEditor'));
            return;
          }
          openMarkdownInEditor(rel, {
            source: 'tabs',
            key,
            lang,
            editorTreeNodeId: `tabs:${key}:${lang}`
          });
        });
        $('.ct-lang-del', block).addEventListener('click', () => {
          delete entry[lang];
          const meta = row.querySelector('.ct-meta');
          if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
          renderBody();
          broadcastLanguagePoolChange();
          markDirty();
        });
        bodyInner.appendChild(block);
      });

      // Add-language via custom dropdown showing only missing languages
      const supportedLangs = PREFERRED_LANG_ORDER.slice();
      const available = supportedLangs.filter(l => !entry[l]);
      if (available.length > 0) {
        const addLangWrap = document.createElement('div');
        addLangWrap.className = 'ct-add-lang has-menu';
        addLangWrap.innerHTML = `
          <button type="button" class="btn-secondary ct-add-lang-btn" aria-haspopup="listbox" aria-expanded="false">${escapeHtml(addLangLabel)}</button>
          <div class="ct-lang-menu ns-menu" role="listbox" hidden>
            ${available.map(l => `<button type="button" role="option" class="ns-menu-item" data-lang="${escapeHtml(l)}">${escapeHtml(displayLangName(l))}</button>`).join('')}
          </div>
        `;
        const btn = $('.ct-add-lang-btn', addLangWrap);
        const menu = $('.ct-lang-menu', addLangWrap);
        if (btn) {
          btn.setAttribute('title', addLangLabel);
          btn.setAttribute('aria-label', addLangLabel);
        }
        function closeMenu(){
          if (menu.hidden) return;
          const finish = () => {
            menu.hidden = true;
            btn.classList.remove('is-open');
            addLangWrap.classList.remove('is-open');
            btn.setAttribute('aria-expanded','false');
            document.removeEventListener('mousedown', onDocDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            menu.classList.remove('is-closing');
          };
          try {
            menu.classList.add('is-closing');
            const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
            menu.addEventListener('animationend', onEnd, { once: true });
            setTimeout(finish, 180);
          } catch(_) { finish(); }
        }
        function openMenu(){
          if (!menu.hidden) return;
          menu.hidden = false;
          try { menu.classList.remove('is-closing'); } catch(_){}
          btn.classList.add('is-open');
          addLangWrap.classList.add('is-open');
          btn.setAttribute('aria-expanded','true');
          try { menu.querySelector('.ns-menu-item')?.focus(); } catch(_){}
          document.addEventListener('mousedown', onDocDown, true);
          document.addEventListener('keydown', onKeyDown, true);
        }
        function onDocDown(e){ if (!addLangWrap.contains(e.target)) closeMenu(); }
        function onKeyDown(e){ if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } }
        btn.addEventListener('click', () => { btn.classList.contains('is-open') ? closeMenu() : openMenu(); });
        menu.querySelectorAll('.ns-menu-item').forEach(it => {
          it.addEventListener('click', () => {
            const code = String(it.getAttribute('data-lang')||'').trim();
            if (!code || entry[code]) return;
            const defaultLocation = buildDefaultLanguagePathFromEntry('tabs', tab, code, entry);
            entry[code] = {
              title: String(tab || ''),
              location: defaultLocation || ''
            };
            const meta = row.querySelector('.ct-meta');
            if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
            closeMenu();
            renderBody();
            broadcastLanguagePoolChange();
            markDirty();
          });
        });
        bodyInner.appendChild(addLangWrap);
      }
      updateComposerDraftContainerState(row);
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const isOpen = body.dataset.open === '1';
      const next = !isOpen;
      row.classList.toggle('is-open', next);
      btnExpand.setAttribute('aria-expanded', String(next));
      slideToggle(body, next);
      scheduleComposerOrderPreviewRelayout('tabs');
    });
    btnDel.addEventListener('click', () => {
      const i = state.tabs.__order.indexOf(tab);
      if (i >= 0) state.tabs.__order.splice(i, 1);
      delete state.tabs[tab];
      row.remove();
      markDirty();
    });
  });

  makeDragList(list, (newOrder) => {
    state.tabs.__order = newOrder;
    markDirty();
  });

  try {
    if (composerOrderPreviewActiveKind === 'tabs') updateComposerOrderPreview('tabs');
  } catch (_) {}
}

function getDefaultComposerLanguage() {
  if (Array.isArray(PREFERRED_LANG_ORDER) && PREFERRED_LANG_ORDER.length > 0) {
    return PREFERRED_LANG_ORDER[0];
  }
  return 'en';
}

function buildDefaultEntryPath(kind, key, lang) {
  const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
  const baseFolder = normalizedKind === 'tabs' ? 'tab' : 'post';
  const safeKey = String(key || '').trim();
  const fallbackLang = String(lang || '').trim() || getDefaultComposerLanguage() || 'en';
  const normalizedLang = fallbackLang.toLowerCase();
  const filename = normalizedLang ? `main_${normalizedLang}.md` : 'main.md';
  const folder = normalizedKind === 'tabs'
    ? (safeKey ? `${baseFolder}/${safeKey}` : baseFolder)
    : (safeKey ? `${baseFolder}/${safeKey}/v1.0.0` : `${baseFolder}/v1.0.0`);
  return `${folder}/${filename}`;
}

function normalizeComposerLangCode(lang) {
  return String(lang || '').trim().toLowerCase();
}

function normalizeComposerVersionTag(version) {
  const raw = String(version || '').trim();
  if (!raw) return '';
  return `v${raw.replace(/^v/i, '')}`;
}

function normalizeComposerVersionPaths(value) {
  if (Array.isArray(value)) return value.filter(path => !!normalizeRelPath(path));
  const normalized = normalizeRelPath(value);
  return normalized ? [normalized] : [];
}

function isComposerVersionTag(version) {
  return /^v\d+(?:\.\d+)*$/i.test(String(version || '').trim());
}

function isComposerVersionSegment(segment) {
  return /^v\d+(?:\.\d+)*$/i.test(String(segment || '').trim());
}

function stripComposerLangSuffix(name, codes) {
  let result = String(name || '');
  if (!result) return result;
  const seen = new Set();
  (codes || []).forEach((code) => {
    const normalized = normalizeComposerLangCode(code);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const suffix = `_${normalized}`;
    if (result.toLowerCase().endsWith(suffix)) {
      result = result.slice(0, result.length - suffix.length);
    }
  });
  return result;
}

function pickComposerReferencePath(kind, entry, excludeLang) {
  const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
  const list = Array.isArray(PREFERRED_LANG_ORDER) ? PREFERRED_LANG_ORDER.slice() : [];
  try {
    Object.keys(entry || {}).forEach((code) => {
      if (!list.includes(code)) list.push(code);
    });
  } catch (_) {}
  for (let i = 0; i < list.length; i += 1) {
    const code = list[i];
    if (!code || code === excludeLang) continue;
    const value = entry ? entry[code] : null;
    if (!value) continue;
    let path = '';
    if (normalizedKind === 'tabs') {
      if (value && typeof value === 'object' && typeof value.location === 'string') {
        path = value.location;
      }
    } else if (Array.isArray(value)) {
      path = value.find(p => p && typeof p === 'string') || '';
    } else if (typeof value === 'string') {
      path = value;
    }
    if (path) return { lang: code, path };
  }
  return null;
}

function buildDefaultLanguagePathFromEntry(kind, key, lang, entry) {
  const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
  const fallback = buildDefaultEntryPath(normalizedKind, key, lang);
  const reference = pickComposerReferencePath(normalizedKind, entry, lang);
  if (!reference || !reference.path) return fallback;

  const normalizedLang = normalizeComposerLangCode(lang);
  const segments = String(reference.path || '').split('/');
  if (segments.length === 0) return fallback;
  let filename = segments.pop() || '';
  if (!filename) return fallback;

  const dotIndex = filename.lastIndexOf('.');
  let namePart = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const extPart = dotIndex >= 0 ? filename.slice(dotIndex) : '';

  const codesToStrip = [];
  codesToStrip.push(reference.lang);
  if (Array.isArray(PREFERRED_LANG_ORDER)) codesToStrip.push(...PREFERRED_LANG_ORDER);
  try { Object.keys(entry || {}).forEach((code) => { codesToStrip.push(code); }); } catch (_) {}
  codesToStrip.push(lang);
  namePart = stripComposerLangSuffix(namePart, codesToStrip);

  const finalName = normalizedLang ? `${namePart}_${normalizedLang}` : namePart;
  filename = `${finalName}${extPart}`;
  if (normalizedKind === 'index') {
    const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
    if (versionIndex >= 0) segments[versionIndex] = 'v1.0.0';
    else segments.push('v1.0.0');
  }
  segments.push(filename);
  return segments.join('/');
}

function buildArticleVersionPath(key, lang, version, entry) {
  const normalizedVersion = normalizeComposerVersionTag(version);
  const normalizedLang = normalizeComposerLangCode(lang);
  const sourceEntry = entry && typeof entry === 'object' ? entry : getIndexEntry(key);
  const current = normalizeComposerVersionPaths(sourceEntry[lang]);
  const reference = current[current.length - 1] || buildDefaultLanguagePathFromEntry('index', key, normalizedLang, sourceEntry);
  const fallback = buildDefaultEntryPath('index', key, normalizedLang).replace('/v1.0.0/', `/${normalizedVersion}/`);
  const normalizedPath = normalizeRelPath(reference || fallback);
  if (!normalizedPath) return fallback;
  const segments = normalizedPath.split('/');
  let filename = segments.pop() || '';
  if (!filename) filename = normalizedLang ? `main_${normalizedLang}.md` : 'main.md';
  const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
  if (versionIndex >= 0) segments[versionIndex] = normalizedVersion;
  else segments.push(normalizedVersion);
  segments.push(filename);
  return segments.join('/');
}

function collectComposerArticleVersions(paths) {
  const versions = new Set();
  const arr = normalizeComposerVersionPaths(paths);
  arr.forEach((path) => {
    const explicitVersion = normalizeComposerVersionTag(extractVersionFromPath(path));
    if (explicitVersion) versions.add(explicitVersion.toLowerCase());
    else if (normalizeRelPath(path)) versions.add('v1.0.0');
  });
  return versions;
}

async function promptArticleVersionValue(key, lang, entry, anchor) {
  const arr = normalizeComposerVersionPaths(entry && entry[lang]);
  const existingVersions = collectComposerArticleVersions(arr);
  const langLabel = displayLangName(lang);
  const result = await showComposerAddEntryPrompt(anchor, {
    typeLabel: t('editor.composer.versionPrompt.label'),
    confirmLabel: t('editor.composer.versionPrompt.confirm'),
    placeholder: t('editor.composer.versionPrompt.placeholder'),
    message: t('editor.composer.versionPrompt.message', { key, lang: langLabel }),
    hint: t('editor.composer.versionPrompt.hint'),
    validate: (value) => {
      if (!value) return { ok: false, error: t('editor.composer.versionPrompt.errorEmpty') };
      if (!isComposerVersionTag(value)) return { ok: false, error: t('editor.composer.versionPrompt.errorInvalid') };
      const normalizedVersion = normalizeComposerVersionTag(value);
      if (existingVersions.has(normalizedVersion.toLowerCase())) {
        return { ok: false, error: t('editor.composer.versionPrompt.errorDuplicate', { version: normalizedVersion }) };
      }
      return { ok: true, value: normalizedVersion };
    }
  });
  return result && result.confirmed ? String(result.value || '').trim() : '';
}

async function promptComposerEntryKey(kind, anchor) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const slice = getStateSlice(normalized) || {};
  const existing = new Set();
  try {
    const order = Array.isArray(slice.__order) ? slice.__order : [];
    order.forEach((key) => {
      const normalizedKey = String(key || '').trim();
      if (normalizedKey) existing.add(normalizedKey);
    });
  } catch (_) {}
  try {
    Object.keys(slice || {}).forEach((key) => {
      if (key === '__order') return;
      const normalizedKey = String(key || '').trim();
      if (normalizedKey) existing.add(normalizedKey);
    });
  } catch (_) {}

  const typeKey = normalized === 'tabs' ? 'tab' : 'post';
  const typeLabel = t(`editor.composer.entryKinds.${typeKey}.label`);
  const confirmLabel = t(`editor.composer.entryKinds.${typeKey}.confirm`);
  const placeholder = t(`editor.composer.entryKinds.${typeKey}.placeholder`);
  const message = t(`editor.composer.entryKinds.${typeKey}.message`);

  try {
    const result = await showComposerAddEntryPrompt(anchor, {
      typeLabel,
      confirmLabel,
      placeholder,
      existingKeys: existing,
      message
    });
    if (!result || !result.confirmed) return '';
    return String(result.value || '').trim();
  } catch (err) {
    console.warn('Failed to capture new entry key', err);
    return '';
  }
}

function focusComposerEntry(kind, key) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const root = normalized === 'tabs' ? document.getElementById('composerTabs') : document.getElementById('composerIndex');
  if (!root) return;
  const selector = normalized === 'tabs' ? `.ct-item[data-key="${cssEscape(key)}"]` : `.ci-item[data-key="${cssEscape(key)}"]`;
  const row = root.querySelector(selector);
  if (!row) return;
  const body = row.querySelector(normalized === 'tabs' ? '.ct-body' : '.ci-body');
  const expandBtn = row.querySelector(normalized === 'tabs' ? '.ct-expand' : '.ci-expand');
  if (body) {
    body.style.display = 'block';
    body.dataset.open = '1';
    clearInlineSlideStyles(body);
  }
  if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
  row.classList.add('is-open');

  const preferredFocus = row.querySelector(normalized === 'tabs' ? '.ct-edit' : '.ci-lang-addver, .ci-edit');
  const fallbackFocus = row.querySelector('input, textarea, button');
  const target = preferredFocus || fallbackFocus;
  if (target && typeof target.focus === 'function') {
    try { target.focus(); } catch (_) {}
  }
  try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}

  scheduleComposerOrderPreviewRelayout(normalized);
}

async function addComposerEntry(kind, anchor) {
  const normalized = kind === 'tabs' ? 'tabs' : 'index';
  const slice = getStateSlice(normalized);
  if (!slice) return '';
  if (!Array.isArray(slice.__order)) slice.__order = [];

  let key = '';
  try {
    key = await promptComposerEntryKey(normalized, anchor);
  } catch (err) {
    console.warn('Failed to add composer entry', err);
    return '';
  }
  if (!key) return '';
  if (slice.__order.includes(key)) return '';

  if (normalized === 'tabs') {
    slice[key] = (slice[key] && typeof slice[key] === 'object') ? slice[key] : {};
    const lang = getDefaultComposerLanguage();
    if (lang && !slice[key][lang]) {
      const defaultPath = buildDefaultEntryPath('tabs', key, lang);
      slice[key][lang] = { title: key, location: defaultPath };
    }
  } else {
    slice[key] = (slice[key] && typeof slice[key] === 'object') ? slice[key] : {};
    const lang = getDefaultComposerLanguage();
    if (lang && !slice[key][lang]) {
      const defaultPath = buildDefaultEntryPath('index', key, lang);
      slice[key][lang] = [defaultPath];
    }
  }

  slice.__order.unshift(key);

  if (normalized === 'index') {
    rebuildIndexUI();
    notifyComposerChange('index');
  } else {
    rebuildTabsUI();
    notifyComposerChange('tabs');
  }

  requestAnimationFrame(() => focusComposerEntry(normalized, key));

  const message = normalized === 'tabs'
    ? `Tab entry "${key}" added. Fill in the details below.`
    : `Post entry "${key}" added. Fill in the details below.`;
  try { showToast('info', message); } catch (_) {}
  refreshEditorContentTree();
  return key;
}

function bindComposerUI(state) {
  mountEditorSystemPanels();
  initEditorOverlay();
  initEditorRailResize();
  initMobileEditorRail();
  bindEditorStatePersistenceListeners();

  // Overlay launchers and legacy mode buttons
  $$('.mode-tab').forEach(btn => {
    btn.addEventListener('click', (event) => {
      const mode = btn.dataset.mode;
      if (mode === 'composer' || mode === 'updates' || mode === 'sync') {
        event.preventDefault();
        openEditorOverlay(mode, btn);
        return;
      }
      applyMode(mode);
    });
  });
  try {
    initSystemUpdates({ onStateChange: () => { try { updateUnsyncedSummary(); } catch (_) {} } });
  } catch (err) {
    console.error('Failed to initialize system updates module', err);
  }

  // File switch (index.yaml <-> tabs.yaml)
  const links = $$('a.vt-btn[data-cfile]');
  const setFile = (name, options = {}) => {
    applyComposerFile(name, options);
    try {
      const normalized = name === 'tabs' ? 'tabs' : (name === 'site' ? 'site' : 'index');
      localStorage.setItem(LS_KEYS.cfile, normalized);
    } catch (_) {}
  };
  links.forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); setFile(a.dataset.cfile); }));
  // Respect persisted selection on load
  setFile(getInitialComposerFile(), { immediate: true });

  // ----- Composer: New Post Wizard -----
  // Legacy wizard removed in favor of inline add buttons.
  (function buildComposerGuide(){
    // Composer wizard removed; direct add buttons handle new entries.
  })();

  // Add item (Post or Tab) directly within the composer lists
  const btnAddItem = document.getElementById('btnAddItem');
  if (btnAddItem) {
    btnAddItem.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      const kind = getActiveComposerFile();
      const anchor = event && event.currentTarget ? event.currentTarget : btnAddItem;
      addComposerEntry(kind, anchor).catch((err) => {
        console.error('Failed to launch add entry prompt', err);
      });
    });
  }


  const btnDiscard = document.getElementById('btnDiscard');
  if (btnDiscard) btnDiscard.addEventListener('click', () => handleComposerDiscard(btnDiscard));

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => handleComposerRefresh(btnRefresh));

  const btnReview = document.getElementById('btnReview');
  if (btnReview) {
    btnReview.addEventListener('click', () => {
      const datasetKind = btnReview.dataset && btnReview.dataset.kind;
      const preferred = datasetKind === 'tabs' ? 'tabs' : datasetKind === 'index' ? 'index' : null;
      if (preferred) {
        openComposerDiffModal(preferred);
        return;
      }
      const summaryEntries = computeUnsyncedSummary();
      const activeKind = getActiveComposerFile();
      const normalizedActive = activeKind === 'tabs' ? 'tabs' : 'index';
      const entry = summaryEntries.find(item => item && item.kind === normalizedActive);
      if (entry) openComposerDiffModal(entry.kind);
    });
  }

  // Verify Setup: check all referenced files exist; if ok, check YAML drift
  (function bindVerifySetup(){
    function attach(btn) {
      if (!btn || btn.__composerVerifyBound) return;
      btn.__composerVerifyBound = true;
      const btnLabel = btn.querySelector('.btn-label');

    function dirname(p){ try { const s=String(p||''); const i=s.lastIndexOf('/'); return i>=0? s.slice(0,i) : ''; } catch(_) { return ''; } }
    function basename(p){ try { const s=String(p||''); const i=s.lastIndexOf('/'); return i>=0? s.slice(i+1) : s; } catch(_) { return String(p||''); } }
    function uniq(arr){ return Array.from(new Set(arr||[])); }

    function buildGhNewLink(owner, repo, branch, folderPath, filename) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(folderPath || '').replace(/^\/+/, '');
      const base = `https://github.com/${enc(owner)}/${enc(repo)}/new/${enc(branch)}/${clean}`;
      if (filename) return `${base}?filename=${enc(filename)}`;
      return base;
    }
    function buildGhEditFileLink(owner, repo, branch, filePath) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(filePath || '').replace(/^\/+/, '');
      return `https://github.com/${enc(owner)}/${enc(repo)}/edit/${enc(branch)}/${clean}`;
    }

    function normalizeTarget(value) {
      return value === 'tabs' ? 'tabs' : value === 'index' ? 'index' : null;
    }

    function resolveTargetKind(button) {
      const ds = button && button.dataset ? button.dataset.kind : null;
      const normalized = normalizeTarget(ds);
      if (normalized) return normalized;
      const attr = button && typeof button.getAttribute === 'function'
        ? normalizeTarget(button.getAttribute('data-kind'))
        : null;
      const fallback = getActiveComposerFile();
      return normalizeTarget(attr) || (fallback === 'tabs' ? 'tabs' : 'index');
    }

    async function computeMissingFiles(preferredKind){
      const contentRoot = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
      const out = [];
      const normalizedPreferred = normalizeTarget(preferredKind);
      const fallback = getActiveComposerFile();
      const target = normalizedPreferred || (fallback === 'tabs' ? 'tabs' : 'index');
      // Fetch existence in parallel batches
      const tasks = [];
      if (target === 'tabs') {
        const tbs = state.tabs || {};
        const keys = Object.keys(tbs).filter(k => k !== '__order');
        for (const key of keys){
          const langsObj = tbs[key] || {};
          const langs = sortLangKeys(langsObj);
          for (const lang of langs){
            const obj = langsObj[lang];
            const rel = obj && typeof obj === 'object' ? obj.location : '';
            if (!rel) continue; // skip empty
            const url = `${contentRoot}/${String(rel||'')}`;
            tasks.push((async () => {
              try {
                const r = await fetch(url, { cache: 'no-store' });
                if (!r || !r.ok) {
                  out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
                }
              } catch(_) { out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) }); }
            })());
          }
        }
      } else {
        const idx = state.index || {};
        const keys = Object.keys(idx).filter(k => k !== '__order');
        for (const key of keys){
          const langsObj = idx[key] || {};
          const langs = sortLangKeys(langsObj);
          for (const lang of langs){
            const val = langsObj[lang];
            const paths = Array.isArray(val) ? val.slice() : (typeof val === 'string' ? [val] : []);
            for (const rel of paths){
              const url = `${contentRoot}/${String(rel||'')}`;
              tasks.push((async () => {
                try {
                  const r = await fetch(url, { cache: 'no-store' });
                  if (!r || !r.ok) {
                    out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
                  }
                } catch(_) { out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) }); }
              })());
            }
          }
        }
      }
      await Promise.all(tasks);
      return out;
    }

    function openVerifyModal(missing, targetKind){
      // Build modal
      const modal = document.createElement('div');
      modal.className = 'ns-modal'; modal.setAttribute('aria-hidden', 'true');
      const dialog = document.createElement('div'); dialog.className = 'ns-modal-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
      const head = document.createElement('div'); head.className = 'comp-guide-head';
      const left = document.createElement('div'); left.className='comp-head-left';
      const title = document.createElement('strong'); title.textContent = 'Verify Setup – Missing Files'; title.id='verifyTitle';
      const sub = document.createElement('span'); sub.className='muted'; sub.textContent = 'Create missing files on GitHub, then Verify again';
      left.appendChild(title); left.appendChild(sub);
      const btnClose = document.createElement('button'); btnClose.className = 'ns-modal-close btn-secondary'; btnClose.type = 'button'; btnClose.textContent = 'Cancel'; btnClose.setAttribute('aria-label','Cancel');
      head.appendChild(left); head.appendChild(btnClose);
      dialog.appendChild(head);

      const body = document.createElement('div'); body.className = 'comp-guide';
      const listWrap = document.createElement('div'); listWrap.style.margin = '.4rem 0';

      function renderList(items){
        listWrap.innerHTML = '';
        if (!items || !items.length){
          const p = document.createElement('p'); p.textContent = 'All files are present.'; listWrap.appendChild(p); return;
        }
        // Group: key -> lang -> entries
        const byKey = new Map();
        for (const it of items){
          if (!byKey.has(it.key)) byKey.set(it.key, new Map());
          const g = byKey.get(it.key);
          if (!g.has(it.lang)) g.set(it.lang, []);
          g.get(it.lang).push(it);
        }
        // Render groups
        for (const [key, g] of byKey.entries()){
          const sec = document.createElement('section');
          sec.style.border='1px solid var(--border)';
          sec.style.borderRadius='8px';
          sec.style.padding='.5rem';
          sec.style.margin='.5rem 0';
          sec.style.background='var(--card)';
          // Emphasize error groups with a subtle red border
          sec.style.borderColor = '#fecaca';
          const h = document.createElement('div'); h.style.display='flex'; h.style.alignItems='center'; h.style.gap='.5rem';
          const title = document.createElement('strong'); title.textContent = key; h.appendChild(title);
          // Badges
          const meta = document.createElement('span'); meta.className='summary-badges';
          const langs = Array.from(g.keys()); if (langs.length){ const b=document.createElement('span'); b.className='badge badge-lang'; b.textContent = langs.map(x=>String(x).toUpperCase()).join(' '); meta.appendChild(b); }
          h.appendChild(meta);
          sec.appendChild(h);
          for (const [lang, arr] of g.entries()){
            const langBox = document.createElement('div'); langBox.className='ci-lang';
            const lh = document.createElement('div'); lh.className='ci-lang-head';
            const lab = document.createElement('span'); lab.textContent = `Language: ${String(lang).toUpperCase()}`; lh.appendChild(lab);
            langBox.appendChild(lh);
            arr.sort((a,b)=>{
              const av = a.version || ''; const bv = b.version || '';
              if (av && bv && av!==bv){
                // compare version desc
                const vp = (v)=>String(v||'').replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0);
                const aa=vp(av), bb=vp(bv); const L=Math.max(aa.length, bb.length);
                for (let i=0;i<L;i++){ const x=aa[i]||0, y=bb[i]||0; if (x!==y) return y-x; }
              }
              return String(a.path).localeCompare(String(b.path));
            });
            for (const it of arr){
              const row = document.createElement('div'); row.className='ci-ver-item';
              const badge = document.createElement('span'); badge.className='badge badge-ver'; badge.textContent = it.version ? it.version : '—'; row.appendChild(badge);
              const p = document.createElement('code'); p.textContent = it.path; p.style.flex='1 1 auto'; row.appendChild(p);
              const actions = document.createElement('div'); actions.className='ci-ver-actions'; actions.style.display='inline-flex'; actions.style.gap='.35rem';
              const { owner, name, branch } = getActiveSiteRepoConfig();
              const root = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
              const aNew = document.createElement('a');
              const canGh = !!(owner && name);
              aNew.className = canGh ? 'btn-secondary btn-github' : 'btn-secondary'; aNew.target='_blank'; aNew.rel='noopener';
              if (canGh) {
                aNew.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg><span class="btn-label">Create File</span>';
              } else {
                aNew.textContent = 'Create File';
              }
              // For missing files under post/..., prefill with default front-matter
              if (canGh) {
                const branchName = branch || 'main';
                let href = buildGhNewLink(owner, name, branchName, `${root}/${it.folder}`, it.filename);
                try {
                  if (String(it.folder || '').replace(/^\/+/, '').startsWith('post/')) {
                    const ver = it && it.version ? String(it.version) : '';
                    href += `&value=${encodeURIComponent(makeDefaultMdTemplate(ver ? { version: ver } : undefined))}`;
                  }
                } catch(_) {}
                aNew.href = href;
              } else {
                aNew.href = '#';
              }
              aNew.title = 'Open GitHub new file page with prefilled filename';
              actions.appendChild(aNew);
              row.appendChild(actions);
              langBox.appendChild(row);
            }
            sec.appendChild(langBox);
          }
          // Card-bottom red banner like the new post wizard
          const groupCount = Array.from(g.values()).reduce((acc,arr)=>acc + (Array.isArray(arr)?arr.length:0), 0);
          const warn = document.createElement('div'); warn.className='comp-warn';
          const wt = document.createElement('div'); wt.className='comp-warn-text';
          wt.textContent = `${groupCount} missing item(s) remain for this key. Create the files above on GitHub, then Verify again.`;
          warn.appendChild(wt);
          sec.appendChild(warn);
          listWrap.appendChild(sec);
        }
      }

      renderList(missing);

      body.appendChild(listWrap);
      dialog.appendChild(body);
      const foot = document.createElement('div'); foot.style.display='flex'; foot.style.justifyContent='flex-end'; foot.style.gap='.5rem'; foot.style.marginTop='.5rem';
      const btnVerify = document.createElement('button'); btnVerify.className='btn-primary'; btnVerify.textContent='Verify';
      foot.appendChild(btnVerify);
      dialog.appendChild(foot);
      modal.appendChild(dialog);
      document.body.appendChild(modal);

      function open(){
        const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
        try { modal.classList.remove('ns-anim-out'); } catch(_) {}
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden','false');
        document.body.classList.add('ns-modal-open');
        if (!reduce) {
          try {
            modal.classList.add('ns-anim-in');
            const onEnd = () => { try { modal.classList.remove('ns-anim-in'); } catch(_) {}; dialog.removeEventListener('animationend', onEnd); };
            dialog.addEventListener('animationend', onEnd, { once: true });
          } catch(_) {}
        }
      }
      function close(){
        const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
        const done = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('ns-modal-open'); try { modal.remove(); } catch(_) {} };
        if (reduce) { done(); return; }
        try { modal.classList.remove('ns-anim-in'); } catch(_) {}
        try { modal.classList.add('ns-anim-out'); } catch(_) {}
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); try { modal.classList.remove('ns-anim-out'); } catch(_) {}; done(); };
        try {
          dialog.addEventListener('animationend', onEnd, { once: true });
          setTimeout(onEnd, 200);
        } catch(_) { onEnd(); }
      }

      btnClose.addEventListener('click', close);
      modal.addEventListener('mousedown', (e)=>{ if (e.target === modal) close(); });
      modal.addEventListener('keydown', (e)=>{ if ((e.key||'').toLowerCase()==='escape') close(); });
      btnVerify.addEventListener('click', async ()=>{
        btnVerify.disabled = true; btnVerify.textContent = t('editor.composer.verifying');
        try {
          const normalizedTarget = normalizeTarget(targetKind) || (getActiveComposerFile() === 'tabs' ? 'tabs' : 'index');
          // Also copy YAML snapshot here to leverage the user gesture
          try {
            const text = normalizedTarget === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
            nsCopyToClipboard(text);
          } catch(_) {}
          const now = await computeMissingFiles(normalizedTarget);
          if (!now.length){ close(); await afterAllGood(normalizedTarget); }
          else { renderList(now); /* no toast: inline red banner shows status */ }
        } finally {
          try { btnVerify.disabled = false; btnVerify.textContent = t('editor.composer.verify'); } catch(_) {}
        }
      });

      open();
    }

    async function afterAllGood(targetKind){
      // Compare current in-memory YAML vs remote file; open GitHub edit if differs
      const contentRoot = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
      const fallback = getActiveComposerFile();
      const target = normalizeTarget(targetKind) || (fallback === 'tabs' ? 'tabs' : 'index');
      const desired = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
      async function fetchText(url){ try { const r = await fetch(url, { cache: 'no-store' }); if (r && r.ok) return await r.text(); } catch(_){} return ''; }
      const baseName = target === 'tabs' ? 'tabs' : 'index';
      const url1 = `${contentRoot}/${baseName}.yaml`; const url2 = `${contentRoot}/${baseName}.yml`;
      const cur = (await fetchText(url1)) || (await fetchText(url2));
      const norm = (s)=>String(s||'').replace(/\r\n/g,'\n').trim();
      const popup = preparePopupWindow();
      if (norm(cur) === norm(desired)) {
        closePopupWindow(popup);
        showToast('success', t('editor.toasts.yamlUpToDate', { name: `${baseName}.yaml` }));
        try {
          const snapshot = await fetchComposerRemoteSnapshot(target);
          if (snapshot && snapshot.state === 'existing') {
            applyComposerRemoteSnapshot(target, snapshot);
            clearDraftStorage(target);
            updateUnsyncedSummary();
          }
        } catch (err) {
          console.warn('Composer: failed to refresh baseline after verify', err);
        }
        return;
      }
      // Need update -> copy and open GitHub edit/new page
      try { nsCopyToClipboard(desired); } catch(_) {}
      const { owner, name, branch } = getActiveSiteRepoConfig();
      if (owner && name){
        let href = '';
        if (cur) href = buildGhEditFileLink(owner, name, branch, `${contentRoot}/${baseName}.yaml`);
        else href = buildGhNewLink(owner, name, branch, `${contentRoot}`, `${baseName}.yaml`);
        if (!href) {
          closePopupWindow(popup);
          showToast('error', t('editor.toasts.unableResolveYamlSync'));
          return;
        }
        const successMessage = cur
          ? t('editor.composer.yaml.toastCopiedUpdate', { name: `${baseName}.yaml` })
          : t('editor.composer.yaml.toastCopiedCreate', { name: `${baseName}.yaml` });
        const blockedMessage = t('editor.composer.yaml.blocked', { name: `${baseName}.yaml` });

        const startWatcher = () => {
          startComposerSyncWatcher(target, {
            expectedText: desired,
            message: t('editor.composer.remoteWatcher.waitingForLabel', { label: `${baseName}.yaml` })
          });
        };

        const opened = finalizePopupWindow(popup, href);
        if (opened) {
          showToast('info', successMessage);
          startWatcher();
        } else {
          closePopupWindow(popup);
          handlePopupBlocked(href, {
            message: blockedMessage,
            actionLabel: t('editor.toasts.openGithubAction'),
            onRetry: () => {
              showToast('info', successMessage);
              startWatcher();
            }
          });
        }
      } else {
        closePopupWindow(popup);
        showToast('info', t('editor.toasts.yamlCopiedNoRepo'));
      }
    }

      btn.addEventListener('click', async () => {
        // Perform first pass; if any missing, show modal list; otherwise go to YAML check
        try {
          btn.disabled = true;
          if (btnLabel) btnLabel.textContent = t('editor.composer.verifying');
          else btn.textContent = t('editor.composer.verifying');
        } catch(_) {}
      try {
        const targetKind = resolveTargetKind(btn);
        const target = targetKind === 'tabs' ? 'tabs' : 'index';
        // Copy YAML snapshot up-front to retain user-activation for clipboard
        try {
          const text = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
          nsCopyToClipboard(text);
        } catch(_) {}
        const missing = await computeMissingFiles(target);
        if (missing.length) openVerifyModal(missing, target);
        else await afterAllGood(target);
      } finally {
        try {
          btn.disabled = false;
          // Restore original label
          const restoreLabel = getMarkdownPushLabel('default');
          if (btnLabel) btnLabel.textContent = restoreLabel;
          else btn.textContent = restoreLabel;
        } catch(_) {}
      }
      });
      }

      const initialVerifyButton = document.getElementById('btnVerify');
      if (initialVerifyButton) attach(initialVerifyButton);
    })();
  }

function showStatus(msg, kind = 'info') {
  if (msg) {
    const type = typeof kind === 'string' ? kind : 'info';
    showToast(type, msg);
  }
  updateUnsyncedSummary();
}

document.addEventListener('DOMContentLoaded', async () => {
  const pushBtn = document.getElementById('btnPushMarkdown');
  if (pushBtn) {
    markdownPushButton = pushBtn;
    pushBtn.addEventListener('click', async (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const active = getActiveDynamicTab();
      if (!active) {
        showToast('info', t('editor.toasts.markdownOpenBeforePush'));
        return;
      }

      const button = markdownPushButton;
      const originalLabel = getButtonLabel(button) || getMarkdownPushLabel('default');
      const setBusyState = (busy, text) => {
        if (!button) return;
        if (busy) {
          button.classList.add('is-busy');
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
          button.setAttribute('aria-disabled', 'true');
          if (text) setButtonLabel(button, text);
        } else {
          button.classList.remove('is-busy');
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.setAttribute('aria-disabled', 'false');
          if (text) setButtonLabel(button, text);
        }
      };

      setBusyState(true, t('editor.composer.remoteWatcher.preparing'));
      try {
        await openMarkdownPushOnGitHub(active);
      } finally {
        setBusyState(false, originalLabel);
        updateMarkdownPushButton(active);
      }
    });
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  const saveBtn = document.getElementById('btnSaveMarkdown');
  if (saveBtn) {
    markdownSaveButton = saveBtn;
    saveBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      manualSaveActiveMarkdown(saveBtn);
    });
    updateMarkdownSaveButton(getActiveDynamicTab());
  }

  const discardBtn = document.getElementById('btnDiscardMarkdown');
  if (discardBtn) {
    markdownDiscardButton = discardBtn;
    discardBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      discardMarkdownLocalChanges(null, discardBtn);
    });
    updateMarkdownDiscardButton(getActiveDynamicTab());
  }

  try {
    if (!window.__ns_site_repo || typeof window.__ns_site_repo !== 'object') {
      window.__ns_site_repo = { owner: '', name: '', branch: 'main' };
    }
  } catch (_) {}

  const state = { index: {}, tabs: {}, site: {} };
  showStatus(t('editor.composer.statusMessages.loadingConfig'));
  try {
    const site = await fetchComposerTrackedSiteConfig();
    const effectiveSite = applyComposerEffectiveSiteConfig(site);
    const root = (effectiveSite && effectiveSite.contentRoot) ? String(effectiveSite.contentRoot) : 'wwwroot';
    updateMarkdownPushButton(getActiveDynamicTab());
    const remoteSite = prepareSiteState(site || {});
    const [idx, tbs] = await Promise.all([
      fetchConfigWithYamlFallback([`${root}/index.yaml`, `${root}/index.yml`]),
      fetchConfigWithYamlFallback([`${root}/tabs.yaml`, `${root}/tabs.yml`])
    ]);
    const remoteIndex = prepareIndexState(idx || {});
    const remoteTabs = prepareTabsState(tbs || {});
    remoteBaseline.index = deepClone(remoteIndex);
    remoteBaseline.tabs = deepClone(remoteTabs);
    remoteBaseline.site = cloneSiteState(remoteSite);
    state.index = deepClone(remoteIndex);
    state.tabs = deepClone(remoteTabs);
    state.site = cloneSiteState(remoteSite);
  } catch (e) {
    console.warn('Composer: failed to load configs', e);
    remoteBaseline.index = { __order: [] };
    remoteBaseline.tabs = { __order: [] };
    remoteBaseline.site = cloneSiteState(prepareSiteState({}));
    state.index = { __order: [] };
    state.tabs = { __order: [] };
    state.site = cloneSiteState(prepareSiteState({}));
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  activeComposerState = state;
  const restoredDrafts = loadDraftSnapshotsIntoState(state);
  applyComposerEffectiveSiteConfig(state.site);
  updateMarkdownPushButton(getActiveDynamicTab());

  if (restoredDrafts.length) {
    const label = restoredDrafts.map(k => (k === 'tabs' ? 'tabs.yaml' : k === 'site' ? 'site.yaml' : 'index.yaml')).join(' & ');
    showStatus(t('editor.composer.statusMessages.restoredDraft', { label }));
    setTimeout(() => { showStatus(''); }, 1800);
  } else {
    showStatus('');
  }

  bindComposerUI(state);
  buildIndexUI($('#composerIndex'), state);
  buildTabsUI($('#composerTabs'), state);
  buildSiteUI($('#composerSite'), state);

  notifyComposerChange('index', { skipAutoSave: true });
  notifyComposerChange('tabs', { skipAutoSave: true });
  notifyComposerChange('site', { skipAutoSave: true });

  refreshEditorContentTree();
  const restoredEditorState = restoreDynamicEditorState();
  if (!restoredEditorState) applyMode('editor');
  allowEditorStatePersist = true;
  if (restoredEditorState) {
    try { window.setTimeout(() => persistDynamicEditorState(), 500); }
    catch (_) { persistDynamicEditorState(); }
  } else {
    persistDynamicEditorState();
  }
});

function buildSiteUI(root, state) {
  if (!root) return;
  root.innerHTML = '';
  try {
    if (typeof root.__nsSiteCompactNavCleanup === 'function') root.__nsSiteCompactNavCleanup();
  } catch (_) {}
  try { root.__nsSiteCompactNavCleanup = null; } catch (_) {}
  try {
    if (typeof root.__nsSiteNavOrientationCleanup === 'function') root.__nsSiteNavOrientationCleanup();
  } catch (_) {}
  try { root.__nsSiteNavOrientationCleanup = null; } catch (_) {}
  try {
    if (typeof root.__nsSiteScrollSyncCleanup === 'function') root.__nsSiteScrollSyncCleanup();
  } catch (_) {}
  try { root.__nsSiteScrollSyncCleanup = null; } catch (_) {}
  try {
    if (typeof root.__nsSiteSingleLabelWidthCleanup === 'function') root.__nsSiteSingleLabelWidthCleanup();
  } catch (_) {}
  try { root.__nsSiteSingleLabelWidthCleanup = null; } catch (_) {}
  try {
    if (typeof root.__nsSiteNavFocusHandler === 'function') root.removeEventListener('focusin', root.__nsSiteNavFocusHandler);
  } catch (_) {}
  try { root.__nsSiteNavFocusHandler = null; } catch (_) {}
  try { root.__nsSiteNavRefresh = null; } catch (_) {}
  try { root.__nsSiteNavSetActive = null; } catch (_) {}
  try { root.__nsSiteFirstSectionId = null; } catch (_) {}
  try { root.__nsSiteRevealField = null; } catch (_) {}
  if (!state || typeof state !== 'object') return;
  let site = state.site;
  if (!site || typeof site !== 'object') {
    site = cloneSiteState(prepareSiteState({}));
    state.site = site;
  }
  setStateSlice('site', site);

  const container = document.createElement('div');
  container.className = 'cs-root';
  root.appendChild(container);

  const sectionsMeta = [];
  let activeSectionId = '';
  let syncCompactNavState = () => {};
  const rootHadVisibleLayout = (() => {
    try { return !!(root.getClientRects && root.getClientRects().length); }
    catch (_) { return false; }
  })();
  const preservedActiveLabel = (() => {
    if (!rootHadVisibleLayout) return '';
    try { return String(root.__nsSiteActiveSection || '').trim(); }
    catch (_) { return ''; }
  })();

  const getNow = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      try { return performance.now(); } catch (_) {}
    }
    try { return Date.now(); } catch (_) { return 0; }
  };

  let scrollSyncHandle = null;
  let scrollSyncHandleType = '';
  let scrollSyncLockUntil = 0;

  const escapeFieldKey = (value) => {
    const raw = value == null ? '' : String(value);
    try {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(raw);
    } catch (_) {}
    return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };

  const layout = document.createElement('div');
  layout.className = 'cs-layout';
  container.appendChild(layout);

  const viewport = document.createElement('div');
  viewport.className = 'cs-viewport';
  layout.appendChild(viewport);

  const resolveViewportAnchorTop = () => {
    if (typeof window === 'undefined') return 0;
    let toolbarOffset = 0;
    try {
      const docStyles = window.getComputedStyle(document.documentElement);
      const parsedToolbar = parseFloat(docStyles && docStyles.getPropertyValue('--editor-toolbar-offset'));
      if (Number.isFinite(parsedToolbar)) toolbarOffset = Math.max(parsedToolbar, 0);
    } catch (_) {}

    let desiredTop = Math.max(toolbarOffset + 12, 12);
    try {
      const scrollContainer = resolveSiteScrollContainer();
      if (scrollContainer && scrollContainer !== window && typeof scrollContainer.getBoundingClientRect === 'function') {
        const containerRect = scrollContainer.getBoundingClientRect();
        if (containerRect && Number.isFinite(containerRect.top)) {
          desiredTop = Math.max(containerRect.top + 12, 12);
        }
      }
    } catch (_) {}
    return desiredTop;
  };

  const resolveSiteScrollContainer = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    try {
      const viewport = root ? root.querySelector('.cs-viewport') : null;
      if (viewport) {
        const styles = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(viewport) : null;
        const overflowY = styles ? String(styles.overflowY || '') : '';
        const canOwnScroll = /(auto|scroll|overlay)/.test(overflowY)
          && (!viewport.getClientRects || viewport.getClientRects().length > 0);
        if (canOwnScroll) return viewport;
      }
    } catch (_) {}
    try {
      const modalBody = root && typeof root.closest === 'function' ? root.closest('.editor-modal-body') : null;
      if (modalBody) return modalBody;
    } catch (_) {}
    let node = root && root.parentElement ? root.parentElement : null;
    while (node && node !== document.body && node !== document.documentElement) {
      try {
        const styles = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(node) : null;
        const overflowY = styles ? String(styles.overflowY || '') : '';
        const canScroll = /(auto|scroll|overlay)/.test(overflowY)
          && (node.scrollHeight || 0) > (node.clientHeight || 0) + 1;
        if (canScroll) return node;
      } catch (_) {}
      node = node.parentElement;
    }
    return window;
  };

  const getSiteScrollTop = (scrollContainer) => {
    if (!scrollContainer || scrollContainer === window) {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }
    return scrollContainer.scrollTop || 0;
  };

  const getSiteViewportHeight = (scrollContainer) => {
    if (!scrollContainer || scrollContainer === window) {
      return window.innerHeight || document.documentElement.clientHeight || 0;
    }
    return scrollContainer.clientHeight || window.innerHeight || document.documentElement.clientHeight || 0;
  };

  const scrollSiteContainerTo = (scrollContainer, targetY, behavior) => {
    if (!scrollContainer || scrollContainer === window) {
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: targetY, behavior });
        } catch (_) {
          window.scrollTo(0, targetY);
        }
      }
      return;
    }
    if (typeof scrollContainer.scrollTo === 'function') {
      try {
        scrollContainer.scrollTo({ top: targetY, behavior });
      } catch (_) {
        scrollContainer.scrollTo(0, targetY);
      }
    } else {
      scrollContainer.scrollTop = targetY;
    }
  };

  function setActiveSection(sectionId, options = {}) {
    if (!sectionId || !sectionsMeta.length) return;
    let resolved = false;
    let focusTarget = null;
    let activeMeta = null;
    const shouldScroll = options && options.scrollViewport !== false;
    const skipScrollLock = !!(options && options.skipScrollLock);
    sectionsMeta.forEach((meta) => {
      if (!meta || !meta.section) return;
      const isActive = meta.id === sectionId;
      if (isActive) {
        activeSectionId = sectionId;
        resolved = true;
        activeMeta = meta;
        try { meta.section.removeAttribute('hidden'); } catch (_) {}
        meta.section.classList.add('is-active');
        meta.section.setAttribute('aria-hidden', 'false');
        try { root.__nsSiteActiveSection = meta.label || ''; } catch (_) {}
        if (options.focusPanel) {
          const focusable = meta.section.querySelector('[data-autofocus], input:not([type="hidden"]), select, textarea, button:not([type="hidden"]), [tabindex]:not([tabindex="-1"])');
          if (focusable && typeof focusable.focus === 'function') focusTarget = focusable;
        }
      } else {
        try { meta.section.removeAttribute('hidden'); } catch (_) {}
        meta.section.classList.remove('is-active');
        try { meta.section.removeAttribute('aria-hidden'); } catch (_) {}
      }
    });
    if (!resolved) return;
    let focusCommitted = false;
    const commitFocus = (delay = 0) => {
      if (!focusTarget || focusCommitted) return;
      focusCommitted = true;
      const target = focusTarget;
      const schedule = () => {
        if (!target || typeof target.focus !== 'function') return;
        if (activeSectionId !== sectionId) return;
        const applyFocus = () => {
          try {
            target.focus({ preventScroll: true });
          } catch (_) {
            try { target.focus(); } catch (_) {}
          }
        };
        try {
          requestAnimationFrame(applyFocus);
        } catch (_) {
          applyFocus();
        }
      };
      const ms = Math.max(0, Number(delay) || 0);
      if (ms > 0 && typeof setTimeout === 'function') {
        setTimeout(schedule, ms);
      } else {
        schedule();
      }
      focusTarget = null;
    };

    if (shouldScroll && activeMeta && typeof window !== 'undefined') {
      const executeScroll = () => {
        try {
          const scrollContainer = resolveSiteScrollContainer();
          const sectionRect = activeMeta.section.getBoundingClientRect();
          const desiredTop = resolveViewportAnchorTop();
          const delta = sectionRect.top - desiredTop;
          if (Math.abs(delta) > 4) {
            const behavior = options.scrollBehavior || 'smooth';
            const prefersReduced = composerPrefersReducedMotion();
            const targetY = getSiteScrollTop(scrollContainer) + delta;
            const resolvedDuration = resolveComposerScrollDuration(options.scrollDuration);
            if (!skipScrollLock) {
              const now = getNow();
              const lockDuration = behavior === 'smooth' ? resolvedDuration + 160 : 140;
              scrollSyncLockUntil = now + Math.max(lockDuration, 140);
            }

            if (scrollContainer === window && !prefersReduced && behavior !== 'auto' && behavior !== 'instant') {
              const animated = animateComposerViewportScroll(targetY, resolvedDuration, () => commitFocus(48));
              if (animated) return;
            }

            cancelComposerSiteScrollAnimation();
            scrollSiteContainerTo(scrollContainer, targetY, behavior);

            if (!prefersReduced && behavior === 'smooth') commitFocus(resolvedDuration + 64);
            else commitFocus(0);
            return;
          }

          commitFocus(0);
        } catch (_) {
          commitFocus(0);
        }
      };

      try {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(executeScroll);
        else executeScroll();
      } catch (_) {
        executeScroll();
      }
    } else {
      commitFocus(0);
    }
  }

  function refreshNavDiffState() {
    // Section navigation was removed; diff state is surfaced in the system tree instead.
  }

  function cancelScheduledScrollSync() {
    if (scrollSyncHandle == null) return;
    if (scrollSyncHandleType === 'raf' && typeof cancelAnimationFrame === 'function') {
      try { cancelAnimationFrame(scrollSyncHandle); } catch (_) {}
    } else if (scrollSyncHandleType === 'timeout' && typeof clearTimeout === 'function') {
      try { clearTimeout(scrollSyncHandle); } catch (_) {}
    }
    scrollSyncHandle = null;
    scrollSyncHandleType = '';
  }

  function runScrollSync() {
    scrollSyncHandle = null;
    scrollSyncHandleType = '';
    if (typeof window === 'undefined') return;
    const now = getNow();
    if (now < scrollSyncLockUntil) {
      if (typeof setTimeout === 'function') {
        const delay = Math.max(24, Math.min(240, scrollSyncLockUntil - now + 16));
        scrollSyncHandleType = 'timeout';
        scrollSyncHandle = setTimeout(() => {
          scrollSyncHandle = null;
          scrollSyncHandleType = '';
          runScrollSync();
        }, delay);
      }
    } else {
      if (!sectionsMeta.length) return;
      const scrollContainer = resolveSiteScrollContainer();
      const anchorTop = resolveViewportAnchorTop();
      const scrollTop = getSiteScrollTop(scrollContainer);
      const viewportHeight = getSiteViewportHeight(scrollContainer);
      const tolerance = Math.max(48, Math.min(viewportHeight * 0.25 || 0, 180));
      let candidate = null;
      let measuredAnySection = false;

      for (let i = 0; i < sectionsMeta.length; i += 1) {
        const meta = sectionsMeta[i];
        if (!meta || !meta.section) continue;
        const rect = meta.section.getBoundingClientRect();
        if (!rect || rect.height <= 4) continue;
        measuredAnySection = true;
        if (rect.top <= anchorTop + tolerance) {
          candidate = meta;
          continue;
        }
        if (!candidate) candidate = meta;
        break;
      }

      if (!measuredAnySection) return;
      if (scrollTop <= 4) candidate = sectionsMeta[0] || null;
      if (!candidate) candidate = sectionsMeta[0] || null;
      if (!candidate || candidate.id === activeSectionId) return;
      setActiveSection(candidate.id, { focusPanel: false, scrollViewport: false, skipScrollLock: true });
    }
  }

  function scheduleScrollSync() {
    if (typeof window === 'undefined') return;
    if (scrollSyncHandle != null) return;
    const runner = () => {
      scrollSyncHandle = null;
      scrollSyncHandleType = '';
      runScrollSync();
    };
    try {
      scrollSyncHandleType = 'raf';
      scrollSyncHandle = requestAnimationFrame(() => runner());
    } catch (_) {
      if (typeof setTimeout === 'function') {
        scrollSyncHandleType = 'timeout';
        scrollSyncHandle = setTimeout(runner, 66);
      } else {
        runner();
      }
    }
  }

  const createSection = (title, description) => {
    const section = document.createElement('section');
    section.className = 'cs-section';
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-hidden', 'false');
    const sectionId = `cs-section-${sectionsMeta.length + 1}`;
    section.id = sectionId;
    if (title || description) {
      const head = document.createElement('div');
      head.className = 'cs-section-head';
      let heading = null;
      if (title) {
        heading = document.createElement('h3');
        heading.className = 'cs-section-title';
        heading.textContent = title;
        head.appendChild(heading);
      }
      if (description) {
        const desc = document.createElement('p');
        desc.className = 'cs-section-description';
        desc.textContent = description;
        head.appendChild(desc);
      }
      section.appendChild(head);
    }
    viewport.appendChild(section);

    const labelText = (() => {
      if (title && String(title).trim()) return String(title).trim();
      const fromHeading = section.querySelector('.cs-section-title');
      return fromHeading && fromHeading.textContent ? fromHeading.textContent.trim() : `Section ${sectionsMeta.length + 1}`;
    })();

    const meta = { id: sectionId, section, label: labelText };
    sectionsMeta.push(meta);

    const shouldRestore = preservedActiveLabel && labelText === preservedActiveLabel;
    if (!activeSectionId || shouldRestore) {
      setActiveSection(sectionId, { scrollViewport: false });
    }

    return section;
  };

  const revealField = (fieldKey, options = {}) => {
    if (!fieldKey) return null;
    const selector = `[data-field="${escapeFieldKey(fieldKey)}"]`;
    let fieldEl = null;
    try { fieldEl = root.querySelector(selector); }
    catch (_) { fieldEl = null; }
    if (!fieldEl) {
      try {
        fieldEl = Array.from(root.querySelectorAll('[data-field]')).find((candidate) => {
          const raw = candidate && candidate.getAttribute ? candidate.getAttribute('data-field') : '';
          return String(raw || '').split('|').map(item => item.trim()).includes(String(fieldKey));
        }) || null;
      } catch (_) {
        fieldEl = null;
      }
    }
    if (!fieldEl) return null;
    const section = typeof fieldEl.closest === 'function' ? fieldEl.closest('.cs-section') : null;
    if (!section) return fieldEl;
    const meta = sectionsMeta.find((item) => item.section === section);
    if (meta) {
      setActiveSection(meta.id, { focusPanel: false, scrollViewport: false });
      if (options.scroll !== false) {
        try {
          const behavior = options.behavior || 'smooth';
          requestAnimationFrame(() => {
            try { fieldEl.scrollIntoView({ block: 'start', behavior }); }
            catch (_) { fieldEl.scrollIntoView(); }
          });
        } catch (_) {
          try { fieldEl.scrollIntoView(); } catch (_) {}
        }
      }
      if (options.focus !== false) {
        let focusTarget = null;
        try {
          focusTarget = fieldEl.querySelector(`[data-site-identity-field="${escapeFieldKey(fieldKey)}"]`);
        } catch (_) {
          focusTarget = null;
        }
        if (!focusTarget) {
          focusTarget = fieldEl.querySelector('[data-autofocus], input:not([type="hidden"]), select, textarea, button:not([type="hidden"]), [tabindex]:not([tabindex="-1"])') || fieldEl;
        }
        try {
          requestAnimationFrame(() => {
            if (typeof focusTarget.focus === 'function') {
              try { focusTarget.focus({ preventScroll: options.scroll !== false }); }
              catch (_) { focusTarget.focus(); }
            }
          });
        } catch (_) {
          try { focusTarget.focus(); } catch (_) {}
        }
      }
    }
    return fieldEl;
  };

  const focusHandler = (event) => {
    const target = event && event.target;
    if (!target || typeof target.closest !== 'function') return;
    const section = target.closest('.cs-section');
    if (!section) return;
    const meta = sectionsMeta.find((item) => item.section === section);
    if (meta && meta.id !== activeSectionId) {
      setActiveSection(meta.id, { focusPanel: false, scrollViewport: false, skipScrollLock: true });
    }
  };

  try { root.addEventListener('focusin', focusHandler); } catch (_) {}
  try { root.__nsSiteNavFocusHandler = focusHandler; } catch (_) {}
  try { root.__nsSiteRevealField = revealField; } catch (_) {}

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onScroll = () => scheduleScrollSync();
    const onResize = () => scheduleScrollSync();
    const scrollContainer = resolveSiteScrollContainer();
    let passiveScrollListener = false;
    try {
      window.addEventListener('scroll', onScroll, { passive: true });
      passiveScrollListener = true;
    } catch (_) {
      try { window.addEventListener('scroll', onScroll); } catch (_) {}
    }
    let passiveContainerScrollListener = false;
    if (scrollContainer && scrollContainer !== window && typeof scrollContainer.addEventListener === 'function') {
      try {
        scrollContainer.addEventListener('scroll', onScroll, { passive: true });
        passiveContainerScrollListener = true;
      } catch (_) {
        try { scrollContainer.addEventListener('scroll', onScroll); } catch (_) {}
      }
    }
    try { window.addEventListener('resize', onResize); } catch (_) {}
    const cleanup = () => {
      try {
        if (passiveScrollListener) window.removeEventListener('scroll', onScroll, { passive: true });
      } catch (_) {}
      try { window.removeEventListener('scroll', onScroll); } catch (_) {}
      try {
        if (scrollContainer && scrollContainer !== window && typeof scrollContainer.removeEventListener === 'function') {
          if (passiveContainerScrollListener) scrollContainer.removeEventListener('scroll', onScroll, { passive: true });
          else scrollContainer.removeEventListener('scroll', onScroll);
        }
      } catch (_) {}
      try { window.removeEventListener('resize', onResize); } catch (_) {}
      cancelScheduledScrollSync();
    };
    try { root.__nsSiteScrollSyncCleanup = cleanup; }
    catch (_) { cleanup(); }
  }

  try { root.__nsSiteNavRefresh = refreshNavDiffState; } catch (_) {}
  try { root.__nsSiteNavSetActive = setActiveSection; } catch (_) {}
  try { root.__nsSiteFirstSectionId = sectionsMeta[0] && sectionsMeta[0].id ? sectionsMeta[0].id : ''; } catch (_) {}

  const markDirty = () => {
    setStateSlice('site', site);
    notifyComposerChange('site');
    refreshNavDiffState();
  };

  const ensureLocalized = (key, ensureDefault = true) => {
    if (!site[key] || typeof site[key] !== 'object') {
      site[key] = ensureDefault ? { default: '' } : {};
    }
    if (ensureDefault && !Object.prototype.hasOwnProperty.call(site[key], 'default')) site[key].default = '';
    return site[key];
  };

  const ensureLinkList = (key) => {
    if (!Array.isArray(site[key])) site[key] = [];
    return site[key];
  };

  const ensureRepo = () => {
    if (!site.repo || typeof site.repo !== 'object') site.repo = { owner: '', name: '', branch: '' };
    return site.repo;
  };

  const ensureAssetWarnings = () => {
    if (!site.assetWarnings || typeof site.assetWarnings !== 'object') site.assetWarnings = {};
    if (!site.assetWarnings.largeImage || typeof site.assetWarnings.largeImage !== 'object') {
      site.assetWarnings.largeImage = { enabled: null, thresholdKB: null };
    }
    const largeImage = site.assetWarnings.largeImage;
    if (!Object.prototype.hasOwnProperty.call(largeImage, 'enabled')) largeImage.enabled = null;
    if (!Object.prototype.hasOwnProperty.call(largeImage, 'thresholdKB')) largeImage.thresholdKB = null;
    return site.assetWarnings;
  };

  const collectLanguageCodes = () => {
    const codes = new Set();
    const add = (value) => {
      const normalized = normalizeLangCode(value);
      if (!normalized) return;
      codes.add(normalized);
    };
    const addFromEntry = (entry) => {
      if (!entry || typeof entry !== 'object') return;
      Object.keys(entry).forEach((key) => {
        if (!isLanguageCode(key)) return;
        add(key);
      });
    };

    try {
      const langs = typeof getAvailableLangs === 'function' ? getAvailableLangs() : [];
      if (Array.isArray(langs)) langs.forEach(add);
    } catch (_) {}
    if (site && site.defaultLanguage) add(site.defaultLanguage);

    if (state && state.index && typeof state.index === 'object') {
      Object.keys(state.index).forEach((key) => {
        if (key === '__order') return;
        addFromEntry(state.index[key]);
      });
    }

    if (state && state.tabs && typeof state.tabs === 'object') {
      Object.keys(state.tabs).forEach((key) => {
        if (key === '__order') return;
        addFromEntry(state.tabs[key]);
      });
    }

    if (site && typeof site === 'object') {
      Object.keys(site).forEach((key) => {
        const value = site[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        addFromEntry(value);
      });
    }

    const ordered = Array.from(codes);
    ordered.sort((a, b) => {
      const ia = PREFERRED_LANG_ORDER.indexOf(a);
      const ib = PREFERRED_LANG_ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
        const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
        return pa - pb;
      }
      return a.localeCompare(b);
    });
    return ordered;
  };

  const createField = (section, config) => {
    const field = document.createElement('div');
    field.className = 'cs-field';
    if (config.dataKey) field.dataset.field = config.dataKey;
    const head = document.createElement('div');
    head.className = 'cs-field-head';
    const labelWrap = document.createElement('div');
    labelWrap.className = 'cs-field-label-wrap';
    head.appendChild(labelWrap);
    const labelEl = document.createElement('label');
    labelEl.className = 'cs-field-label';
    labelEl.textContent = config.label || '';
    labelWrap.appendChild(labelEl);
    if (config.action) {
      config.action.classList.add('cs-field-action');
      head.appendChild(config.action);
    }
    field.appendChild(head);
    field.__csHead = head;
    field.__csLabel = labelEl;
    field.__csLabelWrap = labelWrap;
    const inlineDescription = config.inlineDescription !== false;
    if (config.description) {
      const desc = document.createElement('p');
      desc.className = 'cs-field-help';
      desc.textContent = config.description;
      field.__csHelp = desc;
      if (inlineDescription && labelWrap) {
        field.classList.add('cs-field-inline-help');
        labelWrap.appendChild(desc);
      } else {
        field.appendChild(desc);
      }
    }
    section.appendChild(field);
    return field;
  };

  const createSubheadingField = (section, config) => {
    const field = document.createElement('div');
    field.className = 'cs-field cs-subheading-field';
    if (config.dataKey) field.dataset.field = config.dataKey;
    if (config.label || config.description) {
      const head = document.createElement('div');
      head.className = 'cs-config-subsection-head';
      if (config.label) {
        const title = document.createElement('div');
        title.className = 'cs-config-subsection-title';
        title.textContent = config.label;
        head.appendChild(title);
      }
      if (config.description) {
        const description = document.createElement('p');
        description.className = 'cs-config-subsection-description';
        description.textContent = config.description;
        head.appendChild(description);
      }
      field.appendChild(head);
    }
    section.appendChild(field);
    return field;
  };

  const createConfigSubsection = (section, title, description) => {
    const block = document.createElement('div');
    block.className = 'cs-config-subsection';
    if (title || description) {
      const head = document.createElement('div');
      head.className = 'cs-config-subsection-head';
      if (title) {
        const heading = document.createElement('div');
        heading.className = 'cs-config-subsection-title';
        heading.textContent = title;
        head.appendChild(heading);
      }
      if (description) {
        const desc = document.createElement('p');
        desc.className = 'cs-config-subsection-description';
        desc.textContent = description;
        head.appendChild(desc);
      }
      block.appendChild(head);
    }
    section.appendChild(block);
    return block;
  };

  const renderLocalizedField = (section, key, options = {}) => {
    ensureLocalized(key, options.ensureDefault !== false);
    const useLocalizedGrid = !!(options.grid || options.multiline);
    const field = options.subheading
      ? createSubheadingField(section, {
        dataKey: key,
        label: options.label,
        description: options.description
      })
      : createField(section, {
        dataKey: key,
        label: options.label,
        description: options.description
      });
    const list = document.createElement('div');
    list.className = useLocalizedGrid
      ? 'cs-localized-list cs-localized-list--grid'
      : 'cs-localized-list';
    field.appendChild(list);
    const controls = document.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);
    const addWrap = document.createElement('div');
    addWrap.className = 'cs-add-lang has-menu';
    controls.appendChild(addWrap);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary cs-add-lang';
    addBtn.textContent = t('editor.composer.site.addLanguage');
    addBtn.setAttribute('aria-haspopup', 'listbox');
    addBtn.setAttribute('aria-expanded', 'false');
    addWrap.appendChild(addBtn);

    const menu = document.createElement('div');
    menu.className = 'ns-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    addWrap.appendChild(menu);

    const refreshMenu = () => {
      const localized = ensureLocalized(key, options.ensureDefault !== false);
      const used = new Set(Object.keys(localized || {}));
      used.add('default');

      const supportedSet = new Set();
      const addSupported = (code) => {
        const normalized = normalizeLangCode(code);
        if (!normalized) return;
        supportedSet.add(normalized);
      };

      try {
        const availableLangs = getAvailableLangs();
        if (Array.isArray(availableLangs)) availableLangs.forEach(addSupported);
      } catch (_) {}

      if (Array.isArray(PREFERRED_LANG_ORDER)) {
        PREFERRED_LANG_ORDER.forEach(addSupported);
      }

      try {
        collectLanguageCodes().forEach(addSupported);
      } catch (_) {}

      const supported = Array.from(supportedSet);
      supported.sort((a, b) => {
        const ia = PREFERRED_LANG_ORDER.indexOf(a);
        const ib = PREFERRED_LANG_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) {
          const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
          const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
          return pa - pb;
        }
        return a.localeCompare(b);
      });

      // Filter only valid language codes that match LANG_CODE_PATTERN
      const available = supported.filter((code) => !used.has(code) && LANG_CODE_PATTERN.test(code));

      menu.innerHTML = available
        .map((code) =>
          `<button type="button" role="option" class="ns-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`
        )
        .join('');
      if (!available.length) {
        addBtn.setAttribute('disabled', '');
        addWrap.classList.add('is-disabled');
        addWrap.hidden = true;
        addWrap.setAttribute('aria-hidden', 'true');
        addWrap.style.display = 'none';
        if (!menu.hidden) closeMenu();
        return;
      }

      addBtn.removeAttribute('disabled');
      addWrap.classList.remove('is-disabled');
      addWrap.hidden = false;
      addWrap.removeAttribute('aria-hidden');
      addWrap.style.removeProperty('display');
    };

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener(LANGUAGE_POOL_CHANGED_EVENT, refreshMenu);
    }

    const closeMenu = () => {
      if (menu.hidden) return;
      const finish = () => {
        menu.hidden = true;
        addBtn.classList.remove('is-open');
        addWrap.classList.remove('is-open');
        addBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDocDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        menu.classList.remove('is-closing');
      };
      try {
        menu.classList.add('is-closing');
        const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
        menu.addEventListener('animationend', onEnd, { once: true });
        setTimeout(finish, 180);
      } catch (_) {
        finish();
      }
    };

    const openMenu = () => {
      refreshMenu();
      if (!menu.innerHTML.trim() || addWrap.hidden) return;
      if (!menu.hidden) return;
      menu.hidden = false;
      try { menu.classList.remove('is-closing'); } catch (_) {}
      addBtn.classList.add('is-open');
      addWrap.classList.add('is-open');
      addBtn.setAttribute('aria-expanded', 'true');
      try { menu.querySelector('.ns-menu-item')?.focus(); } catch (_) {}
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      menu.querySelectorAll('.ns-menu-item').forEach((item) => {
        item.addEventListener('click', () => {
          const code = normalizeLangCode(item.getAttribute('data-lang'));
          if (!code) return;
          const localized = ensureLocalized(key, options.ensureDefault !== false);
          if (Object.prototype.hasOwnProperty.call(localized, code)) return;
          localized[code] = '';
          markDirty();
          closeMenu();
          renderRows();
          broadcastLanguagePoolChange();
        });
      });
    };

    const onDocDown = (event) => {
      if (!addWrap.contains(event.target)) closeMenu();
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    addBtn.addEventListener('click', () => {
      if (addBtn.hasAttribute('disabled')) return;
      if (addBtn.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    const renderRows = () => {
      list.innerHTML = '';
      const localized = ensureLocalized(key, options.ensureDefault !== false);
      const langs = Object.keys(localized || {});
      if (options.ensureDefault !== false && !langs.includes('default')) langs.push('default');
      langs.sort((a, b) => {
        if (a === 'default') return -1;
        if (b === 'default') return 1;
        return a.localeCompare(b);
      });
      langs.forEach((lang) => {
        if (!localized && lang !== 'default') return;
        if (options.ensureDefault !== false && !Object.prototype.hasOwnProperty.call(localized, lang)) localized[lang] = '';
        const row = document.createElement('div');
        row.className = 'cs-localized-row';
        if (useLocalizedGrid) row.classList.add('cs-localized-row--grid');
        if (options.multiline) row.classList.add('cs-localized-row--multiline');
        row.dataset.lang = lang;
        const badge = document.createElement('span');
        badge.className = 'cs-lang-chip';
        badge.textContent = lang === 'default'
          ? t('editor.composer.site.languageDefault')
          : lang.toUpperCase();
        row.appendChild(badge);
        const inputWrap = document.createElement('div');
        inputWrap.className = options.multiline
          ? 'cs-localized-input cs-localized-input--multiline'
          : 'cs-localized-input';
        const input = document.createElement(options.multiline ? 'textarea' : 'input');
        if (!options.multiline) input.type = 'text';
        else input.rows = options.rows || 3;
        input.className = options.multiline ? 'cs-input cs-localized-textarea' : 'cs-input';
        input.dataset.field = key;
        input.dataset.lang = lang;
        if (options.placeholder) input.placeholder = options.placeholder;
        input.value = localized[lang] || '';
        if (options.multiline) {
          const expandMultiline = () => {
            list.querySelectorAll('.cs-localized-row--multiline.is-expanded').forEach((expandedRow) => {
              if (expandedRow !== row) expandedRow.classList.remove('is-expanded');
            });
            row.classList.add('is-expanded');
          };
          input.addEventListener('pointerdown', expandMultiline);
          input.addEventListener('focus', expandMultiline);
          input.addEventListener('focusin', expandMultiline);
          input.addEventListener('blur', () => {
            setTimeout(() => {
              if (document.activeElement !== input) row.classList.remove('is-expanded');
            }, 0);
          });
          input.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            row.classList.remove('is-expanded');
            input.blur();
          });
        }
        input.addEventListener('input', () => {
          ensureLocalized(key, options.ensureDefault !== false)[lang] = input.value;
          markDirty();
        });
        inputWrap.appendChild(input);
        row.appendChild(inputWrap);
        if (lang !== 'default' || options.allowDefaultDelete) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-tertiary cs-remove-lang';
          removeBtn.textContent = t('editor.composer.site.removeLanguage');
          removeBtn.addEventListener('click', () => {
            const localizedMap = ensureLocalized(key, options.ensureDefault !== false);
            delete localizedMap[lang];
            markDirty();
            renderRows();
            broadcastLanguagePoolChange();
          });
          row.appendChild(removeBtn);
        }
        list.appendChild(row);
      });
      if (!list.children.length) {
        const empty = document.createElement('div');
        empty.className = 'cs-empty';
        empty.textContent = t('editor.composer.site.noLanguages');
        list.appendChild(empty);
      }
      refreshMenu();
    };

    renderRows();
  };

  const renderIdentityLocalizedGrid = (section) => {
    const titleLabel = t('editor.composer.site.fields.siteTitle');
    const subtitleLabel = t('editor.composer.site.fields.siteSubtitle');
    ensureLocalized('siteTitle', true);
    ensureLocalized('siteSubtitle', true);
    const field = document.createElement('div');
    field.className = 'cs-field cs-identity-fieldset';
    field.dataset.field = 'siteTitle|siteSubtitle';
    field.setAttribute('role', 'group');
    field.setAttribute('aria-label', `${titleLabel} / ${subtitleLabel}`);
    section.appendChild(field);
    const grid = document.createElement('div');
    grid.className = 'cs-identity-grid';
    field.appendChild(grid);
    const controls = document.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);
    const addWrap = document.createElement('div');
    addWrap.className = 'cs-add-lang has-menu';
    controls.appendChild(addWrap);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary cs-add-lang';
    addBtn.textContent = t('editor.composer.site.addLanguage');
    addBtn.setAttribute('aria-haspopup', 'listbox');
    addBtn.setAttribute('aria-expanded', 'false');
    addWrap.appendChild(addBtn);

    const menu = document.createElement('div');
    menu.className = 'ns-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    addWrap.appendChild(menu);

    const sortLangs = (langs) => {
      const ordered = Array.from(new Set(langs.filter(Boolean)));
      ordered.sort((a, b) => {
        if (a === 'default') return -1;
        if (b === 'default') return 1;
        const ia = PREFERRED_LANG_ORDER.indexOf(a);
        const ib = PREFERRED_LANG_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) {
          const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
          const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
          return pa - pb;
        }
        return a.localeCompare(b);
      });
      return ordered;
    };

    const collectUsedLangs = () => {
      const title = ensureLocalized('siteTitle', true);
      const subtitle = ensureLocalized('siteSubtitle', true);
      return sortLangs(['default', ...Object.keys(title || {}), ...Object.keys(subtitle || {})]);
    };

    const refreshMenu = () => {
      const used = new Set(collectUsedLangs());
      used.add('default');

      const supportedSet = new Set();
      const addSupported = (code) => {
        const normalized = normalizeLangCode(code);
        if (!normalized) return;
        supportedSet.add(normalized);
      };

      try {
        const availableLangs = getAvailableLangs();
        if (Array.isArray(availableLangs)) availableLangs.forEach(addSupported);
      } catch (_) {}

      if (Array.isArray(PREFERRED_LANG_ORDER)) {
        PREFERRED_LANG_ORDER.forEach(addSupported);
      }

      try {
        collectLanguageCodes().forEach(addSupported);
      } catch (_) {}

      const available = sortLangs(Array.from(supportedSet))
        .filter((code) => !used.has(code) && LANG_CODE_PATTERN.test(code));

      menu.innerHTML = available
        .map((code) =>
          `<button type="button" role="option" class="ns-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`
        )
        .join('');
      if (!available.length) {
        addBtn.setAttribute('disabled', '');
        addWrap.classList.add('is-disabled');
        addWrap.hidden = true;
        addWrap.setAttribute('aria-hidden', 'true');
        addWrap.style.display = 'none';
        if (!menu.hidden) closeMenu();
        return;
      }

      addBtn.removeAttribute('disabled');
      addWrap.classList.remove('is-disabled');
      addWrap.hidden = false;
      addWrap.removeAttribute('aria-hidden');
      addWrap.style.removeProperty('display');
    };

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener(LANGUAGE_POOL_CHANGED_EVENT, refreshMenu);
    }

    const closeMenu = () => {
      if (menu.hidden) return;
      const finish = () => {
        menu.hidden = true;
        addBtn.classList.remove('is-open');
        addWrap.classList.remove('is-open');
        addBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDocDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        menu.classList.remove('is-closing');
      };
      try {
        menu.classList.add('is-closing');
        const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
        menu.addEventListener('animationend', onEnd, { once: true });
        setTimeout(finish, 180);
      } catch (_) {
        finish();
      }
    };

    const openMenu = () => {
      refreshMenu();
      if (!menu.innerHTML.trim() || addWrap.hidden) return;
      if (!menu.hidden) return;
      menu.hidden = false;
      try { menu.classList.remove('is-closing'); } catch (_) {}
      addBtn.classList.add('is-open');
      addWrap.classList.add('is-open');
      addBtn.setAttribute('aria-expanded', 'true');
      try { menu.querySelector('.ns-menu-item')?.focus(); } catch (_) {}
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      menu.querySelectorAll('.ns-menu-item').forEach((item) => {
        item.addEventListener('click', () => {
          const code = normalizeLangCode(item.getAttribute('data-lang'));
          if (!code) return;
          const title = ensureLocalized('siteTitle', true);
          const subtitle = ensureLocalized('siteSubtitle', true);
          if (!Object.prototype.hasOwnProperty.call(title, code)) title[code] = '';
          if (!Object.prototype.hasOwnProperty.call(subtitle, code)) subtitle[code] = '';
          markDirty();
          closeMenu();
          renderRows();
          broadcastLanguagePoolChange();
        });
      });
    };

    const onDocDown = (event) => {
      if (!addWrap.contains(event.target)) closeMenu();
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    addBtn.addEventListener('click', () => {
      if (addBtn.hasAttribute('disabled')) return;
      if (addBtn.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    const appendHeader = () => {
      const header = document.createElement('div');
      header.className = 'cs-identity-row cs-identity-head';
      const langSpacer = document.createElement('span');
      langSpacer.className = 'cs-identity-head-spacer';
      langSpacer.setAttribute('aria-hidden', 'true');
      const titleHead = document.createElement('span');
      titleHead.className = 'cs-identity-column-title';
      titleHead.textContent = titleLabel;
      const subtitleHead = document.createElement('span');
      subtitleHead.className = 'cs-identity-column-title';
      subtitleHead.textContent = subtitleLabel;
      const actionSpacer = document.createElement('span');
      actionSpacer.className = 'cs-identity-head-spacer';
      actionSpacer.setAttribute('aria-hidden', 'true');
      header.append(langSpacer, titleHead, subtitleHead, actionSpacer);
      grid.appendChild(header);
    };

    const appendInput = (row, lang, key, labelText, value) => {
      const cell = document.createElement('label');
      cell.className = 'cs-identity-field';
      const mobileLabel = document.createElement('span');
      mobileLabel.className = 'cs-identity-cell-label';
      mobileLabel.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cs-input';
      input.dataset.field = key;
      input.dataset.lang = lang;
      input.dataset.subfield = key;
      input.dataset.siteIdentityField = key;
      input.value = value || '';
      input.addEventListener('input', () => {
        ensureLocalized(key, true)[lang] = input.value;
        markDirty();
      });
      cell.append(mobileLabel, input);
      row.appendChild(cell);
    };

    const renderRows = () => {
      grid.innerHTML = '';
      appendHeader();
      const title = ensureLocalized('siteTitle', true);
      const subtitle = ensureLocalized('siteSubtitle', true);
      const langs = collectUsedLangs();
      langs.forEach((lang) => {
        if (!Object.prototype.hasOwnProperty.call(title, lang)) title[lang] = '';
        if (!Object.prototype.hasOwnProperty.call(subtitle, lang)) subtitle[lang] = '';
        const row = document.createElement('div');
        row.className = 'cs-identity-row';
        row.dataset.lang = lang;
        const langCell = document.createElement('div');
        langCell.className = 'cs-identity-lang';
        const badge = document.createElement('span');
        badge.className = 'cs-lang-chip';
        badge.textContent = lang === 'default'
          ? t('editor.composer.site.languageDefault')
          : lang.toUpperCase();
        langCell.appendChild(badge);
        row.appendChild(langCell);
        appendInput(row, lang, 'siteTitle', titleLabel, title[lang] || '');
        appendInput(row, lang, 'siteSubtitle', subtitleLabel, subtitle[lang] || '');
        const actions = document.createElement('div');
        actions.className = 'cs-identity-actions';
        if (lang !== 'default') {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-tertiary cs-remove-lang cs-identity-remove';
          removeBtn.textContent = t('editor.composer.site.removeLanguage');
          removeBtn.addEventListener('click', () => {
            const titleMapNext = ensureLocalized('siteTitle', true);
            const subtitleMapNext = ensureLocalized('siteSubtitle', true);
            delete titleMapNext[lang];
            delete subtitleMapNext[lang];
            markDirty();
            renderRows();
            broadcastLanguagePoolChange();
          });
          actions.appendChild(removeBtn);
        }
        row.appendChild(actions);
        grid.appendChild(row);
      });
      refreshMenu();
    };

    renderRows();
  };

  const createTextField = (section, config) => {
    const field = createField(section, {
      dataKey: config.dataKey,
      label: config.label,
      description: config.description
    });
    const control = document.createElement('div');
    control.className = 'cs-field-controls';
    const input = document.createElement(config.multiline ? 'textarea' : 'input');
    if (!config.multiline) input.type = config.type || 'text';
    else input.rows = config.rows || 3;
    input.className = 'cs-input';
    input.dataset.field = config.dataKey;
    input.value = config.get() || '';
    if (config.placeholder) input.placeholder = config.placeholder;
    input.addEventListener('input', () => {
      config.set(config.multiline ? input.value : input.value);
      markDirty();
    });
    control.appendChild(input);
    if (config.trailing) control.appendChild(config.trailing);
    field.appendChild(control);
    return input;
  };

  const createSingleGridFieldset = (section) => {
    const field = document.createElement('div');
    field.className = 'cs-field cs-single-grid-fieldset';
    const grid = document.createElement('div');
    grid.className = 'cs-single-grid';
    field.appendChild(grid);
    section.appendChild(field);

    const addRow = (item, index = grid.children.length) => {
      const row = document.createElement('div');
      row.className = 'cs-single-grid-row';
      row.dataset.field = item.dataKey;

      const controlId = `cs-single-grid-${item.dataKey}-${index}`;
      const tooltipId = `cs-single-grid-help-${item.dataKey}-${index}`;

      const labelCell = document.createElement('div');
      labelCell.className = 'cs-single-grid-label';

      const tooltipWrap = document.createElement('span');
      tooltipWrap.className = 'cs-help-tooltip-wrap';
      const tooltip = document.createElement('button');
      tooltip.type = 'button';
      tooltip.className = 'cs-help-tooltip';
      tooltip.textContent = '?';
      tooltip.setAttribute('aria-label', `${item.label}: ${item.description}`);
      tooltip.setAttribute('aria-describedby', tooltipId);
      const tooltipBubble = document.createElement('span');
      tooltipBubble.id = tooltipId;
      tooltipBubble.className = 'cs-help-tooltip-bubble';
      tooltipBubble.setAttribute('role', 'tooltip');
      tooltipBubble.textContent = item.description;
      const label = document.createElement('label');
      label.className = 'cs-single-grid-title';
      label.htmlFor = controlId;
      label.textContent = item.label;
      labelCell.appendChild(label);
      tooltipWrap.appendChild(tooltip);
      tooltipWrap.appendChild(tooltipBubble);
      labelCell.appendChild(tooltipWrap);
      row.appendChild(labelCell);

      const controlCell = document.createElement('div');
      controlCell.className = 'cs-single-grid-control';
      row.appendChild(controlCell);
      grid.appendChild(row);

      return { row, controlCell, controlId, label };
    };

    return { field, grid, addRow };
  };

  const renderSingleTextGrid = (section, items) => {
    const { addRow } = createSingleGridFieldset(section);
    items.forEach((item, index) => {
      const { controlCell, controlId } = addRow(item, index);
      const input = document.createElement('input');
      input.id = controlId;
      input.type = item.type || 'text';
      input.className = 'cs-input';
      input.dataset.field = item.dataKey;
      input.value = item.get() || '';
      input.placeholder = item.placeholder || '';
      input.addEventListener('input', () => {
        item.set(input.value);
        markDirty();
      });
      controlCell.appendChild(input);
    });
  };

  const renderIdentityPathGrid = (section) => {
    const items = [
      {
        dataKey: 'avatar',
        label: t('editor.composer.site.fields.avatar'),
        description: t('editor.composer.site.fields.avatarHelp'),
        placeholder: 'assets/avatar.jpeg',
        get: () => site.avatar,
        set: (value) => { site.avatar = value; }
      },
      {
        dataKey: 'contentRoot',
        label: t('editor.composer.site.fields.contentRoot'),
        description: t('editor.composer.site.fields.contentRootHelp'),
        placeholder: 'wwwroot',
        get: () => site.contentRoot,
        set: (value) => { site.contentRoot = value; }
      }
    ];

    renderSingleTextGrid(section, items);
  };

  const renderSeoResourceGrid = (section) => {
    renderSingleTextGrid(section, [
      {
        dataKey: 'resourceURL',
        label: t('editor.composer.site.fields.resourceURL'),
        description: t('editor.composer.site.fields.resourceURLHelp'),
        placeholder: 'https://example.com/',
        get: () => site.resourceURL,
        set: (value) => { site.resourceURL = value; }
      }
    ]);
  };

  const createNumberField = (section, config) => {
    const field = createField(section, {
      dataKey: config.dataKey,
      label: config.label,
      description: config.description
    });
    const control = document.createElement('div');
    control.className = 'cs-field-controls';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'cs-input cs-input-small';
    input.dataset.field = config.dataKey;
    if (config.min != null) input.min = String(config.min);
    if (config.max != null) input.max = String(config.max);
    if (config.step != null) input.step = String(config.step);
    const value = config.get();
    input.value = value != null && !Number.isNaN(value) ? String(value) : '';
    input.placeholder = config.placeholder || '';
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (!raw) config.set(null);
      else config.set(Number(raw));
      markDirty();
    });
    control.appendChild(input);
    if (config.trailing) control.appendChild(config.trailing);
    field.appendChild(control);
    return input;
  };

  const createSwitchControl = (field, labelText, options = {}) => {
    const controls = document.createElement('div');
    controls.className = 'cs-field-controls cs-field-controls-inline';
    if (Array.isArray(options.classes)) controls.classList.add(...options.classes);
    const target = options.target || field;
    const toggle = document.createElement('label');
    toggle.className = 'cs-switch';
    toggle.dataset.state = 'off';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cs-switch-input';
    checkbox.setAttribute('role', 'switch');
    checkbox.setAttribute('aria-checked', 'false');
    const track = document.createElement('span');
    track.className = 'cs-switch-track';
    const thumb = document.createElement('span');
    thumb.className = 'cs-switch-thumb';
    track.appendChild(thumb);
    toggle.appendChild(checkbox);
    toggle.appendChild(track);
    const accessibleLabel = labelText || (field && field.__csLabel ? field.__csLabel.textContent : '');
    if (accessibleLabel) checkbox.setAttribute('aria-label', accessibleLabel);
    controls.appendChild(toggle);
    target.appendChild(controls);
    return { controls, toggle, checkbox };
  };

  const syncSwitchState = (checkbox, toggle, value, allowMixed = false) => {
    if (allowMixed && (value === null || value === undefined)) {
      checkbox.indeterminate = true;
      checkbox.checked = false;
      checkbox.setAttribute('aria-checked', 'mixed');
      toggle.dataset.state = 'mixed';
      return;
    }
    checkbox.indeterminate = false;
    const isOn = allowMixed ? value === true : !!value;
    checkbox.checked = isOn;
    checkbox.setAttribute('aria-checked', isOn ? 'true' : 'false');
    toggle.dataset.state = isOn ? 'on' : 'off';
  };

  const createTriStateCheckbox = (section, config) => {
    const field = createField(section, {
      dataKey: config.dataKey,
      label: config.label,
      description: config.description,
      inlineDescription: false
    });
    const head = field.__csHead || field.querySelector('.cs-field-head');
    const labelWrap = field.__csLabelWrap || head;
    if (labelWrap) labelWrap.classList.add('cs-field-label-with-switch');
    const { toggle, checkbox } = createSwitchControl(field, config.checkboxLabel || config.label, {
      target: labelWrap || head || field,
      classes: ['cs-field-head-switch']
    });
    toggle.dataset.field = config.dataKey;

    const sync = () => {
      const value = config.get();
      syncSwitchState(checkbox, toggle, value, true);
    };

    checkbox.addEventListener('change', () => {
      config.set(checkbox.checked);
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    sync();
  };

  const createToggleField = (section, config) => {
    const field = createField(section, {
      dataKey: config.dataKey,
      label: config.label,
      description: config.description,
      inlineDescription: false
    });
    const head = field.__csHead || field.querySelector('.cs-field-head');
    const labelWrap = field.__csLabelWrap || head;
    if (labelWrap) labelWrap.classList.add('cs-field-label-with-switch');
    const { toggle, checkbox } = createSwitchControl(field, config.checkboxLabel || config.label, {
      target: labelWrap || head || field,
      classes: ['cs-field-head-switch']
    });
    toggle.dataset.field = config.dataKey;

    const sync = () => {
      syncSwitchState(checkbox, toggle, config.get(), false);
    };

    checkbox.addEventListener('change', () => {
      config.set(checkbox.checked);
      syncSwitchState(checkbox, toggle, checkbox.checked, false);
      markDirty();
    });

    sync();
    return {
      checkbox,
      field,
      control: toggle
    };
  };

  const createSelectField = (section, config) => {
    const field = createField(section, {
      dataKey: config.dataKey,
      label: config.label,
      description: config.description
    });
    const control = document.createElement('div');
    control.className = 'cs-field-controls';
    const select = document.createElement('select');
    select.className = 'cs-select';
    select.dataset.field = config.dataKey;
    (config.options || []).forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    const ensureSelection = () => {
      const options = Array.from(select.options);
      if (!options.length) {
        const currentRaw = config.get();
        const current = currentRaw == null ? '' : String(currentRaw);
        if (current) {
          select.value = current;
        }
        return current;
      }
      const available = new Set(options.map((opt) => opt.value));
      const currentRaw = config.get();
      const current = currentRaw == null ? '' : String(currentRaw);
      if (current && available.has(current)) {
        select.value = current;
        return current;
      }
      const fallback = (() => {
        if (config.defaultValue != null && available.has(config.defaultValue)) {
          return config.defaultValue;
        }
        return options.length ? options[0].value : '';
      })();
      select.value = fallback;
      if (fallback && fallback !== current) {
        config.set(fallback);
        markDirty();
        return fallback;
      }
      if (!fallback && current) {
        config.set('');
        markDirty();
      }
      return fallback;
    };
    ensureSelection();
    select.addEventListener('change', () => {
      const next = select.value;
      config.set(next);
      markDirty();
    });
    control.appendChild(select);
    field.appendChild(control);
    return select;
  };

  const renderBehaviorGrid = (section) => {
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addBehaviorRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const createSelectRow = (item) => {
      const { controlCell, controlId } = addBehaviorRow(item);
      const select = document.createElement('select');
      select.id = controlId;
      select.className = 'cs-select';
      select.dataset.field = item.dataKey;
      controlCell.appendChild(select);
      return select;
    };

    const defaultLanguageSelect = createSelectRow({
      dataKey: 'defaultLanguage',
      label: t('editor.composer.site.fields.defaultLanguage'),
      description: t('editor.composer.site.fields.defaultLanguageHelp')
    });

    const applyDefaultLanguageOptions = () => {
      const codes = collectLanguageCodes();
      const seen = new Set();
      const appendOption = (value, label) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        defaultLanguageSelect.appendChild(option);
        seen.add(value);
      };

      defaultLanguageSelect.innerHTML = '';
      appendOption('', t('editor.composer.site.languageAutoOption'));
      codes.forEach((code) => {
        if (!seen.has(code)) appendOption(code, displayLangName(code));
      });
      const current = normalizeLangCode(site.defaultLanguage);
      if (current && !seen.has(current)) {
        appendOption(current, displayLangName(current));
      }
      const nextValue = current && seen.has(current) ? current : '';
      defaultLanguageSelect.value = nextValue;
    };

    defaultLanguageSelect.addEventListener('change', () => {
      site.defaultLanguage = normalizeLangCode(defaultLanguageSelect.value);
      markDirty();
    });
    applyDefaultLanguageOptions();

    const createNumberRow = (item) => {
      const { controlCell, controlId } = addBehaviorRow(item);
      const input = document.createElement('input');
      input.id = controlId;
      input.type = 'number';
      input.className = 'cs-input';
      input.dataset.field = item.dataKey;
      if (item.min != null) input.min = String(item.min);
      const value = item.get();
      input.value = value != null && !Number.isNaN(value) ? String(value) : '';
      input.addEventListener('input', () => {
        const raw = input.value.trim();
        item.set(raw ? Number(raw) : null);
        markDirty();
      });
      controlCell.appendChild(input);
      return input;
    };

    createNumberRow({
      dataKey: 'contentOutdatedDays',
      label: t('editor.composer.site.fields.contentOutdatedDays'),
      description: t('editor.composer.site.fields.contentOutdatedDaysHelp'),
      min: 0,
      get: () => site.contentOutdatedDays,
      set: (value) => { site.contentOutdatedDays = value == null || Number.isNaN(value) ? null : value; }
    });

    createNumberRow({
      dataKey: 'pageSize',
      label: t('editor.composer.site.fields.pageSize'),
      description: t('editor.composer.site.fields.pageSizeHelp'),
      min: 1,
      get: () => site.pageSize,
      set: (value) => { site.pageSize = value == null || Number.isNaN(value) ? null : value; }
    });

    const createToggleRow = (item, allowMixed = false) => {
      const { row, controlCell } = addBehaviorRow(item);
      const { toggle, checkbox } = createSwitchControl(row, item.checkboxLabel || item.label, {
        target: controlCell,
        classes: ['cs-single-grid-switch']
      });
      toggle.dataset.field = item.dataKey;
      const sync = () => {
        syncSwitchState(checkbox, toggle, item.get(), allowMixed);
      };
      checkbox.addEventListener('change', () => {
        item.set(checkbox.checked);
        syncSwitchState(checkbox, toggle, checkbox.checked, allowMixed);
        markDirty();
      });
      sync();
      return { checkbox, row, control: toggle };
    };

    const showAllPostsField = createToggleRow({
      dataKey: 'showAllPosts',
      label: t('editor.composer.site.fields.showAllPosts'),
      description: t('editor.composer.site.fields.showAllPostsHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled'),
      get: () => site.showAllPosts === true,
      set: (value) => { site.showAllPosts = !!value; }
    });

    const landingTabSelect = createSelectRow({
      dataKey: 'landingTab',
      label: t('editor.composer.site.fields.landingTab'),
      description: t('editor.composer.site.fields.landingTabHelp')
    });

    const getTabLabel = (slug) => {
      if (!state.tabs || typeof state.tabs !== 'object') return slug;
      const entry = state.tabs[slug];
      if (!entry || typeof entry !== 'object') return slug;
      const pickTitle = () => {
        const def = entry.default;
        if (def && typeof def === 'object' && def.title) return String(def.title).trim();
        for (const key of Object.keys(entry)) {
          if (key === '__order') continue;
          const val = entry[key];
          if (val && typeof val === 'object' && val.title) {
            const title = String(val.title).trim();
            if (title) return title;
          }
        }
        return '';
      };
      const title = pickTitle();
      if (!title) return slug;
      if (title.toLowerCase() === String(slug).toLowerCase()) return title;
      return `${title} (${slug})`;
    };

    const renderLandingOptions = () => {
      const seen = new Set();
      let firstOption = null;
      const addOption = (value, label) => {
        if (value === '' || seen.has(value)) return;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        landingTabSelect.appendChild(option);
        seen.add(value);
        if (firstOption == null) firstOption = value;
      };

      const current = site.landingTab || '';
      landingTabSelect.innerHTML = '';
      const order = state.tabs && Array.isArray(state.tabs.__order) ? state.tabs.__order : [];
      order.forEach((slug) => {
        if (!slug) return;
        addOption(slug, getTabLabel(slug));
      });
      const allowPosts = site.showAllPosts === true || current === 'posts';
      if (allowPosts) {
        addOption('posts', t('editor.composer.site.fields.landingTabAllPostsOption'));
      }
      if (current && !seen.has(current)) addOption(current, current);
      const nextValue = seen.has(current) ? current : firstOption || '';
      landingTabSelect.value = nextValue;
      if (nextValue && nextValue !== site.landingTab) {
        site.landingTab = nextValue;
        markDirty();
      }
    };

    landingTabSelect.addEventListener('change', () => {
      const value = landingTabSelect.value;
      if (value && site.landingTab !== value) {
        site.landingTab = value;
        markDirty();
      }
    });

    renderLandingOptions();
    showAllPostsField.checkbox.addEventListener('change', () => {
      if (site.showAllPosts !== true && site.landingTab === 'posts') {
        site.landingTab = '';
      }
      renderLandingOptions();
    });

    createToggleRow({
      dataKey: 'cardCoverFallback',
      label: t('editor.composer.site.fields.cardCoverFallback'),
      description: t('editor.composer.site.fields.cardCoverFallbackHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled'),
      get: () => site.cardCoverFallback,
      set: (value) => { site.cardCoverFallback = value; }
    }, true);

    createToggleRow({
      dataKey: 'errorOverlay',
      label: t('editor.composer.site.fields.errorOverlay'),
      description: t('editor.composer.site.fields.errorOverlayHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled'),
      get: () => site.errorOverlay,
      set: (value) => { site.errorOverlay = value; }
    }, true);
  };

  const renderThemeGrid = (section) => {
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addThemeRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const createSelectRow = (item) => {
      const { controlCell, controlId } = addThemeRow(item);
      const select = document.createElement('select');
      select.id = controlId;
      select.className = 'cs-select';
      select.dataset.field = item.dataKey;
      (item.options || []).forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });

      const ensureSelection = () => {
        const options = Array.from(select.options);
        if (!options.length) {
          const currentRaw = item.get();
          const current = currentRaw == null ? '' : String(currentRaw);
          if (current) select.value = current;
          return current;
        }
        const available = new Set(options.map((opt) => opt.value));
        const currentRaw = item.get();
        const current = currentRaw == null ? '' : String(currentRaw);
        if (current && available.has(current)) {
          select.value = current;
          return current;
        }
        const fallback = item.defaultValue != null && available.has(item.defaultValue)
          ? item.defaultValue
          : (options.length ? options[0].value : '');
        select.value = fallback;
        if (fallback && fallback !== current) {
          item.set(fallback);
          markDirty();
        } else if (!fallback && current) {
          item.set('');
          markDirty();
        }
        return fallback;
      };

      ensureSelection();
      select.addEventListener('change', () => {
        item.set(select.value);
        markDirty();
      });
      controlCell.appendChild(select);
      return select;
    };

    createSelectRow({
      dataKey: 'themeMode',
      label: t('editor.composer.site.fields.themeMode'),
      description: t('editor.composer.site.fields.themeModeHelp'),
      get: () => site.themeMode || '',
      set: (value) => { site.themeMode = value == null ? '' : value; },
      defaultValue: 'auto',
      options: [
        { value: 'user', label: 'user' },
        { value: 'auto', label: 'auto' },
        { value: 'light', label: 'light' },
        { value: 'dark', label: 'dark' }
      ]
    });

    const sanitizeThemePackValue = (value) => {
      return safeString(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    };
    const normalizeThemePackList = (list) => {
      const normalized = [];
      const seen = new Set();
      (Array.isArray(list) ? list : []).forEach((item) => {
        if (!item) return;
        const packValue = sanitizeThemePackValue(item.value);
        if (!packValue || seen.has(packValue)) return;
        seen.add(packValue);
        normalized.push({
          value: packValue,
          label: safeString(item.label || item.value || packValue) || packValue
        });
      });
      return normalized;
    };

    const themePackSelect = createSelectRow({
      dataKey: 'themePack',
      label: t('editor.composer.site.fields.themePack'),
      description: t('editor.composer.site.fields.themePackHelp'),
      get: () => sanitizeThemePackValue(site.themePack),
      set: (value) => { site.themePack = sanitizeThemePackValue(value); },
      defaultValue: 'native',
      options: []
    });

    const fallbackThemePacks = [
      { value: 'native', label: 'Native' },
      { value: 'github', label: 'GitHub' },
      { value: 'apple', label: 'Apple' },
      { value: 'openai', label: 'OpenAI' }
    ];

    const applyThemePackOptions = (options) => {
      const normalized = normalizeThemePackList(options);
      const selectOptions = normalized.length ? normalized : normalizeThemePackList(fallbackThemePacks);
      const current = sanitizeThemePackValue(site.themePack);
      const seen = new Set();
      const appendOption = (value, label) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = safeString(label || value) || value;
        themePackSelect.appendChild(option);
        seen.add(value);
      };
      themePackSelect.innerHTML = '';
      let firstOption = null;
      selectOptions.forEach(({ value, label }) => {
        appendOption(value, label);
        if (firstOption == null) firstOption = value;
      });
      if (current && !seen.has(current)) {
        appendOption(current, current);
        if (firstOption == null) firstOption = current;
      }
      const nextValue = current && seen.has(current) ? current : firstOption || '';
      themePackSelect.value = nextValue;
      const sanitized = sanitizeThemePackValue(nextValue);
      if (sanitized && sanitized !== site.themePack) {
        site.themePack = sanitized;
        markDirty();
      } else if (!sanitized && site.themePack) {
        site.themePack = '';
        markDirty();
      }
    };

    applyThemePackOptions(fallbackThemePacks);
    fetch('assets/themes/packs.json')
      .then((response) => (response && response.ok ? response.json() : Promise.reject()))
      .then((list) => {
        if (!Array.isArray(list) || !normalizeThemePackList(list).length) throw new Error('empty theme pack list');
        applyThemePackOptions(list);
      })
      .catch(() => {
        applyThemePackOptions(fallbackThemePacks);
      });

    const { row, controlCell } = addThemeRow({
      dataKey: 'themeOverride',
      label: t('editor.composer.site.fields.themeOverride'),
      description: t('editor.composer.site.fields.themeOverrideHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled')
    });
    const { toggle, checkbox } = createSwitchControl(row, t('editor.composer.site.toggleEnabled'), {
      target: controlCell,
      classes: ['cs-single-grid-switch']
    });
    toggle.dataset.field = 'themeOverride';
    checkbox.addEventListener('change', () => {
      site.themeOverride = checkbox.checked;
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    syncSwitchState(checkbox, toggle, site.themeOverride, true);
  };

  const renderAssetWarningsGrid = (section) => {
    const warnings = ensureAssetWarnings();
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addAssetRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const { row: largeImageRow, controlCell: largeImageControl } = addAssetRow({
      dataKey: 'assetWarnings',
      label: t('editor.composer.site.fields.assetLargeImage'),
      description: t('editor.composer.site.fields.assetLargeImageHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled')
    });
    const { toggle, checkbox } = createSwitchControl(
      largeImageRow,
      t('editor.composer.site.toggleEnabled'),
      {
        target: largeImageControl,
        classes: ['cs-single-grid-switch']
      }
    );
    toggle.dataset.field = 'assetWarnings';
    toggle.dataset.subfield = 'enabled';
    checkbox.addEventListener('change', () => {
      warnings.largeImage.enabled = checkbox.checked;
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    syncSwitchState(checkbox, toggle, warnings.largeImage.enabled, true);

    const { controlCell: thresholdControl, controlId: thresholdId } = addAssetRow({
      dataKey: 'assetWarnings',
      label: t('editor.composer.site.fields.assetLargeImageThreshold'),
      description: t('editor.composer.site.fields.assetLargeImageThresholdHelp')
    });
    const thresholdInput = document.createElement('input');
    thresholdInput.id = thresholdId;
    thresholdInput.type = 'number';
    thresholdInput.className = 'cs-input';
    thresholdInput.dataset.field = 'assetWarnings';
    thresholdInput.dataset.subfield = 'thresholdKB';
    thresholdInput.min = '1';
    const threshold = warnings.largeImage.thresholdKB;
    thresholdInput.value = threshold != null && !Number.isNaN(threshold) ? String(threshold) : '';
    thresholdInput.addEventListener('input', () => {
      const raw = thresholdInput.value.trim();
      warnings.largeImage.thresholdKB = raw ? Number(raw) : null;
      markDirty();
    });
    thresholdControl.appendChild(thresholdInput);
  };

  const createLinkListField = (section, key, config) => {
    const list = ensureLinkList(key);
    const field = config.subheading
      ? createSubheadingField(section, {
        dataKey: key,
        label: config.label,
        description: config.description
      })
      : createField(section, {
        dataKey: key,
        label: config.label,
        description: config.description
      });
    const listWrap = document.createElement('div');
    listWrap.className = 'cs-link-list';
    field.appendChild(listWrap);
    const controls = document.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary cs-add-link';
    addBtn.textContent = t('editor.composer.site.addLink');
    controls.appendChild(addBtn);

    const renderRowsAndRefreshDiff = () => {
      renderRows();
      try { notifyComposerChange('site', { skipAutoSave: true }); } catch (_) {}
    };

    const moveEntry = (from, to, options = {}) => {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      markDirty();
      if (options.refreshDiff) renderRowsAndRefreshDiff();
      else renderRows();
      return true;
    };

    let linkDragState = null;

    const getAnimatedLinkRows = () => Array.from(listWrap.querySelectorAll('.cs-link-row:not(.is-dragging)'));

    const animateLinkRows = (callback) => {
      const previousRects = new Map();
      getAnimatedLinkRows().forEach((row) => {
        previousRects.set(row, row.getBoundingClientRect());
      });

      callback();

      getAnimatedLinkRows().forEach((row) => {
        const previous = previousRects.get(row);
        if (!previous) return;
        const next = row.getBoundingClientRect();
        const deltaY = previous.top - next.top;
        if (!deltaY) return;
        row.style.transition = 'none';
        row.style.transform = `translate3d(0, ${previous.top - next.top}px, 0)`;
        requestAnimationFrame(() => {
          row.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
          row.style.transform = '';
        });
      });
    };

    const createDragPlaceholder = (row) => {
      const rowRect = row.getBoundingClientRect();
      const placeholder = document.createElement('div');
      placeholder.className = 'cs-link-drop-placeholder';
      placeholder.style.height = `${rowRect.height}px`;
      return placeholder;
    };

    const getDropIndex = () => {
      if (!linkDragState || !linkDragState.placeholder) return -1;
      const rows = Array.from(listWrap.children)
        .filter((node) => node === linkDragState.placeholder || (node !== linkDragState.dragRow && node.classList?.contains('cs-link-row')));
      return rows.indexOf(linkDragState.placeholder);
    };

    const moveListEntry = (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      markDirty();
      return true;
    };

    const applyDragPreview = (clientY) => {
      if (!linkDragState) return;
      linkDragState.dragRow.style.transform = `translate3d(0, ${clientY - linkDragState.startY}px, 0)`;
      const rows = getAnimatedLinkRows();
      let nextNode = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          nextNode = row;
          break;
        }
      }
      if (nextNode === linkDragState.placeholder.nextSibling) return;
      animateLinkRows(() => {
        listWrap.insertBefore(linkDragState.placeholder, nextNode);
      });
    };

    const updateDragRowState = () => {
      listWrap.querySelectorAll('.cs-link-row').forEach((row) => {
        row.classList.toggle('is-dragging', !!linkDragState && row === linkDragState.dragRow);
      });
    };

    const endDrag = () => {
      document.removeEventListener('pointermove', handleDragPointerMove, true);
      document.removeEventListener('pointerup', endDrag, true);
      document.removeEventListener('pointercancel', endDrag, true);
      if (linkDragState) {
        const { fromIndex, dragRow, placeholder } = linkDragState;
        const toIndex = getDropIndex();
        dragRow.classList.remove('is-dragging');
        dragRow.style.position = '';
        dragRow.style.left = '';
        dragRow.style.top = '';
        dragRow.style.width = '';
        dragRow.style.zIndex = '';
        dragRow.style.transform = '';
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        moveListEntry(fromIndex, toIndex);
        renderRowsAndRefreshDiff();
      }
      linkDragState = null;
      updateDragRowState();
    };

    const handleDragPointerMove = (event) => {
      if (!linkDragState) return;
      event.preventDefault();
      applyDragPreview(event.clientY);
    };

    const createDragHandle = (index) => {
      const handle = document.createElement('span');
      handle.setAttribute('role', 'button');
      handle.tabIndex = 0;
      handle.className = 'cs-link-drag-handle';
      handle.setAttribute('aria-label', t('editor.composer.site.reorderLink'));
      handle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
      handle.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const row = handle.closest('.cs-link-row');
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const placeholder = createDragPlaceholder(row);
        listWrap.insertBefore(placeholder, row);
        linkDragState = {
          fromIndex: index,
          dragRow: row,
          placeholder,
          startY: event.clientY
        };
        row.classList.add('is-dragging');
        row.style.position = 'fixed';
        row.style.left = `${rowRect.left}px`;
        row.style.top = `${rowRect.top}px`;
        row.style.width = `${rowRect.width}px`;
        row.style.zIndex = '1000';
        row.style.transform = 'translate3d(0, 0, 0)';
        updateDragRowState();
        document.addEventListener('pointermove', handleDragPointerMove, true);
        document.addEventListener('pointerup', endDrag, true);
        document.addEventListener('pointercancel', endDrag, true);
      });
      handle.addEventListener('keydown', (event) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        moveEntry(index, event.key === 'ArrowUp' ? index - 1 : index + 1, { refreshDiff: true });
      });
      return handle;
    };

    const renderRows = () => {
      listWrap.innerHTML = '';
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'cs-empty';
        empty.textContent = t('editor.composer.site.noLinks');
        listWrap.appendChild(empty);
        return;
      }
      const labelTitleId = `${key}-label-title`;
      const hrefTitleId = `${key}-href-title`;
      const appendLinkHeader = () => {
        const head = document.createElement('div');
        head.className = 'cs-link-head';
        const handleSpacer = document.createElement('span');
        handleSpacer.className = 'cs-link-head-spacer';
        handleSpacer.setAttribute('aria-hidden', 'true');
        const labelTitle = document.createElement('span');
        labelTitle.id = labelTitleId;
        labelTitle.className = 'cs-link-field-title cs-link-field-title--label';
        labelTitle.textContent = t('editor.composer.site.linkLabelTitle');
        const hrefTitle = document.createElement('span');
        hrefTitle.id = hrefTitleId;
        hrefTitle.className = 'cs-link-field-title cs-link-field-title--href';
        hrefTitle.textContent = t('editor.composer.site.linkHrefTitle');
        const actionSpacer = document.createElement('span');
        actionSpacer.className = 'cs-link-head-actions';
        actionSpacer.setAttribute('aria-hidden', 'true');
        head.append(handleSpacer, labelTitle, hrefTitle, actionSpacer);
        listWrap.appendChild(head);
      };
      appendLinkHeader();
      list.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'cs-link-row';
        row.dataset.index = String(index);

        const dragHandle = createDragHandle(index);

        const labelField = document.createElement('div');
        labelField.className = 'cs-link-field cs-link-field--label';
        if (index > 0) {
          labelField.classList.add('cs-link-field--compact');
        }
        const labelInputId = `${key}-label-${index}`;
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.id = labelInputId;
        labelInput.className = 'cs-input';
        labelInput.dataset.field = key;
        labelInput.dataset.index = String(index);
        labelInput.dataset.subfield = 'label';
        labelInput.placeholder = t('editor.composer.site.linkLabelPlaceholder');
        labelInput.setAttribute('aria-labelledby', labelTitleId);
        labelInput.value = item && item.label ? item.label : '';
        labelInput.addEventListener('input', () => {
          list[index].label = labelInput.value;
          markDirty();
        });
        labelField.append(labelInput);

        const hrefField = document.createElement('div');
        hrefField.className = 'cs-link-field cs-link-field--href';
        if (index > 0) {
          hrefField.classList.add('cs-link-field--compact');
        }
        const hrefInputId = `${key}-href-${index}`;
        const hrefInput = document.createElement('input');
        hrefInput.type = 'text';
        hrefInput.id = hrefInputId;
        hrefInput.className = 'cs-input';
        hrefInput.dataset.field = key;
        hrefInput.dataset.index = String(index);
        hrefInput.dataset.subfield = 'href';
        hrefInput.placeholder = t('editor.composer.site.linkHrefPlaceholder');
        hrefInput.setAttribute('aria-labelledby', hrefTitleId);
        hrefInput.value = item && item.href ? item.href : '';
        hrefInput.addEventListener('input', () => {
          list[index].href = hrefInput.value;
          markDirty();
        });
        hrefField.append(hrefInput);
        const actions = document.createElement('div');
        actions.className = 'cs-link-actions';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-tertiary cs-remove-link';
        removeBtn.textContent = t('editor.composer.site.removeLink');
        removeBtn.addEventListener('click', () => {
          list.splice(index, 1);
          markDirty();
          renderRowsAndRefreshDiff();
        });
        actions.append(removeBtn);
        row.append(dragHandle, labelField, hrefField, actions);
        listWrap.appendChild(row);
      });
    };

    addBtn.addEventListener('click', () => {
      list.push({ label: '', href: '' });
      markDirty();
      renderRowsAndRefreshDiff();
    });

    renderRows();
  };

  const repoSection = createSection(
    t('editor.composer.site.sections.repo.title'),
    t('editor.composer.site.sections.repo.description')
  );
  const repo = ensureRepo();
  const repoInputs = document.createElement('div');
  repoInputs.className = 'cs-repo-grid';
  repoInputs.dataset.field = 'repo';

  const createRepoFieldTitle = (text) => {
    const title = document.createElement('span');
    title.className = 'cs-repo-field-title';
    title.textContent = text;
    return title;
  };

  const createRepoFieldGroup = (className, titleText, field) => {
    const group = document.createElement('label');
    group.className = `cs-repo-field-group ${className}`;
    group.append(createRepoFieldTitle(titleText), field);
    return group;
  };

  const createRepoIconAffix = (pathData) => {
    const affix = document.createElement('span');
    affix.className = 'cs-repo-affix cs-repo-icon-affix';
    affix.setAttribute('aria-hidden', 'true');
    affix.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="${pathData}"></path></svg>`;
    return affix;
  };

  const ownerInput = document.createElement('input');
  ownerInput.type = 'text';
  ownerInput.className = 'cs-input cs-repo-input cs-repo-input--owner';
  ownerInput.placeholder = t('editor.composer.site.repoOwner');
  ownerInput.setAttribute('aria-label', t('editor.composer.site.repoOwner'));
  ownerInput.spellcheck = false;
  ownerInput.value = repo.owner || '';
  ownerInput.addEventListener('input', () => { repo.owner = ownerInput.value; markDirty(); });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'cs-input cs-repo-input cs-repo-input--name';
  nameInput.placeholder = t('editor.composer.site.repoName');
  nameInput.setAttribute('aria-label', t('editor.composer.site.repoName'));
  nameInput.spellcheck = false;
  nameInput.value = repo.name || '';
  nameInput.addEventListener('input', () => { repo.name = nameInput.value; markDirty(); });

  const branchInput = document.createElement('input');
  branchInput.type = 'text';
  branchInput.className = 'cs-input cs-repo-input cs-repo-input--branch';
  branchInput.placeholder = t('editor.composer.site.repoBranch');
  branchInput.setAttribute('aria-label', t('editor.composer.site.repoBranch'));
  branchInput.spellcheck = false;
  branchInput.value = repo.branch || '';
  branchInput.addEventListener('input', () => { repo.branch = branchInput.value; markDirty(); });

  const ownerWrap = document.createElement('div');
  ownerWrap.className = 'cs-repo-field cs-repo-field--owner';
  ownerWrap.dataset.field = 'repo';
  ownerWrap.dataset.subfield = 'owner';
  const ownerAffix = document.createElement('span');
  ownerAffix.className = 'cs-repo-affix';
  ownerAffix.textContent = t('editor.composer.site.repoOwnerPrefix');
  ownerAffix.setAttribute('aria-hidden', 'true');
  ownerWrap.append(ownerAffix, ownerInput);

  const repoWrap = document.createElement('div');
  repoWrap.className = 'cs-repo-field cs-repo-field--name';
  repoWrap.dataset.field = 'repo';
  repoWrap.dataset.subfield = 'name';
  const repoAffix = createRepoIconAffix('M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z');
  repoWrap.append(repoAffix, nameInput);

  const pathRow = document.createElement('div');
  pathRow.className = 'cs-repo-path';
  const divider = document.createElement('span');
  divider.className = 'cs-repo-divider';
  divider.textContent = '/';
  divider.setAttribute('aria-hidden', 'true');
  pathRow.append(
    createRepoFieldGroup('cs-repo-field-group--owner', t('editor.composer.site.repoOwner'), ownerWrap),
    divider,
    createRepoFieldGroup('cs-repo-field-group--name', t('editor.composer.site.repoName'), repoWrap)
  );

  const branchWrap = document.createElement('div');
  branchWrap.className = 'cs-repo-field cs-repo-field--branch';
  branchWrap.dataset.field = 'repo';
  branchWrap.dataset.subfield = 'branch';
  const branchAffix = createRepoIconAffix('M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z');
  branchWrap.append(branchAffix, branchInput);

  repoInputs.append(
    pathRow,
    createRepoFieldGroup('cs-repo-field-group--branch', t('editor.composer.site.repoBranch'), branchWrap)
  );
  repoSection.appendChild(repoInputs);
  renderFineGrainedTokenSettings(repoSection);

  const identitySection = createSection(
    t('editor.composer.site.sections.identity.title'),
    t('editor.composer.site.sections.identity.description')
  );
  renderIdentityLocalizedGrid(identitySection);
  renderIdentityPathGrid(identitySection);

  const seoSection = createSection(
    t('editor.composer.site.sections.seo.title'),
    t('editor.composer.site.sections.seo.description')
  );
  renderLocalizedField(seoSection, 'siteDescription', {
    label: t('editor.composer.site.fields.siteDescription'),
    description: t('editor.composer.site.fields.siteDescriptionHelp'),
    multiline: true,
    rows: 3,
    ensureDefault: false,
    subheading: true
  });
  renderLocalizedField(seoSection, 'siteKeywords', {
    label: t('editor.composer.site.fields.siteKeywords'),
    description: t('editor.composer.site.fields.siteKeywordsHelp'),
    grid: true,
    ensureDefault: false,
    subheading: true
  });
  createLinkListField(seoSection, 'profileLinks', {
    label: t('editor.composer.site.fields.profileLinks'),
    description: t('editor.composer.site.fields.profileLinksHelp'),
    subheading: true
  });
  renderSeoResourceGrid(seoSection);

  const siteConfigSection = createSection(
    t('editor.composer.site.sections.configuration.title'),
    t('editor.composer.site.sections.configuration.description')
  );
  const behaviorSubsection = createConfigSubsection(
    siteConfigSection,
    t('editor.composer.site.sections.behavior.title'),
    t('editor.composer.site.sections.behavior.description')
  );
  renderBehaviorGrid(behaviorSubsection);

  const themeSubsection = createConfigSubsection(
    siteConfigSection,
    t('editor.composer.site.sections.theme.title'),
    t('editor.composer.site.sections.theme.description')
  );
  renderThemeGrid(themeSubsection);

  const assetsSubsection = createConfigSubsection(
    siteConfigSection,
    t('editor.composer.site.sections.assets.title'),
    t('editor.composer.site.sections.assets.description')
  );
  renderAssetWarningsGrid(assetsSubsection);

  if (site.__extras && Object.keys(site.__extras).length) {
    const extrasSection = createSection(
      t('editor.composer.site.sections.extras.title'),
      t('editor.composer.site.sections.extras.description')
    );
    const list = document.createElement('ul');
    list.className = 'cs-extra-list';
    list.dataset.field = '__extras';
    Object.keys(site.__extras).sort().forEach((key) => {
      const item = document.createElement('li');
      item.textContent = key;
      list.appendChild(item);
    });
    extrasSection.appendChild(list);
  }

  syncSiteEditorSingleLabelWidth(root);
  refreshNavDiffState();
  try { scheduleScrollSync(); } catch (_) {}
}

function rebuildSiteUI() {
  const root = document.getElementById('composerSite');
  if (!root) return;
  buildSiteUI(root, activeComposerState);
  notifyComposerChange('site', { skipAutoSave: true });
}

// Minimal styles injected for composer behaviors
(function injectComposerStyles(){
  const css = `
  .ci-item,.ct-item{border:1px solid var(--border);border-radius:8px;background:var(--card);margin:.5rem 0;position:relative;filter:none;--ci-hover-tint:var(--primary);--ci-ring-shadow:0 0 0 0 transparent;--ci-depth-shadow:0 1px 2px rgba(15,23,42,0.05);box-shadow:var(--ci-ring-shadow),var(--ci-depth-shadow);}
  .ci-head,.ct-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border);}
  .ci-head,.ct-head{border-bottom:none;}
  .ci-item.is-open .ci-head,.ct-item.is-open .ct-head{border-bottom:1px solid var(--border);}
  .ci-key,.ct-key{transition:color .18s ease;}
  .ci-body,.ct-body{display:none;padding:.5rem .6rem;}
  .ci-body-inner,.ct-body-inner{overflow:visible;}
  .ci-grip,.ct-grip{cursor:grab;user-select:none;opacity:.7}
  .ci-actions,.ct-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ci-head-add-lang-slot{display:inline-flex;align-items:center}
  .ci-meta,.ct-meta{color:var(--muted);font-size:.85rem}
  .ci-lang,.ct-lang{border:1px dashed var(--border);border-radius:8px;margin:.4rem 0;background:color-mix(in srgb, var(--text) 3%, transparent);}
  .ci-lang{border:0;border-radius:0;margin:0;background:transparent;padding:.65rem 0;}
  .ci-lang+.ci-lang{border-top:1px solid color-mix(in srgb, var(--border) 82%, transparent);}
  .ct-lang{padding:.0625rem;}
  .ci-lang-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .ci-lang-label{display:inline-flex;align-items:center;gap:.35rem;line-height:1.1;}
  .ci-lang-label .ci-lang-flag{display:inline-grid;place-items:center;width:1.2em;height:1.2em;font-size:1rem;line-height:1;}
  .ci-lang-label .ci-lang-code{display:inline-flex;align-items:center;line-height:1.2;font-size:1rem;font-weight:700;letter-spacing:.035em;}
  .ci-lang-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ct-lang{display:flex;align-items:stretch;gap:0;overflow:hidden;}
  .ct-lang-label{display:flex;align-items:center;justify-content:center;gap:.3rem;padding:.35rem .6rem;background:color-mix(in srgb, var(--text) 14%, var(--card));color:var(--text);min-width:78px;white-space:nowrap;font-weight:700;border-radius:6px 0 0 6px;}
  .ct-lang-label .ct-lang-flag{font-size:1.25rem;line-height:1;transform:translateY(-1px);}
  .ct-lang-label .ct-lang-code{font-size:.9rem;font-weight:700;letter-spacing:.045em;}
  .ci-item[data-child-draft="dirty"] .ci-key,.ct-item[data-child-draft="dirty"] .ct-key{color:#f97316;}
  .ci-item[data-child-draft="conflict"] .ci-key,.ct-item[data-child-draft="conflict"] .ct-key{color:#ef4444;}
  .ct-draft-indicator,.ci-draft-indicator{display:inline-flex;width:.55rem;height:.55rem;border-radius:999px;background:color-mix(in srgb,var(--muted) 48%, transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--muted) 14%, transparent);flex:0 0 auto;opacity:0;transform:scale(.6);transition:opacity .18s ease, transform .18s ease, background-color .18s ease, box-shadow .18s ease;}
  .ct-draft-indicator[hidden],.ci-draft-indicator[hidden]{display:none;}
  .ct-lang[data-draft-state] .ct-draft-indicator,.ci-ver-item[data-draft-state] .ci-draft-indicator{opacity:1;transform:scale(.95);}
  .ct-lang[data-draft-state="dirty"] .ct-draft-indicator,.ci-ver-item[data-draft-state="dirty"] .ci-draft-indicator{background:#f97316;box-shadow:0 0 0 3px color-mix(in srgb,#f97316 22%, transparent);}
  .ct-lang[data-draft-state="saved"] .ct-draft-indicator,.ci-ver-item[data-draft-state="saved"] .ci-draft-indicator{background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 20%, transparent);}
  .ct-lang[data-draft-state="conflict"] .ct-draft-indicator,.ci-ver-item[data-draft-state="conflict"] .ci-draft-indicator{background:#ef4444;box-shadow:0 0 0 3px color-mix(in srgb,#ef4444 25%, transparent);}
  .ct-lang-main{flex:1 1 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:.5rem;align-items:center;padding:.35rem .6rem .35rem .75rem;}
  .ct-field{display:flex;align-items:center;gap:.4rem;font-weight:600;color:color-mix(in srgb, var(--text) 65%, transparent);white-space:nowrap;}
  .ct-field input{flex:1 1 auto;min-width:0;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem;}
  .ct-lang-actions{display:flex;gap:.35rem;justify-content:flex-end;}
  .ct-lang-actions .btn-secondary{white-space:nowrap;}
  @media (max-width:720px){
    .ct-lang{flex-direction:column;gap:.4rem;}
    .ct-lang-label{justify-content:flex-start;border-radius:6px;}
    .ct-lang-main{grid-template-columns:1fr;padding:.25rem 0 0;}
    .ct-field{white-space:normal;}
    .ct-lang-actions{justify-content:flex-start;}
  }
  .ci-ver-item{display:flex;align-items:center;gap:.55rem;margin:.3rem 0;padding:.4rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--text) 2%, transparent)}
  .ci-ver-label{flex:1 1 auto;min-width:0;font-weight:600;color:var(--text)}
  .ci-ver-actions button:disabled{opacity:.5;cursor:not-allowed}
  /* Add Language row: compact button, keep menu aligned to trigger width */
  .ci-add-lang,.ct-add-lang,.cs-add-lang{display:inline-flex;align-items:center;gap:.5rem;margin-top:.5rem;position:relative;flex:0 0 auto}
  .ci-actions .ci-add-lang{margin-top:0}
  .ci-actions .ci-add-lang .btn-secondary{border-bottom:1px solid var(--border)!important}
  .ci-add-lang .btn-secondary,.ct-add-lang .btn-secondary{justify-content:center;border-bottom:0 !important}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang select,.ct-add-lang select{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .has-menu{overflow:visible}
  .has-menu.is-open{z-index:100}
  /* Button when open looks attached to menu */
  .ci-add-lang .btn-secondary.is-open,.ct-add-lang .btn-secondary.is-open{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb, var(--text) 5%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border));border-bottom:0 !important}
  /* Custom menu popup */
  .ns-menu{position:absolute;top:calc(100% - 1px);left:0;right:auto;z-index:101;border:1px solid var(--border);background:var(--card);box-shadow:var(--shadow);width:max-content;min-width:100%;max-width:min(320px,calc(100vw - 3rem));border-top:none;border-bottom-left-radius:8px;border-bottom-right-radius:8px;border-top-left-radius:0;border-top-right-radius:0;transform-origin: top left;}
  .has-menu.is-open > .ns-menu{animation: ns-menu-in 160ms ease-out both}
  @keyframes ns-menu-in{from{opacity:0; transform: translateY(-4px) scale(0.98);} to{opacity:1; transform: translateY(0) scale(1);} }
  /* Closing animation */
  .ns-menu.is-closing{animation: ns-menu-out 130ms ease-in both !important}
  @keyframes ns-menu-out{from{opacity:1; transform: translateY(0) scale(1);} to{opacity:0; transform: translateY(-4px) scale(0.98);} }
  .ns-menu .ns-menu-item{display:block;width:100%;text-align:left;background:transparent;color:var(--text);border:0 !important;border-bottom:0 !important;padding:.4rem .6rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Only draw a single divider: use top border on following items */
  .ns-menu .ns-menu-item + .ns-menu-item{border-top:1px solid color-mix(in srgb, var(--text) 16%, var(--border))}
  .ns-menu .ns-menu-item:hover{background:color-mix(in srgb, var(--text) 6%, var(--card))}
  /* Make selects look like secondary buttons */
  .btn-like-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding:.45rem .8rem;height:2.25rem;line-height:1}
  .btn-like-select:focus-visible{outline:2px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset:2px}
  .dragging{opacity:.96}
  .drag-placeholder{border:1px dashed var(--border);border-radius:8px;background:transparent}
  .is-dragging-list{touch-action:none}
  body.ns-noselect{user-select:none;cursor:grabbing}
  /* Simple badges for verify modal */
  .badge{display:inline-flex;align-items:center;gap:.25rem;border:1px solid var(--border);background:var(--card);color:var(--muted);font-size:.72rem;padding:.05rem .4rem;border-radius:999px}
  .badge-ver{ color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  .badge-lang{}
  .ci-item.is-dirty{border-color:color-mix(in srgb,#f97316 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#f97316 18%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#f97316 16%, transparent);--ci-hover-tint:#f97316;}
  .ci-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));--ci-hover-tint:#16a34a;}
  .ci-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 60%, var(--border));--ci-hover-tint:#dc2626;}
  .ci-item[data-diff="modified"],.ci-item[data-diff="changed"]{--ci-hover-tint:#f59e0b;}
  .ci-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ci-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ci-diff-badge.ci-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-changed{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:#b45309;background:color-mix(in srgb,#f59e0b 12%, transparent);}
  .ci-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, var(--card));}
  .ci-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 8%, var(--card));opacity:.9;}
  .ci-lang[data-diff="modified"]{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));}
  .ci-ver-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));background:color-mix(in srgb,#16a34a 8%, transparent);}
  .ci-ver-item[data-diff="changed"]{border-color:color-mix(in srgb,#f59e0b 60%, var(--border));background:color-mix(in srgb,#f59e0b 6%, transparent);}
  .ci-ver-item[data-diff="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));border-style:dashed;}
  .ci-ver-removed{margin-top:.2rem;font-size:.78rem;color:#b91c1c;}
  .ct-item.is-dirty{border-color:color-mix(in srgb,#2563eb 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#2563eb 16%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#2563eb 14%, transparent);}
  .ct-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));}
  .ct-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));}
  .ct-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ct-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ct-diff-badge.ct-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-changed{border-color:color-mix(in srgb,#2563eb 45%, var(--border));color:#1d4ed8;background:color-mix(in srgb,#2563eb 10%, transparent);}
  .ct-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 8%, var(--card));}
  .ct-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 6%, var(--card));opacity:.9;}
  .ct-lang[data-diff="modified"]{border-color:color-mix(in srgb,#2563eb 45%, var(--border));}
  .ct-field input[data-diff="changed"]{border-color:color-mix(in srgb,#2563eb 60%, var(--border));background:color-mix(in srgb,#2563eb 6%, transparent);}
  /* Caret arrow for Details buttons */
  .ci-expand .caret,.ct-expand .caret{display:inline-block;width:0;height:0;border-style:solid;border-width:5px 0 5px 7px;border-color:transparent transparent transparent currentColor;margin-right:.35rem;transform:rotate(0deg);transform-origin:50% 50%;transition:transform 480ms cubic-bezier(.45,0,.25,1)}
  .ci-expand[aria-expanded="true"] .caret,.ct-expand[aria-expanded="true"] .caret{transform:rotate(90deg)}
  @media (prefers-reduced-motion: reduce){
    .ci-expand .caret,.ct-expand .caret{transition:none}
  }
  /* Composer Guide */
  .comp-guide{border:1px dashed var(--border);border-radius:8px;background:color-mix(in srgb, var(--text) 3%, transparent);padding:.6rem .6rem .2rem;margin:.6rem 0 .8rem}
  .comp-guide-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .comp-guide-head .muted{color:var(--muted);font-size:.88rem}
  /* Titlebar-like header inside modal */
  .ns-modal-dialog .comp-guide-head{
    display:flex;align-items:center;justify-content:space-between;gap:.6rem;
    background: color-mix(in srgb, var(--text) 6%, var(--card));
    border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
    /* Pull to dialog edges to resemble an app title bar */
    /* Remove top gap by not offsetting beyond dialog top */
    margin: 0 -.85rem .9rem;
    padding: .65rem .85rem;
    border-top-left-radius: 12px; border-top-right-radius: 12px;
    position: sticky; top: 0; z-index: 2;
  }
  .ns-modal-dialog .comp-head-left{display:flex;align-items:baseline;gap:.6rem;min-width:0}
  .ns-modal-dialog .comp-guide-head strong{font-weight:700}
  .ns-modal-dialog .comp-guide-head .muted{opacity:.9}
  .comp-form{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;align-items:end;margin-bottom:.5rem}
  .comp-form label{display:flex;flex-direction:column;gap:.25rem;font-weight:600}
  .comp-form label{position:relative}
  .comp-form input[type=text]{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .comp-langs{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .comp-langs .lab{font-weight:600; margin-right:.25rem}
  .comp-langs label{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border);border-radius:999px;padding:.18rem .5rem;background:var(--card);color:var(--text);cursor:pointer;user-select:none}
  .comp-langs label:hover{background:color-mix(in srgb, var(--text) 5%, transparent)}
  .comp-langs label input{display:none}
  .comp-langs label:has(input:checked){background:color-mix(in srgb, var(--primary) 16%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border))}
  .comp-langs label span{font-weight:400;font-size:.85rem}
  /* Disabled states for form + language chips */
  .comp-form input[disabled]{opacity:.6;cursor:not-allowed;background:color-mix(in srgb, var(--text) 4%, var(--card))}
  .comp-langs label:has(input[disabled]){opacity:.5;cursor:not-allowed;pointer-events:none}
  .comp-langs label:has(input[disabled]):hover{background:var(--card)}
  /* Floating bubble over inputs */
  .comp-bubble{position:absolute;bottom:calc(100% + 6px);left:0;z-index:3;padding:.28rem .5rem;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;font-size:.88rem;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.05);max-width:min(72vw,560px);pointer-events:none}
  .comp-bubble::after{content:'';position:absolute;top:100%;left:14px;border-width:6px;border-style:solid;border-color:#fee2e2 transparent transparent transparent}
  /* Floating variant appended to modal to avoid clipping */
  .comp-bubble.is-floating{position:fixed;z-index:100000;bottom:auto;left:auto}
  .comp-actions{display:flex;gap:.5rem;}
  .comp-steps{margin-top:.25rem}
  /* Divider between form and steps */
  .comp-divider{height:1px;background:var(--border);opacity:.8;margin:1.5rem 0}
  .comp-step{display:grid;grid-template-columns:1.6rem 1fr;column-gap:.6rem;align-items:start;margin:.4rem 0;padding:.4rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
  .comp-step > .num{grid-column:1}
  .comp-step > .body{grid-column:2}
  .comp-step > .comp-warn{grid-column:1 / -1}
  .comp-step > .comp-ok{grid-column:1 / -1}
  .comp-step .num{flex:0 0 auto;width:1.6rem;height:1.6rem;border-radius:999px;background:color-mix(in srgb, var(--primary) 14%, var(--card));border:1px solid color-mix(in srgb, var(--primary) 36%, var(--border));display:grid;place-items:center;font-weight:700;color:var(--text)}
  .comp-step .title{font-weight:700;margin-bottom:.15rem}
  .comp-step .desc{color:var(--muted);font-size:.92rem;margin:.1rem 0}
  .comp-step .actions{display:flex;gap:.4rem;margin-top:.25rem}
  .comp-step code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Ubuntu Mono', monospace; background: color-mix(in srgb, var(--text) 10%, transparent); padding: .08rem .35rem; border-radius: 6px; font-size: .9em;}
  /* Footer hint next to Verify */
  .comp-footer .comp-hint{color:var(--muted);font-size:.9rem;align-self:center}
  /* Validation status */
  .comp-step.ok{border-color: color-mix(in srgb, #16a34a 60%, var(--border));}
  .comp-step.err{border-color: color-mix(in srgb, #dc2626 60%, var(--border));}
  .comp-status{margin-top:.2rem;font-size:.9rem;color:var(--muted)}
  .comp-status[data-state="ok"]{color:#16a34a}
  /* Warning area at card bottom */
  .comp-warn{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #fecaca; background:#fee2e2; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#7f1d1d}
  .comp-warn .comp-warn-text{font-size:.92rem; line-height:1.35}
  /* Success note at card bottom */
  .comp-ok{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #bbf7d0; background:#dcfce7; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#065f46}
  .comp-ok .comp-ok-text{font-size:.92rem; line-height:1.35}
  .btn-compact{height:1.9rem;padding:.2rem .55rem;font-size:.9rem}
  /* Unify button styles inside modal (anchors and buttons) */
  .ns-modal-dialog .btn-secondary,
  .ns-modal-dialog a.btn-secondary,
  .ns-modal-dialog button.btn-secondary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none; border:1px solid var(--border); background:var(--card); color:var(--text);
  }
  .ns-modal-dialog a.btn-secondary:visited { color: var(--text); }
  .ns-modal-dialog .btn-secondary:hover { background: color-mix(in srgb, var(--text) 5%, var(--card)); }
  /* GitHub green button variant (overrides theme packs) */
  .ns-modal-dialog .btn-github,
  .ns-modal-dialog a.btn-github,
  .ns-modal-dialog button.btn-github {
    background:#428646 !important; color:#ffffff !important; border:1px solid #3d7741 !important; border-radius:8px !important;
  }
  .ns-modal-dialog a.btn-github:visited { color:#ffffff !important; }
  .ns-modal-dialog .btn-github:hover { background:#3d7741 !important; }
  .ns-modal-dialog .btn-github:active { background:#298e46 !important; }
  .ns-modal-dialog .btn-secondary[disabled],
  .ns-modal-dialog button.btn-secondary[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .ns-modal-dialog .btn-primary,
  .ns-modal-dialog a.btn-primary,
  .ns-modal-dialog button.btn-primary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none;
  }
  .ns-modal-dialog .btn-primary[disabled],
  .ns-modal-dialog button.btn-primary[disabled]{opacity:.6;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .ns-modal-dialog a.btn-primary:visited { color: white; }

  /* Simple modal for the Composer wizard */
  .ns-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9999;padding:1rem}
  .ns-modal.is-open{display:flex}
  /* Nudge modal upward on short viewports */
  @media (max-height: 820px){
    .ns-modal{align-items:flex-start;padding-top:calc(max(12px, env(safe-area-inset-top)) + 24px)}
  }
  /* Remove top padding so sticky header can sit flush */
  .ns-modal-dialog{position:relative;background:var(--card);color:var(--text);border:1px solid color-mix(in srgb, var(--primary) 28%, var(--border));border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,0.18),0 6px 18px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06);width:min(92vw, 760px);max-height:min(90vh, 720px);overflow:auto;padding:0 .85rem .85rem}
  .ns-modal-close{position:absolute;top:.5rem;right:.6rem;z-index:3}
  /* When close button is inside the header, make it part of the flow */
  .ns-modal-dialog .comp-guide-head .ns-modal-close{position:static;top:auto;right:auto;margin-left:auto}
  body.ns-modal-open{overflow:hidden}
  .ns-modal-dialog .comp-guide{border:none;background:transparent;padding:0;margin:0}

  .composer-diff-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 -.85rem;padding:0 .85rem .6rem;border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));background:transparent}
  .composer-diff-tab{position:relative;border:0;background:none;padding:.48rem .92rem;border-radius:999px;font-weight:600;font-size:.93rem;color:color-mix(in srgb,var(--text) 68%, transparent);cursor:pointer;transition:color 160ms ease, background-color 160ms ease, transform 160ms ease}
  .composer-diff-tab.is-active{background:color-mix(in srgb,var(--primary) 18%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text));box-shadow:0 6px 16px rgba(37,99,235,0.18)}
  .composer-diff-tab.is-active::after{content:'';position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:36%;min-width:24px;height:3px;border-radius:999px;background:color-mix(in srgb,var(--primary) 80%, var(--text));}
  .composer-diff-tab:hover{color:color-mix(in srgb,var(--primary) 94%, var(--text));background:color-mix(in srgb,var(--primary) 12%, transparent)}
  .composer-diff-tab:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .composer-diff-views{padding:.85rem .15rem .35rem}
  .composer-diff-view{display:block}
  .composer-diff-empty{margin:.65rem 0;font-size:.95rem;color:var(--muted)}
  .composer-diff-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:.75rem .85rem .85rem;margin:0;border-top:1px solid color-mix(in srgb,var(--text) 12%, var(--border));background:color-mix(in srgb,var(--text) 2%, var(--card))}
  .composer-diff-actions .btn-secondary{min-width:140px;font-weight:600}
  .composer-diff-overview-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.65rem;margin-bottom:1rem}
  .composer-diff-stat{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:12px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 4%, var(--card));display:flex;flex-direction:column;gap:.12rem;min-height:74px}
  .composer-diff-stat-value{font-size:1.6rem;font-weight:700;color:color-mix(in srgb,var(--text) 88%, transparent)}
  .composer-diff-stat[data-id="order"] .composer-diff-stat-value{font-size:1.08rem}
  .composer-diff-stat-label{font-size:.85rem;color:color-mix(in srgb,var(--text) 60%, transparent)}
  .composer-diff-overview-blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.85rem;margin:.6rem 0 1rem}
  .composer-diff-overview-block{border:1px solid var(--border);border-radius:10px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card))}
  .composer-diff-overview-block h3{margin:0 0 .45rem;font-size:.92rem;color:color-mix(in srgb,var(--text) 80%, transparent)}
  .composer-diff-key-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.28rem}
  .composer-diff-key-list code{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-size:.86rem;color:color-mix(in srgb,var(--text) 82%, transparent)}
  .composer-diff-key-more{font-size:.86rem;color:var(--muted)}
  .composer-diff-overview-langs{margin:.4rem 0 0;font-size:.9rem;color:color-mix(in srgb,var(--text) 62%, transparent)}
  .composer-diff-section{margin-bottom:1.05rem}
  .composer-diff-section h3{margin:0 0 .5rem;font-size:.98rem}
  .composer-diff-entry-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.55rem}
  .composer-diff-entry{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:10px;padding:.55rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card));display:flex;flex-direction:column;gap:.35rem}
  .composer-diff-entry-key{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-weight:600;font-size:.95rem;color:var(--text)}
  .composer-diff-entry-badges{display:flex;flex-wrap:wrap;gap:.3rem;font-size:.8rem}
  .composer-diff-field-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.2rem;font-size:.88rem;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-diff-field-list li{display:flex;align-items:flex-start;gap:.35rem}
  .composer-diff-field-list li::before{content:'•';color:color-mix(in srgb,var(--primary) 62%, var(--text));line-height:1.1}
  @media (max-width:640px){
    .composer-diff-tabs{margin:0 0 .6rem;padding:0 0 .6rem}
    .composer-diff-overview-stats{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
    .composer-diff-overview-blocks{grid-template-columns:1fr}
  }
  .composer-order-dialog{width:min(96vw, 880px);max-height:min(90vh, 720px);padding-bottom:1rem}
  .composer-order-head{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:0 -.85rem .85rem;background:color-mix(in srgb,var(--text) 5%, var(--card));border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));padding:.75rem .85rem;position:sticky;top:0;z-index:3}
  .composer-order-head h2{margin:0;font-size:1.15rem;font-weight:700;flex:1 1 auto}
  .composer-order-subtitle{margin:0;font-size:.9rem;color:var(--muted);flex-basis:100%;order:3}
  .composer-order-close{margin-left:auto}
  .composer-order-stats{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .85rem;font-size:.85rem;color:var(--muted)}
  .composer-order-chip{display:inline-flex;align-items:center;gap:.3rem;border-radius:999px;padding:.18rem .55rem;border:1px solid color-mix(in srgb,var(--text) 16%, var(--border));background:color-mix(in srgb,var(--text) 4%, var(--card));font-weight:600;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-order-chip[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 14%, transparent);color:#1d4ed8}
  .composer-order-chip[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 12%, transparent);color:#166534}
  .composer-order-chip[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 12%, transparent);color:#b91c1c}
  .composer-order-chip[data-status="neutral"]{border-style:dashed}
  .composer-order-body{padding:0 0 0}
  .composer-order-visual{position:relative;padding:.4rem 3.4rem 1.9rem}
  .composer-order-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(3.2rem, 8vw, 6.8rem);position:relative;z-index:1}
  .composer-order-column-title{text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:.8rem;color:color-mix(in srgb,var(--text) 60%, transparent);margin-bottom:.4rem}
  .composer-order-list{display:flex;flex-direction:column;gap:.45rem;min-height:1.5rem}
  .composer-order-item{display:flex;align-items:center;gap:.55rem;padding:.38rem .6rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--text) 3%, var(--card));position:relative;box-shadow:0 1px 2px rgba(15,23,42,0.05)}
  .composer-order-item[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 11%, transparent)}
  .composer-order-item[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, transparent)}
  .composer-order-item[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 10%, transparent)}
  .composer-order-index{font-weight:700;font-size:.84rem;color:color-mix(in srgb,var(--text) 70%, transparent);min-width:2.3rem}
  .composer-order-key{flex:1 1 auto;min-width:0;font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);font-size:.9rem;color:var(--text);word-break:break-word}
  .composer-order-badge{margin-left:auto;font-size:.78rem;color:color-mix(in srgb,var(--text) 62%, transparent);font-weight:600}
  .composer-order-badge.is-hidden{display:none}
  .composer-order-lines{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:0;opacity:0;transition:opacity .18s ease}
  .composer-order-lines.is-hovering{opacity:1}
  .composer-order-path{fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity .18s ease}
  .composer-order-path.is-active{opacity:.78}
  .composer-order-path[data-status="same"]{stroke:#94a3b8;stroke-dasharray:6 6}
  .composer-order-path[data-status="same"].is-active{opacity:.35}
  .composer-order-item.is-hovered{box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .composer-order-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.95rem;color:var(--muted);pointer-events:none;padding:1rem}
  .composer-order-visual.is-empty .composer-order-lines{display:none}
  .composer-order-visual.is-empty .composer-order-columns{opacity:.15}
  @media (max-width:860px){
    .composer-order-columns{grid-template-columns:1fr;gap:1.8rem}
    .composer-order-lines{display:none}
    .composer-order-visual{padding:.4rem 1.2rem 1.4rem}
    .composer-order-item{padding:.32rem .55rem}
  }

  .btn-tertiary{appearance:none;border:1px solid transparent;background:transparent;color:color-mix(in srgb,var(--primary) 92%, var(--text));font-weight:600;font-size:.9rem;padding:.3rem .6rem;border-radius:8px;cursor:pointer;transition:color .16s ease, background-color .16s ease, border-color .16s ease}
  .btn-tertiary:hover{background:color-mix(in srgb,var(--primary) 12%, transparent);border-color:color-mix(in srgb,var(--primary) 48%, transparent);color:color-mix(in srgb,var(--primary) 98%, var(--text))}
  .btn-tertiary:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .btn-tertiary[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}

  .composer-site-host{padding:.35rem 0 1.2rem}
  .composer-site-main{width:100%;max-width:none;margin:0;padding:0}
  #composerSite{width:100%}
  .cs-root{display:flex;flex-direction:column;gap:1.1rem;padding:.2rem 0 1.1rem}
  .cs-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;align-items:start}
  .cs-viewport{min-width:0;display:flex;flex-direction:column;gap:1rem}
  .cs-section{border:1px solid color-mix(in srgb,var(--border) 96%, transparent);border-radius:12px;background:var(--card);box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:.9rem 1rem;display:flex;flex-direction:column;gap:.6rem}
  .cs-section-head{display:flex;align-items:baseline;gap:.65rem;flex-wrap:wrap}
  .cs-section-title{margin:0;font-size:1rem;font-weight:700;color:color-mix(in srgb,var(--text) 90%, transparent)}
  .cs-section-description{margin:0;font-size:.82rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 260px;text-align:right}
  .cs-config-subsection{display:flex;flex-direction:column;gap:.4rem}
  .cs-config-subsection + .cs-config-subsection{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-config-subsection-head{display:flex;align-items:baseline;gap:.45rem;flex-wrap:wrap;margin-bottom:.05rem}
  .cs-config-subsection-title{margin:0;font-size:.84rem;font-weight:600;color:color-mix(in srgb,var(--text) 76%, transparent)}
  .cs-config-subsection-description{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 auto;text-align:left}
  .cs-config-subsection > .cs-config-subsection-head + .cs-field{padding-top:0}
  .cs-field{margin:0;padding:.6rem 0;display:flex;flex-direction:column;gap:.4rem;position:relative}
  .cs-field + .cs-field{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-field-head{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
  .cs-field-inline-help .cs-field-head{align-items:baseline}
  .cs-field-label-wrap{display:flex;align-items:center;gap:.45rem;flex:1 1 auto;min-width:120px}
  .cs-field-inline-help .cs-field-label-wrap{align-items:baseline;gap:.4rem;flex-wrap:wrap}
  .cs-field-label-with-switch{gap:.6rem}
  .cs-field-action{margin-left:auto}
  .cs-field-label{font-weight:600;font-size:.9rem;color:color-mix(in srgb,var(--text) 86%, transparent);flex:0 1 auto;min-width:0}
  .cs-field-help{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent)}
  .cs-field-inline-help .cs-field-help{flex:1 1 auto;min-width:120px}
  .cs-field-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
  .cs-field-controls-inline{flex-wrap:nowrap}
  .cs-field-head-switch{display:flex;align-items:center;gap:.4rem}
  .cs-localized-list{display:flex;flex-direction:column;gap:.35rem}
  .cs-localized-row{display:flex;flex-wrap:wrap;gap:.45rem;padding:.2rem 0}
  .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.35rem;--cs-editor-row-column-gap:.45rem;--cs-editor-control-height:1.95rem;--cs-editor-single-control-width:15rem}
  .cs-localized-list--grid{gap:var(--cs-editor-row-gap)}
  .cs-localized-row--grid{display:grid;grid-template-columns:minmax(88px,88px) minmax(0,1fr) minmax(72px,max-content);align-items:center;column-gap:var(--cs-editor-row-column-gap);row-gap:0;min-height:var(--cs-editor-control-height);padding:0}
  .cs-localized-input{flex:1 1 240px;min-width:180px}
  .cs-localized-row--grid .cs-localized-input{min-width:0}
  .cs-localized-row--grid .cs-lang-chip{justify-self:end}
  .cs-localized-row--multiline textarea.cs-localized-textarea{box-sizing:border-box;display:block;height:var(--cs-editor-control-height);min-height:var(--cs-editor-control-height);max-height:var(--cs-editor-control-height);padding-block:0;line-height:calc(var(--cs-editor-control-height) - 2px);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height .18s ease,min-height .18s ease,max-height .18s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}
  .cs-localized-row--multiline.is-expanded,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus){align-items:start}
  .cs-localized-row--multiline.is-expanded .cs-remove-lang,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) .cs-remove-lang{align-self:start}
  .cs-localized-row--multiline.is-expanded textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--grid .cs-remove-lang{align-self:center;margin-left:0;white-space:nowrap}
  .cs-lang-chip{display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .55rem;border-radius:999px;background:color-mix(in srgb,var(--primary) 14%, var(--card));color:color-mix(in srgb,var(--primary) 95%, var(--text));font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .cs-identity-grid{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-identity-row{display:grid;grid-template-columns:minmax(88px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(72px,max-content);align-items:center;gap:var(--cs-editor-row-column-gap)}
  .cs-identity-head{align-items:end;padding:0 0 .1rem}
  .cs-identity-head-spacer{min-width:1px}
  .cs-identity-column-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-lang{min-width:0;display:flex;align-items:center;justify-content:flex-end}
  .cs-identity-field{min-width:0;display:flex;flex-direction:column;gap:.2rem}
  .cs-identity-field .cs-input{min-width:0}
  .cs-identity-cell-label{display:none;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-actions{display:flex;align-items:center;justify-content:flex-end;min-width:0}
  .cs-identity-remove{width:100%;min-width:72px;margin-left:0;white-space:nowrap}
  .cs-single-grid-fieldset{gap:0}
  .cs-single-grid{display:grid;grid-template-columns:var(--cs-editor-single-label-width,88px) minmax(0,var(--cs-editor-single-control-width));column-gap:var(--cs-editor-row-column-gap);row-gap:var(--cs-editor-row-gap);align-items:center;justify-content:start}
  .cs-single-grid-row{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:center;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0;position:relative}
  .cs-single-grid-label{display:inline-flex;align-items:center;justify-content:flex-end;gap:.35rem;min-width:0;font-weight:700;color:color-mix(in srgb,var(--text) 86%, transparent)}
  .cs-single-grid-title{font-size:.84rem;white-space:nowrap}
  .cs-single-grid-control{min-width:0;display:flex;align-items:center}
  .cs-single-grid-control .cs-input,.cs-single-grid-control .cs-select{width:100%;min-width:0}
  .cs-single-grid-switch{margin:0}
  .cs-help-tooltip-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}
  .cs-help-tooltip{appearance:none;width:1rem;height:1rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--primary) 42%, var(--border));background:color-mix(in srgb,var(--card) 99%, transparent);color:color-mix(in srgb,var(--primary) 88%, var(--text));font-size:.68rem;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:help}
  .cs-help-tooltip:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .cs-help-tooltip-bubble{position:absolute;left:0;bottom:calc(100% + .35rem);width:max-content;max-width:min(20rem,70vw);padding:.38rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--card) 99%, transparent);box-shadow:0 10px 24px rgba(15,23,42,0.14);color:color-mix(in srgb,var(--text) 82%, transparent);font-size:.76rem;line-height:1.3;font-weight:500;text-transform:none;letter-spacing:0;opacity:0;transform:translateY(3px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;z-index:20}
  .cs-help-tooltip-wrap:hover .cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible + .cs-help-tooltip-bubble{opacity:1;transform:translateY(0);pointer-events:auto}
  .cs-input{width:100%;min-height:1.95rem;padding:.3rem .5rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease, background .16s ease}
  .cs-input:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  textarea.cs-input{min-height:4.6rem;resize:vertical}
  .cs-input-small{max-width:220px}
  .cs-empty{padding:.7rem .85rem;border:1px dashed color-mix(in srgb,var(--border) 75%, transparent);border-radius:9px;background:color-mix(in srgb,var(--text) 2%, var(--card));color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-field[data-diff="changed"] .cs-empty{background:color-mix(in srgb,#f59e0b 10%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:color-mix(in srgb,#b45309 72%, var(--text))}
  .cs-add-lang,.cs-add-link{align-self:flex-start}
  .cs-remove-lang,.cs-remove-link{margin-left:auto}
  .cs-select{min-width:200px;padding:.3rem .45rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease}
  .cs-select:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-link-list{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-link-head{display:flex;align-items:end;gap:var(--cs-editor-row-column-gap);min-height:1.1rem;padding:0}
  .cs-link-head-spacer{width:1.95rem;flex:0 0 1.95rem}
  .cs-link-head-actions{flex:0 0 72px}
  .cs-link-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0}
  .cs-link-row.is-dragging{pointer-events:none;border-radius:10px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 14px 30px rgba(15,23,42,0.16),0 4px 12px rgba(15,23,42,0.12)}
  .cs-link-row + .cs-link-row{margin-top:0}
  .cs-link-drop-placeholder{border:1px dashed color-mix(in srgb,var(--primary) 48%, var(--border));border-radius:10px;background:color-mix(in srgb,var(--primary) 8%, transparent);min-height:var(--cs-editor-control-height);box-sizing:border-box}
  .cs-link-field{flex:1 1 200px;min-width:160px;display:flex;flex-direction:column;gap:.25rem}
  .cs-link-field--label{flex:1 1 0}
  .cs-link-field--href{flex:3 1 0}
  .cs-link-field--compact{gap:.15rem}
  .cs-link-field-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-link-field-title--label{flex:1 1 0;min-width:160px}
  .cs-link-field-title--href{flex:3 1 0;min-width:160px}
  .cs-link-drag-handle{width:1.95rem;min-height:var(--cs-editor-control-height);align-self:flex-end;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.16rem;padding:.25rem .45rem;border:0;background:transparent;box-shadow:none;border-radius:8px;cursor:grab;touch-action:none;color:color-mix(in srgb,var(--muted) 86%, transparent);box-sizing:border-box;user-select:none}
  .cs-link-drag-handle:hover{background:color-mix(in srgb,var(--text) 4%, transparent)}
  .cs-link-drag-handle:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 36%, transparent);outline-offset:2px;background:color-mix(in srgb,var(--primary) 8%, transparent)}
  .cs-link-drag-handle:active{cursor:grabbing}
  .cs-link-drag-handle span{display:block;width:.9rem;height:1px;border-radius:999px;background:currentColor}
  .cs-link-row.is-dragging .cs-link-drag-handle{border-color:transparent !important;background:color-mix(in srgb,var(--primary) 12%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text))}
  .cs-link-row.is-dragging .cs-input{border-color:color-mix(in srgb,var(--primary) 45%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 14%, transparent)}
  .cs-link-actions{display:flex;gap:.35rem;margin-left:auto;align-self:flex-end;padding-top:0}
  .cs-link-actions .btn-tertiary{min-height:var(--cs-editor-control-height)}
  .cs-remove-link{color:color-mix(in srgb,#dc2626 82%, var(--text))}
  .cs-remove-link:hover{background:color-mix(in srgb,#dc2626 12%, transparent);border-color:color-mix(in srgb,#dc2626 48%, transparent);color:#b91c1c}
  .cs-repo-grid{display:flex;align-items:flex-end;gap:.45rem;flex-wrap:nowrap;margin-top:.35rem}
  .cs-repo-path{display:flex;align-items:flex-end;gap:.35rem;flex:2 1 0;min-width:0;flex-wrap:nowrap}
  .cs-repo-field-group{display:flex;flex-direction:column;gap:.3rem;min-width:0}
  .cs-repo-field-group--owner{flex:1 1 0}
  .cs-repo-field-group--name{flex:1 1 0}
  .cs-repo-field-group--branch{flex:1 1 0}
  .cs-repo-field-title{padding-left:.55rem;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-repo-field{display:inline-flex;align-items:center;gap:.35rem;width:100%;padding:.22rem .55rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--border) 78%, transparent);background:color-mix(in srgb,var(--card) 98%, transparent);transition:border-color .16s ease, box-shadow .16s ease}
  .cs-repo-field:focus-within{border-color:color-mix(in srgb,var(--primary) 50%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-repo-field .cs-repo-input{border:0;background:transparent;padding:0;min-height:1.8rem;font-size:.84rem;line-height:1.25;color:var(--text);min-width:0;width:100%;flex:1 1 auto}
  .cs-repo-field .cs-repo-input:focus{outline:none;box-shadow:none}
  .cs-repo-field--owner{min-width:0}
  .cs-repo-field--name{min-width:0}
  .cs-repo-field--branch{min-width:0}
  .cs-repo-affix{font-size:.82rem;font-weight:600;color:color-mix(in srgb,var(--muted) 78%, transparent);text-transform:lowercase;letter-spacing:.04em}
  .cs-repo-icon-affix{width:1rem;height:1rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 1rem}
  .cs-repo-icon-affix svg{display:block;fill:currentColor}
  .cs-repo-divider{align-self:flex-end;padding-bottom:.48rem;font-size:1.1rem;font-weight:600;color:color-mix(in srgb,var(--muted) 82%, transparent)}
  .cs-token-settings{margin-top:.35rem;display:flex;flex-direction:column;gap:.45rem;width:100%}
  .cs-token-field{width:100%;max-width:100%}
  .cs-token-field input{min-height:1.8rem;background:transparent}
  .cs-repo-field--token{width:100%}
  .cs-repo-input--token{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)}
  .cs-token-affix svg{fill:currentColor}
  .cs-token-clear,.cs-token-clear:hover,.cs-token-clear:focus-visible,.cs-token-clear:active{border:0!important;border-color:transparent!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:color-mix(in srgb,var(--muted) 84%, transparent);width:1.65rem;height:1.65rem;min-width:1.65rem;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:1.1rem;font-weight:400;line-height:1;cursor:pointer;padding:0;margin:0;text-decoration:none;outline:0;user-select:none}
  .cs-token-clear:hover,.cs-token-clear:focus-visible{background:color-mix(in srgb,var(--text) 6%, transparent)!important;color:color-mix(in srgb,var(--text) 82%, transparent);outline:0}
  .cs-token-clear[aria-disabled="true"]{opacity:.28;cursor:default;pointer-events:none;border:0!important;background:transparent!important;box-shadow:none!important}
  .cs-token-help{margin:0;font-size:.8rem}
  .cs-extra-list{margin:.2rem 0 0;padding-left:1.1rem;color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-extra-list li{margin:.2rem 0}
  .cs-switch{display:inline-flex;align-items:center;gap:.45rem;padding:.12rem .2rem;border-radius:999px;cursor:pointer;user-select:none;color:color-mix(in srgb,var(--text) 85%, transparent);transition:color .16s ease}
  .cs-switch-input{position:absolute;opacity:0;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);clip-path:inset(50%)}
  .cs-switch-track{position:relative;display:inline-flex;align-items:center;width:2.4rem;height:1.25rem;border-radius:999px;background:color-mix(in srgb,var(--text) 8%, var(--card));border:1px solid color-mix(in srgb,var(--border) 80%, transparent);padding:0 .15rem;transition:background .16s ease,border-color .16s ease}
  .cs-switch-thumb{width:1rem;height:1rem;border-radius:999px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 1px 2px rgba(15,23,42,0.2);transform:translateX(0);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
  .cs-switch[data-state="on"] .cs-switch-track{background:color-mix(in srgb,var(--primary) 45%, var(--card));border-color:color-mix(in srgb,var(--primary) 55%, var(--border))}
  .cs-switch[data-state="on"] .cs-switch-thumb{transform:translateX(1.05rem);background:color-mix(in srgb,var(--primary) 96%, var(--card));box-shadow:0 4px 10px color-mix(in srgb,var(--primary) 35%, transparent)}
  .cs-switch[data-state="mixed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 35%, var(--card));border-color:color-mix(in srgb,#f59e0b 55%, var(--border))}
  .cs-switch[data-state="mixed"] .cs-switch-thumb{background:color-mix(in srgb,#f59e0b 94%, var(--card));box-shadow:0 3px 8px color-mix(in srgb,#f59e0b 35%, transparent)}
  .cs-switch-input:focus-visible + .cs-switch-track{outline:2px solid color-mix(in srgb,var(--primary) 60%, transparent);outline-offset:2px}
  .cs-input[data-diff="changed"],.cs-select[data-diff="changed"],.cs-field[data-diff="changed"] .cs-input,.cs-field[data-diff="changed"] .cs-select,.cs-single-grid-row[data-diff="changed"] .cs-input,.cs-single-grid-row[data-diff="changed"] .cs-select{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-repo-field[data-diff="changed"],.cs-repo-grid[data-diff="changed"] .cs-repo-field,.cs-extra-list[data-diff="changed"] li{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-switch[data-diff="changed"] .cs-switch-track,.cs-field[data-diff="changed"] .cs-switch-track,.cs-single-grid-row[data-diff="changed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 18%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  @media (max-width:920px){
    .cs-layout{grid-template-columns:minmax(0,1fr);gap:1rem}
  }
  @media (max-width:880px){
    .cs-section{padding:.9rem .9rem}
    .cs-select{min-width:0;width:100%}
    .cs-input-small{max-width:100%}
    .cs-identity-row{grid-template-columns:minmax(74px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(68px,max-content)}
    .cs-link-actions{width:100%;justify-content:flex-end;margin-left:0;align-self:auto;padding-top:.35rem}
  }
  @media (max-width:720px){
    .cs-section-description{text-align:left}
    .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.5rem}
    .cs-repo-grid,.cs-repo-path{flex-wrap:wrap}
    .cs-repo-path,.cs-repo-field-group--branch{flex:1 1 100%}
    .cs-repo-field-group--owner,.cs-repo-field-group--name{flex:1 1 calc(50% - .4rem)}
    .cs-localized-row--grid{grid-template-columns:1fr;gap:.35rem}
    .cs-localized-row--grid .cs-remove-lang{justify-self:flex-start}
    .cs-identity-grid{gap:.5rem}
    .cs-identity-head{display:none}
    .cs-identity-row{grid-template-columns:1fr;align-items:stretch;gap:.4rem;padding:.55rem 0;border-top:1px solid color-mix(in srgb,var(--border) 72%, transparent)}
    .cs-identity-head + .cs-identity-row{border-top:0;padding-top:.1rem}
    .cs-identity-cell-label{display:block}
    .cs-identity-actions{justify-content:flex-start}
    .cs-single-grid{grid-template-columns:1fr;row-gap:.35rem}
    .cs-single-grid-row{grid-template-columns:1fr;align-items:stretch;gap:.35rem;padding:.2rem 0}
  }

  /* Modal animations */
  @keyframes nsModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes nsModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
  @keyframes nsModalSlideIn { from { transform: translateY(10px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
  @keyframes nsModalSlideOut { from { transform: translateY(0) scale(1); opacity: 1 } to { transform: translateY(8px) scale(.98); opacity: 0 } }
  .ns-modal.ns-anim-in { animation: nsModalFadeIn 160ms ease both; }
  .ns-modal.ns-anim-out { animation: nsModalFadeOut 160ms ease both; }
  .ns-modal.ns-anim-in .ns-modal-dialog { animation: nsModalSlideIn 200ms cubic-bezier(.2,.95,.4,1) both; }
  .ns-modal.ns-anim-out .ns-modal-dialog { animation: nsModalSlideOut 160ms ease both; }
  @media (prefers-reduced-motion: reduce){
    .ns-modal.ns-anim-in,
    .ns-modal.ns-anim-out,
    .ns-modal.ns-anim-in .ns-modal-dialog,
    .ns-modal.ns-anim-out .ns-modal-dialog { animation: none !important; }
  }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
