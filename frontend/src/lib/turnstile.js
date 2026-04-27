/**
 * Cloudflare Turnstile helper — невидимый анти-бот CAPTCHA.
 * Загружает скрипт один раз, рендерит виджет в переданный контейнер,
 * возвращает promise с токеном. Non-interactive mode — если Cloudflare
 * считает юзера ботом, challenge всплывёт автоматически.
 *
 * Usage:
 *   const token = await getTurnstileToken('login');
 *   fetch(api, { body: JSON.stringify({ ..., turnstile_token: token }) })
 */

const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let _scriptPromise = null;

function _loadScript() {
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

/**
 * Получить Turnstile токен для действия (register/login/withdraw).
 * Возвращает строку-токен или '' если site key не настроен (dry-run).
 * Никогда не бросает — при ошибке возвращает '' (backend сам разберётся).
 */
export async function getTurnstileToken(action = 'default') {
  if (!SITE_KEY) return '';

  return new Promise((resolve) => {
    let resolved = false;
    const done = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    // Safety timeout — 10s
    const timeout = setTimeout(() => done(''), 10000);

    _loadScript()
      .then((turnstile) => {
        // Create a hidden container just for this challenge
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.style.top = '-10000px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);

        const cleanup = () => {
          clearTimeout(timeout);
          try {
            turnstile.remove(widgetId);
          } catch { /* ignore */ }
          try {
            container.remove();
          } catch { /* ignore */ }
        };

        const widgetId = turnstile.render(container, {
          sitekey: SITE_KEY,
          size: 'invisible',
          action,
          callback: (token) => {
            cleanup();
            done(token || '');
          },
          'error-callback': () => {
            cleanup();
            done('');
          },
          'timeout-callback': () => {
            cleanup();
            done('');
          },
        });

        // Non-interactive mode auto-executes, but call explicitly just in case
        try {
          turnstile.execute(widgetId);
        } catch { /* ignore */ }
      })
      .catch(() => done(''));
  });
}
