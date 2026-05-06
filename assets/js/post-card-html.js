const safe = (value) => escapeHtml(String(value ?? '')) || '';

function escapeHtml(text) {
  return typeof text === 'string'
    ? text
        .replace(/&(?!#[0-9]+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : null;
}

export function renderPressPostCardHtml({
  title = '',
  href = '#',
  dataIdx = '',
  date = '',
  excerpt = '',
  versionsLabel = '',
  draftLabel = '',
  coverHtml = '',
  tagsHtml = '',
  classes = {}
} = {}) {
  const attrMap = {
    cardClass: 'card-class',
    withCoverClass: 'with-cover-class',
    linkClass: 'link-class',
    bodyClass: 'body-class',
    titleClass: 'title-class',
    excerptClass: 'excerpt-class',
    excerptInnerClass: 'excerpt-inner-class',
    metaClass: 'meta-class',
    dateClass: 'date-class',
    versionsClass: 'versions-class',
    draftClass: 'draft-class',
    separatorClass: 'separator-class',
    tagsClass: 'tags-class',
    metaPosition: 'meta-position',
    wrapCard: 'wrap-card'
  };
  const classAttrs = Object.entries(attrMap)
    .map(([key, attr]) => {
      if (!classes || !Object.prototype.hasOwnProperty.call(classes, key) || classes[key] == null) return '';
      return ` ${attr}="${safe(String(classes[key]))}"`;
    })
    .join('');
  return `<press-post-card href="${safe(href)}" title="${safe(title)}" data-idx="${safe(dataIdx || encodeURIComponent(title || ''))}" date="${safe(date)}" excerpt="${safe(excerpt)}" versions-label="${safe(versionsLabel)}" draft-label="${safe(draftLabel)}"${classAttrs}><template data-slot="cover">${coverHtml || ''}</template><template data-slot="tags">${tagsHtml || ''}</template></press-post-card>`;
}
