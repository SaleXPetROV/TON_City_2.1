// Synchronous-friendly language bootstrap.
// Resolves the user's preferred language BEFORE the React tree mounts,
// so the UI never renders in the wrong language and then flickers.

const SUPPORTED = ['en', 'ru', 'es', 'zh', 'fr', 'de', 'ja', 'ko'];

const COUNTRY_TO_LANG = {
  // Russian-speaking
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', TJ: 'ru', UZ: 'ru', AM: 'ru', AZ: 'ru', MD: 'ru',
  // Spanish-speaking
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es',
  CU: 'es', DO: 'es', HN: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', PR: 'es', UY: 'es', PY: 'es', BO: 'es',
  // Chinese-speaking
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
  // French-speaking
  FR: 'fr', BE: 'fr', CH: 'fr', CA: 'fr', LU: 'fr', MC: 'fr',
  // German-speaking
  DE: 'de', AT: 'de',
  // Japanese
  JP: 'ja',
  // Korean
  KR: 'ko',
  // English-speaking (default)
  US: 'en', GB: 'en', AU: 'en', NZ: 'en', IE: 'en', ZA: 'en', IN: 'en',
};

const STORAGE_KEY = 'ton_city_lang';
const DETECTED_FLAG = 'ton_city_lang_geo_detected';

export const SUPPORTED_LANGS = SUPPORTED;

function browserFallback() {
  try {
    const browserLang = navigator.language?.slice(0, 2);
    if (SUPPORTED.includes(browserLang)) return browserLang;
  } catch {}
  return 'en';
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    promise.then(
      (val) => { if (!done) { done = true; clearTimeout(t); resolve(val); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(null); } }
    );
  });
}

async function fetchCountryCode() {
  // Try several free providers; return first country code we get.
  const providers = [
    async () => {
      const r = await fetch('https://ipapi.co/json/', { mode: 'cors' });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.country_code || d?.country || null;
    },
    async () => {
      const r = await fetch('https://ipwho.is/');
      if (!r.ok) return null;
      const d = await r.json();
      return d?.country_code || null;
    },
  ];
  for (const p of providers) {
    const cc = await withTimeout(p().catch(() => null), 1500);
    if (cc) return cc;
  }
  return null;
}

/**
 * Resolve the language to use BEFORE first render and persist it to localStorage.
 * Order:
 *   1) explicit user choice (localStorage)
 *   2) IP geolocation (one-time, cached via DETECTED_FLAG)
 *   3) browser language
 *   4) 'en'
 */
export async function bootstrapLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) {
      // If user already picked a language, respect it. No detection.
      return stored;
    }

    // First-time visit (or never auto-detected): try geo detection now.
    const alreadyDetected = localStorage.getItem(DETECTED_FLAG) === '1';
    if (!alreadyDetected) {
      const cc = await fetchCountryCode();
      const detected = cc ? COUNTRY_TO_LANG[cc.toUpperCase()] : null;
      localStorage.setItem(DETECTED_FLAG, '1');
      if (detected && SUPPORTED.includes(detected)) {
        localStorage.setItem(STORAGE_KEY, detected);
        return detected;
      }
    }

    const fallback = browserFallback();
    localStorage.setItem(STORAGE_KEY, fallback);
    return fallback;
  } catch {
    return browserFallback();
  }
}
