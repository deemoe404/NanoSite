import { loadSiteConfigFlex } from './seo-tool-config.js';

// ---- GitHub Repo config helpers ----
function __buildStatusTextFragment(text) {
  const frag = document.createDocumentFragment();
  const dot = document.createElement('span');
  dot.className = 'dot';
  frag.appendChild(dot);
  const label = document.createElement('span');
  label.textContent = String(text || '');
  frag.appendChild(label);
  return frag;
}

function setGlobalStatus(mode, content, opts = {}) {
  try {
    const box = document.getElementById('global-status');
    if (!box) return;
    const curMode = box.dataset.mode || '';
    // Prevent downgrading from ok -> warn unless forced
    if (!opts.force && mode === 'warn' && curMode === 'ok') return;
    // Avoid clearing to empty when we already have a state
    if (!opts.force && !mode && (curMode === 'ok' || curMode === 'warn' || curMode === 'err')) return;
    box.className = `global-status ${mode || ''}`;
    box.dataset.mode = mode || '';
    // Clear existing content and append safely
    while (box.firstChild) box.removeChild(box.firstChild);
    if (content == null || content === '') return;
    if (typeof content === 'string') {
      box.appendChild(__buildStatusTextFragment(content));
    } else if (content instanceof Node) {
      box.appendChild(content);
    }
  } catch (_) {}
}

