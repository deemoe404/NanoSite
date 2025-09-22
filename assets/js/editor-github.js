import { fetchConfigWithYamlFallback } from './yaml.js';

function setStatus(state, repoText, messageText) {
  const box = document.getElementById('global-status');
  if (!box) return;
  if (state) box.dataset.state = state;
  else box.removeAttribute('data-state');
  const repoEl = document.getElementById('globalStatusRepo');
  const messageEl = document.getElementById('globalStatusMessage');
  if (repoEl) repoEl.textContent = repoText ? String(repoText) : '';
  if (messageEl) messageEl.textContent = messageText ? String(messageText) : '';
}

function describeRepo(owner, repo, branch) {
  if (!owner || !repo) return 'GitHub repository not configured';
  const base = `@${owner}/${repo}`;
  return branch ? `${base} (${branch})` : base;
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
    setStatus('warn', 'Loading GitHub settings…', 'Reading site.yaml for GitHub connection details…');
    const cfg = await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
    const repo = (cfg && cfg.repo) || {};
    const owner = String(repo.owner || '').trim();
    const name = String(repo.name || '').trim();
    const branch = String(repo.branch || '').trim();

    if (!owner || !name) {
      setStatus(
        'warn',
        'GitHub repository not configured',
        'Add repo.owner and repo.name to site.yaml to enable pushing your drafts.'
      );
      return;
    }

    // Checking repository
    setStatus('warn', describeRepo(owner, name, branch || ''), 'Checking repository access…');
    const repoInfo = await fetchRepoExists(owner, name);
    if (!repoInfo.ok) {
      if (repoInfo.reason === 'rate_limited') {
        setStatus('err', describeRepo(owner, name, branch || ''), 'GitHub rate limit hit. Try again later.');
      } else if (repoInfo.reason === 'not_found') {
        setStatus('err', describeRepo(owner, name, branch || ''), 'Repository not found on GitHub.');
      } else if (repoInfo.reason === 'network') {
        setStatus('err', describeRepo(owner, name, branch || ''), 'Could not reach GitHub. Check your connection.');
      } else {
        setStatus('err', describeRepo(owner, name, branch || ''), 'Repository check failed.');
      }
      return;
    }

    // If branch missing in config, display repo OK using default branch hint
    if (!branch) {
      const defaultBranch = repoInfo.default_branch || 'main';
      setStatus(
        'ok',
        describeRepo(owner, name, defaultBranch),
        `Repository connected. Default branch “${defaultBranch}”. Push drafts when you are ready.`
      );
      return;
    }

    // Checking branch
    setStatus('warn', describeRepo(owner, name, branch), 'Checking branch access…');
    const b = await fetchBranchExists(owner, name, branch);
    if (!b.ok) {
      if (b.reason === 'rate_limited') setStatus('err', describeRepo(owner, name, branch), 'GitHub rate limit hit. Try again later.');
      else if (b.reason === 'not_found') setStatus('err', describeRepo(owner, name, branch), 'Branch not found on GitHub.');
      else if (b.reason === 'network') setStatus('err', describeRepo(owner, name, branch), 'Could not reach GitHub. Check your connection.');
      else setStatus('err', describeRepo(owner, name, branch), 'Branch check failed.');
      return;
    }

    setStatus('ok', describeRepo(owner, name, branch), 'Repository and branch verified. Push drafts to publish your changes.');
  } catch (e) {
    setStatus('err', 'GitHub configuration unavailable', 'Failed to read site.yaml.');
  }
}

// Kick on load
try { initGithubStatus(); } catch (_) {}

