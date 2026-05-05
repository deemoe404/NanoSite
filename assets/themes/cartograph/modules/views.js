import {
  renderTags,
  escapeHtml,
  formatDisplayDate,
  sanitizeUrl
} from '../../../js/utils.js';
import { renderPostMetaCard, renderOutdatedCard } from '../../../js/templates.js';
import { renderNanoPostCardHtml } from '../../../js/post-card-html.js';

const CARD_CLASSES = {
  cardClass: 'cartograph-card',
  withCoverClass: 'cartograph-card--with-cover',
  linkClass: 'cartograph-card__link',
  bodyClass: 'cartograph-card__body',
  titleClass: 'cartograph-card__title',
  excerptClass: 'cartograph-card__excerpt',
  metaClass: 'cartograph-card__meta',
  dateClass: 'cartograph-card__date',
  versionsClass: 'cartograph-card__versions',
  draftClass: 'cartograph-card__draft',
  separatorClass: 'cartograph-card__separator',
  tagsClass: 'cartograph-card__tags',
  metaPosition: 'before-title'
};

function fallbackT(key, ...args) {
  try {
    if (typeof window !== 'undefined' && typeof window.__ns_t === 'function') return window.__ns_t(key, ...args);
  } catch (_) {}
  return args.length ? `${key} ${args.join(' ')}` : String(key || '');
}

