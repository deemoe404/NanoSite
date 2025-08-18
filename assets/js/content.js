// Helpers for generating excerpts/snippets from markdown
export function stripMarkdownToText(md) {
  const lines = String(md || '').split('\n');
  let text = [];
  let inCode = false, inBigCode = false;
  for (let raw of lines) {
    if (raw.startsWith('````')) { inBigCode = !inBigCode; continue; }
    if (inBigCode) continue;
    if (raw.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (raw.trim().startsWith('|')) continue; // skip tables for snippet
    if (/^\s*#+\s*/.test(raw)) continue; // skip titles entirely for snippet
    if (/^\s*>/.test(raw)) raw = raw.replace(/^\s*>\s?/, '');
  // strip list markers (unordered and ordered)
  raw = raw.replace(/^\s*[-*+]\s+/, '');
  raw = raw.replace(/^\s*\d{1,9}[\.)]\s+/, '');
    // images -> alt text
    raw = raw.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // links -> text
    raw = raw.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
    // inline code/emphasis markers
    raw = raw.replace(/`([^`]*)`/g, '$1')
             .replace(/\*\*([^*]+)\*\*/g, '$1')
             .replace(/\*([^*]+)\*/g, '$1')
             .replace(/~~([^~]+)~~/g, '$1')
             .replace(/_([^_]+)_/g, '$1');
    text.push(raw.trim());
  }
  return text.join(' ').replace(/\s+/g, ' ').trim();
}

export function limitWords(text, n) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= n) return String(text || '');
  return words.slice(0, n).join(' ') + '…';
}

export function extractExcerpt(md, wordLimit = 50) {
  // First try to extract from front matter
  const { frontMatter, content } = parseFrontMatter(md);
  
  if (frontMatter.excerpt) {
    return limitWords(frontMatter.excerpt, wordLimit);
  }
  
  // Fallback to extracting from content
  const lines = String(content || '').split('\n');
  // find first heading index
  let firstH = -1, secondH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) { firstH = i; break; }
  }
  if (firstH === -1) {
    const text = stripMarkdownToText(content);
    return limitWords(text, wordLimit);
  }
  for (let j = firstH + 1; j < lines.length; j++) {
    if (/^\s*#/.test(lines[j])) { secondH = j; break; }
  }
  const segment = lines.slice(firstH + 1, secondH === -1 ? lines.length : secondH).join('\n');
  const text = stripMarkdownToText(segment);
  return limitWords(text, wordLimit);
}

// Compute predicted read time (in whole minutes, min 1)
export function computeReadTime(md, wpm = 200) {
  // Strip front matter before computing read time
  const { content } = parseFrontMatter(md);
  const text = stripMarkdownToText(content);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / Math.max(100, Number(wpm) || 200)));
  return minutes; // caller formats e.g., `${minutes} min read`
}

// Parse YAML front matter from markdown content
export function parseFrontMatter(content) {
  const trimmed = String(content || '').trim();
  
  // Check if content starts with YAML front matter
  if (!trimmed.startsWith('---')) {
    return { frontMatter: {}, content: trimmed };
  }
  
  // Find the end of front matter
  const lines = trimmed.split('\n');
  let endIndex = -1;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) {
    return { frontMatter: {}, content: trimmed };
  }
  
  // Extract front matter and content
  const frontMatterLines = lines.slice(1, endIndex);
  const contentLines = lines.slice(endIndex + 1);
  
  // Parse simple YAML (key: value format)
  const frontMatter = {};
  let currentKey = null;
  let currentArray = null;
  
  for (const line of frontMatterLines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue; // Skip empty lines and comments
    }
    
    // Handle array items
    if (trimmedLine.startsWith('- ')) {
      if (currentArray) {
        currentArray.push(trimmedLine.substring(2).trim());
      }
      continue;
    }
    
    // Handle key: value pairs
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();
      
      currentKey = key;
      currentArray = null;
      
      if (value) {
        // Single value - remove quotes if present
        frontMatter[key] = value.replace(/^["']|["']$/g, '');
      } else {
        // Start of array
        currentArray = [];
        frontMatter[key] = currentArray;
      }
    }
  }
  
  return {
    frontMatter,
    content: contentLines.join('\n').trim()
  };
}

// Extract content without front matter
export function stripFrontMatter(content) {
  const { content: strippedContent } = parseFrontMatter(content);
  return strippedContent;
}
