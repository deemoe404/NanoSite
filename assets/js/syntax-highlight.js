/**
 * 轻量级语法高亮器 - 简化版本
 * 支持常见编程语言：JavaScript, JSON, HTML, CSS, Python, Java, C/C++, Bash/Shell
 */

// 简化的语言规则定义
const highlightRules = {
  javascript: [
    { type: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(["'`])(?:(?!\1)[^\\\r\n]|\\.)*\1/g },
    { type: 'keyword', pattern: /\b(function|const|let|var|if|else|for|while|return|class|import|export|from|async|await|true|false|null|undefined)\b/g },
    { type: 'number', pattern: /\b\d+(\.\d+)?\b/g },
    { type: 'operator', pattern: /[+\-*/%=<>!&|^~?:]/g }
  ],
  
  json: [
    { type: 'string', pattern: /"(?:[^"\\]|\\.)*"/g },
    { type: 'number', pattern: /\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b/g },
    { type: 'keyword', pattern: /\b(true|false|null)\b/g }
  ],
  
  python: [
    // Strings first to avoid treating '#' inside strings as comments
    // Support: triple quotes, normal quotes, and backslash-quoted strings (e.g., \"...\") sometimes present in exported markdown
    { type: 'string', pattern: /(\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\\"(?:[^"\\]|\\.)*\\"|\\'(?:[^'\\]|\\.)*\\')/g },
    // Line comments
    { type: 'comment', pattern: /#.*$/gm },
    // Expanded Python keywords
    { type: 'keyword', pattern: /\b(def|class|if|elif|else|for|while|import|from|return|try|except|finally|with|as|in|and|or|not|is|pass|break|continue|lambda|yield|True|False|None|global|nonlocal|assert|raise|del)\b/g },
    // Numbers
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/g },
    // Operators and punctuation
    { type: 'operator', pattern: /[+\-*/%=:<>!&|^~]+|[()\[\]{}.,:]/g }
  ],
  
  html: [
    { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
    // Safer HTML tag matcher (avoids ReDoS from nested optional groups and disallows hyphen-start tag names)
    { type: 'tag', pattern: /<\/?[A-Za-z][\w:.-]*(?:\s+(?:"[^"]*"|'[^']*'|[^"'\s<>=]+))*\s*\/?>/g }
  ],
  
  // XML — add PI, CDATA, strings, numbers, and tags
  xml: [
    // XML comments
    { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
    // XML declaration / processing instructions, e.g., <?xml version="1.0"?>
    { type: 'preprocessor', pattern: /<\?[\s\S]*?\?>/g },
    // CDATA sections (treat as comments for readability)
    { type: 'comment', pattern: /<!\[CDATA\[[\s\S]*?\]\]>/g },
    // Attribute/string values
    { type: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g },
    // (Temporarily disable XML number highlighting to avoid content corruption)
    // Tags (names + attributes)
    // Safer XML tag matcher (no nested optional equals within repetition; requires letter-start names)
    { type: 'tag', pattern: /<\/?[A-Za-z][\w:.-]*(?:\s+(?:"[^"]*"|'[^']*'|[^"'\s<>=]+))*\s*\/?>/g }
  ],
  
  css: [
    { type: 'comment', pattern: /\/\*[\s\S]*?\*\//g },
    { type: 'selector', pattern: /[.#]?[\w\-]+(?:\[[\w\-]+(?:="[^"]*")?\])*(?:::?[\w\-]+)?/g },
    { type: 'property', pattern: /[\w\-]+(?=\s*:)/g },
    { type: 'string', pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/g },
    { type: 'number', pattern: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|deg|ms|s)?\b/g }
  ],
  
  markdown: [
    { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
    { type: 'keyword', pattern: /^#{1,6}\s.*/gm },
    { type: 'keyword', pattern: /^\*{3,}$|^-{3,}$|^_{3,}$/gm },
    { type: 'string', pattern: /\*\*(.*?)\*\*/g },
    { type: 'string', pattern: /\*(.*?)\*/g },
    { type: 'string', pattern: /`([^`]+)`/g },
    { type: 'keyword', pattern: /^\s*[-*+]\s/gm },
    { type: 'keyword', pattern: /^\s*\d+\.\s/gm },
    { type: 'string', pattern: /\[([^\]]+)\]\(([^)]+)\)/g }
  ],
  
  bash: [
    { type: 'comment', pattern: /#.*$/gm },
    { type: 'string', pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/g },
    { type: 'keyword', pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|local|export|source|alias|unalias|cd|pwd|ls|mkdir|rmdir|rm|cp|mv|cat|grep|awk|sed|sort|uniq|head|tail|echo|printf|read|test)\b/g },
    { type: 'operator', pattern: /[&|;><(){}[\]$!]/g },
    { type: 'number', pattern: /\b\d+\b/g }
  ],
  
  shell: [
    { type: 'comment', pattern: /#.*$/gm },
    { type: 'string', pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/g },
    { type: 'keyword', pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|local|export|source|alias|unalias|cd|pwd|ls|mkdir|rmdir|rm|cp|mv|cat|grep|awk|sed|sort|uniq|head|tail|echo|printf|read|test)\b/g },
    { type: 'operator', pattern: /[&|;><(){}[\]$!]/g },
    { type: 'number', pattern: /\b\d+\b/g }
  ],

  // YAML / YML — light but useful highlighting
  // Order matters: keys -> strings -> comments (so '#' inside quotes is preserved)
  yaml: [
    // keys (match key and colon together; simple but effective)
    { type: 'property', pattern: /(^|\n)\s*[-\s]*([A-Za-z_][\w\-\.]*|"(?:[^"\\]|\\.)*"|'[^']*')\s*:/g },
    // strings (quoted)
    { type: 'string', pattern: /"(?:[^"\\]|\\.)*"|'[^']*'/g },
    // comments (after strings so '#' inside quotes are not treated as comments)
    { type: 'comment', pattern: /#.*$/gm },
    // dates and times as whole tokens
    { type: 'number', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
    { type: 'number', pattern: /\b\d{2}:\d{2}(?::\d{2})?\b/g },
    // anchors & aliases
    { type: 'variables', pattern: /[&*][A-Za-z0-9_\-]+/g },
    // tags like !Ref, !!str
    { type: 'preprocessor', pattern: /!{1,2}[A-Za-z0-9_:\-]+/g },
    // booleans and null-like
    { type: 'keyword', pattern: /\b(true|false|on|off|yes|no|null)\b/gi },
    // numbers
    { type: 'number', pattern: /\b-?\d+(?:\.\d+)?\b/g },
    // punctuation tokens (include block scalar indicators)
    { type: 'punctuation', pattern: /[:{},\[\]\-|>]/g }
  ],

  // Alias for `.yml`
  yml: [
    { type: 'property', pattern: /(^|\n)\s*[-\s]*([A-Za-z_][\w\-\.]*|"(?:[^"\\]|\\.)*"|'[^']*')\s*:/g },
    { type: 'string', pattern: /"(?:[^"\\]|\\.)*"|'[^']*'/g },
    { type: 'comment', pattern: /#.*$/gm },
    { type: 'number', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
    { type: 'number', pattern: /\b\d{2}:\d{2}(?::\d{2})?\b/g },
    { type: 'variables', pattern: /[&*][A-Za-z0-9_\-]+/g },
    { type: 'preprocessor', pattern: /!{1,2}[A-Za-z0-9_:\-]+/g },
    { type: 'keyword', pattern: /\b(true|false|on|off|yes|no|null)\b/gi },
    { type: 'number', pattern: /\b-?\d+(?:\.\d+)?\b/g },
    { type: 'punctuation', pattern: /[:{},\[\]\-|>]/g }
  ],

  // robots.txt — highlight directives, comments, URLs and numbers
  robots: [
    // Line-leading directive token and its first colon (treat as a keyword block)
    // e.g. "User-agent:" "Disallow:" "Sitemap:" etc., including custom directives
    { type: 'keyword', pattern: /^\s*[A-Za-z][A-Za-z-]*\s*:/gm },
    // Comments
    { type: 'comment', pattern: /#.*$/gm },
    // Known directives anywhere in line (fallback if not at start)
    { type: 'keyword', pattern: /\b(User-agent|Disallow|Allow|Sitemap|Crawl-delay|Host|Clean-param)\b/gi },
    // URLs
    { type: 'string', pattern: /(https?:\/\/[^\s#]+)/gi },
    // Numbers (e.g., Crawl-delay)
    { type: 'number', pattern: /\b\d+\b/g },
    // Wildcards and leftover punctuation
    { type: 'punctuation', pattern: /[/*$]/g }
  ]
};

// 专用的 HTML 高亮（标签名、属性名、等号、字符串分别着色）
function highlightHtmlRich(raw) {
  if (!raw) return '';
  const esc = (t) => {
    return String(t || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  };
  const renderTag = (tagRaw) => {
    try {
      // Parse basics
      const isClosing = /^<\//.test(tagRaw);
      const selfClose = /\/\s*>$/.test(tagRaw);
      const endTrim = selfClose ? 2 : 1; // '/>' vs '>'
      const startTrim = isClosing ? 2 : 1; // '</' vs '<'
      const inner = tagRaw.slice(startTrim, tagRaw.length - endTrim);
      const m = inner.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/);
      if (!m) return esc(tagRaw);
      const tagName = m[1] || '';
      let attrChunk = m[2] || '';
      let out = '';
      // Leading < or </ and tag name
      out += `<span class="syntax-tag">&lt;${isClosing ? '/' : ''}${esc(tagName)}</span>`;
      if (!isClosing && attrChunk) {
        // Walk attributes while preserving spacing
        const attrRegex = /(\s+)([A-Za-z_:][\w:.-]*)(?:\s*(=)\s*("[^"\\]*"|'[^'\\]*'|[^\s"'=<>`]+))?/g;
        let lastIndex = 0; let part = '';
        let am;
        while ((am = attrRegex.exec(attrChunk)) !== null) {
          // Append any skipped raw text (unlikely)
          if (am.index > lastIndex) { part += esc(attrChunk.slice(lastIndex, am.index)); }
          const space = am[1] || '';
          const name = am[2] || '';
          const eq = am[3] || '';
          const val = am[4];
          part += space;
          part += `<span class=\"syntax-property\">${esc(name)}</span>`;
          if (eq) {
            part += `<span class=\"syntax-operator\">=</span>`;
            if (val != null) {
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                const q = val[0];
                const inner = val.slice(1, -1);
                part += `<span class=\"syntax-string\">${esc(q + inner + q)}</span>`;
              } else {
                part += `<span class=\"syntax-string\">${esc(val)}</span>`;
              }
            }
          }
          lastIndex = attrRegex.lastIndex;
        }
        // Trailing text in attrChunk
        if (lastIndex < attrChunk.length) part += esc(attrChunk.slice(lastIndex));
        out += part;
      }
      // Trailing /> or >
      out += `<span class=\"syntax-tag\">${selfClose ? '/&gt;' : '&gt;'}</span>`;
      return out;
    } catch (_) {
      return esc(tagRaw);
    }
  };
  // Walk the string and replace comments/tags, escape the rest
  const tokenRe = /<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9:-]*\s*[^>]*>?/g;
  let out = '';
  let i = 0; let m;
  while ((m = tokenRe.exec(raw)) !== null) {
    const start = m.index; const end = tokenRe.lastIndex;
    if (start > i) out += esc(raw.slice(i, start));
    const tok = m[0];
    if (tok.startsWith('<!--')) {
      out += `<span class=\"syntax-comment\">${esc(tok)}</span>`;
    } else {
      out += renderTag(tok);
    }
    i = end;
  }
  if (i < raw.length) out += esc(raw.slice(i));
  return out;
}

// 主高亮函数
function simpleHighlight(code, language) {
  if (!code || !language) return escapeHtml(code || '');
  
  const lang = language.toLowerCase();
  // 为 HTML 启用更细粒度的高亮（支持属性名/值/等号）
  if (lang === 'html' || lang === 'htm') {
    try { return highlightHtmlRich(code); } catch (_) {}
  }
  const rules = highlightRules[lang];
  
  if (!rules) return escapeHtml(code);
  
  let result = code; // 先不进行HTML转义

  // 仅在未被标记的片段中执行替换，避免嵌套高亮导致标记泄漏
  const MARK_START = '__HIGHLIGHTED__';
  const MARK_END = '__END__';
  function protectedReplace(input, regex, wrapFn) {
    let out = '';
    let i = 0;
    while (i < input.length) {
      const start = input.indexOf(MARK_START, i);
      if (start === -1) {
        out += input.slice(i).replace(regex, wrapFn);
        break;
      }
      // 处理标记前的片段
      out += input.slice(i, start).replace(regex, wrapFn);
      // 原样拷贝已标记片段
      const end = input.indexOf(MARK_END, start);
      if (end === -1) { // 不完整标记，直接附加剩余
        out += input.slice(start);
        break;
      }
      out += input.slice(start, end + MARK_END.length);
      i = end + MARK_END.length;
    }
    return out;
  }

  // 应用每个规则
  rules.forEach(rule => {
    if (!rule.pattern) return;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    result = protectedReplace(result, regex, (match) => `__HIGHLIGHTED__${rule.type}__${match}__END__`);
  });
  
  // HTML转义整个结果
  result = escapeHtml(result);
  
  // 将临时标记替换为实际的HTML标签（允许匹配跨行内容）
  // 注意：类型仅允许字母/连字符，避免 \w 贪婪吞并后续占位导致内容缺失
  result = result.replace(/__HIGHLIGHTED__([A-Za-z-]+)__([\s\S]*?)__END__/g, (match, type, content) => {
    return `<span class="syntax-${type}">${content}</span>`;
  });

  // 兜底：清理任何可能泄漏到界面的标记残留
  result = cleanupMarkerArtifacts(result);
  
  return result;
}

// HTML 转义函数
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 清理任何可能遗留在可视层的占位标记，防御性处理
function cleanupMarkerArtifacts(html) {
  if (!html) return html;
  let out = String(html);
  // 通用：仅处理带显式结束标记的形式，避免跨段误吞
  out = out.replace(/__H[A-Z]*?__([A-Za-z-]+)__([\s\S]*?)(?:__END__|__E__)/gi, (m, t, c) => `<span class="syntax-${t.toLowerCase()}">${c}</span>`);
  // 具体已知形式（冗余加强）
  out = out.replace(/__HIGHLIGHTED__(\w+)__([\s\S]*?)__END__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__H__(\w+)__([\s\S]*?)__E__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__HILIGHTED__(\w+)__([\s\S]*?)__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  // 移除孤立类型标记（未成对的 __tag__/__number__ 等）
  out = out.replace(/__(tag|string|number|comment|operator|punctuation|property|selector|preprocessor|variables|keyword|attributes)__+/gi, '');
  // 终极兜底：去掉任何残留的起止标记，保留内容
  out = out.replace(/__H[A-Z_]*__/g, '');
  out = out.replace(/__(?:END|E)__/g, '');
  return out;
}

// 将受控的高亮 HTML 字符串转换为安全的文档片段，仅允许 <span class="syntax-*"> 与纯文本
function toSafeFragment(html) {
  const allowedTag = 'SPAN';
  const allowedAttr = 'class';
  const classPrefix = 'syntax-';

  // 如果浏览器支持原生 Sanitizer API，优先使用白名单策略
  try {
    if (typeof window !== 'undefined' && 'Sanitizer' in window && typeof Element.prototype.setHTML === 'function') {
      const s = new window.Sanitizer({
        allowElements: ['span'],
        allowAttributes: {'class': ['span']},
      });
      const tmp = document.createElement('div');
      // 使用 Sanitizer 将内容注入到临时容器
      tmp.setHTML(String(html || ''), { sanitizer: s });
      // 进一步约束 class 仅保留以 syntax- 开头
      tmp.querySelectorAll('*').forEach((el) => {
        if (el.tagName !== allowedTag) {
          el.replaceWith(document.createTextNode(el.textContent || ''));
          return;
        }
        const classes = (el.getAttribute('class') || '').split(/\s+/).filter(c => c && c.startsWith(classPrefix));
        if (classes.length) el.setAttribute('class', classes.join(' ')); else el.removeAttribute('class');
        // 移除其他所有属性
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== allowedAttr) el.removeAttribute(attr.name);
        }
      });
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      return frag;
    }
  } catch (_) { /* 忽略，回退到手动净化 */ }

  // 回退：不再重新解释为 HTML，而是手工解析仅允许的 <span class="syntax-*"> 标记
  // 这样可避免“DOM 文本被重新作为 HTML 解释”的 CodeQL 告警
  const decodeEntities = (t) => String(t || '').replace(/&(amp|lt|gt|quot|#039);/g, (m, g1) => (
    g1 === 'amp' ? '&' : g1 === 'lt' ? '<' : g1 === 'gt' ? '>' : g1 === 'quot' ? '"' : "'"
  ));
  const frag = document.createDocumentFragment();
  const stack = [frag];
  let i = 0;
  const len = (html || '').length;
  const src = String(html || '');

  const appendText = (text) => {
    if (!text) return;
    stack[stack.length - 1].appendChild(document.createTextNode(decodeEntities(text)));
  };

  // 仅识别 <span ...> 与 </span>，其它一律按文本处理
  while (i < len) {
    if (src.charCodeAt(i) !== 60 /* '<' */) {
      const nextLt = src.indexOf('<', i);
      const chunk = nextLt === -1 ? src.slice(i) : src.slice(i, nextLt);
      appendText(chunk);
      i = nextLt === -1 ? len : nextLt;
      continue;
    }

    // 尝试匹配关闭标签 </span>
    if (/^<\s*\/\s*span\s*>/i.test(src.slice(i))) {
      const m = src.slice(i).match(/^<\s*\/\s*span\s*>/i);
      if (m) {
        if (stack.length > 1) stack.pop(); else appendText(m[0]);
        i += m[0].length;
        continue;
      }
    }

    // 尝试匹配开启标签 <span ...>
    const open = src.slice(i).match(/^<\s*span\b([^>]*)>/i);
    if (open) {
      const attrText = open[1] || '';
      // 提取 class 属性并仅保留以 syntax- 开头的类名
      const clsMatch = attrText.match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let classes = [];
      if (clsMatch) {
        const raw = (clsMatch[2] || clsMatch[3] || clsMatch[4] || '').trim();
        classes = raw.split(/\s+/).filter(c => c && c.startsWith(classPrefix));
      }
      const el = document.createElement('span');
      if (classes.length) el.setAttribute('class', classes.join(' '));
      stack[stack.length - 1].appendChild(el);
      stack.push(el);
      i += open[0].length;
      continue;
    }

    // 不是允许的标签，按普通文本处理一个字符以推进
    appendText(src[i]);
    i += 1;
  }

  return frag;
}

// 检测代码语言
function detectLanguage(code) {
  if (!code) return null;
  
  // JSON 检测
  if (/^\s*[\{\[]/.test(code) && /[\}\]]\s*$/.test(code)) {
    try {
      JSON.parse(code);
      return 'json';
    } catch (e) {}
  }
  
  // HTML 检测
  if (/<[^>]+>/.test(code)) {
    return 'html';
  }
  
  // CSS 检测
  if (/[{][^}]*[}]/.test(code) && /[\w\-]+\s*:[^;]+;/.test(code)) {
    return 'css';
  }
  
  // Python 检测
  if (/\bdef\s+\w+|import\s+\w+|from\s+\w+/.test(code)) {
    return 'python';
  }
  
  // JavaScript 检测
  if (/\bfunction\s+\w+|\b(const|let|var)\s+\w+|=>\s*[{(]/.test(code)) {
    return 'javascript';
  }
  
  // Bash/Shell 检测
  if (/(^|\n)\s*#!\s*\/.*\/(bash|sh)|^\s*#.*$|^\s*(if|for|while|function)\s+.*;\s*then|^\s*(export|alias|cd|echo|grep|awk|sed)\s+/.test(code)) {
    return 'bash';
  }
  
  // YAML 检测（典型 header、键值对和列表）
  const yamlHeader = /(^|\n)\s*---\s*(\n|$)/;
  const yamlKey = /(^|\n)\s*[-\s]*[A-Za-z_"'][\w\-\."']*\s*:/;
  const yamlList = /(^|\n)\s*-\s+[^\n]+/;
  if (yamlHeader.test(code) || (yamlKey.test(code) && /\n/.test(code)) || yamlList.test(code)) {
    return 'yaml';
  }

  return null;
}

// 初始化语法高亮
export function initSyntaxHighlighting() {
  const codeBlocks = document.querySelectorAll('pre code');
  
  codeBlocks.forEach(codeElement => {
    const preElement = codeElement.closest('pre');
    if (!preElement) return;
    // Skip editor-internal pre blocks (handled by hieditor)
    if (preElement.classList && preElement.classList.contains('hi-pre')) return;
    
    // 获取语言信息
    let language = null;
    
    // 从 class 属性中获取语言
    const classList = Array.from(codeElement.classList);
    for (let className of classList) {
      if (className.startsWith('language-')) {
        language = className.replace('language-', '');
        break;
      }
    }
    // 允许通过标记禁用高亮和复制：`nohighlight`、`plain`、`text` 或 data-nohighlight
    const hasNoHighlightFlag = (
      preElement.classList.contains('nohighlight') ||
      codeElement.classList.contains('nohighlight') ||
      codeElement.hasAttribute('data-nohighlight') ||
      preElement.hasAttribute('data-nohighlight') ||
      codeElement.classList.contains('plain') ||
      codeElement.classList.contains('text') ||
      classList.includes('language-plain') ||
      classList.includes('language-text') ||
      classList.includes('language-none') ||
      classList.includes('language-raw')
    );
    
    // 如果没有找到语言，尝试自动检测
    if (!language) {
      language = detectLanguage(codeElement.textContent);
    }

    // 归一化并确定是否应禁用增强（复制按钮与高亮）
    const normLang = (language || '').toLowerCase();
    const isPlain = !normLang || normLang === 'plain' || normLang === 'text' || normLang === 'raw' || normLang === 'none';
    const isSupported = !!(normLang && highlightRules[normLang]);
    const disableEnhance = hasNoHighlightFlag || isPlain || !isSupported; // 未检测/不支持/显式plain
    
    // 记录原始代码文本用于行号计算
    const originalCode = codeElement.textContent || '';

    // 应用语法高亮（若识别到语言且支持，且未禁用）
    if (!disableEnhance && language && highlightRules[language.toLowerCase()]) {
      const highlightedCode = simpleHighlight(originalCode, language);
      // 使用受控白名单将高亮结果插入 DOM，避免直接 innerHTML 带来的 XSS 风险
      codeElement.textContent = '';
      codeElement.appendChild(toSafeFragment(highlightedCode));

      // 确保代码滚动容器与浮动标签分离，避免水平滚动时标签跟随移动
      // 结构：<pre class="with-code-scroll"><div class="code-scroll"><code>...</code></div><div class="syntax-language-label"/></pre>
      if (!preElement.classList.contains('with-code-scroll')) {
        const currentParent = codeElement.parentElement;
        if (!currentParent || !currentParent.classList.contains('code-scroll')) {
          const scrollWrap = document.createElement('div');
          scrollWrap.className = 'code-scroll';
          // 将 code 放入滚动容器
          preElement.insertBefore(scrollWrap, codeElement);
          scrollWrap.appendChild(codeElement);
        }
        preElement.classList.add('with-code-scroll');
      }
    }

    // 无论是否高亮，统一包装为滚动容器并添加行号
    if (!preElement.classList.contains('with-code-scroll')) {
      const currentParent = codeElement.parentElement;
      if (!currentParent || !currentParent.classList.contains('code-scroll')) {
        const scrollWrap = document.createElement('div');
        scrollWrap.className = 'code-scroll';
        preElement.insertBefore(scrollWrap, codeElement);
        scrollWrap.appendChild(codeElement);
      }
      preElement.classList.add('with-code-scroll');
    }

    const scrollWrap = preElement.querySelector('.code-scroll');
    if (scrollWrap && !scrollWrap.classList.contains('code-with-gutter')) {
      scrollWrap.classList.add('code-with-gutter');
    }

    if (scrollWrap) {
      // 如果还没有 gutter，则创建并插入到 code 之前
      let gutter = scrollWrap.querySelector('.code-gutter');
      if (!gutter) {
        gutter = document.createElement('div');
        gutter.className = 'code-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        scrollWrap.insertBefore(gutter, codeElement);
      }

      // 依据原始代码的行数渲染行号
      // 去除文本末尾的单个换行，避免末尾空白行导致行号多一行
      const trimmed = originalCode.endsWith('\n') ? originalCode.slice(0, -1) : originalCode;
      const lineCount = trimmed ? (trimmed.match(/\n/g) || []).length + 1 : 1;
      // 只在首次或数量变化时重建，避免重复 DOM 操作
      const currentCount = gutter.childElementCount;
      if (currentCount !== lineCount) {
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= lineCount; i++) {
          const s = document.createElement('span');
          s.textContent = String(i);
          frag.appendChild(s);
        }
        gutter.innerHTML = '';
        gutter.appendChild(frag);
      }

      // 动态设置 gutter 宽度以适配位数（再加一点余量）
      const digits = String(lineCount).length;
      gutter.style.width = `${Math.max(2, digits + 1)}ch`;
    }
      
      // 始终显示语言标签/复制按钮；当禁用高亮时标签显示为 PLAIN
      let languageLabel = preElement.querySelector('.syntax-language-label');
      if (!languageLabel) {
        languageLabel = document.createElement('div');
        languageLabel.className = 'syntax-language-label';
        preElement.appendChild(languageLabel);
      }

      // 统一设置基础属性与交互绑定（避免重复绑定）
      const getT = (key, fallback) => {
        try { return (window.__ns_t && typeof window.__ns_t === 'function') ? window.__ns_t(key) : fallback; } catch (_) { return fallback; }
      };
      // 在 main.js 中 t() 已导出，这里尽量从全局桥接，若不可用则使用英文回退
      const TXT_COPY = getT('code.copy', 'Copy');
      const TXT_COPIED = getT('code.copied', 'Copied');
      const TXT_FAILED = getT('code.failed', 'Failed');
      const TXT_ARIA = getT('code.copyAria', 'Copy code');

      const langText = disableEnhance ? 'PLAIN' : (language || '').toUpperCase();
      languageLabel.dataset.lang = langText || 'PLAIN';
      languageLabel.setAttribute('role', 'button');
      languageLabel.setAttribute('tabindex', '0');
      languageLabel.setAttribute('aria-label', TXT_ARIA);
      languageLabel.textContent = langText || 'PLAIN';
      
      if (!languageLabel.dataset.bound) {
        const copyCode = async () => {
          const rawText = codeElement.textContent || '';
          let ok = false;
          if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(rawText); ok = true; } catch (_) { ok = false; }
          }
          if (!ok) {
            try {
              const ta = document.createElement('textarea');
              ta.value = rawText;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              ok = document.execCommand('copy');
              document.body.removeChild(ta);
            } catch (_) { ok = false; }
          }

          // 反馈
          const old = languageLabel.dataset.lang || 'PLAIN';
          languageLabel.classList.add('is-copied');
          languageLabel.textContent = ok ? TXT_COPIED.toUpperCase() : TXT_FAILED.toUpperCase();
          setTimeout(() => {
            languageLabel.classList.remove('is-copied');
            languageLabel.textContent = old;
          }, 1200);
        };

        languageLabel.addEventListener('mouseenter', () => {
          languageLabel.classList.add('is-hover');
          languageLabel.textContent = TXT_COPY.toUpperCase();
        });
        languageLabel.addEventListener('mouseleave', () => {
          languageLabel.classList.remove('is-hover');
          languageLabel.textContent = languageLabel.dataset.lang || 'PLAIN';
        });
        languageLabel.addEventListener('click', copyCode);
        languageLabel.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyCode(); }
        });

        languageLabel.dataset.bound = '1';
      }
  });
}

// 导出函数
export { simpleHighlight, detectLanguage };

// 兼容性导出
export function highlightCode(code, language) {
  return simpleHighlight(code, language);
}

export function applySyntaxHighlighting(code, language) {
  return simpleHighlight(code, language);
}
