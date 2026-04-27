import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function GoogleCallback({ setUser, onAuthSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    
    if (errorParam) {
      setError('Авторизация отменена');
      toast.error('Google авторизация отменена');
      setTimeout(() => navigate('/auth?mode=login'), 2000);
      return;
    }
    
    if (code) {
      handleGoogleCallback(code);
    } else {
      setError('Код авторизации не получен');
      setTimeout(() => navigate('/auth?mode=login'), 2000);
    }
  }, [searchParams]);
  
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
        throw new Error(data.detail || 'Ошибка авторизации');
      }
      
      // Success - save token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('ton_city_token', data.token);
      
      if (setUser && data.user) {
        setUser(data.user);
      }
      
      // Dispatch auth event
      window.dispatchEvent(new Event('ton-city-auth'));
      
      if (onAuthSuccess) {
        await onAuthSuccess();
      }
      
      toast.success('Успешный вход через Google!');
      navigate('/');
      
    } catch (e) {
      console.error('Google callback error:', e);
      setError(e.message || 'Ошибка авторизации через Google');
      toast.error(e.message || 'Ошибка авторизации');
      setTimeout(() => navigate('/auth?mode=login'), 3000);
    }
  };
  
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="text-center p-8">
        {error ? (
          <div className="text-red-400">
            <p className="text-xl mb-2">Ошибка</p>
            <p className="text-sm text-text-muted">{error}</p>
            <p className="text-xs text-text-muted mt-4">Перенаправление...</p>
          </div>
        ) : (
          <div className="text-cyber-cyan">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">Авторизация через Google...</p>
            <p className="text-sm text-text-muted mt-2">Пожалуйста, подождите</p>
          </div>
        )}
      </div>
    </div>
  );
}
