export function normalizeMarkdownDraftContent(text) {
  return String(text == null ? '' : text).replace(/\r\n/g, '\n');
}

export function getManualMarkdownSaveState(contentRaw, isDirty) {
  const content = normalizeMarkdownDraftContent(contentRaw || '');
  if (!content) {
    return {
      canSave: false,
      content,
      reason: 'empty'
    };
  }
  if (!isDirty) {
    return {
      canSave: false,
      content,
      reason: 'clean'
    };
  }
  return {
    canSave: true,
    content,
    reason: 'default'
  };
}
