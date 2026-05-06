import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const themesDir = path.join(root, 'assets', 'themes');
const schemaPath = path.join(root, 'assets', 'schema', 'theme.json');
const failures = [];

const REQUIRED_VIEWS = ['post', 'posts', 'search', 'tab', 'error', 'loading'];
const REQUIRED_REGIONS = ['main', 'toc', 'search', 'nav', 'tags', 'footer'];
const REQUIRED_CONTENT_SHAPES = ['rawMarkdown', 'html', 'blocks', 'tocTree', 'headings', 'metadata', 'assets', 'links'];
const REQUIRED_COMPONENTS = ['nano-search', 'nano-toc', 'nano-post-card'];
const REQUIRED_STYLE_TOKENS = ['--ns-color-text', '--ns-color-surface', '--ns-font-body', '--ns-radius-card', '--ns-space-page'];
const LEGACY_IDS = ['mainview', 'tocview', 'searchInput', 'tabsNav', 'tagview'];
const PURE_THEME_NAMES = new Set(['arcus', 'cartograph', 'native', 'solstice']);
const CORE_RUNTIME_FILES = [
  'assets/main.js',
  'assets/js/dom-utils.js',
  'assets/js/i18n.js',
  'assets/js/lightbox.js',
  'assets/js/search.js',
  'assets/js/tags.js',
  'assets/js/theme.js',
  'assets/js/toc.js'
];

function fail(message) {
  failures.push(message);
}

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (err) {
    fail(`${rel(file)} is not valid JSON: ${err.message}`);
    return null;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function uniqueList(items, label, file) {
  if (!Array.isArray(items)) {
    fail(`${file} ${label} must be an array`);
    return [];
  }
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) {
      fail(`${file} ${label} contains an empty value`);
      return;
    }
    if (seen.has(value)) {
      fail(`${file} ${label} repeats "${value}"`);
      return;
    }
    seen.add(value);
    out.push(value);
  });
  return out;
}

function requireObject(value, label, file) {
  const object = asObject(value);
  if (!object) fail(`${file} ${label} must be an object`);
  return object || {};
}

function requireList(owner, key, label, file) {
  if (!Object.prototype.hasOwnProperty.call(owner || {}, key)) {
    fail(`${file} is missing ${label}`);
    return [];
  }
  return uniqueList(owner[key], label, file);
}

