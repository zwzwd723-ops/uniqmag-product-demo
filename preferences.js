/* Interface preferences are separate from product, invitation and template data. */
(() => {
  'use strict';
  const key = 'uniqmag-interface-preferences-v1';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
  let saved = read();
  let language = saved.language === 'en' ? 'en' : 'zh-CN';
  let theme = ['light', 'dark'].includes(saved.theme) ? saved.theme : systemTheme.matches ? 'dark' : 'light';
  let bannerObserver;
  const icons = {
    language: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 5h12M9 3v2M5 5c0 5 4 9 8 11M13 5c0 5-4 9-9 12M14 21l4-10 4 10M15.5 17h5"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg>'
  };
  function sync() {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-preference]').forEach(button => {
      const isLanguage = button.dataset.preference === 'language';
      const selected = isLanguage ? language : theme;
      const name = isLanguage ? (language === 'en' ? 'Language' : '语言') : (language === 'en' ? 'Theme' : '黑白模式');
      button.querySelector('.preference-name').textContent = name;
      button.setAttribute('aria-label', isLanguage ? (language === 'en' ? 'English language' : '使用英文') : (language === 'en' ? 'Dark mode' : '深色模式'));
      button.setAttribute('aria-checked', String(isLanguage ? language === 'en' : theme === 'dark'));
      button.querySelectorAll('[data-choice]').forEach(choice => choice.classList.toggle('is-active', choice.dataset.choice === selected));
      if (!isLanguage) {
        button.querySelector('[data-choice="light"]').textContent = language === 'en' ? 'Light' : '白';
        button.querySelector('[data-choice="dark"]').textContent = language === 'en' ? 'Dark' : '黑';
      }
    });
  }
  function notify() {
    sync();
    document.dispatchEvent(new CustomEvent('library:preferences-change', {detail: {language, theme}}));
  }
  function change(name) {
    if (name === 'language') language = language === 'en' ? 'zh-CN' : 'en';
    else if (name === 'theme') theme = theme === 'dark' ? 'light' : 'dark';
    else return;
    saved = {...saved, [name]: name === 'language' ? language : theme};
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* Choices still work for this page when storage is unavailable. */ }
    notify();
  }
  window.LibraryPreferences = {
    get language() { return language; },
    get theme() { return theme; },
    sync,
    controls() {
      return `<div class="sidebar-preferences" data-no-translate>${['language','theme'].map(name => `<button type="button" class="preference-switch" role="switch" data-preference="${name}" aria-checked="false"><span class="preference-icon">${icons[name]}</span><span class="preference-name"></span><span class="preference-track" aria-hidden="true">${name === 'language' ? '<span data-choice="zh-CN">中文</span><span data-choice="en">EN</span>' : '<span data-choice="light">白</span><span data-choice="dark">黑</span>'}</span></button>`).join('')}</div>`;
    },
    attachBanner() {
      bannerObserver?.disconnect();
      const banner = document.querySelector('.demo-banner');
      if (!banner) return;
      const resize = () => document.documentElement.style.setProperty('--notice-height', `${banner.getBoundingClientRect().height}px`);
      resize();
      bannerObserver = new ResizeObserver(resize);
      bannerObserver.observe(banner);
      sync();
    }
  };
  sync();
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-preference]');
    if (control) change(control.dataset.preference);
  });
  systemTheme.addEventListener('change', event => {
    if (!['light','dark'].includes(saved.theme)) { theme = event.matches ? 'dark' : 'light'; notify(); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    saved = read();
    language = saved.language === 'en' ? 'en' : 'zh-CN';
    theme = ['light','dark'].includes(saved.theme) ? saved.theme : systemTheme.matches ? 'dark' : 'light';
    notify();
  });
})();
