const HERO_EMPTY_CLASS = 'aurora-hero-empty';

export function registerLayouts({ registerLayoutPreset }) {
  registerLayoutPreset('aurora-split', {
    zones: {
      hero: ['site'],
      content: ['map', 'main'],
      aside: ['search', 'tags', 'tools', 'toc']
    },
    fallbackZone: 'aside',
    bodyClasses: ['layout-aurora'],
    rootClasses: ['aurora-root'],
    build({ root, appendZone }) {
      const shell = document.createElement('div');
      shell.className = 'aurora-shell';

      const hero = document.createElement('header');
      hero.className = 'aurora-hero';
      appendZone(hero, 'hero');

      const main = document.createElement('div');
      main.className = 'aurora-body';

      const content = document.createElement('main');
      content.className = 'aurora-content';
      appendZone(content, 'content');

      const aside = document.createElement('aside');
      aside.className = 'aurora-aside';
      appendZone(aside, 'aside');

      main.appendChild(content);
      main.appendChild(aside);

      shell.appendChild(hero);
      shell.appendChild(main);

      root.appendChild(shell);

      return {
        container: shell,
        hero,
        content,
        aside
      };
    }
  });
}

export function afterLayout({ root }) {
  if (!root) return;
  const hero = root.querySelector('.aurora-hero');
  if (hero) {
    if (!hero.children.length) {
      hero.classList.add(HERO_EMPTY_CLASS);
    } else {
      hero.classList.remove(HERO_EMPTY_CLASS);
    }
  }
}

export function cleanup() {
  // Nothing persistent to clean right now, but keep hook for parity with other packs
}
