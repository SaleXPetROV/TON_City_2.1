import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import LandingPage from "@/pages/LandingPage";
import GamePage from "@/pages/GamePage";
import MapPage from "@/pages/MapPage";
import TonIslandPage from "@/pages/TonIslandPage";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import IncomeTablePage from "@/pages/IncomeTablePage";
import TradingPage from "@/pages/TradingPageNew";
import MarketplacePage from "@/pages/MarketplacePage";
import MyBusinessesPage from "@/pages/MyBusinessesPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import TutorialPage from "@/pages/TutorialPage";
import ChatPage from "@/pages/ChatPage";
import AuthPage from '@/pages/AuthPage';
import GoogleCallback from '@/pages/GoogleCallback';
import SettingsPage from '@/pages/SettingsPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import SecurityPage from '@/pages/SecurityPage';
import TransactionHistoryPage from '@/pages/TransactionHistoryPage';
import CreditPage from '@/pages/CreditPage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import MobileNav from '@/components/MobileNav';
import MaintenanceOverlay from '@/components/MaintenanceOverlay';
import BlockedOverlay from '@/components/BlockedOverlay';
import DurabilityBanner from '@/components/DurabilityBanner';
import { TutorialProvider } from '@/context/TutorialContext';
import TutorialTour from '@/components/tutorial/TutorialTour';
import TutorialStartModal from '@/components/tutorial/TutorialStartModal';
import { TutorialFinishConfirm, TutorialCompletedModal } from '@/components/tutorial/TutorialFinishModal';
import "@/App.css";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Check if running inside Telegram Mini App
const isTelegramMiniApp = () => {
  try {
    return window.Telegram?.WebApp?.initData?.length > 0;
  } catch {
    return false;
  }
};

// Get Telegram user data if available
const getTelegramUser = () => {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [isTgApp, setIsTgApp] = useState(false);
  
  // Function to refresh user balance from server (called only after user actions)
  const refreshBalance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(prev => prev ? { 
          ...prev, 
          balance_ton: data.balance_ton, 
          plots_owned: data.plots_owned,
          businesses_owned: data.businesses_owned 
        } : data);
      }
    } catch (e) {
      console.error("[App.js] refreshBalance error:", e);
    }
  }, []);
  
  // Function to update balance directly (for immediate optimistic updates)
  const updateBalance = useCallback((newBalance) => {
    setUser(prev => prev ? { ...prev, balance_ton: newBalance } : prev);
  }, []);

  // Listen for global balance updates (from WithdrawModal, DepositModal, etc.)
  useEffect(() => {
    const handleBalanceUpdate = (e) => {
      if (e.detail?.balance !== undefined) {
        setUser(prev => prev ? { ...prev, balance_ton: e.detail.balance } : prev);
      }
    };
    window.addEventListener('balanceUpdate', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdate', handleBalanceUpdate);
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    console.log('[App.js] checkAuth: token =', token ? 'exists' : 'null');
    
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[App.js] checkAuth: response status =', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[App.js] checkAuth: user data =', data);
          setUser(data);
        } else {
          console.log('[App.js] checkAuth: invalid token, removing');
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (e) {
        console.error("[App.js] checkAuth error:", e);
        localStorage.removeItem('token');
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  useEffect(() => {
    // Initialize Telegram Mini App
    if (isTelegramMiniApp()) {
      setIsTgApp(true);
      const tgUser = getTelegramUser();
      console.log('[App.js] Running as Telegram Mini App, user:', tgUser);
      
      // Set Telegram theme colors
      try {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0a0a0a');
        tg.setBackgroundColor('#0a0a0a');
      } catch (e) {
        console.warn('[App.js] Telegram theme setup error:', e);
      }
    }
    
    checkAuth();
    
    // Слушатель на изменение localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Suppress script errors that come from external sources (CORS issues)
  useEffect(() => {
    const handleError = (event) => {
      // Suppress "Script error." which comes from cross-origin scripts
      if (event.message === 'Script error.' || event.message?.includes('Script error')) {
        event.preventDefault();
        console.warn('[App.js] Suppressed cross-origin script error');
        return true;
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      uiPreferences={{ theme: 'DARK' }}
      actionsConfiguration={{
        twaReturnUrl: window.location.origin
      }}
    >
      <LanguageProvider user={user}>
        <div className="App min-h-screen bg-void">
          <div className="noise-overlay" />
          
          {/* Maintenance Overlay - shows for all users except admins (checked inside component) */}
          <MaintenanceOverlay />
          
          {/* Blocked User Overlay */}
          <BlockedOverlay user={user} />
          
          <BrowserRouter>
            <TutorialProvider user={user}>
              {/* Global low-durability alert banner (<20%) */}
              <DurabilityBanner user={user} />

              {/* Mobile Bottom Navigation */}
              <MobileNav user={user} refreshBalance={refreshBalance} />

              {/* Tutorial overlays */}
              <TutorialStartModal />
              <TutorialTour />
              <TutorialFinishConfirm />
              <TutorialCompletedModal />

              <Routes>
                <Route path="/" element={<LandingPage user={user} setUser={setUser} />} />
                <Route path="/auth" element={<AuthPage setUser={setUser} onAuthSuccess={checkAuth} />} />
                <Route path="/auth/google/callback" element={<GoogleCallback setUser={setUser} onAuthSuccess={checkAuth} />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/map" element={<TonIslandPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/island" element={<TonIslandPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/game" element={<TonIslandPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/game/:cityId" element={<GamePage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/dashboard" element={<DashboardPage user={user} refreshBalance={refreshBalance} />} />
                <Route path="/admin" element={<AdminPage user={user} />} />
                <Route path="/income-table" element={<IncomeTablePage user={user} />} />
                <Route path="/calculator" element={<IncomeTablePage user={user} />} />
                <Route path="/trading" element={<TradingPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/credit" element={<CreditPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/marketplace" element={<MarketplacePage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/my-businesses" element={<MyBusinessesPage user={user} refreshBalance={refreshBalance} updateBalance={updateBalance} />} />
                <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
                <Route path="/tutorial" element={<TutorialPage user={user} />} />
                <Route path="/chat" element={<ChatPage user={user} />} />
                <Route path="/settings" element={<SettingsPage user={user} setUser={setUser} onLogout={handleLogout} refreshBalance={refreshBalance} />} />
                <Route path="/security" element={<SecurityPage user={user} />} />
                <Route path="/history" element={<TransactionHistoryPage user={user} />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Routes>
            </TutorialProvider>
          </BrowserRouter>
          
          <Toaster position="bottom-right" theme="dark" closeButton richColors />
        </div>
      </LanguageProvider>
    </TonConnectUIProvider>
  );
}

export default App;
