const LAYOUT_PRESETS = new Map();
const COMPONENT_REGISTRY = new Map();
const DEFAULT_PRESET = 'sidebar-right';
let currentPresetName = null;
let activeBodyClasses = [];
let activeRootClasses = [];

const IDENT_RE = /[^a-z0-9_-]/g;

function sanitizeKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  const clean = trimmed.replace(IDENT_RE, '');
  return clean;
}

function sanitizePresetName(value) {
  const key = sanitizeKey(value);
  return key || DEFAULT_PRESET;
}

function sanitizeZoneName(value) {
  const key = sanitizeKey(value);
  return key || '';
}

function isElement(node) {
  return !!(node && typeof node === 'object' && node.nodeType === 1);
}

function toArray(input) {
  if (Array.isArray(input)) return input;
  if (input === undefined || input === null) return [];
  return [input];
}

function sanitizeComponentKey(value) {
  const key = sanitizeKey(value);
  return key;
}

function sanitizeZoneEntries(input) {
  const arr = toArray(input);
  const out = [];
  for (const value of arr) {
    const key = sanitizeComponentKey(value);
    if (key) out.push(key);
  }
  return out;
}

function normalizeZoneObject(zones) {
  const result = {};
  if (!zones || typeof zones !== 'object') return result;
  for (const [zoneName, entries] of Object.entries(zones)) {
    const name = sanitizeZoneName(zoneName);
    if (!name) continue;
    const normalized = sanitizeZoneEntries(entries);
    if (normalized.length || (Array.isArray(entries) && entries.length === 0)) {
      result[name] = normalized;
    }
  }
  return result;
}

function classListFrom(input) {
  const out = [];
  if (!input) return out;
  if (typeof input === 'string') {
    input.split(/\s+/g).forEach(token => {
      const cls = sanitizeKey(token);
      if (cls) out.push(cls);
    });
    return out;
  }
  if (Array.isArray(input)) {
    input.forEach(token => {
      const cls = sanitizeKey(token);
      if (cls) out.push(cls);
    });
  } else if (typeof input === 'object') {
    for (const token of Object.keys(input)) {
      if (!Object.prototype.hasOwnProperty.call(input, token)) continue;
      const enabled = input[token];
      if (!enabled) continue;
      const cls = sanitizeKey(token);
      if (cls) out.push(cls);
    }
  }
  return out;
}

function ensureLayoutRoot() {
  const root = document.querySelector('[data-layout-root]');
  if (!root) return null;
  return root;
}

function collectComponents() {
  const nodes = {};
  for (const [key, resolver] of COMPONENT_REGISTRY.entries()) {
    if (typeof resolver !== 'function') continue;
    try {
      const node = resolver();
      if (isElement(node)) nodes[key] = node;
    } catch (_) {
      // ignore resolver errors to avoid breaking layout apply
    }
  }
  return nodes;
}

function takeNode(key, nodes, used) {
  if (!nodes || !Object.prototype.hasOwnProperty.call(nodes, key)) return null;
  const node = nodes[key];
  if (!isElement(node) || used.has(key)) return null;
  used.add(key);
  if (node.parentNode) node.parentNode.removeChild(node);
  return node;
}

function appendZoneElements(element, zoneName, nodes, used, zones) {
  if (!element) return;
  const keys = (zones && Array.isArray(zones[zoneName])) ? zones[zoneName] : [];
  for (const key of keys) {
    const node = takeNode(key, nodes, used);
    if (node) element.appendChild(node);
  }
}

function mergeZones(baseZones, overrideZones) {
  const result = {};
  const names = new Set();
  if (baseZones && typeof baseZones === 'object') {
    Object.keys(baseZones).forEach(name => names.add(name));
  }
  if (overrideZones && typeof overrideZones === 'object') {
    Object.keys(overrideZones).forEach(name => names.add(name));
  }
  for (const name of names) {
    if (overrideZones && Object.prototype.hasOwnProperty.call(overrideZones, name)) {
      result[name] = Array.isArray(overrideZones[name]) ? [...overrideZones[name]] : [];
    } else if (baseZones && Object.prototype.hasOwnProperty.call(baseZones, name)) {
      result[name] = Array.isArray(baseZones[name]) ? [...baseZones[name]] : [];
    } else {
      result[name] = [];
    }
  }
  return result;
}

