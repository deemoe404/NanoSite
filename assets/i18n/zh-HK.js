import zhTwTranslations from './zh-TW.js';

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

const translations = clone(zhTwTranslations);

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
