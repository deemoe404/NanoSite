// Template renderers (pure functions returning HTML strings)
import { t } from './i18n.js';
import { computeReadTime } from './content.js';
import { escapeHtml, renderTags, formatDisplayDate } from './utils.js';

// Render a metadata card (title/date/read time/tags) for a post
export function renderPostMetaCard(title, meta, markdown) {
  try {
    const safeTitle = escapeHtml(String(title || ''));
    const hasDate = meta && meta.date;
    const dateHtml = hasDate ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
    let readHtml = '';
    try {
      const minutes = computeReadTime(String(markdown || ''), 200);
      readHtml = `<span class="card-read">${minutes} ${t('ui.minRead')}</span>`;
    } catch (_) {}
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (readHtml) parts.push(readHtml);
    const metaLine = parts.length ? `<div class="post-meta-line">${parts.join('<span class="card-sep">•</span>')}</div>` : '';
    // Optional version selector (only when multiple versions available)
    let versionHtml = '';
    try {
      const versions = Array.isArray(meta && meta.versions) ? meta.versions : [];
      if (versions.length > 1 && meta && meta.location) {
        const current = String(meta.location);
        const opts = versions
          .map(v => {
            const label = String(v.versionLabel || v.date || v.location || '').trim() || '—';
            const sel = (v.location === current) ? ' selected' : '';
            return `<option value="${escapeHtml(String(v.location))}"${sel}>${escapeHtml(label)}</option>`;
          })
          .join('');
        versionHtml = `<div class="post-meta-line"><label style="opacity:.8; margin-right:.35rem;">${t('ui.versionLabel')}</label><select class="post-version-select" aria-label="${t('ui.versionLabel')}">${opts}</select></div>`;
      }
    } catch (_) {}
    const excerptHtml = (meta && meta.excerpt) ? `<div class="post-meta-excerpt">${escapeHtml(String(meta.excerpt))}</div>` : '';
    const tags = meta ? renderTags(meta.tag) : '';
    return `<section class="post-meta-card" aria-label="Post meta">
      <div class="post-meta-title">${safeTitle}</div>
      <button type="button" class="post-meta-copy" aria-label="${t('ui.copyLink')}" title="${t('ui.copyLink')}">${t('ui.copyLink')}</button>
      ${metaLine}
      ${versionHtml}
      ${excerptHtml}
      ${tags || ''}
    </section>`;
  } catch (_) {
    return '';
  }
}

// Render an outdated warning card if the post date exceeds the configured threshold
export function renderOutdatedCard(meta, siteCfg) {
  try {
    const hasDate = meta && meta.date;
    if (!hasDate) return '';
    const published = new Date(String(meta.date));
    if (isNaN(published.getTime())) return '';
    const diffDays = Math.floor((Date.now() - published.getTime()) / (1000 * 60 * 60 * 24));
    const threshold = (siteCfg && Number.isFinite(Number(siteCfg.contentOutdatedDays)))
      ? Number(siteCfg.contentOutdatedDays)
      : 180;
    if (diffDays < threshold) return '';
    return `<section class="post-outdated-card" role="note">
      <div class="post-outdated-content">${t('ui.outdatedWarning')}</div>
      <button type="button" class="post-outdated-close" aria-label="${t('ui.close')}" title="${t('ui.close')}">×</button>
    </section>`;
  } catch (_) { return ''; }
}
