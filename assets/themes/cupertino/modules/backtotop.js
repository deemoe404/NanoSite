const STATE_KEY = '__cupertinoBackToTop';

function getScrollRoot(doc) {
  return doc.scrollingElement || doc.documentElement || doc.body;
}

function ensureState(doc) {
  if (!doc[STATE_KEY]) {
    doc[STATE_KEY] = {};
  }
  return doc[STATE_KEY];
}

export function mount(context = {}) {
  const doc = context.document || document;
  if (!doc || !doc.body) return context;

  const state = ensureState(doc);
  const scrollRoot = getScrollRoot(doc);

  let button = state.button || doc.querySelector('.cupertino-backtotop');
  if (!button) {
    button = doc.createElement('button');
    button.type = 'button';
    button.className = 'cupertino-backtotop';
    button.setAttribute('aria-label', 'Back to top');
    button.setAttribute('hidden', '');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </svg>`;
    doc.body.appendChild(button);
  }

  if (!state.button) {
    state.button = button;
  }

  if (!state.onClick) {
    state.onClick = (event) => {
      event.preventDefault();
      scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
    };
    button.addEventListener('click', state.onClick, { passive: false });
  }

  const updateVisibility = () => {
    if (!button) return;
    const offset = scrollRoot.scrollTop || 0;
    if (offset <= 10) {
      if (!button.hasAttribute('hidden')) {
        button.setAttribute('hidden', '');
      }
    } else {
      button.removeAttribute('hidden');
    }
  };

  if (!state.onScroll) {
    state.onScroll = () => updateVisibility();
    doc.addEventListener('scroll', state.onScroll, { passive: true });
  }

  updateVisibility();

  return context;
}
