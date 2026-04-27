/**
 * SecurityPage - 2FA and Passkey Management
 * Implements UI for TOTP setup, Passkey registration, and security status
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, ShieldCheck, ShieldAlert,
  Fingerprint, Smartphone, Key, AlertTriangle,
  Plus, Trash2, Check, X, Copy, Eye, EyeOff,
  Clock, Lock, Unlock, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function SecurityPage({ user }) {
  const navigate = useNavigate();
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);
  
  const [loading, setLoading] = useState(true);
  const [securityStatus, setSecurityStatus] = useState(null);
  
  // TOTP Setup
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  
  // TOTP Disable
  const [showTOTPDisable, setShowTOTPDisable] = useState(false);
  const [disableRequestId, setDisableRequestId] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [disableTotpCode, setDisableTotpCode] = useState('');
  
  // Passkey
  const [showPasskeyRegister, setShowPasskeyRegister] = useState(false);
  const [passkeyDeviceName, setPasskeyDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  
  const token = localStorage.getItem('token');

  // Fetch security status
  const fetchSecurityStatus = useCallback(async () => {
    if (!token) {
      navigate('/auth?mode=login');
      return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/security/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSecurityStatus(data);
      } else {
        toast.error('Ошибка загрузки статуса безопасности');
      }
    } catch (e) {
      console.error('Security status error:', e);
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchSecurityStatus();
  }, [fetchSecurityStatus]);

  // ==================== TOTP Setup ====================
  
  const startTOTPSetup = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/security/totp/setup/start`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setTotpSetupData(data);
      setShowTOTPSetup(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmTOTPSetup = async () => {
    if (totpCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/security/totp/setup/confirm?code=${totpCode}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setBackupCodes(data.backup_codes);
      setShowBackupCodes(true);
      setShowTOTPSetup(false);
      setTotpCode('');
      setTotpSetupData(null);
      
      toast.success('2FA успешно активирована!');
      fetchSecurityStatus();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ==================== TOTP Disable ====================
  
  const startTOTPDisable = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/security/totp/disable/start`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setDisableRequestId(data.request_id);
      setShowTOTPDisable(true);
      toast.info('Код отправлен на email');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmTOTPDisable = async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/security/totp/disable/confirm?request_id=${disableRequestId}&email_code=${emailCode}&totp_code=${disableTotpCode}`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setShowTOTPDisable(false);
      setEmailCode('');
      setDisableTotpCode('');
      setDisableRequestId(null);
      
      toast.success('2FA отключена. Вывод заблокирован на 3 минуты.');
      fetchSecurityStatus();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ==================== Passkey ====================
  
  const startPasskeyRegistration = async () => {
    const deviceName = passkeyDeviceName.trim() || 'My Device';
    setRegistering(true);
    
    try {
      // Step 1: Get registration options
      const optionsRes = await fetch(
        `${BACKEND_URL}/api/security/passkey/register/start?device_name=${encodeURIComponent(deviceName)}`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsData.detail);
      
      const { challenge_id, options } = optionsData;
      
      // Step 2: Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: base64URLToBuffer(options.challenge),
          user: {
            ...options.user,
            id: base64URLToBuffer(options.user.id)
          },
          excludeCredentials: (options.excludeCredentials || []).map(cred => ({
            ...cred,
            id: base64URLToBuffer(cred.id)
          }))
        }
      });
      
      // Step 3: Send credential to server
      const credentialJSON = {
        id: credential.id,
        rawId: bufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
          attestationObject: bufferToBase64URL(credential.response.attestationObject)
        }
      };
      
      const finishRes = await fetch(
        `${BACKEND_URL}/api/security/passkey/register/finish?challenge_id=${challenge_id}&device_name=${encodeURIComponent(deviceName)}`,
        {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ credential: credentialJSON })
        }
      );
      
      const finishData = await finishRes.json();
      if (!finishRes.ok) throw new Error(finishData.detail);
      
      setShowPasskeyRegister(false);
      setPasskeyDeviceName('');
      toast.success('Passkey успешно зарегистрирован!');
      fetchSecurityStatus();
      
    } catch (e) {
      console.error('Passkey registration error:', e);
      if (e.name === 'NotAllowedError') {
        toast.error('Регистрация отменена пользователем');
      } else if (e.name === 'SecurityError') {
        toast.error('Passkeys требуют HTTPS соединения. Эта функция недоступна в preview режиме.');
      } else {
        toast.error(e.message || 'Ошибка регистрации Passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  const deletePasskey = async (passkeyId) => {
    if (!confirm('Удалить этот Passkey?')) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/security/passkey/${passkeyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      toast.success('Passkey удалён');
      fetchSecurityStatus();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Helper functions for WebAuthn
  const base64URLToBuffer = (base64URL) => {
    const padding = '='.repeat((4 - base64URL.length % 4) % 4);
    const base64 = (base64URL + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  };

  const bufferToBase64URL = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (const byte of bytes) {
      str += String.fromCharCode(byte);
    }
    const base64 = window.btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const copyBackupCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join('\n'));
      toast.success('Резервные коды скопированы');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-void">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center lg:ml-16">
          <div className="text-cyber-cyan animate-pulse">Загрузка...</div>
        </div>
      </div>
    );
  }

  const isProtected = securityStatus?.is_protected;
  const is2FAEnabled = securityStatus?.is_2fa_enabled;
  const hasPasskeys = securityStatus?.has_passkeys;
  const isWithdrawLocked = securityStatus?.is_withdraw_locked;

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto lg:ml-16">
        <div className="relative min-h-screen font-rajdhani pb-6 lg:pb-0">
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

          {/* Main Content */}
          <div className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-12 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Security Status Header */}
              <div className="text-center mb-8 sm:mb-12">
                <div className="flex justify-center mb-4">
                  {isProtected ? (
                    <ShieldCheck className="w-16 h-16 text-green-400" />
                  ) : (
                    <ShieldAlert className="w-16 h-16 text-red-400" />
                  )}
                </div>
                <h1 className="font-unbounded text-2xl sm:text-3xl font-bold text-white mb-2 uppercase tracking-tight">
                  {t('securityTitle')}
                </h1>
                <p className={`text-sm sm:text-base ${isProtected ? 'text-green-400' : 'text-red-400'}`}>
                  {isProtected ? t('accountProtected') : t('accountNotProtected')}
                </p>
              </div>

              {/* Withdrawal Lock Warning */}
              {isWithdrawLocked && (
                <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-yellow-500/30 bg-yellow-500/10">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-bold mb-1">{t('withdrawalBlocked')}</h4>
                      <p className="text-text-muted text-sm">
                        {t('withdrawAvailableIn')} {securityStatus.withdraw_lock_remaining_hours.toFixed(1)} {t('hours')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

          {/* Protection Warning */}
          {!isProtected && (
            <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-white font-bold mb-1">{t('protectionRequired')}</h4>
                  <p className="text-text-muted text-sm">
                    {t('protectionRequiredDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Passkey Section */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-6 h-6 text-cyber-cyan" />
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wide">
                    {t('passkeyTitle')}
                  </h3>
                  <p className="text-text-muted text-sm">{t('passkeyDesc')}</p>
                </div>
              </div>
              <Button
                data-testid="add-passkey-btn"
                onClick={() => setShowPasskeyRegister(true)}
                className="bg-cyber-cyan text-black hover:brightness-110 w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('addBtn')}
              </Button>
            </div>

            {securityStatus?.passkeys?.length > 0 ? (
              <div className="space-y-3">
                {securityStatus.passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-cyber-cyan" />
                      <div>
                        <p className="text-white font-medium">{passkey.name}</p>
                        <p className="text-text-muted text-xs">
                          Добавлен: {new Date(passkey.created_at).toLocaleDateString('ru-RU')}
                          {passkey.last_used && ` • Последнее использование: ${new Date(passkey.last_used).toLocaleDateString('ru-RU')}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      data-testid={`delete-passkey-${passkey.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePasskey(passkey.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                <Fingerprint className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('noRegisteredDevices')}</p>
              </div>
            )}
          </div>

          {/* 2FA Section */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-white/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Smartphone className="w-6 h-6 text-neon-purple" />
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wide">
                    {t('twoFaTitle')}
                  </h3>
                  <p className="text-text-muted text-sm">{t('twoFaDesc')}</p>
                </div>
              </div>
              {is2FAEnabled ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium text-center">
                    {t('enabled')}
                  </span>
                  <Button
                    data-testid="disable-2fa-btn"
                    variant="outline"
                    onClick={startTOTPDisable}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 w-full sm:w-auto justify-center"
                  >
                    {t('disableBtn')}
                  </Button>
                </div>
              ) : (
                <Button
                  data-testid="enable-2fa-btn"
                  onClick={startTOTPSetup}
                  className="bg-neon-purple text-white hover:brightness-110 w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('enableBtn')}
                </Button>
              )}
            </div>

            {is2FAEnabled && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-white font-medium">2FA активна</p>
                    <p className="text-text-muted text-xs">
                      Резервных кодов осталось: {securityStatus?.backup_codes_remaining || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!is2FAEnabled && !user?.email && (
              <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-300 text-sm">
                    Для включения 2FA необходимо привязать email в настройках
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
        </div>
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog open={showTOTPSetup} onOpenChange={setShowTOTPSetup}>
        <DialogContent className="bg-panel border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-unbounded">Настройка 2FA</DialogTitle>
          </DialogHeader>
          
          {totpSetupData && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-text-muted text-sm mb-4">
                  Отсканируйте QR-код в приложении Google Authenticator или Authy
                </p>
                <img 
                  src={totpSetupData.qr_code} 
                  alt="QR Code" 
                  className="mx-auto w-48 h-48 bg-white rounded-lg p-2"
                />
              </div>
              
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-text-muted text-xs mb-1">Или введите ключ вручную:</p>
                <code className="text-cyber-cyan text-sm break-all">{totpSetupData.secret}</code>
              </div>
              
              <div>
                <p className="text-text-muted text-sm mb-2">Введите 6-значный код из приложения:</p>
                <div className="relative">
                  <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white/20 pointer-events-none" style={{display: totpCode.length > 0 ? 'none' : 'block'}} />
                  <Input
                    data-testid="totp-code-input"
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="------"
                    className="bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setShowTOTPSetup(false)}>
              Отмена
            </Button>
            <Button 
              data-testid="confirm-2fa-btn"
              onClick={confirmTOTPSetup}
              className="bg-cyber-cyan text-black"
              disabled={totpCode.length !== 6}
            >
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="bg-panel border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-unbounded">Резервные коды</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-red-300 text-sm">
                Сохраните эти коды в безопасном месте. Они не будут показаны снова!
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {backupCodes?.map((code, i) => (
                <div 
                  key={i}
                  className="bg-white/5 p-2 rounded text-center font-mono text-cyber-cyan"
                >
                  {code}
                </div>
              ))}
            </div>
            
            <Button 
              onClick={copyBackupCodes}
              variant="outline"
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Копировать все
            </Button>
            
            {/* How to use backup codes */}
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <h4 className="text-blue-300 font-semibold text-sm mb-2">Как использовать резервные коды:</h4>
              <ul className="text-blue-200 text-xs space-y-1">
                <li>• Если потеряли доступ к Google Authenticator</li>
                <li>• Введите резервный код вместо 6-значного TOTP кода</li>
                <li>• Каждый код можно использовать только один раз</li>
                <li>• После использования кода, он становится недействительным</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowBackupCodes(false)}
              className="bg-cyber-cyan text-black w-full"
            >
              Я сохранил коды
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOTP Disable Dialog */}
      <Dialog open={showTOTPDisable} onOpenChange={setShowTOTPDisable}>
        <DialogContent className="bg-panel border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-unbounded">Отключение 2FA</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-300 text-sm">
                После отключения 2FA вывод средств будет заблокирован на 48 часов
              </p>
            </div>
            
            <div>
              <p className="text-text-muted text-sm mb-2">Код из Email:</p>
              <Input
                data-testid="email-code-input"
                type="text"
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.toUpperCase().replace(/[^A-Za-z0-9]/gi, '').toUpperCase().slice(0, 6))}
                placeholder="000000"
                className="bg-white/5 border-white/10 text-white text-center text-lg tracking-[0.5em] font-mono"
              />
            </div>
            
            <div>
              <p className="text-text-muted text-sm mb-2">Код из приложения 2FA:</p>
              <Input
                data-testid="disable-totp-code-input"
                type="text"
                maxLength={6}
                value={disableTotpCode}
                onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="bg-white/5 border-white/10 text-white text-center text-lg tracking-[0.5em] font-mono"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTOTPDisable(false)}>
              Отмена
            </Button>
            <Button 
              data-testid="confirm-disable-2fa-btn"
              onClick={confirmTOTPDisable}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Отключить 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passkey Register Dialog */}
      <Dialog open={showPasskeyRegister} onOpenChange={setShowPasskeyRegister}>
        <DialogContent className="bg-panel border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-unbounded">Добавить Passkey</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <Fingerprint className="w-16 h-16 mx-auto text-cyber-cyan mb-4" />
              <p className="text-text-muted text-sm">
                Используйте Face ID, Touch ID или Windows Hello для защиты аккаунта
              </p>
            </div>
            
            <div>
              <p className="text-text-muted text-sm mb-2">Название устройства:</p>
              <Input
                data-testid="passkey-name-input"
                type="text"
                value={passkeyDeviceName}
                onChange={(e) => setPasskeyDeviceName(e.target.value)}
                placeholder="Например: iPhone 15 Pro"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasskeyRegister(false)}>
              Отмена
            </Button>
            <Button 
              data-testid="register-passkey-btn"
              onClick={startPasskeyRegistration}
              className="bg-cyber-cyan text-black"
              disabled={registering}
            >
              {registering ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Регистрация...
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Зарегистрировать
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
