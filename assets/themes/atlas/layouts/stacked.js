export function apply(ctx) {
  const { container, sidebar, onCleanup, addClass } = ctx;
  if (!container || !sidebar) return;
  const placeholder = document.createComment('atlas-sidebar-anchor');
  const originalParent = sidebar.parentNode;
  if (originalParent) originalParent.insertBefore(placeholder, sidebar);
  container.appendChild(sidebar);
  addClass(document.documentElement, 'atlas-layout-stacked-active');
  addClass(container, 'atlas-layout-stacked-container');
  addClass(sidebar, 'atlas-layout-stacked-sidebar');
  onCleanup(() => {
    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(sidebar, placeholder);
      placeholder.remove();
    } else if (container.contains(sidebar)) {
      container.removeChild(sidebar);
    }
  });
}

export default { apply };
