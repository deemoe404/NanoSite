import chtTwTranslations from './cht-tw.js?v=20260505welcome';

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
    welcome: '歡迎',
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
  },
  welcome: {
    ...translations.editor.welcome,
    kicker: '快速上手',
    title: '歡迎使用 Press',
    meta: 'Where knowledge becomes pages.',
    stepsTitle: '由呢三步開始',
    step1Number: '第 1 步',
    step1Title: '設定網站',
    step1Detail: '先確認網站名稱、語言、主題同 GitHub 倉庫，之後再開始編輯內容。',
    step1Button: '開啟網站設定',
    step2Number: '第 2 步',
    step2Title: '加入內容',
    step2Detail: '文章適合網誌、筆記同教學；頁面適合 About、History 呢類固定導覽內容。',
    step2ArticlesButton: '開啟文章',
    step2PagesButton: '開啟頁面',
    step3Number: '第 3 步',
    step3Title: '準備好後發布',
    step3Detail: '保存會將草稿留喺本地。發布會將你選擇嘅更改送到 GitHub。',
    step3Button: '開啟發布',
    updatesTitle: 'Press 更新',
    updatesBody: '檢查編輯器同執行時更新，唔會改動你嘅文章、頁面或網站設定。',
    updatesButton: '檢查更新',
    faqTitle: '遇到陌生詞？展開睇睇',
    faqIntro: '唔需要而家全部睇晒。有疑問時展開查閱就得。',
    faqPressQuestion: 'Press 係咩？',
    faqPressAnswer: 'Where knowledge becomes pages.',
    faqMarkdownQuestion: 'Markdown 係咩？',
    faqMarkdownAnswer: 'Markdown 係一種好輕量嘅寫作格式，用普通文字就可以寫標題、連結、列表、圖片同段落。',
    faqArticlesPagesQuestion: '文章同頁面有咩分別？',
    faqArticlesPagesAnswer: '文章會進入文章列表，適合網誌、筆記同教學。頁面係固定導覽內容，適合 About、History 或介紹頁。',
    faqFrontMatterQuestion: '前置資料係咩？',
    faqFrontMatterAnswer: '前置資料係一篇文章或頁面嘅小設定區，用嚟保存標題、日期、標籤、摘要、封面圖等資訊。',
    faqPublishQuestion: '本地編輯同 Publish 係點運作？',
    faqPublishAnswer: '保存會將草稿留喺呢部電腦。Publish 會將你選擇嘅本地更改送到 GitHub。',
    faqUpdatesQuestion: 'Press 更新會改咩？',
    faqUpdatesAnswer: 'System Updates 只更新編輯器同執行時系統檔案，唔會覆蓋你嘅文章、頁面或網站設定。'
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