function setBodyLayoutState(presetName, additionalClasses) {
  const body = document.body;
  if (!body) return;
  const classesToRemove = Array.isArray(activeBodyClasses) ? activeBodyClasses : [];
  classesToRemove.forEach(cls => body.classList.remove(cls));
  const classes = [];
  if (presetName) {
    classes.push(`layout-${presetName}`);
    body.setAttribute('data-layout', presetName);
    body.setAttribute('data-layout-preset', presetName);
  } else {
    body.removeAttribute('data-layout');
    body.removeAttribute('data-layout-preset');
  }
  if (Array.isArray(additionalClasses)) {
    additionalClasses.forEach(cls => {
      if (!cls) return;
      if (!classes.includes(cls)) classes.push(cls);
    });
  }
  classes.forEach(cls => body.classList.add(cls));
  activeBodyClasses = classes;
}

function setRootLayoutState(root, presetName, classes) {
  if (!root) return;
  const prev = Array.isArray(activeRootClasses) ? activeRootClasses : [];
  prev.forEach(cls => root.classList.remove(cls));
  const applied = new Set();
  root.classList.add('layout-host');
  if (presetName) {
    const presetClass = `layout-host-${presetName}`;
    root.classList.add(presetClass);
    applied.add(presetClass);
    root.setAttribute('data-layout-preset', presetName);
  } else {
    root.removeAttribute('data-layout-preset');
  }
  if (Array.isArray(classes)) {
    classes.forEach(cls => {
      if (!cls) return;
      root.classList.add(cls);
      applied.add(cls);
    });
  }
  activeRootClasses = Array.from(applied);
}

function normalizeLayoutConfig(input) {
  if (typeof input === 'string') {
    return {
      preset: sanitizePresetName(input),
      zones: {},
      bodyClasses: [],
      rootClasses: [],
      fallbackZone: 'sidebar',
    };
  }
  const obj = (input && typeof input === 'object') ? input : {};
  const presetName = sanitizePresetName(obj.preset);
  const zones = normalizeZoneObject(obj.zones);
  const bodyClasses = classListFrom(obj.bodyClass || obj.bodyClasses);
  const rootClasses = classListFrom(obj.rootClass || obj.rootClasses);
  const fallbackZone = sanitizeZoneName(obj.fallbackZone) || 'sidebar';
  return { preset: presetName, zones, bodyClasses, rootClasses, fallbackZone };
}

export function registerLayoutComponent(name, resolver) {
  const key = sanitizeComponentKey(name);
  if (!key || typeof resolver !== 'function') return;
  COMPONENT_REGISTRY.set(key, resolver);
}

export function registerLayoutPreset(name, preset) {
  const presetName = sanitizePresetName(name);
  if (!presetName || !preset || typeof preset !== 'object') return;
  const build = typeof preset.build === 'function' ? preset.build : null;
  if (!build) return;
  const zones = normalizeZoneObject(preset.zones || {});
  const fallbackZone = sanitizeZoneName(preset.fallbackZone) || 'sidebar';
  const bodyClasses = classListFrom(preset.bodyClass || preset.bodyClasses);
  const rootClasses = classListFrom(preset.rootClass || preset.rootClasses);
  LAYOUT_PRESETS.set(presetName, {
    name: presetName,
    build,
    zones,
    fallbackZone,
    bodyClasses,
    rootClasses,
  });
}

function getPreset(name) {
  return LAYOUT_PRESETS.get(sanitizePresetName(name));
}

export function getRegisteredLayoutPresets() {
  return Array.from(LAYOUT_PRESETS.keys());
}

export function getCurrentLayoutPreset() {
  return currentPresetName;
}