function renderRepoLink(owner, repo, branch, extraText) {
  const o = String(owner || '');
  const r = String(repo || '');
  const b = String(branch || '');
  const slugOk = (o && r);
  const frag = document.createDocumentFragment();
  const dot = document.createElement('span');
  dot.className = 'dot';
  frag.appendChild(dot);
  if (!slugOk) {
    const label = document.createElement('span');
    label.textContent = 'No repository';
    frag.appendChild(label);
    return frag;
  }
  const a = document.createElement('a');
  a.href = `https://github.com/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = `@${o}/${r}`;
  frag.appendChild(a);
  const tail = document.createElement('span');
  const branchText = b ? ` (${b})` : '';
  const extra = extraText ? ` · ${String(extraText)}` : '';
  tail.textContent = `${branchText}${extra}`;
  frag.appendChild(tail);
  return frag;
}

// Compute global status from current UI (single source of truth binding)
function syncGlobalFromUI(force = true) {
  try {
    const slugEl = document.getElementById('gh-slug');
    const branchEl = document.getElementById('gh-branch');
    const slug = slugEl ? String(slugEl.value || '').trim() : '';
    const { owner, repo } = parseSlug(slug);
    const branch = branchEl ? String(branchEl.value || '').trim() : '';
    const slugStatus = document.getElementById('gh-slug-status');
    const branchStatus = document.getElementById('gh-branch-status');
    const cls = (el) => (el && (el.classList.contains('err') ? 'err' : el.classList.contains('warn') ? 'warn' : el.classList.contains('ok') ? 'ok' : '')) || '';
    const slugCls = cls(slugStatus);
    const branchCls = cls(branchStatus);
    const slugText = (slugStatus && slugStatus.textContent) ? slugStatus.textContent.trim() : '';
    const branchText = (branchStatus && branchStatus.textContent) ? branchStatus.textContent.trim() : '';

    if (!owner || !repo) {
      setGlobalStatus('', __buildStatusTextFragment('Ready'), { force });
      return;
    }
    // Error has highest priority
    if (slugCls === 'err') {
      setGlobalStatus('err', __buildStatusTextFragment(slugText || 'Invalid repository'), { force });
      return;
    }
    if (branchCls === 'err') {
      setGlobalStatus('err', __buildStatusTextFragment(branchText || 'Branch error'), { force });
      return;
    }
    // Loading states
    if (slugCls === 'warn' && /checking/i.test(slugText)) {
      setGlobalStatus('warn', __buildStatusTextFragment(`Checking @${owner}/${repo}…`), { force });
      return;
    }
    if (branchCls === 'warn' && /loading/i.test(branchText)) {
      setGlobalStatus('warn', renderRepoLink(owner, repo, branch || '', 'Loading branches…'), { force });
      return;
    }
    // OK states
    if (slugCls === 'ok' && branchCls === 'ok') {
      // try to extract number of branches from branchText like "3 branches"
      const m = branchText.match(/(\d+)\s+branches?/i);
      const extra = m ? `${m[1]} branches` : 'OK';
      setGlobalStatus('ok', renderRepoLink(owner, repo, branch || '', extra), { force });
      return;
    }
    // Fallback when repo entered but not checked
    setGlobalStatus('warn', renderRepoLink(owner, repo, branch || '', 'Pending check'), { force });
  } catch (_) {}
}
function parseSlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return { owner: '', repo: '' };
  const cleaned = s.replace(/^@/, '');
  const parts = cleaned.split('/').filter(Boolean);
  return { owner: parts[0] || '', repo: parts[1] || '' };
}

function readGhRepoCfg(hydrate = true) {
  const storedSlug = localStorage.getItem('gh_slug');
  let owner = '', repo = '';
  if (storedSlug) {
    ({ owner, repo } = parseSlug(storedSlug));
  } else {
    owner = localStorage.getItem('gh_owner') || '';
    repo  = localStorage.getItem('gh_repo')  || '';
  }
  const branch = localStorage.getItem('gh_branch') || 'main';
  const $ = id => document.getElementById(id);
  const slugVal = owner && repo ? `${owner}/${repo}` : '';
  if (hydrate) {
    if ($('gh-slug')) { $('gh-slug').value = slugVal; }
    if ($('gh-branch')) { $('gh-branch').value = branch; }
  }
  // Bind global status to current UI
  try { syncGlobalFromUI(true); } catch (_) {}
  return { owner, repo, branch };
}

function getGhCfgFromUIOrStorage() {
  const slugEl = document.getElementById('gh-slug');
  const branchEl = document.getElementById('gh-branch');
  let owner = '', repo = '', branch = '';
  if (slugEl && slugEl.value) { ({ owner, repo } = parseSlug(slugEl.value)); }
  if (branchEl && branchEl.value) branch = branchEl.value;
  const stored = readGhRepoCfg(false);
  if (!owner || !repo) { owner = stored.owner; repo = stored.repo; }
  if (!branch) { branch = stored.branch; }
  return { owner, repo, branch };
}

function getGhConfigFromSiteYaml(cfg = {}) {
  if (cfg.github && (cfg.github.owner || cfg.github.repo)) {
    return {
      owner: (cfg.github.owner || '').trim(),
      repo: (cfg.github.repo || '').trim(),
      branch: (cfg.github.branch || 'main').trim()
    };
  }
  if (cfg.reportIssueURL && typeof cfg.reportIssueURL === 'string') {
    const m = cfg.reportIssueURL.match(/https:\/\/github\.com\/([^\/]+)\/([^\/?#]+)/i);
    if (m) return { owner: m[1], repo: m[2], branch: 'main' };
  }
  if (Array.isArray(cfg.profileLinks)) {
    for (const link of cfg.profileLinks) {
      const href = link && link.href;
      if (typeof href === 'string') {
        const m = href.match(/https:\/\/github\.com\/([^\/]+)\/([^\/?#]+)/i);
        if (m) return { owner: m[1], repo: m[2], branch: 'main' };
      }
    }
  }
  return null;
}

// Save button action
function saveGhRepoCfg () {
  const $ = id => document.getElementById(id);
  const { owner, repo } = parseSlug($('gh-slug')?.value || '');
  const branch = ($('gh-branch')?.value || '').trim();
  if (!owner || !repo) return alert('Please enter a repository as owner/repo');
  if (!branch) return alert('Please select a branch');
  const slug = `${owner}/${repo}`;
  localStorage.setItem('gh_slug', slug);
  localStorage.setItem('gh_owner', owner);
  localStorage.setItem('gh_repo', repo);
  localStorage.setItem('gh_branch', branch);
  // If current UI has a validated repo, keep OK state; otherwise mark pending
  if (repoIsValid && branch) {
    try {
      localStorage.setItem('gh_checked', '1');
      setGlobalStatus('ok', renderRepoLink(owner, repo, branch, 'Saved'));
    } catch (_) {}
  } else {
    try { setGlobalStatus('warn', renderRepoLink(owner, repo, branch, 'Pending check')); } catch (_) {}
  }
  if ($('gh-slug')) $('gh-slug').value = slug;
  alert('Saved.');
}
window.saveGhRepoCfg = saveGhRepoCfg;
readGhRepoCfg();

// Try to infer GitHub repo from site.yaml
async function autoFillGhRepoCfgFromSiteYaml() {
  const hasLocal = (localStorage.getItem('gh_slug') || localStorage.getItem('gh_owner') || localStorage.getItem('gh_repo'));
  if (hasLocal) return;
  try {
    const cfg = await loadSiteConfigFlex();
    const inferred = getGhConfigFromSiteYaml(cfg);
    if (inferred && inferred.owner && inferred.repo) {
      const slug = `${inferred.owner}/${inferred.repo}`;
      localStorage.setItem('gh_slug', slug);
      localStorage.setItem('gh_owner', inferred.owner);
      localStorage.setItem('gh_repo', inferred.repo);
      if (inferred.branch) localStorage.setItem('gh_branch', inferred.branch);
      const $ = id => document.getElementById(id);
      if ($('gh-slug')) $('gh-slug').value = slug;
      if ($('gh-branch') && inferred.branch) $('gh-branch').value = inferred.branch;
      try { syncGlobalFromUI(true); } catch (_) {}
    }
  } catch (_) {}
}
autoFillGhRepoCfgFromSiteYaml();

// Inline validation helpers
function setFieldStatus(id, type, text, withSpinner = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('ok','warn','err');
  if (type) el.classList.add(type);
  if (withSpinner) {
    // Build spinner safely without interpreting text as HTML
    while (el.firstChild) el.removeChild(el.firstChild);
    const sp = document.createElement('span');
    sp.className = 'spinner';
    el.appendChild(sp);
    const label = document.createElement('span');
    label.textContent = String(text || '');
    el.appendChild(label);
  } else {
    el.textContent = text || '';
  }
  try { syncGlobalFromUI(true); } catch (_) {}
}
function setInputState(input, state) {
  if (!input) return;
  input.classList.remove('input-error','input-valid');
  const wrap = input.closest('.gh-field');
  if (wrap) wrap.classList.remove('error','valid');
  if (state === 'error') { input.classList.add('input-error'); if (wrap) wrap.classList.add('error'); }
  if (state === 'valid') { input.classList.add('input-valid'); if (wrap) wrap.classList.add('valid'); }
}

let repoIsValid = false;
function setSaveMode(mode) {
  const btn = document.getElementById('gh-save');
  if (!btn) return;
  if (mode === 'save') { btn.innerHTML = 'Save'; btn.disabled = false; btn.onclick = saveGhRepoCfg; }
  else if (mode === 'checking') { btn.innerHTML = '<span class="spinner"></span><span>Checking…</span>'; btn.disabled = true; btn.onclick = null; }
  else { btn.innerHTML = 'Check'; btn.disabled = false; btn.onclick = (e) => { e.preventDefault(); validateSlugAndLoadBranches(); }; }
}
function updateSaveEnabled() { const branchEl = document.getElementById('gh-branch'); const ok = repoIsValid && !!(branchEl && branchEl.value); setSaveMode(ok ? 'save' : 'check'); }

async function fetchRepoInfo(owner, repo) {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (r.status === 404) return { exists: false };
    if (r.status === 403) return { exists: false, error: 'GitHub rate limit hit. Try again later.' };
    if (!r.ok) return { exists: false, error: `GitHub API error: ${r.status}` };
    const data = await r.json();
    return { exists: true, default_branch: data.default_branch || 'main' };
  } catch (e) { return { exists: false, error: e.message }; }
}
async function fetchBranches(owner, repo, limitPages = 2) {
  const branches = [];
  const per = 100;
  for (let page = 1; page <= limitPages; page++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${per}&page=${page}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!r.ok) break;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const b of arr) { if (b && b.name) branches.push(b.name); }
    if (arr.length < per) break;
  }
  return branches;
}
function populateBranchSuggestions(branches, preferred) {
  const select = document.getElementById('gh-branch');
  if (!select) return;
  select.innerHTML = '';
  const unique = Array.from(new Set(branches || []));
  if (unique.length === 0) {
    const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'No branches found'; select.appendChild(opt); select.disabled = true; return;
  }
  for (const name of unique) { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; select.appendChild(opt); }
  select.disabled = false;
  // Auto-pick branch: preferred -> main -> master -> first
  let pick = preferred && unique.includes(preferred) ? preferred : '';
  if (!pick && unique.includes('main')) pick = 'main';
  if (!pick && unique.includes('master')) pick = 'master';
  if (!pick) pick = unique[0];
  try { select.value = pick; } catch (_) { /* ignore */ }
  try { updateSaveEnabled(); updateGhActionButtons(); syncGlobalFromUI(true); } catch (_) {}
}

async function validateSlugAndLoadBranches() {
  const slugEl = document.getElementById('gh-slug');
  const branchEl = document.getElementById('gh-branch');
  if (!slugEl) return;
  const { owner, repo } = parseSlug(slugEl.value);
  if (!owner || !repo) {
    setInputState(slugEl, slugEl.value.trim() ? 'error' : null);
    setFieldStatus('gh-slug-status', slugEl.value.trim() ? 'err' : null, slugEl.value.trim() ? 'Format must be owner/repo' : '');
    repoIsValid = false; updateSaveEnabled();
    syncGlobalFromUI(true);
    return;
  }
  setFieldStatus('gh-slug-status', 'warn', 'Checking repository…', true);
  setInputState(slugEl, null);
  setSaveMode('checking');
  if (branchEl) { branchEl.disabled = true; }
  setFieldStatus('gh-branch-status', null, '');
  const info = await fetchRepoInfo(owner, repo);
  if (!info.exists) {
    setInputState(slugEl, 'error');
    setFieldStatus('gh-slug-status', 'err', info.error ? String(info.error) : 'Repository not found on GitHub');
    syncGlobalFromUI(true);
    repoIsValid = false; updateSaveEnabled(); return;
  }
  setInputState(slugEl, 'valid');
  setFieldStatus('gh-slug-status', 'ok', `Found @${owner}/${repo}`);
  setFieldStatus('gh-branch-status', 'warn', 'Loading branches…', true);
  try {
    const branches = await fetchBranches(owner, repo);
    populateBranchSuggestions(branches, (branchEl && branchEl.value) ? branchEl.value : (localStorage.getItem('gh_branch') || info.default_branch));
    const countText = `${branches.length} branches`;
    setFieldStatus('gh-branch-status', 'ok', countText);
    syncGlobalFromUI(true);
    try {
      localStorage.setItem('gh_checked', '1');
      localStorage.setItem('gh_last_ok_slug', `${owner}/${repo}`);
      localStorage.setItem('gh_last_ok_branch', (branchEl && branchEl.value) ? branchEl.value : (localStorage.getItem('gh_branch') || info.default_branch));
      localStorage.setItem('gh_last_ok_time', String(Date.now()));
    } catch (_) {}
    repoIsValid = true; updateSaveEnabled(); updateGhActionButtons();
  } catch (e) {
    setFieldStatus('gh-branch-status', 'err', `Failed to load branches: ${e.message}`);
    syncGlobalFromUI(true);
    repoIsValid = false; updateSaveEnabled();
  }
}
window.validateSlugAndLoadBranches = validateSlugAndLoadBranches;

// Attach listeners to inputs
(function initGhInputs(){
  const slugInput = document.getElementById('gh-slug');
  const branchInput = document.getElementById('gh-branch');
  const saveBtn = document.getElementById('gh-save');
  if (slugInput) {
    slugInput.addEventListener('input', () => {
      setFieldStatus('gh-slug-status', null, '');
      setFieldStatus('gh-branch-status', null, '');
      if (branchInput) { branchInput.disabled = true; branchInput.value = ''; branchInput.innerHTML = '<option value="" selected>Loading branches…</option>'; }
      setInputState(slugInput, null);
      repoIsValid = false; updateSaveEnabled();
      syncGlobalFromUI(true);
    });
    slugInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); slugInput.blur(); validateSlugAndLoadBranches(); } });
    slugInput.addEventListener('blur', () => { validateSlugAndLoadBranches(); });
  }
  if (branchInput) branchInput.addEventListener('change', () => {
    updateSaveEnabled(); updateGhActionButtons();
    try {
      const slugEl = document.getElementById('gh-slug');
      const { owner, repo } = parseSlug(slugEl?.value || '');
      const branch = branchInput.value || '';
      if (owner && repo && branch) syncGlobalFromUI(true);
    } catch (_) {}
  });
  if (saveBtn) setSaveMode('check');
})();

// Revert from site.yaml button
(function initRevertFromSiteYaml(){
  const btn = document.getElementById('gh-revert');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const slugEl = document.getElementById('gh-slug');
    const branchEl = document.getElementById('gh-branch');
    setFieldStatus('gh-slug-status', null, '');
    setFieldStatus('gh-branch-status', null, '');
    try {
      const cfg = await loadSiteConfigFlex();
      const inferred = getGhConfigFromSiteYaml(cfg);
      if (!inferred || !inferred.owner || !inferred.repo) {
        setFieldStatus('gh-slug-status', 'err', 'No GitHub repository found in site.yaml');
        setGlobalStatus('err', __buildStatusTextFragment('No repository in site.yaml'));
        return;
      }
      if (slugEl) slugEl.value = `${inferred.owner}/${inferred.repo}`;
      if (branchEl) { branchEl.value = (inferred.branch || 'main'); branchEl.disabled = true; branchEl.innerHTML = '<option value="" selected>Loading branches…</option>'; }
      // Immediately reflect checking status in the global indicator
      try { setGlobalStatus('warn', __buildStatusTextFragment(`Checking @${inferred.owner}/${inferred.repo}…`)); } catch (_) {}
      await validateSlugAndLoadBranches();
      // Save without downgrading status
      if (slugEl && slugEl.value && branchEl && branchEl.value) saveGhRepoCfg();
    } catch (err) {
      setFieldStatus('gh-slug-status', 'err', 'Failed to read site.yaml');
      setGlobalStatus('err', __buildStatusTextFragment('Failed to read site.yaml'));
    }
  });
})();

// GitHub URL helpers
function ghEditUrl({owner, repo, branch}, path) { return `https://github.com/${owner}/${repo}/edit/${encodeURIComponent(branch)}/${path.replace(/^\/+/, '')}`; }
function ghNewUrl({owner, repo, branch}, dir, filename, value) { const qs = new URLSearchParams({ filename, value }); return `https://github.com/${owner}/${repo}/new/${encodeURIComponent(branch)}/${dir.replace(/^\/+/, '')}?${qs.toString()}`; }
function ghUploadUrl({owner, repo, branch}, dir) { return `https://github.com/${owner}/${repo}/upload/${encodeURIComponent(branch)}/${dir.replace(/^\/+/, '')}`; }
function openUrl(u){ window.open(u, '_blank', 'noopener'); }
function safeOpenNewWithContent(cfg, dir, filename, content) {
  const urlLenBudget = 7000;
  if (encodeURIComponent(content).length + filename.length + dir.length < urlLenBudget) { openUrl(ghNewUrl(cfg, dir, filename, content)); }
  else { alert('Content is long. Opened a new-file page; please paste the content in the GitHub editor and commit.'); openUrl(ghNewUrl(cfg, dir, filename, '')); }
}

// Open/Create actions used by buttons
function openSitemapNew () { const cfg = getGhCfgFromUIOrStorage(); const content = (document.getElementById('sitemapOutput')||{}).value || ''; if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); safeOpenNewWithContent(cfg, '', 'sitemap.xml', content); }
function openSitemapEdit() { const cfg = getGhCfgFromUIOrStorage(); if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); openUrl(ghEditUrl(cfg, 'sitemap.xml')); }
function openRobotsNew  () { const cfg = getGhCfgFromUIOrStorage(); const content = (document.getElementById('robotsOutput')||{}).value || ''; if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); safeOpenNewWithContent(cfg, '', 'robots.txt', content); }
function openRobotsEdit () { const cfg = getGhCfgFromUIOrStorage(); if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); openUrl(ghEditUrl(cfg, 'robots.txt')); }
function openIndexHtmlEdit() { const cfg = getGhCfgFromUIOrStorage(); if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); openUrl(ghEditUrl(cfg, 'index.html')); }
function openUploadAssets() { const cfg = getGhCfgFromUIOrStorage(); if (!cfg.owner || !cfg.repo) return alert('Please fill owner/repo/branch first'); openUrl(ghUploadUrl(cfg, 'assets')); }
window.openSitemapNew = openSitemapNew;
window.openSitemapEdit = openSitemapEdit;
window.openRobotsNew = openRobotsNew;
window.openRobotsEdit = openRobotsEdit;
window.openIndexHtmlEdit = openIndexHtmlEdit;
window.openUploadAssets = openUploadAssets;

