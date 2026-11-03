'use strict';
(() => {
  const root = document.documentElement;
  const button = document.getElementById('reader-lang');
  function setLanguage(english) {
    root.lang = english ? 'en' : 'zh-CN';
    root.classList.toggle('reader-en', english);
    button.textContent = english ? '中文' : 'English';
    for (const a of document.querySelectorAll('a[href]')) {
      const u = new URL(a.href);
      if (!u.pathname.endsWith('.html')) continue;
      if (english) u.searchParams.set('lang', 'en');
      else u.searchParams.delete('lang');
      a.href = u.href;
    }
  }
  setLanguage(new URLSearchParams(location.search).get('lang') === 'en');
  button.addEventListener('click', () => setLanguage(root.lang !== 'en'));
})();
