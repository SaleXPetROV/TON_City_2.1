import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';
import { 
  Building2, User, Mail, Lock, Wallet, 
  Camera, Save, Globe, Shield, LogOut, Link2, Unlink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { languages, useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function SettingsPage({ user: propUser, setUser: setAppUser, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [user, setUser] = useState(propUser);
  const [loading, setLoading] = useState(!propUser);
  const { language: lang, setLang } = useLanguage();
  const { t } = useTranslation(lang);
  
  // Ref for wallet section scrolling
  const walletSectionRef = useState(null);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState(''); // Separate password for email change
  const [saving, setSaving] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  
  // Email change states
  const [emailChangeStep, setEmailChangeStep] = useState(0); // 0=initial, 1=verify old email, 2=enter new email, 3=verify new email
  const [oldEmailCode, setOldEmailCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmailCode, setNewEmailCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  
  // Telegram Deep Linking
  const [telegramUsername, setTelegramUsername] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramLinkToken, setTelegramLinkToken] = useState(null);
  const [telegramBotLink, setTelegramBotLink] = useState('');

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
      setUsername(propUser.username || '');
      setEmail(propUser.email || '');
      setTelegramUsername(propUser.telegram_username || '');
      setLoading(false);
    } else {
      checkAuth();
    }
  }, [propUser]);

  // Scroll to wallet section if tab=wallet param is present
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'wallet' && !loading) {
      // Function to scroll to wallet section
      const scrollToWallet = () => {
        const walletSection = document.getElementById('wallet-section');
        if (walletSection) {
          // Calculate position
          const rect = walletSection.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const targetY = rect.top + scrollTop - 100;
          
          // Force scroll on mobile using multiple methods
          // Method 1: Standard smooth scroll
          window.scrollTo({
            top: targetY,
            behavior: 'smooth'
          });
          
          // Method 2: For iOS/Safari - use scrollIntoView as backup
          setTimeout(() => {
            walletSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }, 100);
          
          // Flash highlight effect
          walletSection.classList.add('ring-2', 'ring-cyan-500', 'ring-opacity-50');
          setTimeout(() => {
            walletSection.classList.remove('ring-2', 'ring-cyan-500', 'ring-opacity-50');
          }, 2500);
        }
      };
      
      // Multiple attempts for mobile - longer delays
      const timers = [
        setTimeout(scrollToWallet, 300),
        setTimeout(scrollToWallet, 800),
        setTimeout(scrollToWallet, 1500),
        setTimeout(scrollToWallet, 2500)
      ];
      
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [searchParams, loading]);

  // Обработка привязки кошелька через TonConnect
  useEffect(() => {
    if (linkingWallet && wallet) {
      handleLinkWalletFromTonConnect();
    }
  }, [wallet, linkingWallet]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth?mode=login');
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setUsername(userData.username || '');
        setEmail(userData.email || '');
      } else {
        localStorage.removeItem('token');
        navigate('/auth?mode=login');
      }
    } catch (error) {
      console.error("Auth check failed", error);
      navigate('/auth?mode=login');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!username.trim() || username.length < 3) {
      toast.error(t('usernameTooShort') || 'Username too short');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-username', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);

      toast.success(t('usernameUpdated') || 'Username updated!');
      // Обновляем глобальное состояние
      if (setAppUser) {
        setAppUser(prev => ({ ...prev, username }));
      }
      checkAuth();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Step 1: Start email change - send code to current email
  const handleStartEmailChange = async () => {
    setSendingCode(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/email-change/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success('Код отправлен на вашу текущую почту');
      setEmailChangeStep(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingCode(false);
    }
  };
  
  // Step 2: Verify code from old email
  const handleVerifyOldEmail = async () => {
    if (!oldEmailCode || oldEmailCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    
    setSendingCode(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/email-change/verify-old', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: oldEmailCode })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success('Код подтверждён! Введите новый email');
      setEmailChangeStep(2);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingCode(false);
    }
  };
  
  // Step 3: Send code to new email
  const handleSendNewEmailCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Введите корректный email');
      return;
    }
    
    setSendingCode(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/email-change/send-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_email: newEmail, old_code: oldEmailCode })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success('Код отправлен на новую почту');
      setEmailChangeStep(3);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingCode(false);
    }
  };
  
  // Step 4: Verify new email and complete change
  const handleCompleteEmailChange = async () => {
    if (!newEmailCode || newEmailCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/email-change/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          new_email: newEmail, 
          new_code: newEmailCode,
          old_code: oldEmailCode 
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success('Email успешно изменён!');
      setEmail(newEmail);
      setEmailChangeStep(0);
      setOldEmailCode('');
      setNewEmail('');
      setNewEmailCode('');
      
      if (setAppUser) {
        setAppUser(prev => ({ ...prev, email: newEmail }));
      }
      checkAuth();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Cancel email change
  const handleCancelEmailChange = () => {
    setEmailChangeStep(0);
    setOldEmailCode('');
    setNewEmail('');
    setNewEmailCode('');
  };

  const handleUpdateEmail = async () => {
    if (!email.trim()) {
      toast.error(t('enterEmail') || 'Enter email');
      return;
    }
    if (!emailConfirmPassword) {
      toast.error(t('enterCurrentPassword') || 'Enter current password');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password: emailConfirmPassword })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);

      toast.success(t('emailUpdated') || 'Email updated!');
      setEmailConfirmPassword('');
      if (setAppUser) {
        setAppUser(prev => ({ ...prev, email }));
      }
      checkAuth();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t('fillAllFields') || 'Fill all fields');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error(t('passwordsNoMatch') || 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('passwordTooShort') || 'Password too short');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);

      toast.success(t('passwordUpdated') || 'Password updated!');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Привязка кошелька через TonConnect
  const handleConnectWallet = async () => {
    if (wallet) {
      // Уже подключен кошелек - просто привязываем
      await handleLinkWalletFromTonConnect();
    } else {
      // Открываем TonConnect модал
      setLinkingWallet(true);
      try {
        await tonConnectUI.openModal();
      } catch (e) {
        setLinkingWallet(false);
        toast.error(t('walletConnectionError') || 'Wallet connection error');
      }
    }
  };

  const handleLinkWalletFromTonConnect = async () => {
    if (!wallet) return;
    
    setLinkingWallet(false);
    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      const walletAddress = wallet.account.address;
      
      const response = await fetch('/api/auth/link-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ wallet_address: walletAddress })
      });

      const data = await response.json();
      if (!response.ok) {
        // Disconnect the failed wallet so user can try another
        try { await tonConnectUI.disconnect(); } catch (e) {}
        throw new Error(data.detail);
      }

      toast.success(t('walletLinked') || 'Wallet linked!');
      if (setAppUser) {
        setAppUser(prev => ({ ...prev, wallet_address: walletAddress }));
      }
      checkAuth();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Telegram via Deep Link
  const handleGenerateTelegramLink = async () => {
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/api/telegram/generate-link-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ошибка генерации токена');
      }
      const data = await res.json();
      setTelegramLinkToken(data.token);
      setTelegramBotLink(data.bot_link);
      
      // Open bot link in new tab
      window.open(data.bot_link, '_blank');
      toast.success('Перейдите в бота и нажмите /start');
      
      // Start polling to check if linked
      pollTelegramLink();
    } catch (e) { 
      toast.error(e.message); 
    } finally { 
      setSavingTelegram(false); 
    }
  };
  
  // Poll to check if Telegram was linked
  const pollTelegramLink = async () => {
    const token = localStorage.getItem('token');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    
    const checkLink = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/telegram/check-link`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.is_linked) {
            setUser(prev => ({ 
              ...prev, 
              telegram_username: data.telegram_username,
              telegram_chat_id: data.telegram_id 
            }));
            setTelegramLinkToken(null);
            toast.success('Telegram успешно привязан!');
            return;
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkLink, 5000);
      } else {
        setTelegramLinkToken(null);
        toast.error('Время ожидания привязки истекло');
      }
    };
    
    setTimeout(checkLink, 3000);
  };

  // Telegram via username (fallback)
  const handleLinkTelegram = async () => {
    if (!telegramUsername.trim()) {
      toast.error('Укажите Telegram username');
      return;
    }
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/api/auth/link-telegram?telegram_username=${encodeURIComponent(telegramUsername.trim())}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ошибка');
      }
      toast.success('Telegram привязан!');
      setUser(prev => ({ ...prev, telegram_username: telegramUsername.trim().replace('@', '') }));
    } catch (e) { toast.error(e.message); }
    finally { setSavingTelegram(false); }
  };

  const handleUnlinkTelegram = async () => {
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/api/auth/unlink-telegram`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Ошибка');
      toast.success('Telegram отвязан');
      setTelegramUsername('');
      // Update all telegram-related fields
      setUser(prev => ({ 
        ...prev, 
        telegram_username: null, 
        telegram_chat_id: null,
        telegram_notifications: false 
      }));
      // Also update app-level user if available
      if (setAppUser) {
        setAppUser(prev => ({ 
          ...prev, 
          telegram_username: null, 
          telegram_chat_id: null,
          telegram_notifications: false 
        }));
      }
    } catch (e) { toast.error(e.message); }
    finally { setSavingTelegram(false); }
  };

  // Отвязка кошелька
  const handleUnlinkWallet = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/unlink-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);

      toast.success(t('walletUnlinked') || 'Wallet unlinked!');
      if (setAppUser) {
        setAppUser(prev => ({ ...prev, wallet_address: null }));
      }
      // Отключаем TonConnect тоже
      await tonConnectUI.disconnect();
      checkAuth();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const avatar_data = event.target?.result;
      
      setSaving(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/upload-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ avatar_data })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toast.success(t('avatarUpdated') || 'Avatar updated!');
        if (setAppUser) {
          setAppUser(prev => ({ ...prev, avatar: avatar_data }));
        }
        checkAuth();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    try {
      // Отключаем TonConnect если подключен
      if (wallet) {
        await tonConnectUI.disconnect();
      }
    } catch (e) {
      console.error('TonConnect disconnect error:', e);
    }
    
    localStorage.removeItem('token');
    if (onLogout) {
      onLogout();
    } else if (setAppUser) {
      setAppUser(null);
    }
    toast.success(t('loggedOut') || 'Logged out');
    navigate('/');
  };

  const changeLang = (newLang) => {
    setLang(newLang);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center font-rajdhani">
        <div className="text-cyber-cyan animate-pulse">
          {t('loading') || 'Loading...'}
        </div>
      </div>
    );
  }

  const isGoogleUser = user?.auth_type === 'google';
  const isWalletOnlyUser = user?.auth_type === 'wallet';
  const isEmailUser = user?.auth_type === 'email';

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto lg:ml-16">
        <div className="relative min-h-screen font-rajdhani pb-20 lg:pb-0">
          {/* Background grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
              }}
            />
          </div>

          {/* Header */}
          <div className="relative z-10 container mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Space for burger menu on mobile */}
                <div className="lg:hidden w-10 flex-shrink-0" />
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-unbounded text-sm sm:text-xl font-bold text-white uppercase tracking-tight truncate">
                    {t('settings') || 'Настройки'}
                  </h1>
                  <p className="text-text-muted text-[10px] sm:text-xs hidden sm:block">{t('manageAccount')}</p>
                </div>
              </div>

              <Select value={lang} onValueChange={changeLang}>
                <SelectTrigger className="w-auto min-w-[60px] sm:min-w-[120px] bg-panel border-grid-border text-text-main text-xs sm:text-sm flex-shrink-0 px-2 sm:px-3">
                  <span className="flex items-center gap-1">
                    <span>{languages.find(l => l.code === lang)?.flag}</span>
                    <span className="hidden sm:inline">{languages.find(l => l.code === lang)?.name}</span>
                    <span className="sm:hidden">{lang.toUpperCase()}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
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
          </div>

          {/* Main Content */}
          <div className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="font-unbounded text-2xl sm:text-3xl font-bold text-white mb-2 uppercase tracking-tight">
              {t('settingsTitle') || 'Settings'}
            </h1>
            <p className="text-text-muted text-sm sm:text-base">
              {t('accountManagement') || 'Manage your account'}
            </p>
          </div>

          {/* Avatar Section */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="Avatar"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-cyber-cyan object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold text-black">
                    {(user?.username || 'U')[0].toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-cyber-cyan text-black p-2 rounded-full cursor-pointer hover:brightness-110 transition-all">
                  <Camera className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-bold text-white">{user?.display_name || user?.username}</h3>
                <p className="text-text-muted text-sm">{user?.email || (user?.wallet_address ? (() => { try { const { toUserFriendlyAddress, shortenAddress } = require('@/lib/tonAddress'); return shortenAddress(toUserFriendlyAddress(user.wallet_address)); } catch { return `${user.wallet_address.slice(0, 8)}...${user.wallet_address.slice(-6)}`; } })() : '')}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-text-muted text-xs uppercase">ID:</span>
                  <code className="text-cyber-cyan text-xs font-mono bg-white/5 px-2 py-1 rounded">{user?.id}</code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(user?.id || '');
                      toast.success('ID скопирован!');
                    }}
                    className="text-text-muted hover:text-cyber-cyan transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-cyber-cyan" />
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                {t('changeUsername') || 'Username'}
              </h3>
            </div>
            <div className="space-y-4">
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all text-sm sm:text-base"
              />
              <Button 
                onClick={handleUpdateUsername}
                disabled={saving}
                className="w-full sm:w-auto bg-cyber-cyan text-black hover:brightness-110">
                <Save className="w-4 h-4 mr-2" />
                {t('save') || 'Save'}
              </Button>
            </div>
          </div>

          {/* Email (only for email users, not Google or wallet-only) */}
          {(isEmailUser || isWalletOnlyUser) && (
            <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                  {t('changeEmail') || 'Смена Email'}
                </h3>
              </div>
              
              {/* Current email display */}
              <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-text-muted text-sm">{t('currentEmail')}: </span>
                <span className="text-cyber-cyan">{user?.email || t('notSpecified')}</span>
              </div>
              
              {/* Step 0: Initial - button to start */}
              {emailChangeStep === 0 && (
                <Button 
                  onClick={handleStartEmailChange}
                  disabled={sendingCode || !user?.email}
                  className="w-full sm:w-auto bg-cyber-cyan text-black hover:brightness-110">
                  <Mail className="w-4 h-4 mr-2" />
                  {t('changeEmailBtn')}
                </Button>
              )}
              
              {/* Step 1: Enter code from old email */}
              {emailChangeStep === 1 && (
                <div className="space-y-4">
                  <p className="text-text-muted text-sm">
                    {t('confirmationCodeSentTo')} <span className="text-cyber-cyan">{user?.email}</span>
                  </p>
                  <input 
                    type="text"
                    value={oldEmailCode}
                    onChange={(e) => setOldEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-center text-lg tracking-[0.5em] font-mono placeholder:text-sm placeholder:tracking-normal placeholder:text-white/30 outline-none focus:border-cyber-cyan transition-all"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleCancelEmailChange}
                      variant="outline"
                      className="flex-1 border-white/10">
                      {t('cancel')}
                    </Button>
                    <Button 
                      onClick={handleVerifyOldEmail}
                      disabled={sendingCode || oldEmailCode.length !== 6}
                      className="flex-1 bg-cyber-cyan text-black hover:brightness-110">
                      {t('confirm')}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 2: Enter new email */}
              {emailChangeStep === 2 && (
                <div className="space-y-4">
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {t('currentEmailConfirmed')}
                  </p>
                  <input 
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Введите новый email"
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleCancelEmailChange}
                      variant="outline"
                      className="flex-1 border-white/10">
                      Отмена
                    </Button>
                    <Button 
                      onClick={handleSendNewEmailCode}
                      disabled={sendingCode || !newEmail.includes('@')}
                      className="flex-1 bg-cyber-cyan text-black hover:brightness-110">
                      Отправить код
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Verify new email */}
              {emailChangeStep === 3 && (
                <div className="space-y-4">
                  <p className="text-text-muted text-sm">
                    Код подтверждения отправлен на <span className="text-cyber-cyan">{newEmail}</span>
                  </p>
                  <input 
                    type="text"
                    value={newEmailCode}
                    onChange={(e) => setNewEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-center text-lg tracking-[0.5em] font-mono placeholder:text-sm placeholder:tracking-normal placeholder:text-white/30 outline-none focus:border-cyber-cyan transition-all"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleCancelEmailChange}
                      variant="outline"
                      className="flex-1 border-white/10">
                      Отмена
                    </Button>
                    <Button 
                      onClick={handleCompleteEmailChange}
                      disabled={saving || newEmailCode.length !== 6}
                      className="flex-1 bg-green-500 text-black hover:brightness-110">
                      Подтвердить смену
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Password (only for email users, not Google or wallet-only) */}
          {isEmailUser && (
            <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                  {t('changePassword') || 'Смена пароля'}
                </h3>
              </div>
              <div className="space-y-4">
                <input 
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('currentPassword') || 'Текущий пароль'}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all text-sm sm:text-base"
                />
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('newPassword') || 'Новый пароль'}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all text-sm sm:text-base"
                />
                <input 
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder={t('confirmPassword') || 'Подтвердите новый пароль'}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all text-sm sm:text-base"
                />
                <Button 
                  onClick={handleUpdatePassword}
                  disabled={saving}
                  className="w-full sm:w-auto bg-cyber-cyan text-black hover:brightness-110">
                  <Save className="w-4 h-4 mr-2" />
                  {t('changePassword') || 'Change Password'}
                </Button>
              </div>
            </div>
          )}

          {/* TON Wallet - через TonConnect */}
          <div id="wallet-section" className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-cyber-cyan" />
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                {t('tonWallet') || 'TON Wallet'}
              </h3>
            </div>
            <div className="space-y-4">
              {user?.wallet_address ? (
                <>
                  <div className="bg-white/5 border border-cyber-cyan/20 p-4 rounded-xl">
                    <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">
                      {t('linkedWallet') || 'Linked Wallet'}
                    </p>
                    {/* User-friendly формат адреса */}
                    <div className="flex items-center gap-2">
                      <p className="text-cyber-cyan font-mono text-sm sm:text-base">
                        {(() => {
                          try {
                            const { toUserFriendlyAddress } = require('@/lib/tonAddress');
                            const friendly = toUserFriendlyAddress(user.wallet_address);
                            return friendly.slice(0, 6) + '...' + friendly.slice(-4);
                          } catch { return user.wallet_address.slice(0, 6) + '...' + user.wallet_address.slice(-4); }
                        })()}
                      </p>
                      <button 
                        onClick={() => {
                          try {
                            const { toUserFriendlyAddress } = require('@/lib/tonAddress');
                            const friendly = toUserFriendlyAddress(user.wallet_address);
                            navigator.clipboard.writeText(friendly);
                          } catch {
                            navigator.clipboard.writeText(user.wallet_address);
                          }
                          toast.success('Адрес скопирован!');
                        }}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        title="Скопировать полный адрес"
                      >
                        <svg className="w-4 h-4 text-text-muted hover:text-cyber-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2 break-all font-mono opacity-60">
                      {(() => {
                        try {
                          const { toUserFriendlyAddress } = require('@/lib/tonAddress');
                          return toUserFriendlyAddress(user.wallet_address);
                        } catch { return user.wallet_address; }
                      })()}
                    </p>
                  </div>
                  <Button 
                    onClick={handleUnlinkWallet}
                    disabled={saving}
                    variant="outline"
                    className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10">
                    <Unlink className="w-4 h-4 mr-2" />
                    {t('unlinkWallet') || 'Unlink Wallet'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-text-muted text-sm">
                    {t('connectWalletDesc') || 'Connect your TON wallet via TonConnect to link it to your account.'}
                  </p>
                  <Button 
                    onClick={handleConnectWallet}
                    disabled={saving || linkingWallet}
                    className="w-full sm:w-auto bg-gradient-to-r from-[#0098EA] to-[#0057FF] text-white hover:brightness-110">
                    <Link2 className="w-4 h-4 mr-2" />
                    {linkingWallet ? (t('connecting') || 'Connecting...') : (t('connectWallet') || 'Connect Wallet')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Telegram Notifications */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#26A5E4]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.12.098.153.229.169.339.016.11.035.324.019.5z"/></svg>
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                {t('telegramNotifications') || 'Telegram уведомления'}
              </h3>
            </div>
            <div className="space-y-4">
              {user?.telegram_username || user?.telegram_chat_id ? (
                <>
                  <div className="bg-white/5 border border-[#26A5E4]/20 p-4 rounded-xl">
                    <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">{t('linkedTelegram') || 'Привязанный Telegram'}</p>
                    <p className="text-[#26A5E4] font-mono text-sm">
                      {user.telegram_username ? `@${user.telegram_username}` : `ID: ${user.telegram_chat_id}`}
                    </p>
                  </div>
                  <Button 
                    onClick={handleUnlinkTelegram}
                    disabled={savingTelegram}
                    variant="outline"
                    className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10">
                    {t('unlinkTelegram') || 'Отвязать Telegram'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-text-muted text-sm">
                    {t('telegramDesc') || 'Привяжите Telegram для получения уведомлений о кредитах, платежах и событиях.'}
                  </p>
                  
                  {/* Deep Link method (recommended) */}
                  <div className="p-4 bg-[#26A5E4]/10 border border-[#26A5E4]/20 rounded-xl">
                    <p className="text-sm text-white mb-3 font-medium">{t('recommendedMethod') || 'Рекомендуемый способ:'}</p>
                    <Button 
                      data-testid="link-telegram-bot-btn"
                      onClick={handleGenerateTelegramLink}
                      disabled={savingTelegram}
                      className="w-full bg-[#26A5E4] text-white hover:brightness-110">
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.12.098.153.229.169.339.016.11.035.324.019.5z"/></svg>
                      {savingTelegram ? (t('generatingLink') || 'Генерация ссылки...') : (t('linkViaBot') || 'Привязать через бота')}
                    </Button>
                    {telegramBotLink && (
                      <p className="text-xs text-text-muted mt-2">
                        {t('botWillOpen') || 'Откроется бот TON City. Нажмите Start и подождите.'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Security Settings - 2FA & Passkey */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-cyber-cyan/20 bg-cyber-cyan/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyber-cyan" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                    {t('security') || 'Безопасность'}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {t('securityDesc') || '2FA, Passkey и защита вывода средств'}
                  </p>
                </div>
              </div>
              <Button 
                data-testid="security-settings-btn"
                onClick={() => navigate('/security')}
                className="w-full sm:w-auto bg-cyber-cyan text-black hover:brightness-110">
                <Shield className="w-4 h-4 mr-2" />
                {t('configure') || 'Настроить'}
              </Button>
            </div>
          </div>

          {/* Account Info for Google users */}
          {isGoogleUser && (
            <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-neon-purple/20 bg-neon-purple/5">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-neon-purple mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-white font-bold mb-1">
                    {t('googleAccount') || 'Google Account'}
                  </h4>
                  <p className="text-text-muted text-sm">
                    {t('googleAccountDesc') || 'You signed in with Google. Email and password are managed through your Google account.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-red-500/20 bg-red-500/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide mb-1">
                  {t('logout') || 'Log Out'}
                </h3>
                <p className="text-text-muted text-sm">
                  {t('logoutDesc') || 'Sign out of your account on this device'}
                </p>
              </div>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                <LogOut className="w-4 h-4 mr-2" />
                {t('logout') || 'Log Out'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
        </div>
      </div>
    </div>
  );
}
