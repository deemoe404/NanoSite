export function setupSearch(entries){
  const input = document.getElementById('searchInput');
  if (!input) return;
  const container = document.getElementById('mainview');
  const cards = () => Array.from(container.querySelectorAll('.index a'));
  const titles = entries.map(([t]) => String(t || '').toLowerCase());
  input.value = '';
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    cards().forEach((el, idx) => {
      const match = !q || titles[idx].includes(q);
      el.style.display = match ? '' : 'none';
    });
  };
}

