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
    { type: 'comment', pattern: /#.*$/gm },
    { type: 'string', pattern: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g },
    { type: 'keyword', pattern: /\b(def|class|if|elif|else|for|while|import|from|return|try|except|with|as|True|False|None)\b/g },
    { type: 'number', pattern: /\b\d+(\.\d+)?\b/g }
  ],
  
  html: [
    { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
    { type: 'tag', pattern: /<\/?[\w\-]+(?:\s+[\w\-]+(=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g }
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
  ]
};

// 主高亮函数
function simpleHighlight(code, language) {
  if (!code || !language) return escapeHtml(code || '');
  
  const lang = language.toLowerCase();
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
  
  // 将临时标记替换为实际的HTML标签
  result = result.replace(/__HIGHLIGHTED__(\w+)__(.*?)__END__/g, (match, type, content) => {
    return `<span class="syntax-${type}">${content}</span>`;
  });
  
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
  
  return null;
}

// 初始化语法高亮
export function initSyntaxHighlighting() {
  const codeBlocks = document.querySelectorAll('pre code');
  
  codeBlocks.forEach(codeElement => {
    const preElement = codeElement.closest('pre');
    if (!preElement) return;
    
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
    
    // 如果没有找到语言，尝试自动检测
    if (!language) {
      language = detectLanguage(codeElement.textContent);
    }
    
    // 记录原始代码文本用于行号计算
    const originalCode = codeElement.textContent || '';

    // 应用语法高亮（若识别到语言且支持）
    if (language && highlightRules[language.toLowerCase()]) {
      const highlightedCode = simpleHighlight(originalCode, language);
      codeElement.innerHTML = highlightedCode;

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
      
      // 添加/增强语言标签（支持悬浮复制与点击复制）
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

      const langText = (language || '').toUpperCase();
      languageLabel.dataset.lang = langText;
      languageLabel.setAttribute('role', 'button');
      languageLabel.setAttribute('tabindex', '0');
  languageLabel.setAttribute('aria-label', TXT_ARIA);
      languageLabel.textContent = langText;
      
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
          const old = languageLabel.dataset.lang || 'CODE';
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
          languageLabel.textContent = languageLabel.dataset.lang || 'CODE';
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