export function applyLayoutConfig(config) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { preset: null };
  const root = ensureLayoutRoot();
  if (!root) return { preset: null };
  const normalized = normalizeLayoutConfig(config);
  const preset = getPreset(normalized.preset) || getPreset(DEFAULT_PRESET);
  if (!preset) return { preset: null };
  const nodes = collectComponents();
  const used = new Set();
  const zones = mergeZones(preset.zones, normalized.zones);

  // Clear existing layout content but retain root element and tracked classes
  while (root.firstChild) root.removeChild(root.firstChild);

  const appendZone = (element, zoneName) => appendZoneElements(element, zoneName, nodes, used, zones);
  const context = {
    root,
    zones,
    config: normalized,
    preset: preset.name,
    appendZone,
    takeNode: (key) => takeNode(key, nodes, used),
    getNode: (key) => (nodes && Object.prototype.hasOwnProperty.call(nodes, key) ? nodes[key] : null),
  };

  let zoneElements = {};
  try {
    const built = preset.build(context) || {};
    if (built && typeof built === 'object') {
      for (const [zoneName, element] of Object.entries(built)) {
        if (!zoneName || !isElement(element)) continue;
        zoneElements[zoneName] = element;
      }
    }
  } catch (err) {
    console.error('[layout] Failed to build layout preset:', preset.name, err);
  }

  const fallbackZoneName = sanitizeZoneName(normalized.fallbackZone) || preset.fallbackZone || 'sidebar';
  const fallbackTarget = zoneElements[fallbackZoneName] || zoneElements.sidebar || zoneElements.content || root;
  if (fallbackTarget) {
    for (const [key, node] of Object.entries(nodes)) {
      if (!isElement(node) || used.has(key)) continue;
      const taken = takeNode(key, nodes, used);
      if (taken) fallbackTarget.appendChild(taken);
    }
  }

  currentPresetName = preset.name;
  const bodyClasses = [...new Set([...(preset.bodyClasses || []), ...(normalized.bodyClasses || [])])];
  setBodyLayoutState(currentPresetName, bodyClasses);
  const rootClasses = [...new Set([...(preset.rootClasses || []), ...(normalized.rootClasses || [])])];
  setRootLayoutState(root, currentPresetName, rootClasses);

  return {
    preset: currentPresetName,
    zones,
    fallbackZone: fallbackZoneName,
  };
}

// --- Default component registry ---
registerLayoutComponent('map', () => document.getElementById('mapview'));
registerLayoutComponent('main', () => document.getElementById('mainview'));
registerLayoutComponent('search', () => document.getElementById('searchbox'));
registerLayoutComponent('site', () => document.getElementById('sitecard'));
registerLayoutComponent('tags', () => document.getElementById('tagview'));
registerLayoutComponent('toc', () => document.getElementById('tocview'));
registerLayoutComponent('tools', () => document.getElementById('tools'));

// --- Built-in presets ---
registerLayoutPreset('sidebar-right', {
  zones: {
    content: ['map', 'main'],
    sidebar: ['search', 'site', 'tags', 'tools', 'toc'],
  },
  fallbackZone: 'sidebar',
  build({ root, appendZone }) {
    const container = document.createElement('div');
    container.className = 'container layout-two-column layout-sidebar-right';

    const content = document.createElement('div');
    content.className = 'content';
    appendZone(content, 'content');

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    appendZone(sidebar, 'sidebar');

    container.appendChild(content);
    container.appendChild(sidebar);
    root.appendChild(container);

    return { container, content, sidebar };
  },
});

registerLayoutPreset('sidebar-left', {
  zones: {
    content: ['map', 'main'],
    sidebar: ['search', 'site', 'tags', 'tools', 'toc'],
  },
  fallbackZone: 'sidebar',
  build({ root, appendZone }) {
    const container = document.createElement('div');
    container.className = 'container layout-two-column layout-sidebar-left';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    appendZone(sidebar, 'sidebar');

    const content = document.createElement('div');
    content.className = 'content';
    appendZone(content, 'content');

    container.appendChild(sidebar);
    container.appendChild(content);
    root.appendChild(container);

    return { container, content, sidebar };
  },
});

registerLayoutPreset('single-column', {
  zones: {
    content: ['map', 'main'],
    sidebar: ['search', 'site', 'tags', 'tools', 'toc'],
  },
  fallbackZone: 'content',
  build({ root, appendZone }) {
    const container = document.createElement('div');
    container.className = 'container layout-single-column';

    const content = document.createElement('div');
    content.className = 'content';
    appendZone(content, 'content');

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar sidebar-stack';
    appendZone(sidebar, 'sidebar');

    container.appendChild(content);
    container.appendChild(sidebar);
    root.appendChild(container);

    return { container, content, sidebar };
  },
});

export default {
  applyLayoutConfig,
  registerLayoutPreset,
  registerLayoutComponent,
  getRegisteredLayoutPresets,
  getCurrentLayoutPreset,
};
