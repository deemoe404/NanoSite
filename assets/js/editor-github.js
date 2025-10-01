import './cache-control.js';
import { fetchConfigWithYamlFallback } from './yaml.js';
import { t } from './i18n.js';

function setStatus(state, repoText, messageText) {
  const box = document.getElementById('global-status');
  if (!box) return;
  if (state) box.dataset.state = state;
  else box.removeAttribute('data-state');
  const repoEl = document.getElementById('globalStatusRepo');
  const messageEl = document.getElementById('globalStatusMessage');
  const arrowLabelEl = document.getElementById('globalArrowLabel');
  if (repoEl) repoEl.textContent = repoText ? String(repoText) : '';
  if (messageEl) messageEl.textContent = messageText ? String(messageText) : '';
  if (arrowLabelEl && box && !box.hasAttribute('data-dirty')) {
    if (state === 'ok') arrowLabelEl.textContent = t('editor.status.synced');
    else if (state === 'warn') arrowLabelEl.textContent = t('editor.github.status.arrowWarn');
    else if (state === 'err') arrowLabelEl.textContent = t('ui.error');
    else arrowLabelEl.textContent = t('editor.github.status.arrowDefault');
  }
}

function describeRepo(owner, repo, branch) {
  if (!owner || !repo) return t('editor.github.status.repoNotConfigured');
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
    setStatus(
      'warn',
      t('editor.github.status.loadingRepo'),
      t('editor.github.status.readingConfig')
    );
    const cfg = await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
    const repo = (cfg && cfg.repo) || {};
    const owner = String(repo.owner || '').trim();
    const name = String(repo.name || '').trim();
    const branch = String(repo.branch || '').trim();

    if (!owner || !name) {
      setStatus(
        'warn',
        t('editor.github.status.repoNotConfigured'),
        t('editor.github.status.repoConfigHint')
      );
      return;
    }

    // Checking repository
    setStatus(
      'warn',
      describeRepo(owner, name, branch || ''),
      t('editor.github.status.checkingRepo')
    );
    const repoInfo = await fetchRepoExists(owner, name);
    if (!repoInfo.ok) {
      if (repoInfo.reason === 'rate_limited') {
        setStatus(
          'err',
          describeRepo(owner, name, branch || ''),
          t('editor.github.status.rateLimited')
        );
      } else if (repoInfo.reason === 'not_found') {
        setStatus(
          'err',
          describeRepo(owner, name, branch || ''),
          t('editor.github.status.repoNotFound')
        );
      } else if (repoInfo.reason === 'network') {
        setStatus(
          'err',
          describeRepo(owner, name, branch || ''),
          t('editor.github.status.networkError')
        );
      } else {
        setStatus(
          'err',
          describeRepo(owner, name, branch || ''),
          t('editor.github.status.repoCheckFailed')
        );
      }
      return;
    }

    // If branch missing in config, display repo OK using default branch hint
    if (!branch) {
      const defaultBranch = repoInfo.default_branch || 'main';
      setStatus(
        'ok',
        describeRepo(owner, name, defaultBranch),
        t('editor.github.status.repoConnectedDefault', { branch: defaultBranch })
      );
      return;
    }

    // Checking branch
    setStatus(
      'warn',
      describeRepo(owner, name, branch),
      t('editor.github.status.checkingBranch')
    );
    const b = await fetchBranchExists(owner, name, branch);
    if (!b.ok) {
      if (b.reason === 'rate_limited') {
        setStatus('err', describeRepo(owner, name, branch), t('editor.github.status.rateLimited'));
      } else if (b.reason === 'not_found') {
        setStatus('err', describeRepo(owner, name, branch), t('editor.github.status.branchNotFound'));
      } else if (b.reason === 'network') {
        setStatus('err', describeRepo(owner, name, branch), t('editor.github.status.networkError'));
      } else {
        setStatus('err', describeRepo(owner, name, branch), t('editor.github.status.branchCheckFailed'));
      }
      return;
    }

    setStatus('ok', describeRepo(owner, name, branch), t('editor.github.status.repoConnected'));
  } catch (e) {
    setStatus(
      'err',
      t('editor.github.status.configUnavailable'),
      t('editor.github.status.readFailed')
    );
  }
}

// Kick on load
try { initGithubStatus(); } catch (_) {}