function modulePathIsSafe(entry, extension) {
  return entry
    && !entry.startsWith('.')
    && !entry.startsWith('/')
    && !entry.includes('..')
    && !entry.includes('\\')
    && entry.endsWith(extension);
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceMentionsRegion(source, key) {
  const escaped = escapeRe(key);
  return new RegExp(`\\b${escaped}\\b`).test(source);
}

function declaredViewHooks(viewDecl = {}) {
  const hooks = [];
  if (typeof viewDecl.hook === 'string' && viewDecl.hook.trim()) hooks.push(viewDecl.hook.trim());
  if (Array.isArray(viewDecl.hooks)) {
    viewDecl.hooks.forEach((hook) => {
      const value = String(hook || '').trim();
      if (value) hooks.push(value);
    });
  }
  return [...new Set(hooks)];
}

function declaredViewHandler(viewDecl = {}) {
  const module = typeof viewDecl.module === 'string' ? viewDecl.module.trim() : '';
  const handler = typeof viewDecl.handler === 'string' ? viewDecl.handler.trim() : '';
  return { module, handler };
}

const schema = readJson(schemaPath);
if (!schema) fail('assets/schema/theme.json must be readable');

const componentSource = read(path.join(root, 'assets', 'js', 'components.js'));
const themeRegionsSource = read(path.join(root, 'assets', 'js', 'theme-regions.js'));
const themeLayoutSource = read(path.join(root, 'assets', 'js', 'theme-layout.js'));
const mainSource = read(path.join(root, 'assets', 'main.js'));
const contentModelSource = read(path.join(root, 'assets', 'js', 'content-model.js'));
const docsSource = read(path.join(root, 'docs', 'theme-contract.md'));

REQUIRED_COMPONENTS.forEach((component) => {
  const localName = component.replace(/^nano-/, '');
  const className = `Nano${localName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
  if (!componentSource.includes(`defineElement('${component}'`) || !componentSource.includes(`class ${className}`)) {
    fail(`assets/js/components.js must define shared component ${component}`);
  }
});

['createThemeRegionRegistry', 'registerMany', 'value(name)', 'REGION_ALIASES'].forEach((needle) => {
  if (!themeRegionsSource.includes(needle)) {
    fail(`assets/js/theme-regions.js must expose region registry support for ${needle}`);
  }
});

['getThemeApiHandler', 'VIEW_HOOKS', 'bindLegacyHookAdapters', 'applyManifestStyles'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme API adapter support for ${needle}`);
  }
});
['createThemeI18nContext', 'switchLanguage', 'ensureLanguageBundle', 'getAvailableLangs', 'getLanguageLabel'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme i18n context support for ${needle}`);
  }
});
if (!/const direct = \([\s\S]*asObject\(mod\.effects\)[\s\S]*\) \? mod : null;/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must merge pure API objects returned from mount(ctx)');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must inject ctx.i18n into theme mount context');
}

['createContentModel', 'blocks', 'tocTree', 'headings', 'assets', 'links'].forEach((needle) => {
  if (!contentModelSource.includes(needle)) {
    fail(`assets/js/content-model.js must provide content model field ${needle}`);
  }
});

if (!mainSource.includes('getThemeApiHandler')) {
  fail('assets/main.js must route theme calls through getThemeApiHandler before legacy hooks');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(mainSource)) {
  fail('assets/main.js must pass the standard ctx.i18n shape to theme view handlers');
}
if (!/renderPostView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into post view rendering');
}
if (!/parseFrontMatter/.test(mainSource) || !/frontMatterMetadata[\s\S]*postMetadata\s*=\s*\{[\s\S]*\.\.\.frontMatterMetadata[\s\S]*location:\s*postname/.test(mainSource)) {
  fail('assets/main.js must merge the current post front matter into legacy post metadata before theme rendering');
}
if (!/renderStaticTabView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into tab view rendering');
}

CORE_RUNTIME_FILES.forEach((file) => {
  const source = read(path.join(root, file));
  LEGACY_IDS.forEach((id) => {
    const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
    const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
    if (directId.test(source) || directSelector.test(source)) {
      fail(`${file} directly depends on legacy DOM id "${id}" instead of the region registry`);
    }
  });
});

['contractVersion', 'regions', 'views', 'components', 'scrollContainer', 'configSchema', 'content', 'shapes', 'handler'].forEach((needle) => {
  if (!docsSource.includes(needle)) {
    fail(`docs/theme-contract.md must document manifest field ${needle}`);
  }
});

const themeNames = fs.readdirSync(themesDir)
  .filter((name) => fs.statSync(path.join(themesDir, name)).isDirectory())
  .sort();

themeNames.forEach((themeName) => {
  const themeDir = path.join(themesDir, themeName);
  const manifestPath = path.join(themeDir, 'theme.json');
  const relManifest = rel(manifestPath);
  const manifest = readJson(manifestPath);
  if (!manifest) return;
  const isPureTheme = PURE_THEME_NAMES.has(themeName);

  if (manifest.$schema !== '../../schema/theme.json') {
    fail(`${relManifest} must declare "$schema": "../../schema/theme.json"`);
  }
  if (!manifest.name) fail(`${relManifest} must declare name`);
  if (!manifest.version) fail(`${relManifest} must declare version`);
  if (manifest.contractVersion !== 1) fail(`${relManifest} contractVersion must be 1`);

  const styles = requireList(manifest, 'styles', 'styles', relManifest);
  let styleSource = '';
  styles.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.css')) {
      fail(`${relManifest} has unsafe style path "${entry}"`);
      return;
    }
    const stylePath = path.join(themeDir, entry);
    if (!fs.existsSync(stylePath)) {
      fail(`${relManifest} references missing style "${entry}"`);
      return;
    }
    styleSource += `\n${read(stylePath)}`;
  });
  if (themeName === 'native') {
    const basePath = path.join(themeDir, 'base.css');
    if (fs.existsSync(basePath)) styleSource += `\n${read(basePath)}`;
  }
  REQUIRED_STYLE_TOKENS.forEach((token) => {
    if (!styleSource.includes(token)) fail(`${relManifest} styles must expose ${token}`);
  });

  const modules = requireList(manifest, 'modules', 'modules', relManifest);
  if (!modules.length) fail(`${relManifest} modules must not be empty`);
  modules.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.js')) {
      fail(`${relManifest} has unsafe module path "${entry}"`);
      return;
    }
    if (!fs.existsSync(path.join(themeDir, entry))) {
      fail(`${relManifest} references missing module "${entry}"`);
    }
  });

  const moduleSource = modules
    .map((entry) => {
      const modulePath = path.join(themeDir, entry);
      return fs.existsSync(modulePath) ? read(modulePath) : '';
    })
    .join('\n');
  if (
    /from\s+['"][^'"]*js\/i18n\.js(?:\?[^'"]*)?['"]/.test(moduleSource)
    || /import\s*\([^)]*js\/i18n\.js/.test(moduleSource)
  ) {
    fail(`${relManifest} theme modules must read i18n from ctx.i18n instead of importing js/i18n.js directly`);
  }
  if (isPureTheme) {
    if (/__ns_themeHooks/.test(moduleSource)) {
      fail(`${relManifest} pure theme modules must not write window.__ns_themeHooks`);
    }
    LEGACY_IDS.forEach((id) => {
      const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
      const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
      if (directId.test(moduleSource) || directSelector.test(moduleSource)) {
        fail(`${relManifest} pure theme modules must not query legacy DOM id "${id}"`);
      }
    });
    if (manifest.contract != null) {
      fail(`${relManifest} pure theme must omit legacy contract`);
    }
  }
  if (!/return\s*\{[\s\S]*(views|effects)[\s\S]*components/.test(moduleSource)) {
    fail(`${relManifest} modules must return an explicit theme API object with views/effects and components`);
  }
  if (!/export\s+default\s+\{[\s\S]*mount[\s\S]*views[\s\S]*components[\s\S]*effects/.test(moduleSource)) {
    fail(`${relManifest} modules must export a default theme API object`);
  }

  const views = requireObject(manifest.views, 'views', relManifest);
  REQUIRED_VIEWS.forEach((view) => {
    if (!asObject(views[view])) fail(`${relManifest} views must include "${view}"`);
  });

  const regions = requireObject(manifest.regions, 'regions', relManifest);
  REQUIRED_REGIONS.forEach((region) => {
    const declaration = asObject(regions[region]);
    if (!declaration) {
      fail(`${relManifest} regions must include "${region}"`);
      return;
    }
    const aliases = Array.isArray(declaration.aliases) ? declaration.aliases.map(String) : [];
    const candidates = [region, ...aliases];
    if (!candidates.some((candidate) => sourceMentionsRegion(moduleSource, candidate))) {
      fail(`${relManifest} declares region "${region}" but no module source mentions it or its aliases`);
    }
  });

  const components = requireList(manifest, 'components', 'components', relManifest);
  REQUIRED_COMPONENTS.forEach((component) => {
    if (!components.includes(component)) {
      fail(`${relManifest} components must include "${component}"`);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(manifest, 'scrollContainer')) {
    fail(`${relManifest} must declare scrollContainer`);
  }
  requireObject(manifest.configSchema, 'configSchema', relManifest);
  const content = requireObject(manifest.content, 'content', relManifest);
  const shapes = requireList(content, 'shapes', 'content.shapes', relManifest);
  REQUIRED_CONTENT_SHAPES.forEach((shape) => {
    if (!shapes.includes(shape)) fail(`${relManifest} content.shapes must include "${shape}"`);
  });

  Object.entries(views).forEach(([view, declaration]) => {
    if (isPureTheme) {
      const declared = declaredViewHandler(declaration);
      if (!declared.module || !declared.handler) {
        fail(`${relManifest} pure theme views.${view} must declare module and handler`);
      }
      declaredViewHooks(declaration).forEach((hookName) => {
        fail(`${relManifest} pure theme views.${view} must not reference legacy hook "${hookName}"`);
      });
    }
  });

  if (!isPureTheme) {
    const contract = requireObject(manifest.contract, 'contract', relManifest);
    if (contract.version !== 1) fail(`${relManifest} contract.version must be 1`);
    const hooks = requireList(contract, 'hooks', 'contract.hooks', relManifest);
    const contractRegions = requireList(contract, 'regions', 'contract.regions', relManifest);
    REQUIRED_REGIONS.forEach((region) => {
      if (!contractRegions.includes(region)) {
        fail(`${relManifest} contract.regions must include stable region "${region}"`);
      }
    });
    LEGACY_IDS.forEach((id) => {
      if (!requireList(contract, 'domIds', 'contract.domIds', relManifest).includes(id)) {
        fail(`${relManifest} contract.domIds should keep legacy adapter id "${id}" explicit`);
      }
    });
    const contractViews = requireList(contract, 'views', 'contract.views', relManifest);
    ['post', 'posts', 'search', 'tab'].forEach((view) => {
      if (!contractViews.includes(view)) fail(`${relManifest} contract.views must include "${view}"`);
    });
    const contractContent = requireObject(contract.content, 'contract.content', relManifest);
    if (contractContent.markdown !== 'html') fail(`${relManifest} contract.content.markdown must be "html"`);
    if (contractContent.toc !== 'html') fail(`${relManifest} contract.content.toc must be "html"`);
    const contractShapes = requireList(contractContent, 'shapes', 'contract.content.shapes', relManifest);
    REQUIRED_CONTENT_SHAPES.forEach((shape) => {
      if (!contractShapes.includes(shape)) fail(`${relManifest} contract.content.shapes must include "${shape}"`);
    });

    Object.entries(views).forEach(([view, declaration]) => {
      declaredViewHooks(declaration).forEach((hookName) => {
        if (!hooks.includes(hookName)) fail(`${relManifest} views.${view} references hook "${hookName}" missing from contract.hooks`);
      });
    });

    hooks.forEach((hookName) => {
      const re = new RegExp(`hooks\\.${escapeRe(hookName)}\\s*=`);
      if (!re.test(moduleSource)) {
        fail(`${relManifest} declares hook "${hookName}" but no module assigns hooks.${hookName}`);
      }
    });
  }
});

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Theme contract check passed for ${themeNames.length} theme packs.`);
