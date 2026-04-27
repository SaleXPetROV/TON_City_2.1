import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';
import { 
  Users, Building2, DollarSign, TrendingUp, Settings, 
  CreditCard, Bell, Gift, RefreshCw, Check, X, ArrowLeft, Wallet, Copy,
  Wrench, Play, Clock, Home, Calendar, Map, Trash2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import axios from 'axios';
import WalletSettings from '@/components/WalletSettings';
import RevenueAnalytics from '@/components/RevenueAnalytics';
import TreasuryWarning from '@/components/TreasuryWarning';
import AdminDataPanel from '@/components/AdminDataPanel';
import ContractDeployerPanel from '@/components/ContractDeployerPanel';
import { toUserFriendlyAddress } from '@/lib/tonAddress';
import { tonToCity, formatCity } from '@/lib/currency';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPage({ user }) {
  const navigate = useNavigate();
  const wallet = useTonWallet();
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);
  
  const [stats, setStats] = useState(null);
  const [treasuryHealth, setTreasuryHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [promos, setPromos] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Maintenance states
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Form states
  const [promoName, setPromoName] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoMaxUses, setPromoMaxUses] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  
  // Credit admin states
  const [credits, setCredits] = useState([]);
  const [multiAccounts, setMultiAccounts] = useState(null);
  const [creditSettings, setCreditSettings] = useState({ government_interest_rate: 0.15 });
  const [govRate, setGovRate] = useState('15');
  
  // Withdrawal selection states
  const [selectedWithdrawals, setSelectedWithdrawals] = useState(new Set());
  const [selectAllWithdrawals, setSelectAllWithdrawals] = useState(false);
  
  // Admin wallet settings
  const [walletConfigs, setWalletConfigs] = useState([]);
  const [newWallet, setNewWallet] = useState({ address: '', percentage: 100, mnemonic: '' });
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Tax settings
  const [taxSettings, setTaxSettings] = useState({
    small_business_tax: 5,
    medium_business_tax: 8,
    large_business_tax: 10,
    land_business_sale_tax: 10
  });
  
  // User details
  const [userDetailId, setUserDetailId] = useState('');
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Transaction search and filtering
  const [txSearchId, setTxSearchId] = useState('');
  const [txSearchResult, setTxSearchResult] = useState(null);
  const [txFilter, setTxFilter] = useState('all');
  const [loadingTxSearch, setLoadingTxSearch] = useState(false);
  
  // Telegram bot
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [adminTelegramId, setAdminTelegramId] = useState('');
  const [settingWebhook, setSettingWebhook] = useState(false);
  
  // Wallet settings
  const [senderMnemonic, setSenderMnemonic] = useState('');
  const [senderWalletAddress, setSenderWalletAddress] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  
  const token = localStorage.getItem('ton_city_token') || localStorage.getItem('token');

  // S5 + UX: silent redirect — fire immediately before any UI is shown.
  // If user is not admin, navigate away synchronously so no spinner/error flashes.
  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    // If we already have `user` prop from App.js, decide instantly without API call
    if (user && typeof user.is_admin !== 'undefined' && !user.is_admin) {
      navigate('/', { replace: true });
      return;
    }
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const checkAdmin = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.data.is_admin) {
        // Silent redirect — no toast, no alert
        navigate('/', { replace: true });
        return;
      }

      setIsAdmin(true);
      loadData();
      loadMaintenanceStatus();
    } catch (error) {
      // Silent redirect even on error
      navigate('/', { replace: true });
    }
  };

  const loadMaintenanceStatus = async () => {
    try {
      const response = await axios.get(`${API}/admin/maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMaintenanceEnabled(response.data.enabled || false);
    } catch (error) {
      console.error('Failed to load maintenance status:', error);
    }
  };

  const toggleMaintenance = async (startNow = false, scheduledAt = null) => {
    try {
      const newState = !maintenanceEnabled;
      await axios.post(`${API}/admin/maintenance`, {
        enabled: newState,
        scheduled_at: startNow ? null : scheduledAt
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMaintenanceEnabled(newState);
      setShowMaintenanceDialog(false);
      
      if (newState) {
        toast.success(startNow ? 'Технические работы начаты' : 'Технические работы запланированы');
      } else {
        toast.success('Технические работы завершены');
      }
    } catch (error) {
      console.error('Failed to toggle maintenance:', error);
      toast.error('Ошибка при изменении статуса');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, usersRes, txRes, promosRes, announcementsRes, treasuryRes, creditsRes, creditSettingsRes, taxRes, walletsRes, multiAccRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users?limit=50`, { headers }),
        axios.get(`${API}/admin/transactions?limit=100`, { headers }),
        axios.get(`${API}/admin/promos`, { headers }).catch(() => ({ data: { promos: [] } })),
        axios.get(`${API}/admin/announcements`, { headers }).catch(() => ({ data: { announcements: [] } })),
        axios.get(`${API}/admin/treasury-health`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/credits`, { headers }).catch(() => ({ data: { credits: [] } })),
        axios.get(`${API}/admin/credit-settings`, { headers }).catch(() => ({ data: { government_interest_rate: 0.15 } })),
        axios.get(`${API}/admin/settings/tax`, { headers }).catch(() => ({ data: { land_market_tax: 10, resource_market_tax: 5, business_upgrade_tax: 3 } })),
        axios.get(`${API}/admin/wallets`, { headers }).catch(() => ({ data: { wallets: [] } })),
        axios.get(`${API}/admin/multi-accounts`, { headers }).catch(() => ({ data: { ip_duplicates: [], device_duplicates: [] } })),
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setTransactions(txRes.data.transactions || []);
      setPromos(promosRes.data.promos || []);
      setAnnouncements(announcementsRes.data.announcements || []);
      setTreasuryHealth(treasuryRes.data);
      setCredits(creditsRes.data.credits || []);
      setMultiAccounts(multiAccRes.data);
      if (creditSettingsRes.data) {
        setCreditSettings(creditSettingsRes.data);
        setGovRate(((creditSettingsRes.data.government_interest_rate || 0.15) * 100).toFixed(0));
      }
      if (taxRes.data) {
        setTaxSettings(taxRes.data);
      }
      if (walletsRes.data) {
        setWalletConfigs(walletsRes.data.wallets || []);
      }
      
      // Load wallet and telegram settings
      await loadWalletSettings();
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const approveWithdrawal = async (txId) => {
    try {
      await axios.post(`${API}/admin/withdrawal/approve/${txId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Вывод одобрен и отправлен');
      // Remove from list - update transactions state
      setTransactions(prev => prev.filter(tx => tx.id !== txId));
      setSelectedWithdrawals(prev => {
        const newSet = new Set(prev);
        newSet.delete(txId);
        return newSet;
      });
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка при одобрении заявки';
      toast.error(msg);
    }
  };

  const rejectWithdrawal = async (txId) => {
    try {
      await axios.post(`${API}/admin/withdrawal/reject/${txId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Вывод отклонён, средства возвращены');
      // Remove from list - update transactions state
      setTransactions(prev => prev.filter(tx => tx.id !== txId));
      setSelectedWithdrawals(prev => {
        const newSet = new Set(prev);
        newSet.delete(txId);
        return newSet;
      });
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка при отклонении заявки';
      toast.error(msg);
    }
  };

  // Bulk withdrawal actions
  const handleSelectAllWithdrawals = (checked) => {
    setSelectAllWithdrawals(checked);
    if (checked) {
      setSelectedWithdrawals(new Set(pendingWithdrawals.map(tx => tx.id)));
    } else {
      setSelectedWithdrawals(new Set());
    }
  };

  const toggleWithdrawalSelection = (txId) => {
    setSelectedWithdrawals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const bulkApproveWithdrawals = async () => {
    if (selectedWithdrawals.size === 0) {
      toast.error('Выберите заявки для одобрения');
      return;
    }
    
    let success = 0;
    let failed = 0;
    
    for (const txId of selectedWithdrawals) {
      try {
        await axios.post(`${API}/admin/withdrawal/approve/${txId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        success++;
      } catch {
        failed++;
      }
    }
    
    toast.success(`Одобрено: ${success}, Ошибок: ${failed}`);
    setSelectedWithdrawals(new Set());
    setSelectAllWithdrawals(false);
    loadData();
  };

  const bulkRejectWithdrawals = async () => {
    if (selectedWithdrawals.size === 0) {
      toast.error('Выберите заявки для отклонения');
      return;
    }
    
    let success = 0;
    let failed = 0;
    
    for (const txId of selectedWithdrawals) {
      try {
        await axios.post(`${API}/admin/withdrawal/reject/${txId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        success++;
      } catch {
        failed++;
      }
    }
    
    toast.success(`Отклонено и возвращено: ${success}, Ошибок: ${failed}`);
    setSelectedWithdrawals(new Set());
    setSelectAllWithdrawals(false);
    loadData();
  };

  // Tax settings
  const saveTaxSettings = async () => {
    try {
      await axios.post(`${API}/admin/settings/tax`, taxSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Налоговые настройки сохранены');
    } catch (error) {
      toast.error('Ошибка сохранения налогов');
    }
  };

  // User resource update
  const updateUserResources = async (userId, resources) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/resources`, { resources }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ресурсы пользователя обновлены');
    } catch (error) {
      toast.error('Ошибка обновления ресурсов');
    }
  };

  const createPromo = async () => {
    try {
      await axios.post(`${API}/admin/promo/create`, null, {
        params: { name: promoName, amount: parseFloat(promoAmount), max_uses: parseInt(promoMaxUses) },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Promo created');
      setPromoName('');
      setPromoAmount('');
      setPromoMaxUses('');
      loadData();
    } catch (error) {
      toast.error('Failed to create promo');
    }
  };

  const createAnnouncement = async () => {
    try {
      await axios.post(`${API}/admin/announcement`, null, {
        params: { title: announcementTitle, message: announcementMessage, lang: 'all' },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Announcement created');
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      loadData();
    } catch (error) {
      toast.error('Failed to create announcement');
    }
  };

  const setUserAdmin = async (walletAddress, isAdminStatus) => {
    try {
      await axios.post(`${API}/admin/user/set-admin/${walletAddress}`, null, {
        params: { is_admin: isAdminStatus },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Admin status ${isAdminStatus ? 'granted' : 'revoked'}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update admin status');
    }
  };

  // Credit admin actions
  const handleUpdateGovRate = async () => {
    try {
      const rate = parseFloat(govRate) / 100;
      await axios.post(`${API}/admin/credit-settings?government_interest_rate=${rate}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Ставка обновлена: ${govRate}%`);
      loadData();
    } catch (e) { toast.error('Ошибка обновления'); }
  };

  const handleCreatePromo = async () => {
    if (!promoName || !promoAmount) {
      toast.error('Заполните название и сумму');
      return;
    }
    try {
      await axios.post(`${API}/admin/promo/create`, {
        name: promoName,
        code: promoCode || promoName.toUpperCase().replace(/\s/g, ''),
        amount: parseFloat(promoAmount),
        max_uses: parseInt(promoMaxUses) || 100,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Промокод создан');
      setPromoName('');
      setPromoAmount('');
      setPromoMaxUses('');
      setPromoCode('');
      loadData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const handleDeletePromo = async (promoId) => {
    if (!window.confirm('Удалить этот промокод?')) return;
    try {
      await axios.delete(`${API}/admin/promo/${promoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Промокод удалён');
      setPromos(promos.filter(p => p.id !== promoId));
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка удаления'); }
  };

  const handleLoadUserDetail = async () => {
    if (!userDetailId.trim()) return;
    setLoadingDetail(true);
    setUserDetail(null);
    try {
      const res = await axios.get(`${API}/admin/user-details/${encodeURIComponent(userDetailId.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserDetail(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Пользователь не найден'); }
    finally { setLoadingDetail(false); }
  };
  
  // Search transaction by ID
  const handleSearchTransaction = async () => {
    if (!txSearchId.trim()) return;
    setLoadingTxSearch(true);
    setTxSearchResult(null);
    try {
      const res = await axios.get(`${API}/admin/transaction/${encodeURIComponent(txSearchId.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTxSearchResult(res.data);
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Операция не найдена'); 
    }
    finally { setLoadingTxSearch(false); }
  };
  
  // Block/unblock user
  const handleBlockUser = async (userId, reason) => {
    try {
      await axios.post(`${API}/admin/user/${userId}/block`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Пользователь заблокирован');
      if (userDetail?.id === userId) {
        handleLoadUserDetail();
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка блокировки'); }
  };
  
  const handleUnblockUser = async (userId) => {
    try {
      await axios.post(`${API}/admin/user/${userId}/unblock`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Пользователь разблокирован');
      if (userDetail?.id === userId) {
        handleLoadUserDetail();
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка разблокировки'); }
  };

  const handleSetTelegramWebhook = async () => {
    if (!telegramBotToken.trim()) {
      toast.error('Введите токен бота');
      return;
    }
    setSettingWebhook(true);
    try {
      const res = await axios.post(`${API}/admin/telegram/set-webhook?bot_token=${encodeURIComponent(telegramBotToken.trim())}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Webhook установлен: ${res.data.url}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка установки'); }
    finally { setSettingWebhook(false); }
  };

  const handleSetAdminTelegramId = async () => {
    if (!adminTelegramId.trim()) {
      toast.error('Введите Telegram ID');
      return;
    }
    try {
      await axios.post(`${API}/admin/settings/telegram-admin-id?admin_telegram_id=${encodeURIComponent(adminTelegramId.trim())}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Telegram ID админа сохранён');
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
  };

  const handleAutoSetupWebhook = async () => {
    try {
      const res = await axios.post(`${API}/admin/settings/telegram-webhook`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Webhook автоматически настроен: ${res.data.webhook_url}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка автонастройки'); }
  };

  const handleSetTelegramBotUsername = async () => {
    if (!telegramBotUsername.trim()) {
      toast.error('Введите username бота');
      return;
    }
    try {
      await axios.post(`${API}/admin/settings/telegram-bot-username`, {
        username: telegramBotUsername.trim().replace('@', '')
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Username бота сохранён');
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
  };

  const handleSetSenderWallet = async () => {
    if (!senderMnemonic.trim()) {
      toast.error('Введите мнемонику');
      return;
    }
    try {
      const res = await axios.post(`${API}/admin/settings/sender-wallet`, {
        mnemonic: senderMnemonic.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Кошелёк отправителя сохранён');
      if (res.data.address) {
        setSenderWalletAddress(res.data.address);
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
  };

  const handleSetDepositAddress = async () => {
    if (!depositAddress.trim()) {
      toast.error('Введите адрес');
      return;
    }
    try {
      await axios.post(`${API}/admin/settings/deposit-address`, {
        address: depositAddress.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Адрес для пополнений сохранён');
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
  };

  const loadWalletSettings = async () => {
    try {
      // Load sender wallet config
      const senderRes = await axios.get(`${API}/admin/settings/sender-wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (senderRes.data.address) {
        setSenderWalletAddress(senderRes.data.address);
      }
      
      // Load deposit address config
      const depositRes = await axios.get(`${API}/admin/settings/deposit-address`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (depositRes.data.address) {
        setDepositAddress(depositRes.data.address);
      }
      
      // Load telegram config
      const tgRes = await axios.get(`${API}/admin/settings/telegram-bot`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (tgRes.data.admin_telegram_id) {
        setAdminTelegramId(tgRes.data.admin_telegram_id);
      }
      if (tgRes.data.bot_username) {
        setTelegramBotUsername(tgRes.data.bot_username);
      }
    } catch (e) {
      console.error('Failed to load wallet settings:', e);
    }
  };

  const AddressDisplay = ({ address, short = false }) => {
    if (!address) return <span className="text-text-muted">-</span>;
  
    // Если адрес уже в user-friendly формате (UQ... или EQ...), используем его напрямую
    // Если это raw адрес (0:...), тогда преобразуем
    let displayAddress = address;
  
    // Проверяем, является ли это raw адресом
    if (address.startsWith('0:') || address.startsWith('-1:')) {
      // Только в этом случае преобразуем
      displayAddress = toUserFriendlyAddress(address);
    }
    // Иначе используем адрес как есть (он уже user-friendly из API)
  
    const copyToClipboard = () => {
      navigator.clipboard.writeText(displayAddress);
      toast.success('Адрес скопирован');
    };
  
    const shortAddress = short 
      ? `${displayAddress.slice(0, 8)}...${displayAddress.slice(-6)}` 
      : displayAddress;
  
    return (
      <div className="flex items-center gap-2 group">
        <span className="font-mono text-sm break-all" title={displayAddress}>
          {shortAddress}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={copyToClipboard}
          className="h-6 w-6 opacity-50 hover:opacity-100"
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  const formatAddress = (address) => {
    if (!address) return '-';
    const friendly = toUserFriendlyAddress(address);
    return `${friendly.slice(0, 8)}...${friendly.slice(-6)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading || !isAdmin) {
    // S5: render nothing for non-admins (silent redirect already fired in useEffect)
    return null;
  }

  const pendingWithdrawals = transactions.filter(tx => tx.tx_type === 'withdrawal' && tx.status === 'pending');

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="glass-panel border-b border-grid-border px-4 lg:px-6 py-4">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 pl-12 lg:pl-0">
          <div className="flex items-center gap-2 lg:gap-4">
            <Button
              data-testid="admin-go-to-user-ui"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-text-muted hover:text-text-main"
            >
              <Home className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">На сайт</span>
            </Button>
            <h1 className="font-unbounded text-lg lg:text-xl font-bold text-text-main flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyber-cyan" />
              <span className="hidden sm:inline">{t('adminPanel')}</span>
              <span className="sm:hidden">Админ</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Maintenance Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="maintenance-toggle-btn"
                  variant="outline"
                  size="sm"
                  className={`transition-all ${
                    maintenanceEnabled 
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500/30' 
                      : 'border-grid-border hover:border-white/30'
                  }`}
                >
                  <Wrench className="w-4 h-4 lg:mr-2" />
                  <span className="hidden lg:inline">
                    {maintenanceEnabled ? 'Тех. работы (ВКЛ)' : 'Тех. работы'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-panel border-grid-border w-56">
                {!maintenanceEnabled ? (
                  <>
                    <DropdownMenuItem 
                      onClick={() => toggleMaintenance(true)}
                      className="cursor-pointer"
                    >
                      <Play className="w-4 h-4 mr-2 text-orange-400" />
                      Начать прямо сейчас
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowMaintenanceDialog(true)}
                      className="cursor-pointer"
                    >
                      <Clock className="w-4 h-4 mr-2 text-blue-400" />
                      Установить время начала
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem 
                    onClick={() => toggleMaintenance(false)}
                    className="cursor-pointer"
                  >
                    <Check className="w-4 h-4 mr-2 text-green-400" />
                    Закончить тех. работы
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="border-grid-border"
            >
              <RefreshCw className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">{t('refresh')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent className="glass-panel border-grid-border">
          <DialogHeader>
            <DialogTitle className="text-text-main flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Запланировать технические работы
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Укажите дату и время начала технических работ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="bg-panel border-grid-border text-text-main"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceDialog(false)}>
              Отмена
            </Button>
            <Button 
              onClick={() => toggleMaintenance(false, scheduledTime ? new Date(scheduledTime).toISOString() : null)}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!scheduledTime}
            >
              Запланировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards - Only unique metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Map className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-text-muted text-sm">Доход от продажи новой земли и бизнесов</span>
            </div>
            <div className="font-mono text-3xl text-purple-400">
              {formatCity(tonToCity((stats?.treasury?.first_sale_revenue || 0) + (stats?.treasury?.building_sales_income || 0)))} $CITY
            </div>
            <p className="text-xs text-text-muted mt-2">
              Земля: {formatCity(tonToCity(stats?.treasury?.first_sale_revenue || 0))} $CITY | 
              Бизнесы: {formatCity(tonToCity(stats?.treasury?.building_sales_income || 0))} $CITY
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-error" />
              </div>
              <span className="text-text-muted text-sm">{t('pendingWithdrawals')}</span>
            </div>
            <div className="font-mono text-3xl text-error">
              {stats?.pending_withdrawals || 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyber-cyan/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyber-cyan" />
              </div>
              <span className="text-text-muted text-sm">{t('activeUsers')}</span>
            </div>
            <div className="font-mono text-3xl text-cyber-cyan">
              {stats?.active_users_7d || 0} / {stats?.total_users || 0}
            </div>
          </motion.div>
        </div>

        {/* Treasury Health Warning */}
        {treasuryHealth && (
          <TreasuryWarning treasuryStats={treasuryHealth} lang={lang} />
        )}

        {/* Tabs */}
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="glass-panel border-grid-border flex-wrap">
            <TabsTrigger value="revenue" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              <DollarSign className="w-4 h-4 mr-2" />
              Доходы
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              {t('pendingWithdrawals')} ({pendingWithdrawals.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              {t('users')}
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              {t('transactions')}
            </TabsTrigger>
            <TabsTrigger value="promos" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              Promos
            </TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan">
              {t('announcements')}
            </TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
              Данные
            </TabsTrigger>
            <TabsTrigger value="credits" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
              Кредиты
            </TabsTrigger>
            <TabsTrigger value="userdetails" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
              Детали
            </TabsTrigger>
            <TabsTrigger value="taxes" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
              Налоги
            </TabsTrigger>
            <TabsTrigger value="contract" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400">
              Контракт
            </TabsTrigger>
            <TabsTrigger value="multiaccounts" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
              Мульти-аккаунты
            </TabsTrigger>
          </TabsList>

          {/* Revenue Analytics Tab */}
          <TabsContent value="revenue">
            <RevenueAnalytics token={token} />
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-unbounded text-lg font-bold text-text-main">
                  {t('pendingWithdrawals')} ({pendingWithdrawals.length})
                </h2>
                
                {pendingWithdrawals.length > 0 && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectAllWithdrawals}
                        onChange={(e) => handleSelectAllWithdrawals(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5"
                      />
                      Выбрать все
                    </label>
                    
                    {selectedWithdrawals.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={bulkApproveWithdrawals}
                          className="bg-success hover:bg-success/80"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Одобрить ({selectedWithdrawals.size})
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={bulkRejectWithdrawals}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Отклонить ({selectedWithdrawals.size})
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {pendingWithdrawals.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  No pending withdrawals
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {pendingWithdrawals.map((tx) => (
                      <div
                        key={tx.id}
                        className={`glass-panel rounded-lg p-4 transition-all ${selectedWithdrawals.has(tx.id) ? 'ring-2 ring-cyber-cyan' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          <input 
                            type="checkbox" 
                            checked={selectedWithdrawals.has(tx.id)}
                            onChange={() => toggleWithdrawalSelection(tx.id)}
                            className="w-5 h-5 mt-2 rounded border-white/20 bg-white/5 cursor-pointer"
                          />
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="text-xs text-text-muted mb-1">Пользователь:</div>
                              <div className="text-white text-sm">{tx.user_username || tx.user_id}</div>
                            </div>
                            <div>
                              <div className="text-xs text-text-muted mb-1">Куда (To):</div>
                              <AddressDisplay address={tx.to_address_display || tx.to_address} />
                            </div>
                            <div className="text-xs text-text-muted">
                              {formatDate(tx.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-2xl text-signal-amber">
                              {formatCity(tonToCity(tx.amount_ton))} $CITY
                            </div>
                            <div className="text-sm text-text-muted">
                              Комиссия: {formatCity(tonToCity(tx.commission))} $CITY
                            </div>
                            <div className="text-sm text-success">
                              К выплате: {formatCity(tonToCity(tx.amount_ton - (tx.commission || 0)))} $CITY
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveWithdrawal(tx.id)}
                              className="bg-success hover:bg-success/80"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Одобрить
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectWithdrawal(tx.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Отклонить
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-unbounded text-lg font-bold text-text-main mb-6">
                {t('users')} ({users.length})
              </h2>
              
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.wallet_address}
                      className="glass-panel rounded-lg p-4 flex items-center gap-4"
                    >
                      <div className="flex-1">
                        <div className="font-mono text-sm text-text-main flex items-center gap-2">
                          {formatAddress(user.wallet_address)}
                          {user.is_admin && (
                            <span className="px-2 py-0.5 bg-cyber-cyan/20 text-cyber-cyan text-xs rounded">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted">
                          Level: {user.level} | Plots: {user.plots_owned?.length || 0} | Businesses: {user.businesses_owned?.length || 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-success">
                          {formatCity(tonToCity(user.total_income || 0))} $CITY income
                        </div>
                        <div className="text-xs text-text-muted">
                          Balance: {formatCity(tonToCity(user.balance_ton || 0))} $CITY
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={user.is_admin ? "destructive" : "outline"}
                        onClick={() => setUserAdmin(user.wallet_address, !user.is_admin)}
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-unbounded text-lg font-bold text-text-main">
                  {t('transactions')}
                </h2>
                
                {/* Filter */}
                <div className="flex gap-2 flex-wrap">
                  {['all', 'deposit', 'withdrawal', 'land_purchase', 'business_purchase', 'other'].map(filter => (
                    <Button
                      key={filter}
                      size="sm"
                      variant={txFilter === filter ? 'default' : 'outline'}
                      onClick={() => setTxFilter(filter)}
                      className={txFilter === filter ? 'bg-cyber-cyan text-black' : 'border-white/10'}
                    >
                      {filter === 'all' ? 'Все' : 
                       filter === 'deposit' ? 'Пополнения' : 
                       filter === 'withdrawal' ? 'Выводы' : 
                       filter === 'land_purchase' ? 'Покупка земли' : 
                       filter === 'business_purchase' ? 'Покупка бизнеса' : 'Другое'}
                    </Button>
                  ))}
                </div>
              </div>
              
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {transactions
                    .filter(tx => {
                      if (txFilter === 'all') return true;
                      if (txFilter === 'deposit') return tx.tx_type === 'deposit';
                      if (txFilter === 'withdrawal') return tx.tx_type === 'withdrawal';
                      if (txFilter === 'land_purchase') return tx.tx_type === 'land_purchase' || tx.type === 'land_purchase';
                      if (txFilter === 'business_purchase') return tx.tx_type === 'business_purchase' || tx.type === 'business_purchase';
                      return !['deposit', 'withdrawal', 'land_purchase', 'business_purchase'].includes(tx.tx_type);
                    })
                    .map((tx) => {
                      const isDepositOrWithdraw = ['deposit', 'withdrawal'].includes(tx.tx_type);
                      const amount = tx.amount_ton || tx.amount || 0;
                      const isNegative = tx.tx_type === 'withdrawal' || amount < 0;
                      
                      return (
                        <div
                          key={tx.id}
                          className="glass-panel rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Status */}
                            <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${
                              tx.status === 'completed' ? 'bg-success/20 text-success' :
                              tx.status === 'pending' ? 'bg-signal-amber/20 text-signal-amber' :
                              tx.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-error/20 text-error'
                            }`}>
                              {tx.status_display || tx.status}
                            </span>
                            
                            {/* Type */}
                            <span className="text-text-muted whitespace-nowrap">
                              {tx.type_name || tx.tx_type}
                            </span>
                            
                            {/* User */}
                            {tx.user_username && (
                              <span className="text-cyber-cyan font-medium">{tx.user_username}</span>
                            )}
                            
                            {/* Amount with correct sign */}
                            <span className={`font-mono whitespace-nowrap ml-auto ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                              {isNegative ? '-' : '+'}{formatCity(tonToCity(Math.abs(amount)))} $CITY
                            </span>
                            
                            {/* Date */}
                            <span className="text-text-muted text-xs whitespace-nowrap">
                              {formatDate(tx.created_at)}
                            </span>
                          </div>
                          
                          {/* Details row */}
                          <div className="mt-2 pt-2 border-t border-white/5 text-xs">
                            {isDepositOrWithdraw ? (
                              // For deposits/withdrawals - show wallets
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-text-muted">
                                {tx.from_address && (
                                  <span>От: <span className="font-mono text-white">{formatAddress(tx.from_address)}</span></span>
                                )}
                                {tx.to_address && (
                                  <span>Кому: <span className="font-mono text-white">{formatAddress(tx.to_address)}</span></span>
                                )}
                              </div>
                            ) : (
                              // For other operations - show transaction ID
                              <div className="flex items-center gap-2 text-text-muted">
                                <span>ID операции:</span>
                                <span className="font-mono text-white">{tx.id}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(tx.id);
                                    toast.success('ID скопирован');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Promos Tab */}
          <TabsContent value="promos">
            <div className="space-y-6">
              {/* Promo code creation */}
              <div className="glass-panel rounded-xl p-4 border border-green-500/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Создать промокод</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <Input
                    data-testid="promo-name-input"
                    placeholder="Название"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                  <Input
                    data-testid="promo-code-input"
                    placeholder="Код (авто)"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                  <Input
                    data-testid="promo-amount-input"
                    type="number"
                    step="0.01"
                    placeholder="Сумма $CITY"
                    value={promoAmount}
                    onChange={(e) => setPromoAmount(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                  <Input
                    type="number"
                    placeholder="Макс. использований"
                    value={promoMaxUses}
                    onChange={(e) => setPromoMaxUses(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <Button data-testid="create-promo-btn" onClick={handleCreatePromo} className="btn-cyber">
                  <Gift className="w-4 h-4 mr-1" /> Создать промокод
                </Button>
              </div>

              {/* Existing promos */}
              <div className="glass-panel rounded-xl p-4 border border-white/10">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Промокоды ({promos.length})</h3>
                <p className="text-xs text-text-muted mb-3">Каждый пользователь может использовать промокод только 1 раз</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {promos.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                      <div>
                        <div className="font-mono text-cyber-cyan font-bold">{p.code || p.name}</div>
                        <div className="text-text-muted text-xs">{p.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-signal-amber font-bold">{formatCity(tonToCity(p.amount))} $CITY</div>
                          <div className="text-xs text-text-muted">Использовано: {p.current_uses || 0}/{p.max_uses || '∞'}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDeletePromo(p.id)}
                          data-testid={`delete-promo-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {promos.length === 0 && (
                    <p className="text-text-muted text-center py-4">Нет промокодов</p>
                  )}
                </div>
              </div>

              {/* Telegram Bot Settings */}
              <div className="glass-panel rounded-xl p-4 border border-[#26A5E4]/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Telegram бот</h3>
                <p className="text-text-muted text-xs mb-3">Настройка бота для уведомлений о выводах и бизнесах</p>
                
                <div className="space-y-4">
                  {/* Bot Username */}
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Username бота (без @)</label>
                    <div className="flex gap-2">
                      <Input
                        data-testid="telegram-bot-username"
                        type="text"
                        placeholder="YourBotName_bot"
                        value={telegramBotUsername}
                        onChange={(e) => setTelegramBotUsername(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                      <Button onClick={handleSetTelegramBotUsername} className="bg-[#26A5E4] text-white">
                        Сохранить
                      </Button>
                    </div>
                    <p className="text-xs text-text-muted mt-1">Username бота можно найти в @BotFather после создания</p>
                  </div>
                  
                  {/* Bot Token */}
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Токен бота (от @BotFather)</label>
                    <div className="flex gap-2">
                      <Input
                        data-testid="telegram-bot-token"
                        type="password"
                        placeholder="1234567890:ABCdefGHI..."
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                      <Button onClick={handleSetTelegramWebhook} disabled={settingWebhook} className="bg-[#26A5E4] text-white">
                        {settingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Admin Telegram ID */}
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Telegram ID админа (для уведомлений о выводах)</label>
                    <div className="flex gap-2">
                      <Input
                        data-testid="admin-telegram-id"
                        type="text"
                        placeholder="123456789"
                        value={adminTelegramId}
                        onChange={(e) => setAdminTelegramId(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                      <Button onClick={handleSetAdminTelegramId} className="bg-[#26A5E4] text-white">
                        Сохранить
                      </Button>
                    </div>
                    <p className="text-xs text-text-muted mt-1">Узнать ID: напишите @userinfobot в Telegram</p>
                  </div>
                  
                  {/* Auto Webhook Setup */}
                  <div className="pt-2 border-t border-white/10">
                    <Button onClick={handleAutoSetupWebhook} className="w-full bg-gradient-to-r from-[#26A5E4] to-[#0088cc] text-white">
                      🔄 Автонастройка Webhook
                    </Button>
                    <p className="text-xs text-text-muted mt-1 text-center">Автоматически настроит webhook для получения команд бота</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-unbounded text-lg font-bold text-text-main">
                  {t('announcements')}
                </h2>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="btn-cyber">
                      <Bell className="w-4 h-4 mr-2" />
                      {t('createAnnouncement')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-panel border-grid-border text-text-main">
                    <DialogHeader>
                      <DialogTitle>Create Announcement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Title"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        className="bg-panel border-grid-border"
                      />
                      <textarea
                        placeholder="Message"
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        className="w-full h-32 bg-panel border border-grid-border rounded-lg p-3 text-text-main"
                      />
                      <Button onClick={createAnnouncement} className="w-full btn-cyber">
                        Create & Broadcast
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="glass-panel rounded-lg p-4"
                  >
                    <div className="font-unbounded text-text-main mb-2">
                      {ann.title}
                    </div>
                    <div className="text-text-muted text-sm mb-2">
                      {ann.message}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatDate(ann.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* DATA TAB - Players & Prices */}
          <TabsContent value="data">
            <AdminDataPanel token={token} />
          </TabsContent>

          {/* CREDITS TAB */}
          <TabsContent value="credits">
            <div className="space-y-6">
              {/* Government rate settings */}
              <div className="glass-panel rounded-xl p-4 border border-amber-500/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Ставка государственного кредита</h3>
                <div className="flex items-center gap-3">
                  <Input
                    data-testid="gov-rate-input"
                    type="number"
                    min="1"
                    max="100"
                    value={govRate}
                    onChange={(e) => setGovRate(e.target.value)}
                    className="w-24 bg-white/5 border-white/10"
                    placeholder="%"
                  />
                  <span className="text-text-muted">%</span>
                  <Button onClick={handleUpdateGovRate} size="sm" className="btn-cyber">
                    <Check className="w-4 h-4 mr-1" /> Сохранить
                  </Button>
                  <span className="text-text-muted text-xs">Текущая: {(creditSettings.government_interest_rate * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Active credits with FULL user ID */}
              <div className="glass-panel rounded-xl p-4 border border-white/10">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">
                  Активные кредиты ({credits.filter(c => ['active','overdue'].includes(c.status)).length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {credits.filter(c => ['active','overdue'].includes(c.status)).map(c => (
                    <div key={c.id} className={`p-4 bg-white/5 rounded-lg text-sm border ${c.status === 'overdue' ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded font-bold ${c.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {c.status === 'overdue' ? '⚠️ ПРОСРОЧЕН' : '✓ Активный'}
                          </span>
                          <span className="text-text-muted">{c.lender_name}</span>
                        </div>
                        {c.status === 'overdue' && c.seized_building && (
                          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                            🏢 Здание изъято
                          </span>
                        )}
                      </div>
                      
                      {/* Full borrower ID with copy */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-text-muted text-xs">ID заёмщика:</span>
                        <code 
                          className="text-white font-mono text-xs bg-white/10 px-2 py-1 rounded cursor-pointer hover:bg-white/20 transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(c.borrower_id);
                            toast.success('ID скопирован!');
                          }}
                          title="Нажмите для копирования"
                        >
                          {c.borrower_id}
                        </code>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white/5 p-2 rounded">
                          <span className="text-text-muted block">Сумма</span>
                          <span className="text-white font-bold">{formatCity(tonToCity(c.amount))} $CITY</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded">
                          <span className="text-text-muted block">Ставка</span>
                          <span className="text-white font-bold">{(c.interest_rate*100).toFixed(0)}%</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded">
                          <span className="text-text-muted block">Остаток</span>
                          <span className="text-amber-400 font-bold">{formatCity(tonToCity(c.remaining || 0))} $CITY</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded">
                          <span className="text-text-muted block">Удержание</span>
                          <span className="text-white font-bold">{(c.salary_deduction_percent*100).toFixed(0)}%</span>
                        </div>
                      </div>
                      
                      {/* Seized building info */}
                      {c.status === 'overdue' && c.seized_building && (
                        <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
                          <span className="text-purple-400">Изъятое здание: </span>
                          <span className="text-white">{c.seized_building.type} (Level {c.seized_building.level})</span>
                          <span className="text-text-muted ml-2">→ Выставлено на торги</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {credits.filter(c => ['active','overdue'].includes(c.status)).length === 0 && (
                    <p className="text-text-muted text-center py-8">Нет активных кредитов</p>
                  )}
                </div>
              </div>
              
              {/* History of paid credits */}
              <div className="glass-panel rounded-xl p-4 border border-green-500/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">
                  Погашенные кредиты ({credits.filter(c => c.status === 'paid').length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {credits.filter(c => c.status === 'paid').map(c => (
                    <div key={c.id} className="p-2 bg-green-500/5 rounded-lg text-xs border border-green-500/20">
                      <div className="flex justify-between items-center">
                        <code 
                          className="text-white font-mono cursor-pointer hover:text-green-400"
                          onClick={() => {
                            navigator.clipboard.writeText(c.borrower_id);
                            toast.success('ID скопирован!');
                          }}
                        >
                          {c.borrower_id}
                        </code>
                        <span className="text-green-400">✓ {formatCity(tonToCity(c.amount))} $CITY погашено</span>
                      </div>
                    </div>
                  ))}
                  {credits.filter(c => c.status === 'paid').length === 0 && (
                    <p className="text-text-muted text-center py-4">Нет погашенных кредитов</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* USER DETAILS TAB */}
          <TabsContent value="userdetails">
            <div className="space-y-4">
              {/* Search user */}
              <div className="glass-panel rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Поиск пользователя</h3>
                <div className="flex gap-3">
                  <Input
                    data-testid="user-search-input"
                    placeholder="ID, email или wallet"
                    value={userDetailId}
                    onChange={(e) => setUserDetailId(e.target.value)}
                    className="bg-white/5 border-white/10"
                    onKeyDown={(e) => e.key === 'Enter' && handleLoadUserDetail()}
                  />
                  <Button onClick={handleLoadUserDetail} disabled={loadingDetail} className="btn-cyber">
                    {loadingDetail ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Найти'}
                  </Button>
                </div>
              </div>
              
              {/* Search transaction by ID */}
              <div className="glass-panel rounded-xl p-4 border border-cyan-500/20">
                <h3 className="font-unbounded text-sm font-bold text-white mb-3">Поиск операции по ID</h3>
                <div className="flex gap-3">
                  <Input
                    data-testid="tx-search-input"
                    placeholder="ID операции"
                    value={txSearchId}
                    onChange={(e) => setTxSearchId(e.target.value)}
                    className="bg-white/5 border-white/10"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchTransaction()}
                  />
                  <Button onClick={handleSearchTransaction} disabled={loadingTxSearch} className="btn-cyber">
                    {loadingTxSearch ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Найти'}
                  </Button>
                </div>
                
                {/* Transaction search result */}
                {txSearchResult && (
                  <div className="mt-4 p-4 bg-white/5 rounded-lg space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        txSearchResult.status === 'completed' ? 'bg-success/20 text-success' :
                        txSearchResult.status === 'pending' ? 'bg-signal-amber/20 text-signal-amber' :
                        'bg-error/20 text-error'
                      }`}>
                        {txSearchResult.status_display || txSearchResult.status}
                      </span>
                      <span className="text-text-muted text-sm">{txSearchResult.type_name || txSearchResult.tx_type}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">Сумма:</span>
                        <span className="text-white ml-2 font-mono">
                          {formatCity(tonToCity(txSearchResult.amount_ton || txSearchResult.amount || 0))} $CITY
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Дата:</span>
                        <span className="text-white ml-2">{formatDate(txSearchResult.created_at)}</span>
                      </div>
                      {txSearchResult.user_username && (
                        <div>
                          <span className="text-text-muted">Пользователь:</span>
                          <span className="text-cyber-cyan ml-2">{txSearchResult.user_username}</span>
                        </div>
                      )}
                      {txSearchResult.from_address && (
                        <div>
                          <span className="text-text-muted">От:</span>
                          <span className="text-white ml-2 font-mono">{formatAddress(txSearchResult.from_address)}</span>
                        </div>
                      )}
                      {txSearchResult.to_address && (
                        <div>
                          <span className="text-text-muted">Кому:</span>
                          <span className="text-white ml-2 font-mono">{formatAddress(txSearchResult.to_address)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2 border-t border-white/10 text-xs">
                      <span className="text-text-muted">ID: </span>
                      <span className="font-mono text-white">{txSearchResult.id}</span>
                    </div>
                  </div>
                )}
              </div>

              {userDetail && (
                <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                        {(userDetail.user?.username || '?')[0]}
                      </div>
                      <div>
                        <div className="text-white font-bold">{userDetail.user?.username || 'N/A'}</div>
                        <div className="text-text-muted text-xs">{userDetail.user?.email || userDetail.user?.wallet_address?.slice(0,12)+'...'}</div>
                      </div>
                    </div>
                    
                    {/* Block/Unblock button */}
                    {userDetail.user?.is_blocked ? (
                      <Button
                        size="sm"
                        onClick={() => handleUnblockUser(userDetail.id)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        Разблокировать
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          const reason = prompt('Причина блокировки:');
                          if (reason) handleBlockUser(userDetail.id, reason);
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        Заблокировать
                      </Button>
                    )}
                  </div>
                  
                  {/* Device and IP info */}
                  {(userDetail.user?.last_device || userDetail.user?.last_ip) && (
                    <div className="p-3 bg-white/5 rounded-lg">
                      <h4 className="text-xs text-text-muted mb-2">Последний вход</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {userDetail.user?.last_device && (
                          <div>
                            <span className="text-text-muted">Устройство:</span>
                            <span className="text-white ml-2">{userDetail.user.last_device}</span>
                          </div>
                        )}
                        {userDetail.user?.last_ip && (
                          <div>
                            <span className="text-text-muted">IP:</span>
                            <span className="text-white ml-2 font-mono">{userDetail.user.last_ip}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Multi-account warning */}
                      {userDetail.multi_account_warning && (
                        <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                          ⚠️ Замечен мультиаккаунтинг: {userDetail.multi_account_warning}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <div className="text-xs text-text-muted">Баланс</div>
                      <div className="text-lg font-bold text-green-400">{formatCity(tonToCity(userDetail.balance || 0))} $CITY</div>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg">
                      <div className="text-xs text-text-muted">Долг</div>
                      <div className="text-lg font-bold text-amber-400">{formatCity(tonToCity(userDetail.active_debt || 0))} $CITY</div>
                    </div>
                    <div className="p-3 bg-cyan-500/10 rounded-lg">
                      <div className="text-xs text-text-muted">Стоимость бизнесов</div>
                      <div className="text-lg font-bold text-cyan-400">{formatCity(tonToCity(userDetail.total_business_value || 0))} $CITY</div>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                      <div className="text-xs text-text-muted">Доступный вывод</div>
                      <div className="text-lg font-bold text-purple-400">{formatCity(tonToCity(userDetail.available_withdrawal || 0))} $CITY</div>
                    </div>
                  </div>

                  {/* Withdrawal Block Status */}
                  {userDetail.withdrawal_blocked_until && new Date(userDetail.withdrawal_blocked_until) > new Date() && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-red-400 font-bold text-sm">Вывод заблокирован</div>
                          <div className="text-xs text-text-muted">
                            До: {new Date(userDetail.withdrawal_blocked_until).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await axios.post(`${API}/admin/user/${userDetail.id}/unblock-withdrawal`, {}, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              toast.success('Блокировка вывода снята');
                              // Refresh user detail
                              const res = await axios.get(`${API}/admin/user/${userDetail.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              setUserDetail(res.data);
                            } catch (error) {
                              toast.error(error.response?.data?.detail || 'Ошибка');
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          Снять блокировку
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Businesses */}
                  {userDetail.businesses?.length > 0 && (
                    <div>
                      <h4 className="text-white font-bold text-sm mb-2">Бизнесы ({userDetail.businesses_count})</h4>
                      <div className="space-y-1">
                        {userDetail.businesses.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                            <span className="text-white">{b.type}</span>
                            <span className="text-text-muted">Ур. {b.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credits */}
                  {userDetail.credits?.length > 0 && (
                    <div>
                      <h4 className="text-white font-bold text-sm mb-2">Кредиты</h4>
                      <div className="space-y-1">
                        {userDetail.credits.map(c => (
                          <div key={c.id} className={`p-2 rounded text-sm border ${c.status === 'overdue' ? 'bg-red-500/10 border-red-500/20' : c.status === 'active' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-white">{formatCity(tonToCity(c.amount))} $CITY ({c.lender_name})</span>
                              <span className={c.status === 'overdue' ? 'text-red-400' : c.status === 'active' ? 'text-amber-400' : 'text-green-400'}>
                                {c.status === 'overdue' ? 'Просрочен' : c.status === 'active' ? 'Активный' : 'Погашен'} | Остаток: {(c.remaining || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tax Settings Tab */}
          <TabsContent value="taxes">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-unbounded text-lg font-bold text-text-main mb-6">
                Налоговые настройки
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Налог на продажу мелких бизнесов (Tier 1) %</label>
                  <Input 
                    type="number"
                    value={taxSettings.small_business_tax || 5}
                    onChange={(e) => setTaxSettings({...taxSettings, small_business_tax: parseFloat(e.target.value) || 0})}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-text-muted">Применяется к бизнесам Tier 1</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Налог на продажу средних бизнесов (Tier 2) %</label>
                  <Input 
                    type="number"
                    value={taxSettings.medium_business_tax || 8}
                    onChange={(e) => setTaxSettings({...taxSettings, medium_business_tax: parseFloat(e.target.value) || 0})}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-text-muted">Применяется к бизнесам Tier 2</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Налог на продажу крупных бизнесов (Tier 3) %</label>
                  <Input 
                    type="number"
                    value={taxSettings.large_business_tax || 10}
                    onChange={(e) => setTaxSettings({...taxSettings, large_business_tax: parseFloat(e.target.value) || 0})}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-text-muted">Применяется к бизнесам Tier 3</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Налог на продажу земли с бизнесом %</label>
                  <Input 
                    type="number"
                    value={taxSettings.land_business_sale_tax || 10}
                    onChange={(e) => setTaxSettings({...taxSettings, land_business_sale_tax: parseFloat(e.target.value) || 0})}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-text-muted">Применяется при продаже участка с бизнесом на маркетплейсе</p>
                </div>
              </div>
              
              <Button 
                onClick={saveTaxSettings}
                className="mt-6 bg-cyber-cyan text-black hover:bg-cyber-cyan/80"
              >
                Сохранить налоги
              </Button>
            </div>
          </TabsContent>

          {/* Contract Deployer Tab */}
          <TabsContent value="contract">
            <ContractDeployerPanel token={token} />
          </TabsContent>

          {/* Multi-Accounts Detection Tab */}
          <TabsContent value="multiaccounts">
            <Card className="bg-void border-red-500/30">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  Обнаружение мульти-аккаунтов
                </h3>
                
                {multiAccounts ? (
                  <div className="space-y-6">
                    {/* IP Duplicates */}
                    <div>
                      <h4 className="text-lg font-bold text-amber-400 mb-3">
                        Совпадения по IP ({multiAccounts.total_ip_groups || 0} групп)
                      </h4>
                      {(multiAccounts.ip_duplicates || []).length > 0 ? (
                        <div className="space-y-3">
                          {multiAccounts.ip_duplicates.map((group, i) => (
                            <div key={i} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                              <div className="text-red-400 font-mono text-sm mb-2">IP: {group.ip} ({group.count} пользователей)</div>
                              <div className="space-y-1">
                                {group.users.map((u, j) => (
                                  <div key={j} className="flex items-center gap-2 text-sm">
                                    <span className="text-white font-bold">{u.username || u.email}</span>
                                    <span className="text-text-muted text-xs">ID: {u.id}</span>
                                    <span className="text-text-muted text-xs">Устройство: {u.last_device || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-green-400 text-sm">Совпадений по IP не обнаружено</div>
                      )}
                    </div>
                    
                    {/* Device Duplicates */}
                    <div>
                      <h4 className="text-lg font-bold text-amber-400 mb-3">
                        Совпадения по устройству ({multiAccounts.total_device_groups || 0} групп)
                      </h4>
                      {(multiAccounts.device_duplicates || []).length > 0 ? (
                        <div className="space-y-3">
                          {multiAccounts.device_duplicates.map((group, i) => (
                            <div key={i} className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                              <div className="text-amber-400 font-mono text-sm mb-2">Устройство: {group.device} ({group.count} пользователей)</div>
                              <div className="space-y-1">
                                {group.users.map((u, j) => (
                                  <div key={j} className="flex items-center gap-2 text-sm">
                                    <span className="text-white font-bold">{u.username || u.email}</span>
                                    <span className="text-text-muted text-xs">ID: {u.id}</span>
                                    <span className="text-text-muted text-xs">IP: {u.last_ip || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-green-400 text-sm">Совпадений по устройствам не обнаружено</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-text-muted text-center py-8">Загрузка данных...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
