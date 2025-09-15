import { fetchConfigWithYamlFallback } from './yaml.js';

function buildStatusFrag(text) {
  const frag = document.createDocumentFragment();
  const dot = document.createElement('span');
  dot.className = 'dot';
  frag.appendChild(dot);
  const label = document.createElement('span');
  label.textContent = String(text || '');
  frag.appendChild(label);
  return frag;
}

function setStatus(mode, content) {
  const box = document.getElementById('global-status');
  if (!box) return;
  box.className = `global-status ${mode || ''}`;
  while (box.firstChild) box.removeChild(box.firstChild);
  if (content == null || content === '') return;
  if (typeof content === 'string') box.appendChild(buildStatusFrag(content));
  else if (content instanceof Node) box.appendChild(content);
}

function renderRepoLink(owner, repo, branch, extraText) {
  const frag = document.createDocumentFragment();
  const dot = document.createElement('span');
  dot.className = 'dot';
  frag.appendChild(dot);
  if (!owner || !repo) {
    const label = document.createElement('span');
    label.textContent = 'No repository configured';
    frag.appendChild(label);
    return frag;
  }
  const a = document.createElement('a');
  a.href = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = `@${owner}/${repo}`;
  frag.appendChild(a);
  const tail = document.createElement('span');
  const btxt = branch ? ` (${branch})` : '';
  const extra = extraText ? ` · ${String(extraText)}` : '';
  tail.textContent = `${btxt}${extra}`;
  frag.appendChild(tail);
  return frag;
}

async function fetchRepoExists(owner, repo) {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (r.status === 404) return { ok: false, reason: 'not_found' };
    if (r.status === 403) return { ok: false, reason: 'rate_limited' };
    if (!r.ok) return { ok: false, reason: `error_${r.status}` };
    const data = await r.json().catch(() => ({}));
    return { ok: true, default_branch: data && data.default_branch || 'main' };
  } catch (e) {
    return { ok: false, reason: 'network', message: e && e.message };
  }
}

async function fetchBranchExists(owner, repo, branch) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (r.status === 404) return { ok: false, reason: 'not_found' };
    if (r.status === 403) return { ok: false, reason: 'rate_limited' };
    return { ok: r.ok };
  } catch (e) {
    return { ok: false, reason: 'network', message: e && e.message };
  }
}

async function initGithubStatus() {
  try {
    setStatus('warn', buildStatusFrag('Loading GitHub config…'));
    const cfg = await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
    const repo = (cfg && cfg.repo) || {};
    const owner = String(repo.owner || '').trim();
    const name = String(repo.name || '').trim();
    const branch = String(repo.branch || '').trim();

    if (!owner || !name) {
      setStatus('warn', buildStatusFrag('No repository configured in site.yaml'));
      return;
    }

    // Checking repository
    setStatus('warn', renderRepoLink(owner, name, branch || '', 'Checking…'));
    const repoInfo = await fetchRepoExists(owner, name);
    if (!repoInfo.ok) {
      if (repoInfo.reason === 'rate_limited') setStatus('err', renderRepoLink(owner, name, branch || '', 'GitHub rate limit, try later'));
      else if (repoInfo.reason === 'not_found') setStatus('err', renderRepoLink(owner, name, branch || '', 'Repository not found'));
      else setStatus('err', renderRepoLink(owner, name, branch || '', 'Repository check failed'));
      return;
    }

    // If branch missing in config, display repo OK using default branch hint
    if (!branch) {
      setStatus('ok', renderRepoLink(owner, name, repoInfo.default_branch || '', 'OK'));
      return;
    }

    // Checking branch
    setStatus('warn', renderRepoLink(owner, name, branch, 'Checking branch…'));
    const b = await fetchBranchExists(owner, name, branch);
    if (!b.ok) {
      if (b.reason === 'rate_limited') setStatus('err', renderRepoLink(owner, name, branch, 'Rate limited'));
      else if (b.reason === 'not_found') setStatus('err', renderRepoLink(owner, name, branch, 'Branch not found'));
      else setStatus('err', renderRepoLink(owner, name, branch, 'Branch check failed'));
      return;
    }

    setStatus('ok', renderRepoLink(owner, name, branch, 'OK'));
  } catch (e) {
    setStatus('err', buildStatusFrag('Failed to read site.yaml'));
  }
}

// Kick on load
try { initGithubStatus(); } catch (_) {}

