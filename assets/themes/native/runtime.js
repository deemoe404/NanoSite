export function activate(context) {
  if (!context) return {};
  const { addBodyClass, registerCleanup, root } = context;
  addBodyClass('theme-native-active');
  if (root) {
    root.setAttribute('data-theme-shell', 'two-column');
    registerCleanup(() => {
      if (root.getAttribute('data-theme-shell') === 'two-column') {
        root.removeAttribute('data-theme-shell');
      }
    });
  }

  return {
    applySiteConfig() {},
    deactivate() {}
  };
}
