import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, Globe, UserCircle, Mail, Lock, Chrome, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation, languages } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Load Google Identity Services
const loadGoogleScript = () => {
  return new Promise((resolve) => {
    if (window.google) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    document.head.appendChild(script);
  });
};

export default function AuthPage({ setUser, onAuthSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wallet = useTonWallet();
  const mode = searchParams.get('mode');
  
  const { language: lang, setLang } = useLanguage();
  const { t } = useTranslation(lang);
  const [isVerifying, setIsVerifying] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  
  // Email verification states
  const [showVerificationStep, setShowVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  
  // 2FA states
  const [show2FAStep, setShow2FAStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pending2FAEmail, setPending2FAEmail] = useState('');
  const [pending2FAPassword, setPending2FAPassword] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false); // Toggle for backup code input
  
  const [showUsernameStep, setShowUsernameStep] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const finishAuth = async (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('ton_city_token', data.token);
    // Dispatch event for MaintenanceOverlay
    window.dispatchEvent(new Event('ton-city-auth'));
    if (data.user) {
      setUser(data.user);
    }
    toast.success(t('loggedIn'));
    
    // Вызываем checkAuth из App.js для обновления глобального состояния
    if (onAuthSuccess) {
      await onAuthSuccess();
    }
    
    // Переходим на главную после обновления состояния
    navigate('/');
  };

  // Load Google OAuth script
  useEffect(() => {
    loadGoogleScript().then(() => {
      setGoogleLoaded(true);
    });
  }, []);

  // Initialize Google Sign In button
  useEffect(() => {
    if (googleLoaded && window.google && !showUsernameStep) {
      try {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
      } catch (e) {
        console.error('Google Sign In init error:', e);
      }
    }
  }, [googleLoaded, showUsernameStep]);

  const handleGoogleCallback = async (response) => {
    try {
      setIsVerifying(true);
      const res = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
  
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
  
      finishAuth(data);
    } catch (e) {
      toast.error(e.message || 'Google auth failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Google OAuth using redirect method (works on mobile)
  const handleGoogleSignIn = () => {
    // Check if user agreed to terms (only for registration)
    if (mode === 'register' && !agreementAccepted) {
      toast.error(t('mustAgreeToTerms') || 'You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Client ID not configured');
      return;
    }
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'email profile openid';
    const responseType = 'code';
    
    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', responseType);
    googleAuthUrl.searchParams.set('scope', scope);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    
    // Store current mode for after redirect
    localStorage.setItem('google_auth_mode', mode || 'login');
    
    // Redirect to Google
    window.location.href = googleAuthUrl.toString();
  };

  // Emergent Google OAuth - alternative method that doesn't require Google API keys
  const handleEmergentGoogleSignIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth?mode=login';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Handle Emergent OAuth callback (session_id in URL hash)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        handleEmergentCallback(sessionId);
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  const handleEmergentCallback = async (sessionId) => {
    try {
      setIsVerifying(true);
      const res = await fetch(`${API}/auth/google/emergent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Auth failed');
      }
      
      // Success
      localStorage.setItem('token', data.token);
      localStorage.setItem('ton_city_token', data.token);
      localStorage.setItem('ton_city_lang', lang);
      
      if (setUser) setUser(data.user);
      if (onAuthSuccess) onAuthSuccess(data.user, data.token);
      
      toast.success(lang === 'ru' ? 'Успешный вход через Google!' : 'Google login successful!');
      navigate('/');
    } catch (e) {
      console.error('Emergent auth error:', e);
      toast.error(e.message || 'Google auth failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEmailAuth = async () => {
    try {
      setIsVerifying(true);
      
      // Validation
      if (mode === 'register' && !username.trim()) {
        toast.error(lang === 'ru' ? 'Введите username' : 'Enter username');
        setIsVerifying(false);
        return;
      }
      if (!email.trim()) {
        toast.error(lang === 'ru' ? 'Введите email или username' : 'Enter email or username');
        setIsVerifying(false);
        return;
      }
      if (!password.trim()) {
        toast.error(lang === 'ru' ? 'Введите пароль' : 'Enter password');
        setIsVerifying(false);
        return;
      }

      if (mode === 'register' && !agreementAccepted) {
        toast.error(lang === 'ru' ? 'Необходимо принять пользовательское соглашение' : 'You must accept the terms of service');
        setIsVerifying(false);
        return;
      }

      // Для регистрации используем новый endpoint с верификацией email
      const endpoint = mode === 'register' ? `${API}/auth/register/initiate` : `${API}/auth/login`;

      // FingerprintJS OSS — visitor_id (для проверки мульти-аккаунтинга)
      // Turnstile — анти-бот проверка (невидимая)
      let visitorId = '';
      let turnstileToken = '';
      try {
        const [fp, ts] = await Promise.all([
          import('@/lib/fingerprint').then(m => m.getVisitorId()).catch(() => ''),
          import('@/lib/turnstile').then(m => m.getTurnstileToken(mode === 'register' ? 'register' : 'login')).catch(() => ''),
        ]);
        visitorId = fp || '';
        turnstileToken = ts || '';
      } catch { /* noop */ }

      const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, visitor_id: visitorId, turnstile_token: turnstileToken })
        }
      );
  
      // Читаем текст ответа и парсим как JSON
      const responseText = await res.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error("JSON parse error:", jsonErr, "Response:", responseText);
      }
      
      if (!res.ok) {
        // Показываем ошибку от сервера
        const errorMsg = data?.detail || data?.message || (lang === 'ru' ? 'Неверные данные для входа' : 'Invalid credentials');
        toast.error(errorMsg);
        setIsVerifying(false);
        return;
      }
  
      if (!data) {
        toast.error(lang === 'ru' ? 'Ошибка сервера' : 'Server error');
        setIsVerifying(false);
        return;
      }

      // Проверяем статус ответа для регистрации
      if (mode === 'register') {
        if (data.status === 'verification_sent') {
          // Нужно ввести код верификации
          setPendingEmail(email);
          setShowVerificationStep(true);
          toast.success(lang === 'ru' ? 'Код отправлен на email' : 'Code sent to email');
          setIsVerifying(false);
          return;
        } else if (data.status === 'registered' && data.token) {
          // SMTP не настроен - регистрация прошла сразу
          await finishAuth(data);
          return;
        }
      }
      
      // Проверяем требуется ли 2FA
      if (data.requires_2fa) {
        setPending2FAEmail(email);
        setPending2FAPassword(password);
        setShow2FAStep(true);
        toast.info(lang === 'ru' ? 'Введите код из приложения аутентификации' : 'Enter code from authenticator app');
        setIsVerifying(false);
        return;
      }

      await finishAuth(data);
    } catch (e) {
      console.error("Email auth error:", e);
      // Показываем понятное сообщение об ошибке
      if (e.message === 'Failed to fetch') {
        toast.error(lang === 'ru' ? 'Ошибка соединения с сервером' : 'Server connection error');
      } else if (e.message?.includes('body stream') || e.message?.includes('already read')) {
        // Техническая ошибка - показываем общее сообщение
        toast.error(lang === 'ru' ? 'Неверные данные для входа' : 'Invalid credentials');
      } else {
        toast.error(lang === 'ru' ? 'Ошибка авторизации' : 'Auth failed');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Подтверждение email кода
  const handleVerifyEmail = async () => {
    if (!verificationCode.trim()) {
      toast.error(t('enterCode'));
      return;
    }
    
    setIsVerifying(true);
    try {
      let visitorId = '';
      try {
        const mod = await import('@/lib/fingerprint');
        visitorId = await mod.getVisitorId();
      } catch { /* noop */ }

      const res = await fetch(`${API}/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: verificationCode.trim(), visitor_id: visitorId })
      });
      
      const responseText = await res.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error("JSON parse error:", jsonErr);
        toast.error(t('serverError'));
        return;
      }
      
      if (!res.ok) {
        toast.error(data?.detail || t('invalidCode'));
        return;
      }
      
      if (data.token) {
        toast.success(t('emailVerified'));
        await finishAuth(data);
      }
    } catch (e) {
      console.error("Verify error:", e);
      toast.error(t('verificationFailed'));
    } finally {
      setIsVerifying(false);
    }
  };
  
  // Обработка входа с 2FA кодом
  const handle2FALogin = async () => {
    const codeToCheck = totpCode.trim();
    const minLength = useBackupCode ? 8 : 6;
    
    if (!codeToCheck || codeToCheck.length < minLength) {
      toast.error(useBackupCode ? t('enter8CharBackupCode') : t('enter6DigitCode'));
      return;
    }
    
    setIsVerifying(true);
    try {
      let visitorId = '';
      let turnstileToken = '';
      try {
        const [fp, ts] = await Promise.all([
          import('@/lib/fingerprint').then(m => m.getVisitorId()).catch(() => ''),
          import('@/lib/turnstile').then(m => m.getTurnstileToken('login')).catch(() => ''),
        ]);
        visitorId = fp || '';
        turnstileToken = ts || '';
      } catch { /* noop */ }

      const res = await fetch(`${API}/auth/login-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: pending2FAEmail, 
          password: pending2FAPassword, 
          totp_code: codeToCheck,
          visitor_id: visitorId,
          turnstile_token: turnstileToken
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data?.detail || t('invalid2FACode'));
        return;
      }
      
      if (data.token) {
        await finishAuth(data);
      }
    } catch (e) {
      console.error("2FA login error:", e);
      toast.error(t('authFailed'));
    } finally {
      setIsVerifying(false);
    }
  };


  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('ton_city_lang', newLang);
  };

  const title = showUsernameStep 
    ? t('completeRegistration')
    : (mode === 'register' ? t('registerTitle') : t('loginTitle'));

  // Используем ref чтобы отслеживать уже обработанные кошельки и избежать двойных уведомлений
  const [walletProcessed, setWalletProcessed] = useState(false);
  
  useEffect(() => {
    const verifyWallet = async () => {
      // Пропускаем если уже обрабатывали этот кошелёк или токен уже есть
      if (walletProcessed || localStorage.getItem('token')) return;
      
      if (wallet?.account?.address && !isVerifying && !showUsernameStep) {
        setIsVerifying(true);
        setWalletProcessed(true); // Отмечаем что начали обработку
        try {
          const response = await fetch(`${API}/auth/verify-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                address: wallet.account.address,
                language: lang,
                username: username,
                email: email,      
                password: password 
              })
          });

          const responseText = await response.text();
          let data = null;
          
          try {
            data = JSON.parse(responseText);
          } catch (jsonErr) {
            console.error("JSON parse error in verifyWallet:", jsonErr, "Response:", responseText);
            toast.error(lang === 'ru' ? 'Ошибка соединения с сервером' : 'Server connection error');
            return;
          }

          if (!response.ok) {
            throw new Error(data?.detail || 'Auth failed');
          }

          if (data.status === 'need_username') {
            setShowUsernameStep(true);
            toast.info(t('createNickname'));
          } else if (data.token) {
            // Используем finishAuth для правильной обработки
            finishAuth(data);
          }
        } catch (error) {
          console.error("Auth error:", error);
          setWalletProcessed(false); // Сбрасываем при ошибке
          if (error.message === 'Failed to fetch') {
            toast.error(t('serverConnectionError'));
          } else {
            toast.error(error.message);
          }
        } finally {
          setIsVerifying(false);
        }
      }
    };

    verifyWallet();
  }, [wallet?.account?.address, lang, navigate, walletProcessed]);

  const handleFinalRegister = async () => {
    if (!username.trim()) {
      toast.error(t('enterUsername'));
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`${API}/auth/verify-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: wallet.account.address,
          language: lang,
          username: username.trim(),
          email: email,
          password: password
        })
      });

      const responseText = await response.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error("JSON parse error:", jsonErr, "Response:", responseText);
        toast.error(t('serverError'));
        return;
      }

      if (response.ok && data.token) {
        // Используем finishAuth для корректной обработки
        finishAuth(data);
      } else {
        toast.error(data?.detail || "Error");
      }
    } catch (e) {
      console.error("Registration error:", e);
      toast.error(t('serverConnectionError'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4 relative font-rajdhani">
      <div className="absolute top-6 right-6 z-20">
        <Select value={lang} onValueChange={changeLang}>
          <SelectTrigger className="w-36 bg-panel/50 border-grid-border text-white border-white/10">
            <Globe className="w-4 h-4 mr-2 text-cyber-cyan" />
            <SelectValue>
              {languages.find(l => l.code === lang)?.flag} {languages.find(l => l.code === lang)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-panel border-white/10 text-white">
            {languages.map(language => (
              <SelectItem key={language.code} value={language.code}>
                <span className="flex items-center gap-2">
                  <span>{language.flag}</span>
                  <span>{language.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 rounded-3xl w-full max-w-md border border-white/10 text-center relative shadow-2xl"
      >
        <button 
          onClick={() => {
            if (showVerificationStep) {
              setShowVerificationStep(false);
            } else if (show2FAStep) {
              setShow2FAStep(false);
              setTotpCode('');
            } else if (showUsernameStep) {
              setShowUsernameStep(false);
            } else {
              navigate('/');
            }
          }} 
          className="absolute top-6 left-6 text-text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="w-16 h-16 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyber-cyan/20">
          <Building2 className="text-black w-10 h-10" />
        </div>

        <h1 className="font-unbounded text-xl font-bold text-white mb-8 tracking-tighter uppercase">
          {showVerificationStep 
            ? t('verifyEmail')
            : show2FAStep
            ? t('twoFactorAuth')
            : title
          }
        </h1>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {/* Email Verification Step */}
            {showVerificationStep ? (
              <motion.div 
                key="verification-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl mb-4">
                  <p className="text-cyber-cyan text-sm">
                    {t('codeSentToEmail')} {pendingEmail}
                  </p>
                </div>

                <div className="relative text-left">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                  <Input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('codeFromEmail')}
                    className="w-full pl-10 pr-4 py-3.5 bg-panel border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>

                <Button 
                  data-testid="verify-email-btn"
                  onClick={handleVerifyEmail}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="w-full bg-cyber-cyan text-black font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-cyber-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? t('verifyingCode') : t('verify')}
                </Button>

                <p className="text-text-muted text-xs mt-4">
                  {t('checkSpamFolder')}
                </p>
              </motion.div>
            ) : show2FAStep ? (
              /* 2FA Verification Step */
              <motion.div 
                key="2fa-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-4 bg-neon-purple/10 border border-neon-purple/20 rounded-xl mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-neon-purple" />
                    <span className="text-neon-purple text-sm font-bold">
                      {t('twoFactorAuthentication')}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    {useBackupCode ? t('enter8CharBackupCode') : t('enter6DigitCode')}
                  </p>
                </div>

                <div className="relative text-left">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-purple" />
                  <Input
                    type="text"
                    value={totpCode}
                    onChange={(e) => {
                      if (useBackupCode) {
                        setTotpCode(e.target.value.slice(0, 8).toUpperCase());
                      } else {
                        setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      }
                    }}
                    placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                    autoFocus
                    className={`w-full pl-10 pr-4 py-3.5 bg-panel border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-center text-2xl font-mono ${useBackupCode ? 'tracking-[0.3em]' : 'tracking-[0.5em]'}`}
                    maxLength={useBackupCode ? 8 : 6}
                  />
                </div>

                {/* Toggle for backup code */}
                <button 
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setTotpCode('');
                  }}
                  className="text-neon-purple text-xs hover:text-neon-purple/80 transition-colors underline"
                >
                  {useBackupCode ? t('useAppCode') : t('useBackupCode')}
                </button>

                <Button 
                  data-testid="verify-2fa-btn"
                  onClick={handle2FALogin}
                  disabled={isVerifying || totpCode.length !== (useBackupCode ? 8 : 6)}
                  className="w-full bg-neon-purple text-white font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-neon-purple/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? t('verifyingCode') : t('signIn')}
                </Button>

                <button 
                  onClick={() => {
                    setShow2FAStep(false);
                    setTotpCode('');
                    setUseBackupCode(false);
                  }}
                  className="text-text-muted text-xs hover:text-white transition-colors"
                >
                  {t('backToLogin')}
                </button>
              </motion.div>
            ) : showUsernameStep ? (
              <motion.div 
                key="username-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl mb-4">
                  <p className="text-cyber-cyan text-xs uppercase tracking-widest flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> 
                    {t('walletConnected')}
                  </p>
                  <p className="text-white/40 text-[10px] mt-1 truncate">
                    {wallet?.account?.address}
                  </p>
                </div>

                <div className="relative text-left">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                  <input 
                    placeholder={t('chooseUsername')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    className="w-full bg-white/5 border border-cyber-cyan/50 p-3 pl-10 rounded-xl text-white outline-none shadow-[0_0_15px_rgba(0,255,243,0.05)] focus:border-cyber-cyan transition-all"
                  />
                </div>

                <Button 
                  onClick={handleFinalRegister}
                  disabled={isVerifying}
                  className="w-full bg-cyber-cyan text-black font-bold py-6 hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-cyber-cyan/20"
                >
                  {isVerifying ? t('creating') : t('startGame')}
                </Button>
              </motion.div>
            ) : (
              <motion.div 
                key="login-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {mode === 'register' && (
                  <div className="relative text-left">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                    <input 
                      placeholder={t('chooseUsername')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                    />
                  </div>
                )}

                <div className="relative text-left">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input 
                    type="text"
                    placeholder={mode === 'register' ? 'Email' : (lang === 'ru' ? 'Email или Username' : 'Email or Username')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEmailAuth()}
                    className="w-full bg-white/5 border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                  />
                </div>

                <div className="relative text-left">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEmailAuth()}
                    className="w-full bg-white/5 border border-white/10 p-3 pl-10 pr-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                    data-testid="toggle-password-visibility"
                    tabIndex={-1}
                  >
                    {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>

                {/* Agreement checkbox - only for registration */}
                {mode === 'register' && (
                  <div className="flex items-center justify-center gap-3 text-center">
                    <input
                      type="checkbox"
                      id="agreement"
                      checked={agreementAccepted}
                      onChange={(e) => setAgreementAccepted(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 bg-transparent accent-cyan-400 cursor-pointer"
                    />
                    <label htmlFor="agreement" className="text-xs text-gray-400 cursor-pointer leading-relaxed">
                      {t('agreeTerms')} <a href="/terms" className="text-cyber-cyan underline hover:text-white">{t('termsOfService')}</a> {t('and')} <a href="/privacy" className="text-cyber-cyan underline hover:text-white">{t('privacyPolicy')}</a> {t('gameDisclaimer')}
                    </label>
                  </div>
                )}

                <Button 
                  onClick={handleEmailAuth}
                  disabled={isVerifying || (mode === 'register' && !agreementAccepted)}
                  className="w-full bg-cyber-cyan text-black font-bold py-6 hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-cyber-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isVerifying ? '...' : (mode === 'register' ? t('createAccount') : t('signIn'))}
                </Button>

                {/* Кнопки переключения между входом и регистрацией */}
                <div className="flex items-center justify-center gap-4 text-sm">
                  {mode !== 'register' ? (
                    <>
                      <button 
                        onClick={() => navigate('/forgot-password')}
                        className="text-text-muted hover:text-cyber-cyan transition-colors"
                      >
                        {t('forgotPassword')}
                      </button>
                      <span className="text-white/20">|</span>
                      <button 
                        onClick={() => navigate('/auth?mode=register')}
                        className="text-cyber-cyan hover:text-cyber-cyan/80 transition-colors font-medium"
                      >
                        {t('register')}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => navigate('/auth?mode=login')}
                      className="text-cyber-cyan hover:text-cyber-cyan/80 transition-colors font-medium"
                    >
                      {t('alreadyHaveAccount')}
                    </button>
                  )}
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="mx-4 text-text-muted text-[10px] uppercase tracking-[0.2em]">{t('orVia')}</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={handleGoogleSignIn}
                    disabled={!googleLoaded || isVerifying || (mode === 'register' && !agreementAccepted)}
                    variant="outline" 
                    className="border-white/10 hover:bg-white/5 py-6 text-xs uppercase tracking-widest disabled:opacity-50">
                    <Chrome className="w-4 h-4 mr-2" /> {t('google')}
                  </Button>
                  <div
                    data-testid="ton-connect-wrapper"
                    className={`relative flex items-center justify-center rounded-xl overflow-hidden group
                      bg-gradient-to-br from-[#0098ea] to-[#0079c0]
                      border border-[#0098ea]/60 hover:border-[#30a9ef]
                      shadow-[0_4px_18px_-4px_rgba(0,152,234,0.55)]
                      hover:shadow-[0_6px_24px_-4px_rgba(0,152,234,0.85)]
                      transition-all duration-200
                      ${(mode === 'register' && !agreementAccepted) ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={(e) => {
                      if (mode === 'register' && !agreementAccepted) {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error(t('mustAgreeToTerms') || 'You must agree to the Terms of Service and Privacy Policy');
                      }
                    }}
                  >
                    {/* Subtle shine overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="relative scale-90 group-hover:scale-[0.95] transition-transform">
                      <TonConnectButton />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-4 mt-2">
            {isVerifying && (
              <p className="text-cyber-cyan text-[10px] animate-pulse font-mono uppercase tracking-[0.3em]">
                {t('verifying')}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}