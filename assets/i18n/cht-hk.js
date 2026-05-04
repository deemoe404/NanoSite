import chtTwTranslations from './cht-tw.js?v=20260504publish';

export const languageMeta = { label: '繁體中文（香港）' };

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = typeof val === 'function' ? val : clone(val);
    }
    return out;
  }
  return value;
};

const translations = clone(chtTwTranslations);

translations.editor = {
  ...translations.editor,
  tree: {
    ...translations.editor.tree,
    deletedKicker: '已刪除項目',
    deletedMeta: '這個項目已從目前草稿中刪除。如需保留，請在發布前恢復。',
    deletedEntryMeta: '這個條目已從目前草稿中刪除。如需保留，請在發布前恢復。',
    deletedLanguageMeta: '這個語言已從目前草稿中刪除。如需保留，請在發布前恢復。',
    deletedFileMeta: '這個檔案已從目前草稿中刪除。如需保留，請在發布前恢復。',
    deletedPageLanguageMeta: '這個頁面語言檔案已從目前草稿中刪除。如需保留，請在發布前恢復。',
    deletedRestoreHint: '恢復會寫回這個刪除項目最後載入的基線內容。',
    restoreDeleted: '恢復',
    status: {
      added: '新增',
      modified: '已修改',
      deleted: '已刪除',
      issue: '要處理',
      checking: '檢查緊',
      changedCount: ({ count }) => `${count} 項變更`,
      changedSummary: ({ total, added, modified, deleted }) => {
        const parts = [];
        if (added) parts.push(`${added} 新增`);
        if (modified) parts.push(`${modified} 修改`);
        if (deleted) parts.push(`${deleted} 刪除`);
        return parts.length ? `${total} 項變更：${parts.join('，')}` : `${total} 項變更`;
      },
      orderChanged: '順序已變更',
      deletedSummary: '已刪除項目'
    }
  }
};

translations.ui = {
  ...translations.ui,
  backToAllPosts: '返到全部文章',
  backToHome: '返到首頁',
  more: '更多功能',
  less: '收埋',
  details: '詳情',
  copyDetails: '複製詳情',
  reportIssue: '回報問題'
};

translations.tools = {
  ...translations.tools,
  toggleTheme: '切換主題模式',
  resetLanguage: '重設語言'
};

export default translations;
