import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const SUPPORTED = ['en', 'ru', 'es', 'zh', 'fr', 'de', 'ja', 'ko'];

// NOTE: IP-based geolocation is performed BEFORE React mounts in `index.js`
// (see `lib/languageBootstrap.js`). By the time this provider runs the
// resolved language is already in localStorage, so the very first render
// uses the correct language — no flicker.
function resolveInitialLang(user) {
  try {
    const stored = localStorage.getItem('ton_city_lang');
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  if (user?.language && SUPPORTED.includes(user.language)) return user.language;
  try {
    const browserLang = navigator.language?.slice(0, 2);
    if (SUPPORTED.includes(browserLang)) return browserLang;
  } catch {}
  return 'en';
}

export const LanguageProvider = ({ children, user }) => {
  const [lang, setLangState] = useState(() => resolveInitialLang(user));

  // If we get a logged-in user with a saved preference and the visitor
  // has NEVER explicitly chosen a language locally, sync once.
  useEffect(() => {
    const stored = localStorage.getItem('ton_city_lang');
    if (!stored && user?.language && SUPPORTED.includes(user.language) && user.language !== lang) {
      setLangState(user.language);
      localStorage.setItem('ton_city_lang', user.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.language]);

  const setLang = (newLang) => {
    setLangState(newLang);
    try { localStorage.setItem('ton_city_lang', newLang); } catch {}
    // Force re-render across app
    window.dispatchEvent(new Event('languageChange'));
  };

  return (
    <LanguageContext.Provider value={{ language: lang, lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback when used outside provider
    let stored = 'en';
    try { stored = localStorage.getItem('ton_city_lang') || 'en'; } catch {}
    return {
      language: stored,
      lang: stored,
      setLang: (l) => { try { localStorage.setItem('ton_city_lang', l); } catch {} },
    };
  }
  return context;
};

export default LanguageContext;
