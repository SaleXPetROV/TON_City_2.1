import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, Mail, Lock, KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);
  
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Translations
  const texts = {
    ru: {
      title: 'Восстановление пароля',
      enterEmail: 'Введите email',
      emailPlaceholder: 'Ваш email',
      sendCode: 'Отправить код',
      enterCode: 'Введите код',
      codePlaceholder: '8-значный код',
      codeInfo: 'Мы отправили код на ваш email. Проверьте папку "Спам" если не видите письмо.',
      verifyCode: 'Подтвердить',
      newPassword: 'Новый пароль',
      confirmPassword: 'Подтвердите пароль',
      changePassword: 'Сменить пароль',
      backToLogin: 'Вернуться к входу',
      passwordChanged: 'Пароль успешно изменён!',
      userNotFound: 'Пользователь с таким email не найден',
      invalidCode: 'Неверный код',
      codeExpired: 'Код истёк. Запросите новый',
      codeSent: 'Код отправлен на ваш email',
      passwordMismatch: 'Пароли не совпадают',
      passwordTooShort: 'Пароль должен быть минимум 6 символов',
      emailSendFailed: 'Ошибка отправки email. Проверьте настройки SMTP',
      noPasswordAccount: 'Этот аккаунт использует вход через кошелёк или Google',
      tooManyAttempts: 'Слишком много попыток. Запросите новый код'
    },
    en: {
      title: 'Password Recovery',
      enterEmail: 'Enter your email',
      emailPlaceholder: 'Your email',
      sendCode: 'Send Code',
      enterCode: 'Enter code',
      codePlaceholder: '8-digit code',
      codeInfo: 'We sent a code to your email. Check spam folder if you don\'t see it.',
      verifyCode: 'Verify',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      changePassword: 'Change Password',
      backToLogin: 'Back to Login',
      passwordChanged: 'Password changed successfully!',
      userNotFound: 'User with this email not found',
      invalidCode: 'Invalid code',
      codeExpired: 'Code expired. Request a new one',
      codeSent: 'Code sent to your email',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters',
      emailSendFailed: 'Failed to send email. Check SMTP settings',
      noPasswordAccount: 'This account uses wallet or Google login',
      tooManyAttempts: 'Too many attempts. Request a new code'
    }
  };

  const txt = texts[lang] || texts.en;

  const handleRequestCode = async () => {
    if (!email) {
      toast.error(txt.enterEmail);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMap = {
          'user_not_found': txt.userNotFound,
          'no_password_account': txt.noPasswordAccount,
          'email_send_failed': txt.emailSendFailed
        };
        throw new Error(errorMap[error.detail] || error.detail);
      }

      toast.success(txt.codeSent);
      setStep(2);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 8) {
      toast.error(txt.enterCode);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API}/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMap = {
          'invalid_code': txt.invalidCode,
          'code_expired': txt.codeExpired,
          'too_many_attempts': txt.tooManyAttempts,
          'no_code_requested': txt.codeExpired
        };
        throw new Error(errorMap[error.detail] || error.detail);
      }

      setStep(3);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error(txt.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(txt.passwordMismatch);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMap = {
          'invalid_code': txt.invalidCode,
          'code_expired': txt.codeExpired,
          'password_too_short': txt.passwordTooShort,
          'user_not_found': txt.userNotFound
        };
        throw new Error(errorMap[error.detail] || error.detail);
      }

      toast.success(txt.passwordChanged);
      navigate('/auth?mode=login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-void flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyber-cyan/5 via-transparent to-transparent"></div>
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyber-cyan/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 rounded-3xl w-full max-w-md border border-white/10 text-center relative shadow-2xl"
      >
        <button 
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/auth?mode=login')} 
          className="absolute top-6 left-6 text-text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="w-16 h-16 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyber-cyan/20">
          <Building2 className="text-black w-10 h-10" />
        </div>

        <h1 className="font-unbounded text-xl font-bold text-white mb-2 tracking-tighter uppercase">
          {txt.title}
        </h1>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-cyber-cyan w-6' : s < step ? 'bg-cyber-cyan/50' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-text-muted text-sm mb-4">{txt.enterEmail}</p>
              
              <div className="relative text-left">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                <input 
                  type="email"
                  placeholder={txt.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRequestCode()}
                  className="w-full bg-white/5 border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                />
              </div>

              <Button 
                onClick={handleRequestCode}
                disabled={isLoading || !email}
                className="w-full bg-cyber-cyan text-black font-bold py-6 hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-cyber-cyan/20"
              >
                {isLoading ? '...' : txt.sendCode}
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl mb-4">
                <p className="text-cyber-cyan text-xs">{txt.codeInfo}</p>
              </div>
              
              <div className="relative text-left">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                <input 
                  type="text"
                  placeholder={txt.codePlaceholder}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyCode()}
                  maxLength={8}
                  className="w-full bg-white/5 border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20 font-mono tracking-widest text-center text-lg"
                />
              </div>

              <Button 
                onClick={handleVerifyCode}
                disabled={isLoading || code.length !== 8}
                className="w-full bg-cyber-cyan text-black font-bold py-6 hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-cyber-cyan/20"
              >
                {isLoading ? '...' : txt.verifyCode}
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-4 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <p className="text-green-400 text-xs">{lang === 'ru' ? 'Код подтверждён' : 'Code verified'}</p>
              </div>
              
              <div className="relative text-left">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-cyan" />
                <input 
                  type={showNewPassword ? "text" : "password"}
                  placeholder={txt.newPassword}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-3 pl-10 pr-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  data-testid="toggle-new-password-visibility"
                  tabIndex={-1}
                >
                  {showNewPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative text-left">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={txt.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleResetPassword()}
                  className="w-full bg-white/5 border border-white/10 p-3 pl-10 pr-10 rounded-xl text-white outline-none focus:border-cyber-cyan transition-all placeholder:text-white/20"
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  data-testid="toggle-confirm-password-visibility"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>

              <Button 
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full bg-cyber-cyan text-black font-bold py-6 hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-cyber-cyan/20"
              >
                {isLoading ? '...' : txt.changePassword}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => navigate('/auth?mode=login')}
          className="mt-6 text-text-muted text-sm hover:text-cyber-cyan transition-colors"
        >
          {txt.backToLogin}
        </button>
      </motion.div>
    </div>
  );
}
