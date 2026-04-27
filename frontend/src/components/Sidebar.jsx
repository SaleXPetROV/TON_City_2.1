import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Settings, Map, Store, Trophy, Calculator, 
  GraduationCap, Building2, MessageCircle, ShoppingBag,
  ArrowDownToLine, ArrowUpFromLine, Wallet, Landmark, History,
  Shield, User, LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DepositModal, WithdrawModal } from './BalanceModals';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { useTutorial } from '@/context/TutorialContext';
import { tonToCity, formatCity, formatTon } from '@/lib/currency';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function Sidebar({ user, onBalanceUpdate, refreshBalance }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';
  const [isHovered, setIsHovered] = useState(false);
  const [supportLink, setSupportLink] = useState('https://t.me/support');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [balanceTon, setBalanceTon] = useState(user?.balance_ton || 0);
  const [depositAddress, setDepositAddress] = useState('');
  
  // Calculate $CITY balance
  const balanceCity = tonToCity(balanceTon);
  
  // Get language from context
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);

  // Tutorial gating
  const tutorial = useTutorial();
  const isTutorialActive = !!tutorial?.active;
  const allowedRoute = tutorial?.getAllowedRoute ? tutorial.getAllowedRoute() : null;
  // If tutorial targets a sidebar element, force sidebar expanded
  const tutorialTargetSelector = tutorial?.currentStep?.target_selector;
  const shouldForceExpand = isTutorialActive && typeof tutorialTargetSelector === 'string'
    && (tutorialTargetSelector === 'sidebar-logo' || tutorialTargetSelector.startsWith('sidebar-nav-'));

  useEffect(() => {
    // Fetch support link and deposit address from config
    fetch(`${API}/config`)
      .then(r => r.json())
      .then(data => {
        if (data.support_telegram) {
          setSupportLink(data.support_telegram);
        }
        if (data.deposit_address) {
          setDepositAddress(data.deposit_address);
        }
      })
      .catch(() => {});
  }, []);

  // Update balance when user changes
  useEffect(() => {
    if (user?.balance_ton !== undefined) {
      setBalanceTon(user.balance_ton);
    }
  }, [user?.balance_ton]);

  // Balance is updated via props from App.js, no auto-refresh needed

  const handleDepositSuccess = async () => {
    // Немедленно обновляем баланс из БД
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('ton_city_token');
      if (!token) return;
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newBalance = response.data.balance_ton || 0;
      setBalanceTon(newBalance);
      if (onBalanceUpdate) onBalanceUpdate(newBalance);
      // Dispatch global event so App.js updates user state immediately
      window.dispatchEvent(new CustomEvent('balanceUpdate', { detail: { balance: newBalance } }));
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  };

  const handleWithdrawSuccess = async () => {
    // Немедленно обновляем баланс из БД
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('ton_city_token');
      if (!token) return;
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newBalance = response.data.balance_ton || 0;
      setBalanceTon(newBalance);
      if (onBalanceUpdate) onBalanceUpdate(newBalance);
      // Dispatch global event so App.js updates user state immediately
      window.dispatchEvent(new CustomEvent('balanceUpdate', { detail: { balance: newBalance } }));
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  };

  // Sidebar открыт только при наведении (на всех страницах включая главную).
  // Во время туториала ховер-разворот ОТКЛЮЧЁН — открыть сайдбар можно
  // только если шаг туториала явно подсвечивает sidebar-элемент
  // (тогда `shouldForceExpand` принудительно разворачивает панель).
  const isExpanded = shouldForceExpand || (!isTutorialActive && isHovered);

  // Если юзер не залогинен, не показываем меню вообще
  if (!user) return null;

  return (
    <>
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-4 top-4 z-40 hidden lg:flex flex-col
          transition-all duration-300 ${isExpanded ? 'w-52' : 'w-14'}`}
      >
        <div className="flex flex-col gap-1.5 p-2 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] backdrop-blur-xl border border-cyber-cyan/20 rounded-2xl shadow-2xl shadow-cyber-cyan/10">
          
          {/* Logo - always visible, links to home */}
          {(() => {
            const logoDisabled = isTutorialActive && allowedRoute && allowedRoute !== '/';
            const isLogoHighlighted = isTutorialActive && tutorialTargetSelector === 'sidebar-logo';
            return (
              <div
                className={`flex items-center gap-2 p-2 rounded-xl transition-colors mb-1
                  ${logoDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-white/5'}
                  ${isLogoHighlighted ? 'ring-2 ring-cyber-cyan' : ''}`}
                onClick={() => { if (!logoDisabled) navigate('/'); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !logoDisabled) { e.preventDefault(); navigate('/'); } }}
                data-testid="sidebar-logo"
                role="link"
                tabIndex={logoDisabled ? -1 : 0}
                aria-label="TON City — home"
                title="TON City"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-cyan to-neon-purple flex items-center justify-center shadow-lg shadow-cyber-cyan/20 flex-shrink-0">
                  <Building2 className="w-5 h-5 text-black" />
                </div>
                {isExpanded && (
                  <span className="font-unbounded text-sm font-bold text-text-main tracking-tighter whitespace-nowrap">
                    TON <span className="text-cyber-cyan">CITY</span>
                  </span>
                )}
              </div>
            );
          })()}
          
          {/* Balance Section */}
          <div className={`p-3 bg-gradient-to-r from-cyber-cyan/10 to-purple-500/10 rounded-xl border border-cyber-cyan/20 mb-2 ${!isExpanded ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyber-cyan" />
                <span className="text-xs text-text-muted uppercase tracking-wider">{t('sidebarBalance')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate('/history')}
                  className="w-6 h-6 text-text-muted hover:text-white hover:bg-white/10"
                  title={t('transactionHistory')}
                >
                  <History className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate('/settings')}
                  className="w-6 h-6 text-text-muted hover:text-white hover:bg-white/10"
                  title={t('settings')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* Balance display: $CITY primary, TON secondary */}
            <div className="mb-3">
              <div className="text-xl font-bold text-white">
                {formatCity(balanceCity)} <span className="text-yellow-400 text-sm">$CITY</span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                ≈ {formatTon(balanceTon)} TON
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => setShowDepositModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-xs h-9"
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                {t('sidebarDeposit')}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowWithdrawModal(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-xs h-9"
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                {t('sidebarWithdraw')}
              </Button>
            </div>
          </div>
          
          {/* Compact balance for collapsed state */}
          {!isExpanded && (
            <div 
              className="p-2 bg-cyber-cyan/10 rounded-xl text-center cursor-pointer hover:bg-cyber-cyan/20 transition-colors mb-2"
              onClick={() => setShowDepositModal(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDepositModal(true); } }}
              role="button"
              tabIndex={0}
              aria-label={`${t('sidebarBalance')}: ${balanceTon.toFixed(1)} TON. ${t('sidebarDeposit')}`}
              title={`${t('sidebarBalance')}: ${balanceTon.toFixed(1)} TON`}
            >
              <Wallet className="w-5 h-5 text-cyber-cyan mx-auto" />
              <div className="text-xs text-cyber-cyan mt-1 font-bold">{balanceTon.toFixed(1)}</div>
            </div>
          )}
          
          <NavItem icon={<Map className="w-5 h-5" />} label={t('sidebarMap')} path="/map" isExpanded={isExpanded} testId="sidebar-nav-map" />
          <NavItem icon={<Building2 className="w-5 h-5" />} label={t('sidebarMyBusinesses')} path="/my-businesses" isExpanded={isExpanded} testId="sidebar-nav-my-businesses" />
          <NavItem icon={<Store className="w-5 h-5" />} label={t('sidebarMarketplace')} path="/marketplace" isExpanded={isExpanded} testId="sidebar-nav-marketplace" />
          <NavItem icon={<ShoppingBag className="w-5 h-5" />} label={t('sidebarTrading')} path="/trading" isExpanded={isExpanded} testId="sidebar-nav-trading" />
          <NavItem icon={<Landmark className="w-5 h-5" />} label={t('sidebarCredits')} path="/credit" isExpanded={isExpanded} testId="sidebar-nav-credit" />
          <NavItem icon={<Trophy className="w-5 h-5" />} label={t('sidebarLeaderboard')} path="/leaderboard" isExpanded={isExpanded} testId="sidebar-nav-leaderboard" />
          <NavItem icon={<MessageCircle className="w-5 h-5" />} label={t('sidebarChat')} path="/chat" isExpanded={isExpanded} testId="sidebar-nav-chat" />
          <NavItem icon={<Calculator className="w-5 h-5" />} label={t('sidebarCalculator')} path="/calculator" isExpanded={isExpanded} testId="sidebar-nav-calculator" />
          <NavItem
            icon={<GraduationCap className="w-5 h-5" />}
            label={t('sidebarTutorial')}
            isExpanded={isExpanded}
            testId="sidebar-nav-tutorial"
            onClick={() => {
              if (tutorial?.launch) tutorial.launch();
            }}
          />
          
          {/* Admin Panel Button - only for admins */}
          {user?.is_admin && (
            <>
              <div className="h-px bg-red-500/20 mx-2 my-1" />
              <NavItem 
                icon={<Shield className="w-5 h-5" />} 
                label={t('sidebarAdminPanel')} 
                path="/admin" 
                isExpanded={isExpanded}
                isAdmin={true}
              />
            </>
          )}
          
          <div className="h-px bg-cyber-cyan/20 mx-2 my-1" />
          <a 
            href={supportLink}
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-green-400 hover:bg-green-500/10 border border-transparent"
          >
            <div className="min-w-[20px] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            {isExpanded && (
              <span className="font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                {t('sidebarSupport')}
              </span>
            )}
          </a>
        </div>
      </motion.div>

      {/* Modals */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={handleDepositSuccess}
        receiverAddress={depositAddress}
        updateBalance={(newBal) => {
          setBalanceTon(newBal);
          if (onBalanceUpdate) onBalanceUpdate(newBal);
        }}
      />
      
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={handleWithdrawSuccess}
        currentBalance={balanceTon}
        userWallet={user?.wallet_address}
        updateBalance={(newBal) => {
          setBalanceTon(newBal);
          if (onBalanceUpdate) onBalanceUpdate(newBal);
        }}
      />
    </>
  );

  function NavItem({ icon, label, path, isExpanded, isAdmin = false, testId, onClick }) {
    const isActive = path ? location.pathname === path : false;
    // Normalize map/island/game to same path for tutorial matching
    const normalizedAllowed = allowedRoute === '/island' ? ['/island', '/map', '/game'] : (allowedRoute ? [allowedRoute] : []);
    const isDisabledByTutorial = isTutorialActive && allowedRoute && path && !normalizedAllowed.includes(path);

    const handleClick = () => {
      if (isDisabledByTutorial) return;
      if (onClick) { onClick(); return; }
      if (path) navigate(path);
    };

    return (
      <div
        onClick={handleClick}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isDisabledByTutorial) { e.preventDefault(); handleClick(); } }}
        data-testid={testId}
        role="link"
        tabIndex={isDisabledByTutorial ? -1 : 0}
        aria-label={typeof label === 'string' ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        aria-disabled={isDisabledByTutorial || undefined}
        title={typeof label === 'string' ? label : undefined}
        className={`relative flex items-center gap-3 p-3 rounded-xl transition-all
          outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60
          ${isDisabledByTutorial ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          ${isActive 
            ? isAdmin
              ? 'text-red-400 bg-red-500/20 border border-red-500/30 shadow-lg shadow-red-500/10'
              : 'text-cyber-cyan bg-cyber-cyan/20 border border-cyber-cyan/30 shadow-lg shadow-cyber-cyan/10' 
            : isAdmin
              ? 'text-red-400/70 hover:bg-red-500/10 hover:text-red-400 border border-transparent'
              : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
      >
        <div className="min-w-[20px] flex items-center justify-center">{icon}</div>
        {isExpanded && (
          <span className="font-bold text-xs uppercase tracking-widest whitespace-nowrap">
            {label}
          </span>
        )}
      </div>
    );
  }
}