// File existence checks to switch button mode
async function ghFileExists({owner, repo, branch}, path) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path.replace(/^\/+/, '')}?ref=${encodeURIComponent(branch)}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (r.status === 404) return false;
    return r.ok;
  } catch (_) { return false; }
}
function setGhBtnState(btn, exists, path, onNew, onEdit) {
  if (!btn) return; btn.disabled = false;
  if (exists) { btn.textContent = `Edit on GitHub`; btn.onclick = onEdit; btn.title = `Edit ${path} on GitHub`; btn.setAttribute('aria-label', `Edit ${path} on GitHub`); }
  else { btn.textContent = 'Create on GitHub'; btn.onclick = onNew; btn.title = `Create ${path} on GitHub`; btn.setAttribute('aria-label', `Create ${path} on GitHub`); }
}
async function updateGhActionButtons() {
  const cfg = getGhCfgFromUIOrStorage();
  const sitemapBtn = document.getElementById('sitemap-gh-btn');
  const robotsBtn = document.getElementById('robots-gh-btn');
  const hasCfg = !!(cfg.owner && cfg.repo && cfg.branch);
  if (sitemapBtn) sitemapBtn.disabled = !hasCfg;
  if (robotsBtn) robotsBtn.disabled = !hasCfg;
  if (!hasCfg) return;
  try {
    const [siteExists, robotsExists] = await Promise.all([
      ghFileExists(cfg, 'sitemap.xml'),
      ghFileExists(cfg, 'robots.txt')
    ]);
    setGhBtnState(sitemapBtn, siteExists, 'sitemap.xml', window.openSitemapNew, window.openSitemapEdit);
    setGhBtnState(robotsBtn, robotsExists, 'robots.txt', window.openRobotsNew, window.openRobotsEdit);
  } catch (_) {
    if (sitemapBtn) setGhBtnState(sitemapBtn, false, 'sitemap.xml', window.openSitemapNew, window.openSitemapEdit);
    if (robotsBtn) setGhBtnState(robotsBtn, false, 'robots.txt', window.openRobotsNew, window.openRobotsEdit);
  }
}
window.updateGhActionButtons = updateGhActionButtons;

// Initial validation if slug present
validateSlugAndLoadBranches();
