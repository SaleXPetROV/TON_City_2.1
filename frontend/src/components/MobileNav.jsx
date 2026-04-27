import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Map, ShoppingBag, Settings, MessageCircle, X,
  Building2, Trophy, Calculator, GraduationCap, Store, Wallet,
  ArrowDownToLine, ArrowUpFromLine, Shield, AlertCircle, Link2, Landmark, History, Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/translations';
import { DepositModal, WithdrawModal } from './BalanceModals';
import { tonToCity, formatCity, formatTon } from '@/lib/currency';
import { useTutorial } from '@/context/TutorialContext';

export default function MobileNav({ user, refreshBalance }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tutorial = useTutorial();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showWalletWarning, setShowWalletWarning] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [supportTelegram, setSupportTelegram] = useState('');
  const lang = localStorage.getItem('ton_city_lang') || 'ru';
  const { t } = useTranslation(lang);

  // Load config including deposit address
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.deposit_address) {
          setDepositAddress(data.deposit_address);
        }
        if (data.support_telegram) {
          setSupportTelegram(data.support_telegram);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for toggle events from PageHeader.
  // Во время туториала на «обычной» странице игнорируем — пусть пользователь
  // не выходит за пределы шага. Открыть burger-меню можно только если шаг
  // явно подсвечивает элемент внутри меню (mobile-menu-item-*).
  useEffect(() => {
    const handler = () => {
      const sel = tutorial?.currentStep?.mobile_target_selector || '';
      const tutorialAllowsBurger = !!sel && sel.startsWith('mobile-menu-item-');
      if (tutorial?.active && !tutorialAllowsBurger) return;
      setIsMenuOpen(prev => !prev);
    };
    window.addEventListener('toggle-mobile-menu', handler);
    return () => window.removeEventListener('toggle-mobile-menu', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.active, tutorial?.currentStep?.mobile_target_selector]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Auto-open burger menu ONLY for tutorial steps that point at an item
  // INSIDE the burger menu (mobile_target_selector === "mobile-menu-item-*").
  // For on-page targets (e.g. a button on /trading, a resource card on
  // /my-businesses) we must NOT auto-open the drawer.
  useEffect(() => {
    if (!tutorial?.active) return;
    const sel = tutorial?.currentStep?.mobile_target_selector;
    if (!sel || !sel.startsWith('mobile-menu-item-')) return;
    setIsMenuOpen(true);
  }, [tutorial?.active, tutorial?.currentStep?.mobile_target_selector]);

  // Не показываем на странице авторизации
  if (location.pathname.startsWith('/auth')) return null;
  // Не показываем если нет пользователя
  if (!user) return null;

  const menuItems = [
    { icon: Home, label: t('menuHome') || t('home') || 'Home', path: '/' },
    { icon: Map, label: t('menuMap') || t('map') || 'Map', path: '/map' },
    { icon: Building2, label: t('myBusinesses') || t('menuMyBusinesses') || 'My Businesses', path: '/my-businesses' },
    { icon: Store, label: t('marketplace') || t('menuMarket') || 'Marketplace', path: '/marketplace' },
    { icon: ShoppingBag, label: t('trading') || t('menuTrading') || 'Trading', path: '/trading' },
    { icon: Landmark, label: t('menuCredits') || t('credits') || 'Credits', path: '/credit' },
    { icon: History, label: t('menuHistory') || t('transactionHistory') || 'History', path: '/history' },
    { icon: Trophy, label: t('menuLeaderboard') || t('leaderboard') || 'Leaderboard', path: '/leaderboard' },
    { icon: MessageCircle, label: t('chat') || 'Chat', path: '/chat' },
    { icon: Calculator, label: t('menuCalculator') || t('incomeCalculator') || 'Calculator', path: '/calculator' },
    { icon: GraduationCap, label: t('menuTutorial') || t('tutorialTitle') || 'Tutorial', action: 'tutorial' },
    { icon: Settings, label: t('settings') || t('menuSettings') || 'Settings', path: '/settings' },
  ];

  // Если пользователь - админ, добавляем ссылку на админку
  if (user?.is_admin) {
    menuItems.push({ icon: Shield, label: t('menuAdmin') || t('adminPanel') || 'Admin', path: '/admin' });
  }

  const handleNavigation = (item) => {
    if (item && item.action === 'tutorial') {
      if (tutorial?.launch) tutorial.launch();
      setIsMenuOpen(false);
      return;
    }
    const path = typeof item === 'string' ? item : item.path;
    if (path) navigate(path);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Hamburger Button - Fixed, shown on all pages on mobile (only when menu is closed).
          Во время туториала кнопка бургера скрыта — пользователь должен оставаться
          в рамках текущей страницы и ничего не нажимать мимо туториала.
          Исключение: шаг, который явно указывает на пункт burger-меню (mobile-menu-item-*).
       */}
      {!isMenuOpen && (() => {
        const sel = tutorial?.currentStep?.mobile_target_selector || '';
        const tutorialAllowsBurger = !!sel && sel.startsWith('mobile-menu-item-');
        if (tutorial?.active && !tutorialAllowsBurger) return null;
        return (
        <div className="lg:hidden fixed top-3 left-3 z-[60]">
          <Button
            data-testid="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(true)}
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 transition-all duration-300"
          >
            <div className="flex flex-col items-center justify-center gap-[5px] w-5 h-5">
              <span className="block w-4 h-[2px] bg-current rounded-full" />
              <span className="block w-4 h-[2px] bg-current rounded-full" />
              <span className="block w-4 h-[2px] bg-current rounded-full" />
            </div>
          </Button>
        </div>
        );
      })()}

      {/* Fullscreen Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            data-testid="mobile-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-void/98 backdrop-blur-xl"
          >
            {/* Background Grid Effect */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <div 
                className="absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)`,
                  backgroundSize: '40px 40px',
                }}
              />
            </div>

            {/* Menu Content */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="relative h-full flex flex-col pt-4 px-4 pb-8 overflow-y-auto"
            >
              {/* User Profile Card with Close Button */}
              <div className="mb-6 p-4 bg-gradient-to-r from-cyber-cyan/10 to-neon-purple/10 rounded-2xl border border-cyber-cyan/20">
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.username}
                      className="w-12 h-12 rounded-full border-2 border-cyber-cyan shadow-lg shadow-cyber-cyan/30 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-full flex items-center justify-center text-lg font-bold text-black flex-shrink-0">
                      {(user.display_name || user.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white truncate">{user.display_name || user.username}</p>
                  </div>
                  {/* Close Button integrated in profile card */}
                  <Button
                    onClick={() => setIsMenuOpen(false)}
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-xl bg-cyber-cyan text-black hover:bg-cyber-cyan/80 flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {/* Balance */}
                <div className="mt-4 p-3 bg-black/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-cyber-cyan" />
                      <span className="text-xs text-text-muted uppercase">{t('balance') || 'Balance'}</span>
                    </div>
                  </div>
                  {/* Balance: $CITY primary, TON secondary */}
                  <div className="text-2xl font-bold text-white">
                    {formatCity(tonToCity(user.balance_ton || 0))} <span className="text-yellow-400 text-sm">$CITY</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    ≈ {formatTon(user.balance_ton || 0)} TON
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs h-10"
                    onClick={() => {
                      if (user.wallet_address) {
                        setIsMenuOpen(false);
                        setShowDeposit(true);
                      } else {
                        setShowWalletWarning('deposit');
                      }
                    }}
                  >
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                    {t('deposit') || 'Deposit'}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-xs h-10"
                    onClick={() => {
                      if (user.wallet_address) {
                        setIsMenuOpen(false);
                        setShowWithdraw(true);
                      } else {
                        setShowWalletWarning('withdraw');
                      }
                    }}
                  >
                    <ArrowUpFromLine className="w-4 h-4 mr-2" />
                    {t('withdraw') || 'Withdraw'}
                  </Button>
                </div>

                {/* Wallet Warning */}
                {showWalletWarning && (
                  <div className="mt-2 p-3 rounded-xl bg-red-900/30 border border-red-700/50">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-300 font-medium">
                          {t('walletRequiredFor') || (showWalletWarning === 'deposit' 
                            ? (t('walletRequiredDeposit') || 'To deposit, you need to link a TON wallet') 
                            : (t('walletRequiredWithdraw') || 'To withdraw, you need to link a TON wallet'))}
                        </p>
                        <Button
                          size="sm"
                          className="mt-2 bg-blue-600 hover:bg-blue-700 text-xs h-8"
                          onClick={() => {
                            setShowWalletWarning('');
                            handleNavigation('/settings');
                          }}
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          {t('linkWallet') || 'Link Wallet'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <nav className="flex-1 space-y-2">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = item.path ? location.pathname === item.path : false;
                  const testKey = item.path ? (item.path.replace('/', '') || 'home') : (item.action || 'action');
                  
                  return (
                    <motion.button
                      key={item.path || item.action || item.label}
                      data-testid={`mobile-menu-item-${testKey}`}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.05 * index }}
                      onClick={() => handleNavigation(item)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-cyber-cyan/20 border border-cyber-cyan/30 text-cyber-cyan' 
                          : 'bg-white/5 border border-transparent text-white hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-cyber-cyan/20' : 'bg-white/5'
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-cyber-cyan' : 'text-white/70'}`} />
                      </div>
                      <span className="text-base font-semibold uppercase tracking-wide">
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-cyber-cyan shadow-lg shadow-cyber-cyan/50" />
                      )}
                    </motion.button>
                  );
                })}
              </nav>

              {/* Support Button */}
              {supportTelegram && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <a
                    href={supportTelegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-all"
                  >
                    <Headphones className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('support') || 'Support'}</span>
                  </a>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-white/10 text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-widest">
                  TON City Builder © 2026
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        onSuccess={async () => { 
          setShowDeposit(false); 
          // Обновляем данные пользователя из БД после успешного депозита/промокода
          if (refreshBalance) await refreshBalance();
        }}
        receiverAddress={depositAddress}
        updateBalance={(newBal) => { 
          // Мгновенное локальное обновление + синхронизация с БД
          if (refreshBalance) refreshBalance(); 
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={async () => { 
          setShowWithdraw(false); 
          if (refreshBalance) await refreshBalance();
        }}
        currentBalance={user?.balance_ton || 0}
        userWallet={user?.wallet_address}
        updateBalance={(newBal) => { 
          if (refreshBalance) refreshBalance(); 
        }}
      />
    </>
  );
}
