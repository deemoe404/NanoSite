// Template renderers (pure functions returning HTML strings)
import { t } from './i18n.js';
import { computeReadTime } from './content.js';
import { escapeHtml, renderTags, formatDisplayDate } from './utils.js';

// Render a metadata card (title/date/read time/tags) for a post
export function renderPostMetaCard(title, meta, markdown) {
  try {
    const safeTitle = escapeHtml(String(title || ''));
    const aiFlag = !!(meta && (meta.ai || meta.aiGenerated || meta.llm));
    const isDraft = !!(meta && meta.draft);
    const aiIcon = aiFlag
      ? `<span class="ai-flag" role="img" tabindex="0" aria-label="${t('ui.aiFlagLabel')}">
          <svg viewBox=\"0 0 32 32\" width=\"1em\" height=\"1em\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M10.52 7.052a1.17 1.17 0 0 1-.639-.636L8.93 4.257c-.178-.343-.69-.343-.858 0l-.952 2.16a1.28 1.28 0 0 1-.638.635l-1.214.524a.462.462 0 0 0 0 .838l1.214.524c.293.121.523.353.638.636l.952 2.169c.178.343.69.343.858 0l.952-2.17c.126-.282.356-.504.638-.635l1.214-.524a.462.462 0 0 0 0-.838zM25.574 13.555a3.73 3.73 0 0 1-1.922-1.977L20.79 4.81a1.432 1.432 0 0 0-2.58 0l-2.863 6.768a3.8 3.8 0 0 1-1.921 1.977l-3.622 1.64c-1.072.53-1.072 2.08 0 2.61l3.622 1.64c.87.388 1.557 1.101 1.922 1.977l2.862 6.768a1.432 1.432 0 0 0 2.58 0l2.863-6.768a3.8 3.8 0 0 1 1.921-1.977l3.622-1.64c1.072-.53 1.072-2.08 0-2.61zM8.281 20.33c.16.392.454.696.822.872l1.55.725a.646.646 0 0 1 0 1.146l-1.55.725c-.368.176-.661.49-.822.872l-1.228 2.977a.61.61 0 0 1-1.106 0L4.72 24.67a1.66 1.66 0 0 0-.822-.872l-1.55-.725a.646.646 0 0 1 0-1.146l1.55-.725c.368-.176.661-.49.822-.872l1.228-2.977a.61.61 0 0 1 1.106 0z\"/><\/svg>
        </span>`
      : '';
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
    const draftNotice = isDraft ? `<div class="post-draft-notice" role="note">${t('ui.draftNotice')}</div>` : '';
    // Optional version selector (only when multiple versions available)
    let versionHtml = '';
    try {
      const versions = Array.isArray(meta && meta.versions) ? meta.versions : [];
      if (versions.length > 1 && meta && meta.location) {
        const current = String(meta.location);
        // Determine latest by date; fallback to first item
        const latestLoc = (() => {
          let best = null; let bestTs = -Infinity;
          for (const v of versions) {
            const ts = new Date(String(v && v.date || '')).getTime();
            if (Number.isFinite(ts) && ts > bestTs) { bestTs = ts; best = v && v.location; }
          }
          return best || (versions[0] && versions[0].location) || null;
        })();
        const opts = versions
          .map(v => {
            const base = String(v.versionLabel || v.date || v.location || '').trim() || '—';
            const isLatest = latestLoc && v.location === latestLoc;
            const label = isLatest ? `${base} ${t('ui.latestSuffix')}` : base;
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
      <div class="post-meta-title">${aiIcon}${safeTitle}</div>
      <button type="button" class="post-meta-copy" aria-label="${t('ui.copyLink')}" title="${t('ui.copyLink')}">${t('ui.copyLink')}</button>
      ${draftNotice}
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
