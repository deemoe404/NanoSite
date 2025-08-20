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
    const excerptHtml = (meta && meta.excerpt) ? `<div class="post-meta-excerpt">${escapeHtml(String(meta.excerpt))}</div>` : '';
    const tags = meta ? renderTags(meta.tag) : '';
    return `<section class="post-meta-card" aria-label="Post meta">
      <div class="post-meta-title">${safeTitle}</div>
      <button type="button" class="post-meta-copy" aria-label="${t('ui.copyLink')}" title="${t('ui.copyLink')}">${t('ui.copyLink')}</button>
      ${metaLine}
      ${excerptHtml}
      ${tags || ''}
    </section>`;
  } catch (_) {
    return '';
  }
}

