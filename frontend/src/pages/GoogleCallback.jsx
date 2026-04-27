import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function GoogleCallback({ setUser, onAuthSuccess }) {
  const { lang } = useLanguage();
  const { t } = useTranslation(lang);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  // StrictMode в dev вызывает useEffect дважды — предотвращаем повторную отправку
  const executed = useRef(false);

  useEffect(() => {
    if (executed.current) return;
    executed.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(t('googleAuthCancelled'));
      toast.error(t('googleAuthCancelled'));
      setTimeout(() => navigate('/auth?mode=login'), 2000);
      return;
    }

    if (code) {
      handleGoogleCallback(code);
    } else {
      setError(t('googleAuthNoCode'));
      setTimeout(() => navigate('/auth?mode=login'), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (code) => {
    try {
      const redirectUri = window.location.origin + '/auth/google/callback';

      const res = await fetch(`${API}/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || t('googleAuthFailed'));
      }

      // Success - save token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('ton_city_token', data.token);

      if (setUser && data.user) {
        setUser(data.user);
      }

      window.dispatchEvent(new Event('ton-city-auth'));

      if (onAuthSuccess) {
        await onAuthSuccess();
      }

      toast.success(t('googleLoginSuccess'));
      navigate('/');
    } catch (e) {
      console.error('Google callback error:', e);
      setError(e.message || t('googleAuthFailed'));
      toast.error(e.message || t('googleAuthFailed'));
      setTimeout(() => navigate('/auth?mode=login'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center" data-testid="google-callback-page">
      <div className="text-center p-8">
        {error ? (
          <div className="text-red-400">
            <p className="text-xl mb-2">{t('errorTitle')}</p>
            <p className="text-sm text-text-muted">{error}</p>
            <p className="text-xs text-text-muted mt-4">{t('redirecting')}</p>
          </div>
        ) : (
          <div className="text-cyber-cyan">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">{t('googleAuthInProgress')}</p>
            <p className="text-sm text-text-muted mt-2">{t('pleaseWait')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
