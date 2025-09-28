export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.cupertino-content');
  const stageWrap = regions.stageWrap || doc.querySelector('.cupertino-stage-wrap');
  const container = stageWrap || content;
  if (!doc || !container) return context;

  let mainview = container.querySelector('#mainview');
  if (!mainview) {
    mainview = doc.createElement('section');
    mainview.id = 'mainview';
    mainview.className = 'cupertino-stage box';
    const aside = container.querySelector('.cupertino-stage-aside');
    if (aside) {
      container.insertBefore(mainview, aside);
    } else {
      container.appendChild(mainview);
    }
  } else {
    mainview.classList.add('cupertino-stage', 'box');
    const aside = container.querySelector('.cupertino-stage-aside');
    if (mainview.parentElement !== container) {
      if (aside) container.insertBefore(mainview, aside);
      else container.appendChild(mainview);
    }
  }

  const stageAside = regions.stageAside || container.querySelector('.cupertino-stage-aside');
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');

  const syncSidebarLoading = () => {
    if (!stageAside) return;
    const isLoading = sidebar ? sidebar.classList.contains('loading') : false;
    stageAside.classList.toggle('loading', isLoading);
  };

  syncSidebarLoading();

  if (stageAside) {
    try {
      if (stageAside.__cupertinoSidebarObserver) {
        stageAside.__cupertinoSidebarObserver.disconnect();
      }
    } catch (_) {}
  }

  if (sidebar && stageAside) {
    try {
      const sidebarObserver = new MutationObserver(syncSidebarLoading);
      sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
      stageAside.__cupertinoSidebarObserver = sidebarObserver;
    } catch (_) {}
  }
  const applyLayoutState = () => {
    const hasArticle = !!(mainview.querySelector('article') || mainview.querySelector('.post-meta-card'));
    if (content) content.classList.toggle('post-layout', hasArticle);
    container.classList.toggle('post-layout', hasArticle);
    mainview.classList.toggle('post-layout', hasArticle);
    if (stageAside) {
      if (hasArticle) stageAside.removeAttribute('hidden');
      else stageAside.setAttribute('hidden', '');
    }
  };

  applyLayoutState();

  try {
    if (mainview.__cupertinoLayoutObserver) {
      mainview.__cupertinoLayoutObserver.disconnect();
    }
  } catch (_) {}

  try {
    const observer = new MutationObserver(applyLayoutState);
    observer.observe(mainview, { childList: true, subtree: true });
    mainview.__cupertinoLayoutObserver = observer;
  } catch (_) {}

  context.regions = { ...regions, mainview };
  return { regions: { ...regions, mainview } };
}