function safe(value) {
  return escapeHtml(String(value ?? '')) || '';
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function getContent(params = {}) {
  return params.content || (params.ctx && params.ctx.content) || {};
}

function getMetadata(params = {}) {
  const content = getContent(params);
  return {
    ...((content && content.metadata) || {}),
    ...((params && params.postMetadata) || {})
  };
}

function getDocument(params = {}) {
  return params.document || (params.ctx && params.ctx.document) || document;
}

function getWindow(params = {}) {
  return params.window || (params.ctx && params.ctx.window) || window;
}

function getI18n(params = {}) {
  const i18n = (params.ctx && params.ctx.i18n) || {};
  const translate = typeof params.translate === 'function'
    ? params.translate
    : (typeof params.translator === 'function'
        ? params.translator
        : (typeof i18n.t === 'function' ? i18n.t : fallbackT));
  const withLanguage = typeof params.withLangParam === 'function'
    ? params.withLangParam
    : (typeof i18n.withLangParam === 'function' ? i18n.withLangParam : (href) => href);
  return { t: translate, withLangParam: withLanguage };
}

function getRegion(params = {}, names, fallbackSelector = '') {
  const list = Array.isArray(names) ? names : [names];
  const regions = params.ctx && params.ctx.regions;
  if (regions && typeof regions.get === 'function') {
    for (const name of list) {
      const region = regions.get(name);
      if (region) return region;
    }
  }
  if (params.containers && typeof params.containers === 'object') {
    const containerMap = {
      main: 'mainElement',
      toc: 'tocElement',
      sidebar: 'sidebarElement',
      content: 'contentElement',
      container: 'containerElement'
    };
    for (const name of list) {
      const key = containerMap[name];
      if (key && params.containers[key]) return params.containers[key];
    }
  }
  if (fallbackSelector) {
    try { return getDocument(params).querySelector(fallbackSelector); } catch (_) {}
  }
  return null;
}

function getMain(params = {}) {
  return (params.containers && params.containers.mainElement)
    || params.container
    || getRegion(params, 'main', '.cartograph-mainview');
}

function scrollToBoardTop(params = {}) {
  const win = getWindow(params);
  const scroller = getRegion(params, 'scrollContainer', '.cartograph-scroll');
  try {
    if (scroller && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return true;
    }
  } catch (_) {}
  try {
    if (win && typeof win.scrollTo === 'function') {
      win.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return true;
    }
  } catch (_) {}
  return false;
}

function clearToc(tocElement) {
  if (!tocElement) return;
  try {
    if (typeof tocElement.clear === 'function') tocElement.clear();
    else tocElement.innerHTML = '';
  } catch (_) {}
  try { tocElement.hidden = true; } catch (_) {}
}

function panelList(items, rowRenderer) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ol class="cartograph-manifest__list">${items.map(rowRenderer).join('')}</ol>`;
}

function renderManifestPanel(panel, { title, label, items, empty, rowRenderer }) {
  if (!panel) return;
  const hasItems = Array.isArray(items) && items.length > 0;
  if (!hasItems && !empty) {
    panel.innerHTML = '';
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `
    <div class="cartograph-panel__header">
      <span class="cartograph-panel__label">${safe(label)}</span>
      <h2>${safe(title)}</h2>
    </div>
    ${hasItems ? panelList(items, rowRenderer) : `<p class="cartograph-empty">${safe(empty)}</p>`}`;
}

function renderMediaManifest(params = {}, content = {}) {
  const panel = getRegion(params, 'mediaPanel', '[data-cartograph-media]');
  const assets = Array.isArray(content.assets) ? content.assets.slice(0, 8) : [];
  renderManifestPanel(panel, {
    label: 'manifest',
    title: 'Media',
    items: assets,
    empty: 'No media assets in this route.',
    rowRenderer(asset, index) {
      const type = firstText(asset && asset.type, 'asset');
      const label = firstText(asset && asset.alt, asset && asset.title, asset && asset.source, asset && asset.url, `${type} ${index + 1}`);
      const href = sanitizeUrl(asset && asset.url ? String(asset.url) : '');
      return `<li class="cartograph-manifest__item">
        <a href="${safe(href || '#')}" target="_blank" rel="noopener">${safe(label)}</a>
        <span>${safe(type)}</span>
      </li>`;
    }
  });
}

function renderLinkDocket(params = {}, content = {}) {
  const panel = getRegion(params, 'linksPanel', '[data-cartograph-links]');
  const links = Array.isArray(content.links) ? content.links.slice(0, 10) : [];
  renderManifestPanel(panel, {
    label: 'docket',
    title: 'Links',
    items: links,
    empty: 'No outbound or internal links detected.',
    rowRenderer(link) {
      const href = sanitizeUrl(link && link.url ? String(link.url) : '');
      const label = firstText(link && link.label, link && link.href, href, 'link');
      return `<li class="cartograph-manifest__item">
        <a href="${safe(href || '#')}" ${link && link.internal ? '' : 'target="_blank" rel="noopener"'}>${safe(label)}</a>
        <span>${link && link.internal ? 'internal' : 'external'}</span>
      </li>`;
    }
  });
}

function createRouteMap(content = {}) {
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const headings = Array.isArray(content.headings) ? content.headings : [];
  const counts = blocks.reduce((out, block) => {
    const type = firstText(block && block.type, 'block');
    out[type] = (out[type] || 0) + 1;
    return out;
  }, {});
  const sections = headings
    .filter((heading) => heading && heading.level >= 1 && heading.level <= 3 && heading.text)
    .slice(0, 8)
    .map((heading) => ({
      id: String(heading.id || ''),
      level: Number(heading.level) || 1,
      text: String(heading.text || '')
    }));
  const lead = blocks.find((block) => block && block.type === 'paragraph' && block.text);
  const notable = blocks
    .filter((block) => block && ['quote', 'code', 'table', 'list'].includes(block.type) && block.text)
    .slice(0, 4)
    .map((block) => ({
      type: block.type,
      text: String(block.text || '').slice(0, 160)
    }));
  return { counts, sections, lead: lead && lead.text ? String(lead.text).slice(0, 220) : '', notable };
}

function renderRouteMapPanel(params = {}, content = {}) {
  const panel = getRegion(params, 'routeMap', '[data-cartograph-route-map]');
  if (!panel) return;
  const routeMap = createRouteMap(content);
  const hasStructure = routeMap.sections.length || routeMap.lead || routeMap.notable.length;
  if (!hasStructure) {
    panel.innerHTML = '';
    panel.hidden = true;
    return;
  }
  const counts = Object.entries(routeMap.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `<span><b>${safe(count)}</b>${safe(type)}</span>`)
    .join('');
  panel.hidden = false;
  panel.innerHTML = `
    <div class="cartograph-panel__header">
      <span class="cartograph-panel__label">route</span>
      <h2>Map</h2>
    </div>
    ${routeMap.lead ? `<p class="cartograph-route-map__lead">${safe(routeMap.lead)}</p>` : ''}
    ${routeMap.sections.length ? `<ol class="cartograph-route-map__sections">${routeMap.sections.map((section) => `<li data-level="${safe(section.level)}"><a href="#${safe(section.id)}">${safe(section.text)}</a></li>`).join('')}</ol>` : ''}
    ${routeMap.notable.length ? `<div class="cartograph-route-map__notables">${routeMap.notable.map((item) => `<p><span>${safe(item.type)}</span>${safe(item.text)}</p>`).join('')}</div>` : ''}
    ${counts ? `<div class="cartograph-route-map__counts">${counts}</div>` : ''}`;
}

export function renderContentLegend(params = {}) {
  const content = getContent(params);
  const toc = getRegion(params, 'toc', '.cartograph-toc');
  const main = getMain(params);
  const scrollRoot = getRegion(params, 'scrollContainer', '.cartograph-scroll');
  const { t } = getI18n(params);
  const title = params.articleTitle || firstText(content.metadata && content.metadata.title, t('ui.contents'));
  const tocHtml = params.tocHtml || content.tocHtml || '';

  if (tocHtml && toc) {
    try {
      if (typeof toc.renderToc === 'function') {
        toc.renderToc({
          articleTitle: `Route / ${title}`,
          tocHtml,
          contentRoot: main,
          scrollRoot
        });
      } else {
        toc.innerHTML = `<div class="cartograph-toc__inner"><div class="cartograph-toc__title">${safe(title)}</div>${tocHtml}</div>`;
      }
      toc.hidden = false;
    } catch (_) {
      clearToc(toc);
    }
  } else {
    clearToc(toc);
  }

  renderRouteMapPanel(params, content);
  renderMediaManifest(params, content);
  renderLinkDocket(params, content);
  return true;
}

export function resetContentLegend(params = {}) {
  const doc = params && params.nodeType === 9 ? params : getDocument(params);
  const toc = params && params.nodeType === 9
    ? doc.querySelector('.cartograph-toc')
    : getRegion(params, 'toc', '.cartograph-toc');
  clearToc(toc);
  ['[data-cartograph-media]', '[data-cartograph-links]'].forEach((selector) => {
    const panel = doc.querySelector(selector);
    if (!panel) return;
    panel.innerHTML = '';
    panel.hidden = true;
  });
  const routePanel = params && params.nodeType === 9
    ? doc.querySelector('[data-cartograph-route-map]')
    : getRegion(params, 'routeMap', '[data-cartograph-route-map]');
  if (routePanel) {
    routePanel.innerHTML = '';
    routePanel.hidden = true;
  }
}

function renderStats(content = {}, metadata = {}) {
  const headings = Array.isArray(content.headings) ? content.headings.length : 0;
  const blocks = Array.isArray(content.blocks) ? content.blocks.length : 0;
  const assets = Array.isArray(content.assets) ? content.assets.length : 0;
  const links = Array.isArray(content.links) ? content.links.length : 0;
  const location = firstText(metadata.location, content.location);
  const date = metadata.date ? formatDisplayDate(metadata.date) : '';
  const rows = [
    ['date', date || 'undated'],
    ['route', location || 'unmapped'],
    ['blocks', blocks],
    ['heads', headings],
    ['media', assets],
    ['links', links]
  ];
  return `<dl class="cartograph-stats">
    ${rows.map(([key, value]) => `<div><dt>${safe(key)}</dt><dd>${safe(value)}</dd></div>`).join('')}
  </dl>`;
}

function decorateArticle(container, params = {}) {
  if (!container) return;
  const utilities = params.utilities || {};
  const { t, withLangParam } = getI18n(params);
  const body = container.querySelector('.cartograph-prose') || container;

  try { if (typeof utilities.hydratePostImages === 'function') utilities.hydratePostImages(body); } catch (_) {}
  try { if (typeof utilities.hydratePostVideos === 'function') utilities.hydratePostVideos(body); } catch (_) {}
  try { if (typeof utilities.applyLazyLoadingIn === 'function') utilities.applyLazyLoadingIn(body); } catch (_) {}
  try { if (typeof utilities.applyLangHints === 'function') utilities.applyLangHints(body); } catch (_) {}

  try {
    if (typeof utilities.hydrateInternalLinkCards === 'function') {
      utilities.hydrateInternalLinkCards(body, {
        allowedLocations: params.allowedLocations || new Set(),
        locationAliasMap: params.locationAliasMap || new Map(),
        postsByLocationTitle: params.postsByLocationTitle || {},
        postsIndexCache: params.postsIndex || {},
        siteConfig: params.siteConfig || {},
        translate: params.translate || t,
        makeHref: utilities.makeLangHref || ((loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)),
        fetchMarkdown: utilities.fetchMarkdown || (() => Promise.resolve(''))
      });
    }
  } catch (_) {}

  const copyBtn = container.querySelector('.post-meta-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const win = getWindow(params);
      const href = String((win && win.location && win.location.href) || '').split('#')[0];
      let copied = false;
      try {
        const clipboard = win && win.navigator && win.navigator.clipboard;
        if (clipboard && typeof clipboard.writeText === 'function') {
          await clipboard.writeText(href);
          copied = true;
        }
      } catch (_) {}
      if (copied) {
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 1200);
      }
    });
  }

  const versionSelect = container.querySelector('.post-version-select');
  if (versionSelect) {
    versionSelect.addEventListener('change', () => {
      const target = versionSelect.value;
      if (!target) return;
      const win = getWindow(params);
      try { win.location.href = withLangParam(`?id=${encodeURIComponent(target)}`); } catch (_) {}
    });
  }

  const outdated = container.querySelector('.post-outdated-card');
  if (outdated) {
    const close = outdated.querySelector('.post-outdated-close');
    if (close) close.addEventListener('click', () => outdated.remove());
  }
}

function renderArticleShell(params = {}, options = {}) {
  const main = getMain(params);
  if (!main) return false;

  const content = getContent(params);
  const metadata = getMetadata(params);
  const title = firstText(options.title, metadata.title, params.fallbackTitle, params.postId, 'Untitled');
  const bodyHtml = firstText(params.markdownHtml, content.html, params.html);
  const tags = renderTags(metadata.tag || metadata.tags);
  const metaCard = options.kind === 'post' ? renderPostMetaCard(title, metadata || {}, params.markdown || content.rawMarkdown || '') : '';
  const outdatedCard = options.kind === 'post' ? renderOutdatedCard(metadata || {}, params.siteConfig || {}) : '';
  const routeKind = options.kind === 'tab' ? 'static map' : 'article route';

  main.innerHTML = `
    <article class="cartograph-article" data-route-kind="${safe(routeKind)}">
      <header class="cartograph-article__header">
        <div class="cartograph-coordinate">
          <span>atlas</span>
          <span>${safe(routeKind)}</span>
        </div>
        <h1 class="cartograph-article__title">${safe(title)}</h1>
        ${tags ? `<div class="cartograph-article__tags">${tags}</div>` : ''}
        ${renderStats(content, metadata)}
        ${(metaCard || outdatedCard) ? `<div class="cartograph-article__notebook">${outdatedCard || ''}${metaCard || ''}</div>` : ''}
      </header>
      <div class="cartograph-prose">${bodyHtml}</div>
      ${options.kind === 'post' ? '<footer class="cartograph-article__footer"><div class="cartograph-postnav" data-post-nav></div></footer>' : ''}
    </article>`;

  renderContentLegend({
    ...params,
    content,
    articleTitle: title,
    tocHtml: params.tocHtml || content.tocHtml || ''
  });

  try {
    if (options.kind === 'post' && params.utilities && typeof params.utilities.renderPostNav === 'function') {
      params.utilities.renderPostNav(main.querySelector('[data-post-nav]'), params.postsIndex || {}, metadata && metadata.location);
    }
  } catch (_) {}

  decorateArticle(main, params);
  scrollToBoardTop(params);
  return { decorated: true, title };
}

function buildCard([title, meta] = [], siteConfig = {}, params = {}) {
  const { t, withLangParam } = getI18n(params);
  const href = meta && meta.location ? withLangParam(`?id=${encodeURIComponent(meta.location)}`) : '#';
  const date = meta && meta.date ? formatDisplayDate(meta.date) : '';
  const tags = meta ? renderTags(meta.tag || meta.tags) : '';
  const versions = Array.isArray(meta && meta.versions) && meta.versions.length > 1
    ? t('ui.versionsCount', meta.versions.length)
    : '';
  const draft = meta && meta.draft ? t('ui.draftBadge') : '';
  const excerpt = meta && meta.excerpt ? String(meta.excerpt) : '';
  void siteConfig;
  return renderNanoPostCardHtml({
    title: firstText(title, 'Untitled'),
    href,
    date,
    excerpt,
    versionsLabel: versions,
    draftLabel: draft,
    tagsHtml: tags,
    classes: CARD_CLASSES
  });
}

function buildPagination({ page, totalPages, baseHref, query = {}, translate = fallbackT } = {}) {
  const t = typeof translate === 'function' ? translate : fallbackT;
  if (!totalPages || totalPages <= 1) return '';
  const win = typeof window !== 'undefined' ? window : null;
  const makeHref = (targetPage) => {
    try {
      const url = new URL(baseHref, win ? win.location.href : 'https://example.invalid/');
      url.searchParams.set('page', String(targetPage));
      if (query.q) url.searchParams.set('q', query.q);
      if (query.tag) url.searchParams.set('tag', query.tag);
      return url.toString();
    } catch (_) {
      return baseHref;
    }
  };
  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pages.push(`<a class="cartograph-page${i === page ? ' is-current' : ''}" href="${safe(makeHref(i))}">${i}</a>`);
  }
  const prev = page > 1 ? makeHref(page - 1) : '';
  const next = page < totalPages ? makeHref(page + 1) : '';
  return `<nav class="cartograph-pagination" aria-label="${safe(t('ui.pagination'))}">
    <a class="cartograph-page${prev ? '' : ' is-disabled'}" href="${safe(prev || '#')}" ${prev ? '' : 'aria-disabled="true"'}>${safe(t('ui.prev'))}</a>
    <div class="cartograph-pagination__pages">${pages.join('')}</div>
    <a class="cartograph-page${next ? '' : ' is-disabled'}" href="${safe(next || '#')}" ${next ? '' : 'aria-disabled="true"'}>${safe(t('ui.next'))}</a>
  </nav>`;
}

export function renderPostView(params = {}) {
  return renderArticleShell(params, { kind: 'post' });
}

export function renderStaticTabView(params = {}) {
  const tabTitle = firstText(params.title, params.tab && params.tab.title);
  return renderArticleShell(params, { kind: 'tab', title: tabTitle });
}

export function renderIndexView(params = {}) {
  const container = getMain(params);
  if (!container) return false;
  const { t, withLangParam } = getI18n(params);
  const entries = Array.isArray(params.pageEntries) ? params.pageEntries : [];
  const cards = entries.map((entry) => buildCard(entry, params.siteConfig || {}, params)).join('');
  container.innerHTML = `<section class="cartograph-atlas index">
    <header class="cartograph-atlas__header">
      <div class="cartograph-coordinate"><span>catalog</span><span>${safe(params.total || entries.length)} routes</span></div>
      <h1>${safe(t('titles.allPosts'))}</h1>
    </header>
    <div class="cartograph-atlas__grid">${cards || `<p class="cartograph-empty">${safe(t('ui.noResultsTitle'))}</p>`}</div>
    ${buildPagination({ page: params.page, totalPages: params.totalPages, baseHref: withLangParam('?tab=posts'), translate: t })}
  </section>`;
  resetContentLegend(params);
  scrollToBoardTop(params);
  return true;
}

export function renderSearchResults(params = {}) {
  const container = getMain(params);
  if (!container) return false;
  const { t, withLangParam } = getI18n(params);
  const entries = Array.isArray(params.entries) ? params.entries : [];
  const label = params.tagFilter
    ? `${t('ui.tags')} / ${params.tagFilter}`
    : (params.query ? `${t('ui.searchTab')} / ${params.query}` : t('ui.searchTab'));
  const cards = entries.map((entry) => buildCard(entry, params.siteConfig || {}, params)).join('');
  container.innerHTML = `<section class="cartograph-atlas cartograph-atlas--search index">
    <header class="cartograph-atlas__header">
      <div class="cartograph-coordinate"><span>scan</span><span>${safe(params.total || entries.length)} matches</span></div>
      <h1>${safe(label)}</h1>
    </header>
    <div class="cartograph-atlas__grid">${cards || `<div class="cartograph-empty"><h2>${safe(t('ui.noResultsTitle'))}</h2><p>${safe(params.query || params.tagFilter || '')}</p></div>`}</div>
    ${buildPagination({
      page: params.page,
      totalPages: params.totalPages,
      baseHref: withLangParam('?tab=search'),
      query: { q: params.query || '', tag: params.tagFilter || '' },
      translate: t
    })}
  </section>`;
  resetContentLegend(params);
  scrollToBoardTop(params);
  return true;
}

export function renderLoadingState(params = {}) {
  const main = getMain(params);
  if (!main) return false;
  const { t } = getI18n(params);
  main.innerHTML = `<section class="cartograph-loader" role="status">
    <span class="cartograph-loader__grid" aria-hidden="true"></span>
    <span>${safe(t('ui.loading'))}</span>
  </section>`;
  return true;
}

export function renderErrorState(params = {}) {
  const target = params.targetElement || getMain(params);
  if (!target) return false;
  const { t } = getI18n(params);
  const actions = Array.isArray(params.actions) ? params.actions : [];
  target.innerHTML = `<section class="cartograph-error" role="alert">
    <div class="cartograph-coordinate"><span>${safe(params.variant || 'error')}</span><span>off map</span></div>
    <h1>${safe(params.title || t('errors.pageUnavailableTitle'))}</h1>
    <p>${safe(params.message || t('errors.pageUnavailableBody'))}</p>
    ${actions.length ? `<div class="cartograph-error__actions">${actions.map((action) => `<a class="cartograph-button" href="${safe(action.href || '#')}">${safe(action.label || '')}</a>`).join('')}</div>` : ''}
  </section>`;
  resetContentLegend(params);
  return true;
}

export default {
  mount() {
    return {
      views: {
        post: renderPostView,
        posts: renderIndexView,
        search: renderSearchResults,
        tab: renderStaticTabView,
        error: renderErrorState,
        loading: renderLoadingState
      },
      components: {},
      effects: {}
    };
  },
  views: {
    post: renderPostView,
    posts: renderIndexView,
    search: renderSearchResults,
    tab: renderStaticTabView,
    error: renderErrorState,
    loading: renderLoadingState
  },
  components: {},
  effects: {}
};
