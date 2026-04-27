import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Package, Coins, TrendingUp, RefreshCw, 
  Settings2, Wrench, Zap, ArrowUp, ChevronRight,
  Play, Pause, Check, X, AlertCircle, Shield, Heart,
  Crown, Users, Warehouse, Clock, Loader2, Tag,
  FileText, HandshakeIcon, ChevronDown, Scroll
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { tonToCity, formatCity } from '@/lib/currency';
import { getResource, getAllResources } from '@/lib/resourceConfig';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Tier colors
const CONTRACT_TYPES = {
  tax_haven: {
    name: 'Налоговая Гавань',
    description: 'Вассал платит 10% от дохода в $CITY Патрону',
    vassal_note: 'Вы платите 10% дохода',
    patron_note: 'Получаете 10% от прибыли вассала',
    icon: '🏝️',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    penalty: 500,
  },
  raw_material: {
    name: 'Сырьевой Придаток',
    description: 'Вассал отдаёт 15% произведённых товаров Патрону',
    vassal_note: '15% товаров уходит Патрону',
    patron_note: 'Получаете 15% ресурсов вассала',
    icon: '⚙️',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    penalty: 750,
  },
  tech_umbrella: {
    name: 'Технологический Зонтик',
    description: 'Вассал экономит 30% на ремонтных комплектах',
    vassal_note: '-30% стоимость ремонта',
    patron_note: 'Фиксированная рента 50 $CITY/день',
    icon: '🛡️',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    penalty: 300,
  },
};

const TIER_COLORS = {
  1: 'bg-green-500/20 text-green-400 border-green-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// Resource icons - V2.0
const resourceIcons = {
  energy: '⚡',
  cu: '🖥️',
  quartz: '💎',
  traffic: '📡',
  cooling: '❄️',
  biomass: '🌿',
  scrap: '🗑️',
  chips: '🔲',
  nft: '🎨',
  neurocode: '🧠',
  logistics: '🚚',
  repair_kits: '🔧',
  vr_experience: '🥽',
  profit_ton: '💰',
  shares: '📈',
  ton: '💎',
  // Backward compat
  food: '🌿',
  algo: '🧠',
  iron: '🔧',
};

export default function MyBusinessesPage({ user, refreshBalance, updateBalance }) {
  const navigate = useNavigate();
  
  // Get language from context
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);
  
  const [businesses, setBusinesses] = useState([]);
  const [summary, setSummary] = useState({});
  const [resourcesFromBusinesses, setResourcesFromBusinesses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [patrons, setPatrons] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [myPlots, setMyPlots] = useState([]);
  
  // Modals
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAllResources, setShowAllResources] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showPatronModal, setShowPatronModal] = useState(false);
  const [showBuffModal, setShowBuffModal] = useState(false);
  const [availableBuffs, setAvailableBuffs] = useState([]);
  const [buffBusiness, setBuffBusiness] = useState(null);

  // ==== T3 Resource Buffs (subscription-style) ====
  // IDs of T3 resources that can be activated as buffs
  const T3_BUFF_RESOURCE_IDS = ['neuro_core', 'gold_bill', 'license_token', 'luck_chip', 'war_protocol', 'bio_module', 'gateway_code'];
  const [resourceBuffsData, setResourceBuffsData] = useState({ buffs: [], active: [] });
  const [showResourceBuffModal, setShowResourceBuffModal] = useState(false);
  const [selectedBuffResource, setSelectedBuffResource] = useState(null);
  const [isActivatingBuff, setIsActivatingBuff] = useState(false);
  const [vassals, setVassals] = useState([]);
  const [showVassalsModal, setShowVassalsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [sellTaxInfo, setSellTaxInfo] = useState(null);
  const [isCancelingSale, setIsCancelingSale] = useState(false);
  
  // Loading states
  const [isCollecting, setIsCollecting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  
  // Contract state
  const [contracts, setContracts] = useState({ as_patron: [], as_vassal: [] });
  const [showContractProposalModal, setShowContractProposalModal] = useState(false);
  const [contractTarget, setContractTarget] = useState(null);
  const [proposalType, setProposalType] = useState('tax_haven');
  const [proposalBuff, setProposalBuff] = useState('');
  const [proposalDuration, setProposalDuration] = useState(30);
  const [proposalAutoRenew, setProposalAutoRenew] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [showContractDetailsModal, setShowContractDetailsModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  
  // Alliance offers state
  const [allianceOffers, setAllianceOffers] = useState([]);
  const [showAllOffersModal, setShowAllOffersModal] = useState(false);
  const [showPublishOfferModal, setShowPublishOfferModal] = useState(false);
  const [offerBuff, setOfferBuff] = useState('');
  const [offerType, setOfferType] = useState('tax_haven');
  const [offerDuration, setOfferDuration] = useState(30);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Alliance offers browsing (paginated)
  const [offersPage, setOffersPage] = useState(0);
  const OFFERS_PER_PAGE = 3;
  
  const token = localStorage.getItem('token');

  // Fetch alliance offers
  const fetchAllianceOffers = async () => {
    try {
      const res = await fetch(`${API}/alliances/offers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllianceOffers(data.offers || []);
      }
    } catch (e) {
      console.error('Failed to fetch alliance offers:', e);
    }
  };

  // Publish offer handler
  const handlePublishOffer = async () => {
    if (!offerBuff || !offerType) {
      toast.error('Выберите баф и тип контракта');
      return;
    }
    setIsPublishing(true);
    try {
      const res = await fetch(`${API}/alliances/publish-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          buff_id: offerBuff,
          contract_type: offerType,
          duration_days: offerDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success('Оффер опубликован! Вассалы смогут его увидеть.');
      setShowPublishOfferModal(false);
      setOfferBuff('');
      setOfferType('tax_haven');
      setOfferDuration(30);
      fetchAllianceOffers();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Accept offer handler
  const handleAcceptOffer = async (offerId, vassalBusinessId) => {
    try {
      const url = vassalBusinessId
        ? `${API}/alliances/accept/${offerId}?vassal_business_id=${vassalBusinessId}`
        : `${API}/alliances/accept/${offerId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success(data.message || 'Альянс заключён!');
      fetchAllianceOffers();
      fetchContracts();
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Cancel own offer
  const handleCancelOffer = async (offerId) => {
    try {
      const res = await fetch(`${API}/alliances/cancel-offer/${offerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success('Оффер отменён');
      fetchAllianceOffers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Helper: get color class for consumed resource based on hours remaining
  const getConsumeColor = (resource, dailyAmount) => {
    if (!dailyAmount || dailyAmount <= 0) return 'text-text-muted';
    const available = resourcesFromBusinesses[resource] || 0;
    if (available === 0) return 'text-red-400';
    const hoursRemaining = (available / dailyAmount) * 24;
    if (hoursRemaining <= (5 / 60)) return 'text-red-400';  // ≤ 5 min
    if (hoursRemaining <= 4) return 'text-yellow-400';       // ≤ 4 hours
    return 'text-green-400';                                  // > 4 hours
  };

  // Форматирование адреса кошелька
  const formatWalletAddress = (address) => {
    if (!address) return 'Не привязан';
    if (address.length <= 15) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Расчет налога при продаже
  const calculateSaleTax = async (price) => {
    try {
      const res = await fetch(`${API}/business/calculate-sale-tax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseFloat(price), business_id: selectedBusiness?.id })
      });
      if (res.ok) {
        const data = await res.json();
        setSellTaxInfo(data);
      }
    } catch (error) {
      console.error('Failed to calculate tax:', error);
    }
  };

  // Продажа бизнеса
  const handleSellBusiness = async () => {
    if (!selectedBusiness || !sellPrice) return;
    
    setIsSelling(true);
    try {
      const res = await fetch(`${API}/business/${selectedBusiness.id}/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          business_id: selectedBusiness.id,
          price: parseFloat(sellPrice) / 1000  // Convert $CITY to TON for backend
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to list business');
      }
      
      const data = await res.json();
      toast.success(`Бизнес выставлен на продажу! Вы получите ${formatCity(tonToCity(data.listing.seller_receives))} $CITY`);
      setShowSellModal(false);
      setSellPrice('');
      setSellTaxInfo(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSelling(false);
    }
  };

  // Снять бизнес с продажи
  const handleCancelSale = async () => {
    if (!selectedBusiness) {
      toast.error('Бизнес не выбран');
      return;
    }
    
    setIsCancelingSale(true);
    try {
      // Сначала найдём листинг по plot_id или business_id
      const listingsRes = await fetch(`${API}/market/land/listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listingsData = await listingsRes.json();
      
      // Ищем листинг этого бизнеса
      const listing = (listingsData.listings || []).find(l => 
        l.plot_id === selectedBusiness.plot_id || 
        l.business_id === selectedBusiness.id ||
        (l.business && l.business.id === selectedBusiness.id)
      );
      
      if (!listing) {
        toast.error('Листинг не найден');
        setIsCancelingSale(false);
        return;
      }
      
      // Используем тот же эндпоинт DELETE как на маркетплейсе
      const res = await fetch(`${API}/market/land/listing/${listing.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Не удалось снять с продажи');
      }
      
      toast.success('Бизнес снят с продажи');
      setShowDetailsModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCancelingSale(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bizRes, patronsRes, resourcesRes, plotsRes, buffsRes] = await Promise.all([
        fetch(`${API}/my/businesses`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/patrons`).then(r => r.json()),
        fetch(`${API}/my/resources`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ resources: {} })),
        fetch(`${API}/users/me/plots`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ plots: [] })),
        fetch(`${API}/resource-buffs/available`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ buffs: [], active: [] })),
      ]);

      setBusinesses(bizRes.businesses || []);
      setSummary(bizRes.summary || {});
      setPatrons(patronsRes.patrons || []);
      setResourcesFromBusinesses(resourcesRes.resources || {});
      setMyPlots(plotsRes.plots || []);
      setResourceBuffsData(buffsRes || { buffs: [], active: [] });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  };

  // Activate a T3 resource as a buff (consumes 1 unit, lasts N days)
  const handleActivateResourceBuff = async (resourceId) => {
    if (!resourceId) return;
    setIsActivatingBuff(true);
    try {
      const res = await fetch(`${API}/resource-buffs/activate/${resourceId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { detail: text || 'Ошибка активации' }; }
      if (!res.ok) throw new Error(data.detail || 'Ошибка активации');
      toast.success(data.message || 'Баф активирован');
      setShowResourceBuffModal(false);
      setSelectedBuffResource(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsActivatingBuff(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await fetch(`${API}/contracts/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (!token) {
      navigate('/auth?mode=login');
      return;
    }
    fetchData();
    fetchContracts();
    fetchAllianceOffers();
    
    // Auto-open buff modal if coming from Tier 3 purchase
    const pendingBuff = sessionStorage.getItem('pending_tier3_buff');
    if (pendingBuff) {
      sessionStorage.removeItem('pending_tier3_buff');
      // After data loads, find the business and open buff modal
      setTimeout(async () => {
        try {
          const res = await fetch(`${API}/tier3/buffs`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          setAvailableBuffs(data.buffs || []);
          // Find the tier 3 business (most recently purchased)
          setBusinesses(prev => {
            const tier3 = prev.find(b => (b.config?.tier || b.tier || 1) === 3);
            if (tier3) {
              setBuffBusiness(tier3);
              setSelectedBusiness(tier3);
              setShowBuffModal(true);
            }
            return prev;
          });
        } catch {}
      }, 1500);
    }
  }, [user]);

  // Collect all income
  const handleCollectAll = async () => {
    setIsCollecting(true);
    try {
      const res = await fetch(`${API}/my/collect-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Ошибка сбора');
      
      const data = await res.json();
      
      // Мгновенное отображение начисления
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">💰</span>
            <span className="text-lg font-bold text-green-400">+{formatCity(tonToCity(data.total_player_income))} $CITY</span>
          </div>
          <div className="text-xs text-gray-400">Собрано с {data.businesses_collected} бизнесов</div>
          <div className="text-xs text-amber-400">Налог: -{formatCity(tonToCity(data.total_tax_paid))} $CITY</div>
        </div>,
        { duration: 5000 }
      );
      
      // Update global balance
      if (refreshBalance) refreshBalance();
      if (updateBalance && data.new_balance !== undefined) {
        updateBalance(data.new_balance);
      }
      
      setLastUpdate(new Date());
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCollecting(false);
    }
  };

  // Collect single business
  const handleCollect = async (businessId) => {
    try {
      const res = await fetch(`${API}/business/${businessId}/collect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ошибка сбора');
      }
      
      const data = await res.json();
      
      // Мгновенное визуальное начисление
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-xl animate-bounce">💰</span>
          <span className="font-bold text-green-400">+{formatCity(tonToCity(data.player_receives))} $CITY</span>
        </div>,
        { duration: 3000 }
      );
      
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Upgrade business
  const handleUpgrade = async () => {
    if (!selectedBusiness) return;
    setIsUpgrading(true);
    
    try {
      const res = await fetch(`${API}/business/${selectedBusiness.id}/upgrade`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ошибка улучшения');
      }
      
      const data = await res.json();
      toast.success(`Улучшено до уровня ${data.new_level}!`);
      setShowUpgradeModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Repair business
  const handleRepair = async () => {
    if (!selectedBusiness) return;
    setIsRepairing(true);

    try {
      const res = await fetch(`${API}/business/${selectedBusiness.id}/repair`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      // Safe JSON parsing: backend may return HTML/plain on 500
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        data = { detail: res.status === 500 ? 'Ошибка сервера при ремонте. Попробуйте позже.' : (text || 'Ошибка ремонта') };
      }

      if (!res.ok) {
        throw new Error(data.detail || 'Ошибка ремонта');
      }

      const cost = data.cost_city ?? (data.cost_paid ? tonToCity(data.cost_paid) : 0);
      toast.success(`Отремонтировано! Оплачено: ${formatCity(cost)} $CITY`);
      setShowRepairModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsRepairing(false);
    }
  };

  // Set patron
  const handleSetPatron = async (patronId) => {
    if (!selectedBusiness) return;
    
    try {
      const url = patronId 
        ? `${API}/business/${selectedBusiness.id}/set-patron?patron_id=${patronId}`
        : `${API}/business/${selectedBusiness.id}/set-patron`;
        
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ошибка назначения патрона');
      }
      
      toast.success(patronId ? 'Патрон назначен!' : 'Патрон удалён');
      setShowPatronModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Open buff selection for Tier 3 business
  const openBuffModal = async (biz) => {
    setBuffBusiness(biz);
    try {
      const res = await fetch(`${API}/tier3/buffs`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAvailableBuffs(data.buffs || []);
    } catch {
      setAvailableBuffs([]);
    }
    setShowBuffModal(true);
  };

  const handleSetBuff = async (buffId) => {
    if (!buffBusiness) return;
    try {
      const res = await fetch(`${API}/business/${buffBusiness.id}/set-buff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ buff_id: buffId })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Ошибка'); }
      toast.success('Баф выбран! Ваши вассалы получат его.');
      setShowBuffModal(false);
      fetchData();
    } catch (e) { toast.error(e.message); }
  };

  const openVassalsModal = async (biz) => {
    setSelectedBusiness(biz);
    try {
      const res = await fetch(`${API}/business/${biz.id}/vassals`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setVassals(data.vassals || []);
    } catch { setVassals([]); }
    setShowVassalsModal(true);
  };

  // Open business details
  const openDetails = async (biz) => {
    try {
      const res = await fetch(`${API}/business/${biz.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedBusiness({ ...biz, ...data });
      setShowDetailsModal(true);
    } catch (error) {
      setSelectedBusiness(biz);
      setShowDetailsModal(true);
    }
  };

  // Get durability color
  const getDurabilityColor = (durability) => {
    if (durability >= 70) return 'bg-green-500';
    if (durability >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Contract handlers
  const openContractProposal = async (vassalInfo) => {
    setContractTarget(vassalInfo);
    setProposalType('tax_haven');
    setProposalBuff('');
    // Load buffs if not already loaded
    if (availableBuffs.length === 0) {
      try {
        const res = await fetch(`${API}/tier3/buffs`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAvailableBuffs(data.buffs || []);
      } catch {}
    }
    setShowContractProposalModal(true);
  };

  const handleProposeContract = async () => {
    if (!contractTarget || !proposalType || !proposalBuff) {
      toast.error('Выберите тип контракта и баф');
      return;
    }
    setIsProposing(true);
    try {
      const res = await fetch(`${API}/contracts/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: proposalType,
          vassal_business_id: contractTarget.business_id,
          patron_buff: proposalBuff,
          duration_days: proposalDuration,
          auto_renew: proposalAutoRenew,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success('Предложение контракта отправлено!');
      setShowContractProposalModal(false);
      fetchContracts();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsProposing(false);
    }
  };

  const handleContractAction = async (contractId, action) => {
    try {
      const res = await fetch(`${API}/contracts/${contractId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success(data.message || 'Готово');
      fetchContracts();
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-void">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-cyber-cyan animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-hidden lg:ml-16">
        <ScrollArea className="h-full">
          <div className="p-4 lg:p-6 pt-4 lg:pt-6 space-y-4 lg:space-y-6">
            {/* Header - Mobile Optimized */}
            <PageHeader 
              icon={<Building2 className="w-6 h-6 lg:w-8 lg:h-8 text-cyber-cyan" />}
              title={t('myBusinessesTitle')}
              actionButtons={
                <Button onClick={fetchData} variant="outline" size="icon" className="border-white/10 h-8 w-8 sm:h-10 sm:w-10" disabled={isLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              }
            />
              
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-panel border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-cyber-cyan" />
                  <div>
                    <div className="text-2xl font-bold text-white">{summary.total_businesses || 0}</div>
                    <div className="text-xs text-text-muted">{t('totalBusinesses')}</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-panel border-purple-500/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <Package className="w-8 h-8 text-purple-400" />
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-purple-400">
                      {Math.floor(summary.total_warehouse_used || 0)}/{summary.total_warehouse_capacity || 0}
                    </div>
                    <div className="text-xs text-text-muted">{t('totalWarehouse')}</div>
                    {/* Total warehouse color bar */}
                    {(summary.total_warehouse_capacity || 0) > 0 && (() => {
                      const pct = (summary.total_warehouse_used || 0) / (summary.total_warehouse_capacity || 1);
                      const barColor = pct >= 1 ? 'bg-red-500' : pct > 0.8 ? 'bg-red-400' : pct > 0.5 ? 'bg-yellow-400' : 'bg-green-500';
                      return (
                        <div className="w-full bg-gray-700/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* === T3 Active Buffs Banner === */}
            {(resourceBuffsData.active || []).length > 0 && (
              <div className="mb-6" data-testid="active-buffs-banner">
                <Card className="glass-panel border-purple-500/30 bg-purple-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-purple-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Активные бафы</h3>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 ml-auto">
                        {resourceBuffsData.active.length} / 2
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resourceBuffsData.active.map((b) => (
                        <div
                          key={b.resource_id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-purple-500/20"
                          data-testid={`active-buff-${b.resource_id}`}
                        >
                          <div className="text-2xl">{b.buff_icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm">{b.buff_name}</div>
                            <div className="text-xs text-text-muted line-clamp-1">{b.buff_description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-purple-300 font-mono font-bold" data-testid={`buff-time-${b.resource_id}`}>
                              {b.remaining_label || (b.days_remaining != null ? `${b.days_remaining}д` : '—')}
                            </div>
                            <div className="text-[10px] text-text-muted">осталось</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Businesses List */}
            {businesses.length === 0 ? (
              <Card className="glass-panel border-white/10">
                <CardContent className="p-12 text-center">
                  <Building2 className="w-16 h-16 text-text-muted mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">{t('noBusinessesYet')}</h3>
                  <p className="text-text-muted mb-4">
                    {t('buyPlotAndBuild')}
                  </p>
                  <Button onClick={() => navigate('/island')} className="bg-cyber-cyan text-black">
                    {t('goToIsland')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {businesses.map((biz) => (
                  <motion.div
                    key={biz.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                  >
                    <Card className="glass-panel border-white/10 hover:border-cyber-cyan/30 transition-all h-full flex flex-col" data-testid={biz.tutorial ? 'tutorial-business-card' : `business-card-${biz.id}`}>
                      <CardContent className="p-4 flex flex-col flex-1">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{biz.config?.icon || '🏢'}</div>
                            <div>
                              <h3 className="font-bold text-white">
                                {biz.config?.name?.ru || biz.config?.name?.en || biz.business_type}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={TIER_COLORS[biz.config?.tier || 1]}>
                                  {t('tierLabel')} {biz.config?.tier || 1}
                                </Badge>
                                <Badge variant="outline" className="border-white/20">
                                  Ур. {biz.level || 1}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetails(biz)}
                            className="text-text-muted hover:text-white transition-colors"
                            data-testid={`business-settings-${biz.id}`}
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Durability Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-text-muted flex items-center gap-1">
                              <Heart className="w-3 h-3" /> Прочность
                            </span>
                            <span className={biz.durability < 30 ? 'text-red-400' : 'text-white'}>
                              {biz.durability?.toFixed(1) || 100}%
                            </span>
                          </div>
                          <Progress 
                            value={biz.durability || 100} 
                            className="h-2" 
                          />
                          {biz.durability < 30 && (
                            <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
                              <AlertCircle className="w-3 h-3" />
                              {t('needsRepair')}
                            </div>
                          )}
                        </div>
                        
                        {/* Production & Storage Status */}
                        <div className="p-3 bg-white/5 rounded-lg mb-3">
                          {/* Work status badge with reason */}
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-muted">{t('businessStatus')}:</span>
                            {(() => {
                              // Determine work status and reason
                              let status = 'working';
                              let reason = '';
                              
                              // Check if on sale first
                              if (biz.on_sale) {
                                status = 'on_sale';
                                reason = '';
                              } else if (biz.durability <= 0) {
                                status = 'stopped';
                                reason = `0% ${t('durability')}`;
                              } else if (biz.storage_info?.is_full) {
                                status = 'stopped';
                                reason = t('warehouseFull') || 'Warehouse full';
                              } else if (biz.work_status === 'idle') {
                                status = 'idle';
                                reason = t('noResourcesAvailable') || 'No resources';
                              } else if (biz.work_status === 'stopped') {
                                status = 'stopped';
                                reason = biz.stop_reason || t('stopped');
                              }
                              
                              return (
                                <div className="flex flex-col items-end">
                                  <Badge data-testid={`work-status-${biz.id}`} className={
                                    status === 'working' 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : status === 'on_sale'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : status === 'idle'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-red-500/20 text-red-400'
                                  }>
                                    {status === 'working' ? t('active') : 
                                     status === 'on_sale' ? t('onSale') :
                                     status === 'idle' ? t('idle') || 'Idle' : t('stopped')}
                                  </Badge>
                                  {reason && (
                                    <span className={`text-xs mt-0.5 ${status === 'on_sale' ? 'text-amber-400' : 'text-red-400'}`}>{reason}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          
                          {/* Production info - what it produces */}
                          {biz.config?.produces && (
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-text-muted">{t('produces')}:</span>
                              <span className="text-cyan-300 font-medium flex items-center gap-1">
                                {getResource(biz.config.produces)?.icon || resourceIcons[biz.config.produces] || '📦'} {getResource(biz.config.produces)?.name || biz.config.produces}
                              </span>
                            </div>
                          )}
                          
                          {/* Production amount based on durability */}
                          {(() => {
                            const base = biz.production?.base_production || biz.config?.base_production || 100;
                            const dur = biz.durability || 100;
                            const durMult = dur <= 0 ? 0 : dur < 50 ? 0.8 : 1.0;
                            const daily = Math.round(base * durMult);
                            return (
                              <>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-text-muted">{t('outputPerDay') || 'Выход/сутки'}:</span>
                                  <span className="text-green-400 font-mono">{daily} ед.</span>
                                </div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-text-muted">{t('outputPerHour') || 'Выход/час'}:</span>
                                  <span className="text-green-400/70 font-mono text-xs">{(daily / 24).toFixed(1)} ед.</span>
                                </div>
                              </>
                            );
                          })()}
                          
                          {/* Consumption info - what it consumes */}
                          {(() => {
                            const consumes = biz.production?.consumption_breakdown || biz.config?.consumes;
                            if (!consumes) return null;
                            const entries = Array.isArray(consumes)
                              ? consumes.map(c => [c.resource || c.type, c.amount || c.rate || 0])
                              : Object.entries(consumes);
                            return entries.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {entries.map(([res, amt], i) => {
                                  const resInfo = getResource(res);
                                  const colorClass = getConsumeColor(res, amt);
                                  return (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span className={colorClass}>{t('consumes') || 'Потребляет'}:</span>
                                      <span className={`font-medium flex items-center gap-1 ${colorClass}`}>
                                        {resInfo?.icon || '📦'} {resInfo?.name || res} {amt} ед./сутки
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          
                          {/* Storage bar */}
                          {biz.storage_info && biz.storage_info.capacity > 0 && (() => {
                            const pct = biz.storage_info.capacity > 0
                              ? biz.storage_info.used / biz.storage_info.capacity
                              : 0;
                            const barColor = biz.storage_info.is_full ? 'bg-red-500'
                              : pct > 0.8 ? 'bg-red-400'
                              : pct > 0.5 ? 'bg-yellow-400'
                              : 'bg-green-500';
                            const textColor = biz.storage_info.is_full || pct > 0.8 ? 'text-red-400 font-bold'
                              : pct > 0.5 ? 'text-yellow-400'
                              : 'text-green-400';
                            return (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-text-muted flex items-center gap-1">
                                    <Package className="w-3 h-3" /> Склад
                                  </span>
                                  <span className={textColor}>
                                    {biz.storage_info.used}/{biz.storage_info.capacity}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700/60 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                                  />
                                </div>
                                {biz.storage_info.is_full && (
                                  <div className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Склад полон — продайте ресурсы!
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Patron Badge (set through contract) */}
                        {biz.patron && (
                          <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg mb-3 border border-purple-500/20">
                            <Crown className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-purple-300">
                              Покровитель (контракт): {biz.patron.icon} {biz.patron.name?.ru || biz.patron.name?.en || biz.patron.type} (Ур. {biz.patron.level})
                            </span>
                          </div>
                        )}
                        
                        {/* Actions - NO COLLECT BUTTON, businesses produce resources not TON */}
                        <div className="flex gap-2 mt-3">
                          {biz.level < 10 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500/30 text-blue-400"
                              onClick={async () => {
                                setSelectedBusiness(biz);
                                setShowUpgradeModal(true);
                                // Fetch upgrade cost data
                                try {
                                  const res = await fetch(`${API}/business/${biz.id}/upgrade-cost`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setSelectedBusiness(prev => ({ ...prev, upgrade_cost_data: data }));
                                  }
                                } catch (e) { console.error('Failed to fetch upgrade cost', e); }
                              }}
                            >
                              <ArrowUp className="w-4 h-4 mr-1" />
                              Улучшить
                            </Button>
                          )}
                          
                          {biz.durability < 100 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-yellow-500/30 text-yellow-400"
                              onClick={() => {
                                setSelectedBusiness(biz);
                                setShowRepairModal(true);
                              }}
                            >
                              <Wrench className="w-4 h-4 mr-1" />
                              Ремонт
                            </Button>
                          )}
                          
                          {/* Patron is now set through contracts, not standalone */}
                          {/* Tier 3: buff is only shown in details modal */}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}


            {/* Storage/Resources Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  {t('myResources')}
                </h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllResources}
                    onChange={(e) => setShowAllResources(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs text-text-muted">{t('showAllResources') || 'Показать все'}</span>
                </label>
              </div>
              
              <Card className="glass-panel border-amber-500/20">
                <CardContent className="p-4">
                  {(() => {
                    const allResourceIds = getAllResources().map(r => r.id);
                    const displayResources = showAllResources
                      ? allResourceIds.reduce((acc, id) => { acc[id] = resourcesFromBusinesses[id] || 0; return acc; }, {})
                      : Object.fromEntries(Object.entries(resourcesFromBusinesses).filter(([_, v]) => v >= 1));
                    
                    return Object.keys(displayResources).length === 0 ? (
                      <div className="text-center py-6 text-text-muted">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>{t('noAccumulatedResources')}</p>
                        <p className="text-xs mt-1">{t('businessesProduceAutomatically')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(displayResources).map(([resource, amount]) => {
                          const isT3Buff = T3_BUFF_RESOURCE_IDS.includes(resource);
                          const buffInfo = isT3Buff ? (resourceBuffsData.buffs || []).find(b => b.resource_id === resource) : null;
                          const isActive = (resourceBuffsData.active || []).some(a => a.resource_id === resource);
                          return (
                            <button
                              type="button"
                              key={resource}
                              onClick={() => {
                                if (!isT3Buff) return;
                                setSelectedBuffResource({
                                  resource_id: resource,
                                  quantity: Math.floor(amount > 0 ? amount : 0),
                                  buff: buffInfo,
                                  isActive,
                                });
                                setShowResourceBuffModal(true);
                              }}
                              disabled={!isT3Buff}
                              data-testid={`resource-card-${resource}`}
                              className={`relative bg-white/5 rounded-lg p-3 text-center border transition-all text-left ${
                                amount > 0 ? 'border-white/10 hover:border-amber-500/30' : 'border-white/5 opacity-50'
                              } ${isT3Buff ? 'cursor-pointer hover:bg-purple-500/10 hover:border-purple-500/40' : 'cursor-default'} ${
                                isActive ? 'ring-2 ring-purple-400/50' : ''
                              }`}
                            >
                              {isT3Buff && (
                                <div className="absolute top-1 right-1 text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded px-1 py-0.5 font-bold">
                                  БАФ
                                </div>
                              )}
                              {isActive && (
                                <div className="absolute top-1 left-1 text-[10px] bg-green-500/30 text-green-200 border border-green-500/50 rounded px-1 py-0.5 font-bold">
                                  ●
                                </div>
                              )}
                              <div className="text-2xl mb-1 mt-1">
                                {getResource(resource)?.icon || '📦'}
                              </div>
                              <div className="text-lg font-bold text-white text-center">{Math.floor(amount > 0 ? amount : 0)}</div>
                              <div className="text-xs text-text-muted capitalize text-center">{getResource(resource)?.name || resource}</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="bg-void border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-blue-400" />
              Улучшение бизнеса
            </DialogTitle>
          </DialogHeader>
          
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                <span className="text-3xl">{selectedBusiness.config?.icon}</span>
                <div>
                  <div className="text-white font-bold">
                    {selectedBusiness.config?.name?.ru || selectedBusiness.config?.name?.en || selectedBusiness.business_type}
                  </div>
                  <div className="text-text-muted text-sm">
                    {t('levelLabel') || 'Уровень'} {selectedBusiness.level} → {selectedBusiness.level + 1}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                {/* Production */}
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Производство/сутки:</span>
                  <span className="text-green-400">
                    {selectedBusiness.upgrade_cost_data?.current_production || '?'} → {selectedBusiness.upgrade_cost_data?.next_production || '?'} ед.
                  </span>
                </div>
                {/* Consumption */}
                {selectedBusiness.upgrade_cost_data?.next_consumption && Object.entries(selectedBusiness.upgrade_cost_data.next_consumption).map(([res, amt]) => (
                  <div key={res} className="flex justify-between text-sm">
                    <span className="text-text-muted">Потребляет {getResource(res)?.icon} {getResource(res)?.name || res}:</span>
                    <span className="text-red-400">{amt} ед./сутки</span>
                  </div>
                ))}
                {/* Storage */}
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Ёмкость склада:</span>
                  <span className="text-white">
                    {selectedBusiness.upgrade_cost_data?.current_storage || '?'} → {selectedBusiness.upgrade_cost_data?.next_storage || '?'}
                  </span>
                </div>
              </div>
              
              <div className="p-3 bg-blue-500/10 rounded-lg space-y-2">
                <div className="text-xs text-text-muted mb-1">Стоимость улучшения:</div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted text-sm">$CITY:</span>
                  <span className="text-xl font-bold text-blue-400">
                    {formatCity(selectedBusiness.upgrade_cost_data?.cost?.city || 0)} $CITY
                  </span>
                </div>
                {/* Resource requirements */}
                {selectedBusiness.upgrade_cost_data?.resource_meta && (
                  <div className="flex justify-between items-center border-t border-white/10 pt-2">
                    <span className="text-text-muted text-sm">
                      {selectedBusiness.upgrade_cost_data.resource_meta.icon} {selectedBusiness.upgrade_cost_data.resource_meta.name_ru}:
                    </span>
                    <span className="font-bold text-amber-400">
                      {selectedBusiness.upgrade_cost_data.cost?.resource_amount || 0} шт.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="border-white/10 w-full sm:w-auto">
              Отмена
            </Button>
            <Button 
              onClick={handleUpgrade} 
              className="bg-blue-600 w-full sm:w-auto"
              disabled={isUpgrading}
            >
              {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Улучшить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair Modal */}
      <Dialog open={showRepairModal} onOpenChange={setShowRepairModal}>
        <DialogContent className="bg-void border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-yellow-400" />
              Ремонт бизнеса
            </DialogTitle>
          </DialogHeader>
          
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                <span className="text-3xl">{selectedBusiness.config?.icon}</span>
                <div>
                  <div className="text-white font-bold">
                    {selectedBusiness.config?.name?.ru}
                  </div>
                  <div className="text-red-400 text-sm">
                    Прочность: {selectedBusiness.durability?.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">Текущая прочность:</span>
                  <span className="text-yellow-400">{selectedBusiness.durability?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">После ремонта:</span>
                  <span className="text-green-400">100%</span>
                </div>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-xs text-text-muted mb-1">Стоимость ремонта:</div>
                <div className="text-xl font-bold text-yellow-400">
                  ~{formatCity(tonToCity((100 - (selectedBusiness.durability || 0)) * 0.001))} $CITY
                </div>
              </div>
              
              <p className="text-xs text-text-muted">
                При прочности 0% производство полностью останавливается. 
                Регулярный ремонт экономит деньги.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRepairModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button 
              onClick={handleRepair} 
              className="bg-yellow-600"
              disabled={isRepairing}
            >
              {isRepairing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Отремонтировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patron Modal removed - patronage now only through contracts */}

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-void border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-cyber-cyan" />
              Детали бизнеса
            </DialogTitle>
          </DialogHeader>
          
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                <span className="text-4xl">{selectedBusiness.config?.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedBusiness.config?.name?.ru}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <Badge className={TIER_COLORS[selectedBusiness.config?.tier || 1]}>
                      {t('tierLabel')} {selectedBusiness.config?.tier}
                    </Badge>
                    <Badge variant="outline">{t('levelLabel') || 'Уровень'} {selectedBusiness.level}</Badge>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-xs text-text-muted">Прочность</div>
                  <div className="text-lg font-bold text-white">
                    {selectedBusiness.durability?.toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-xs text-text-muted">Налог</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {((selectedBusiness.production?.tax_rate || 0.15) * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg col-span-2">
                  <div className="text-xs text-text-muted">Склад</div>
                  <div className="text-lg font-bold text-white">
                    {selectedBusiness.storage_info?.used || 0} / {selectedBusiness.storage_info?.capacity || selectedBusiness.storage?.capacity || 0}
                  </div>
                </div>
              </div>
              
              {selectedBusiness.patron && (
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium">Патрон</span>
                  </div>
                  <div className="text-white">
                    {selectedBusiness.patron.icon} {selectedBusiness.patron.name?.ru || selectedBusiness.patron.name?.en || selectedBusiness.patron.type} (Ур. {selectedBusiness.patron.level})
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    Бонус: +{((selectedBusiness.patron.bonus || 1) - 1) * 100}% к доходу
                  </div>
                </div>
              )}

              {/* Tier 3: Buff selection section in details */}
              {(selectedBusiness.config?.tier || selectedBusiness.tier || 1) === 3 && (
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400">⚡</span>
                      <span className="text-yellow-400 font-medium text-sm">Баф для вассалов</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20"
                      onClick={() => openBuffModal(selectedBusiness)} data-testid="select-buff-btn">
                      {selectedBusiness.patron_buff ? 'Изменить' : 'Выбрать'}
                    </Button>
                  </div>
                  {selectedBusiness.patron_buff_data ? (
                    <div className="text-sm text-white">
                      {selectedBusiness.patron_buff_data.icon} <strong>{selectedBusiness.patron_buff_data.name}</strong>
                      <p className="text-xs text-text-muted mt-0.5">{selectedBusiness.patron_buff_data.description}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">Баф не выбран. Выберите баф, который получат ваши вассалы.</p>
                  )}
                </div>
              )}

              {/* Tier 3: Vassals quick view */}
              {(selectedBusiness.config?.tier || selectedBusiness.tier || 1) === 3 && (
                <>
                  <Button variant="outline" size="sm" className="w-full border-cyan-500/30 text-cyan-400"
                    onClick={() => { setShowDetailsModal(false); openVassalsModal(selectedBusiness); }}>
                    <Crown className="w-4 h-4 mr-2" /> Посмотреть вассалов
                  </Button>
                  {/* Active contracts for this patron business */}
                  {contracts.as_patron.filter(c => c.patron_business_id === selectedBusiness.id && c.status === 'active').length > 0 && (
                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="text-xs text-purple-400 font-medium mb-2 flex items-center gap-1">
                        <Scroll className="w-3 h-3" /> Активные контракты
                      </div>
                      {contracts.as_patron.filter(c => c.patron_business_id === selectedBusiness.id && c.status === 'active').map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                          <div>
                            <span className="text-white">{CONTRACT_TYPES[c.type]?.icon} {CONTRACT_TYPES[c.type]?.name}</span>
                            <span className="text-text-muted ml-2">→ {c.vassal_username}</span>
                          </div>
                          <Badge className={`${CONTRACT_TYPES[c.type]?.bg} ${CONTRACT_TYPES[c.type]?.color} text-xs`}>
                            {CONTRACT_TYPES[c.type]?.name.split(' ')[0]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Vassal contract info */}
              {selectedBusiness.contract_id && selectedBusiness.contract_buff_data && (
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Scroll className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium text-sm">Активный контракт</span>
                  </div>
                  {(() => {
                    const contractInfo = contracts.as_vassal.find(c => c.id === selectedBusiness.contract_id);
                    return contractInfo ? (
                      <div className="text-xs space-y-1">
                        <p className="text-white">{CONTRACT_TYPES[contractInfo.type]?.icon} {CONTRACT_TYPES[contractInfo.type]?.name}</p>
                        <p className="text-text-muted">{CONTRACT_TYPES[contractInfo.type]?.description}</p>
                        <p className="text-yellow-400">Баф: {selectedBusiness.contract_buff_data.icon} {selectedBusiness.contract_buff_data.name}</p>
                        <p className="text-text-muted">Патрон: {contractInfo.patron_username}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">
                        Баф контракта: {selectedBusiness.contract_buff_data.icon} {selectedBusiness.contract_buff_data.name}
                      </p>
                    );
                  })()}
                </div>
              )}
              
              <div className="text-xs text-text-muted">
                ID: {selectedBusiness.id}
              </div>
              
              {/* Кнопка продажи или снятия с продажи */}
              {selectedBusiness.on_sale ? (
                <Button 
                  onClick={handleCancelSale}
                  disabled={isCancelingSale}
                  className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                >
                  {isCancelingSale ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400 mr-2"></div>
                      Снимаем...
                    </>
                  ) : (
                    <>
                      <Tag className="w-4 h-4 mr-2" />
                      Снять с продажи
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowSellModal(true);
                  }}
                  className="w-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Выставить на продажу
                </Button>
              )}
            </div>
          )}
          
        </DialogContent>
      </Dialog>

      {/* Sell Modal */}
      <Dialog open={showSellModal} onOpenChange={setShowSellModal}>
        <DialogContent className="bg-void border-red-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Tag className="w-5 h-5 text-red-400" />
              Продать бизнес
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Бизнес будет продан вместе с землёй. Укажите желаемую цену.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBusiness && (() => {
            // Find plot for this business
            const businessPlot = myPlots.find(p => p.id === selectedBusiness.plot_id);
            const cityName = businessPlot?.island_id === 'ton_island' ? 'TON Island' : 
              (typeof businessPlot?.city_name === 'object' ? (businessPlot?.city_name?.ru || businessPlot?.city_name?.en || 'TON Island') : (businessPlot?.city_name || 'TON Island'));
            const plotPrice = businessPlot?.price || 0;
            const businessCost = selectedBusiness.base_cost_ton || selectedBusiness.config?.base_cost_ton || 0;
            const totalInvested = plotPrice + businessCost;
            const coordinates = selectedBusiness.x !== undefined && selectedBusiness.y !== undefined 
              ? `[${selectedBusiness.x}, ${selectedBusiness.y}]` 
              : (businessPlot ? `[${businessPlot.x}, ${businessPlot.y}]` : 'Неизвестно');
            const businessName = selectedBusiness.config?.name?.ru || selectedBusiness.config?.name?.en || selectedBusiness.business_type;
            
            return (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                <span className="text-4xl">{selectedBusiness.config?.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {businessName}
                  </h3>
                  <Badge variant="outline">Уровень {selectedBusiness.level}</Badge>
                </div>
              </div>
              
              {/* Detailed plot and business info like in MarketplacePage */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Город:</span>
                  <span className="text-amber-400">{cityName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Координаты:</span>
                  <span className="text-white">{coordinates}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Бизнес на участке:</span>
                  <span className="text-green-400">{businessName}</span>
                </div>
                {businessCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Стоимость бизнеса:</span>
                    <span className="text-white font-mono">{formatCity(tonToCity(businessCost))} $CITY</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Производит:</span>
                  <span className="text-cyan-400">
                    {getResource(selectedBusiness.config?.produces)?.icon} {getResource(selectedBusiness.config?.produces)?.name || selectedBusiness.config?.produces}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Выпуск/сутки:</span>
                  <span className="text-green-400 font-mono">
                    {(() => { const base = selectedBusiness.production?.base_production || 100; const dur = selectedBusiness.durability || 100; const m = dur <= 0 ? 0 : dur < 50 ? 0.8 : 1.0; return Math.round(base * m); })()} ед.
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Цена продажи ($CITY)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={sellPrice}
                  onChange={(e) => {
                    setSellPrice(e.target.value);
                    if (e.target.value) calculateSaleTax(e.target.value);
                  }}
                  placeholder="Например: 10.00"
                  className="bg-white/5 border-white/10"
                />
              </div>
              
              {sellTaxInfo && (
                <div className="p-4 bg-white/5 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Цена продажи:</span>
                    <span className="text-white font-mono">{formatCity(sellTaxInfo.price)} $CITY</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Налог ({sellTaxInfo.tax_rate_percent}, Tier {sellTaxInfo.tier || 1}):</span>
                    <span className="text-red-400 font-mono">−{formatCity(sellTaxInfo.tax_amount)} $CITY</span>
                  </div>
                  <div className="h-px bg-white/10 my-1" />
                  <div className="flex justify-between font-bold">
                    <span className="text-white">Чистая прибыль:</span>
                    <span className="text-green-400 text-lg font-mono">{formatCity(sellTaxInfo.seller_receives)} $CITY</span>
                  </div>
                </div>
              )}
            </div>
            );
          })()}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSellModal(false)} className="border-white/10 w-full sm:w-auto">
              Отмена
            </Button>
            <Button 
              onClick={handleSellBusiness}
              disabled={!sellPrice || isSelling}
              className="bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
            >
              {isSelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buff Selection Modal for Tier 3 businesses */}
      <Dialog open={showBuffModal} onOpenChange={setShowBuffModal}>
        <DialogContent className="bg-void border-yellow-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <span>⚡</span> Выберите баф для вассалов
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-text-muted mb-3">
            Этот баф получат все игроки, зарегистрировавшие свои бизнесы под вашим покровительством.
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {availableBuffs.map(buff => (
              <button
                key={buff.id}
                onClick={() => handleSetBuff(buff.id)}
                data-testid={`buff-${buff.id}`}
                className={`w-full text-left p-3 rounded-lg border transition-all ${buffBusiness?.patron_buff === buff.id ? 'border-yellow-500 bg-yellow-500/15' : 'border-white/10 bg-white/5 hover:border-yellow-500/50 hover:bg-yellow-500/10'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{buff.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">{buff.name}
                      {buffBusiness?.patron_buff === buff.id && <span className="ml-2 text-xs text-yellow-400">(активен)</span>}
                    </div>
                    <div className="text-xs text-text-muted">{buff.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuffModal(false)} className="border-white/10">Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vassals Modal for Tier 3 businesses */}
      <Dialog open={showVassalsModal} onOpenChange={setShowVassalsModal}>
        <DialogContent className="bg-void border-cyan-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-cyan-400" />
              Вассалы — {selectedBusiness?.config?.name?.ru || selectedBusiness?.config?.name?.en}
            </DialogTitle>
          </DialogHeader>
          {selectedBusiness?.patron_buff_data && (
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
              <span className="text-xs text-yellow-400 font-medium">
                Активный баф: {selectedBusiness.patron_buff_data.icon} {selectedBusiness.patron_buff_data.name}
              </span>
              <p className="text-xs text-text-muted mt-0.5">{selectedBusiness.patron_buff_data.description}</p>
            </div>
          )}
          {vassals.length === 0 ? (
            <div className="text-center py-8 text-text-muted">Нет вассалов. Игроки могут прийти под ваше покровительство.</div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {vassals.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  {v.owner_avatar && <img src={v.owner_avatar} className="w-8 h-8 rounded-full" alt="" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{v.owner_username}</div>
                    <div className="text-xs text-text-muted">{v.business_icon} {typeof v.business_name === 'object' ? (v.business_name?.ru || v.business_name?.en) : v.business_name} · Эшелон {v.business_tier}</div>
                    {/* Active contract indicator */}
                    {contracts.as_patron.find(c => c.vassal_business_id === v.business_id && c.status === 'active') && (
                      <div className="text-xs text-green-400 mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Контракт активен
                      </div>
                    )}
                  </div>
                  {/* Propose contract button */}
                  {!contracts.as_patron.find(c => c.vassal_business_id === v.business_id && ['proposed','active'].includes(c.status)) ? (
                    <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400 h-7 text-xs"
                      data-testid={`propose-contract-${v.business_id}`}
                      onClick={() => {
                        setShowVassalsModal(false);
                        openContractProposal({
                          business_id: v.business_id,
                          owner_username: v.owner_username,
                          business_name: typeof v.business_name === 'object' ? (v.business_name?.ru || v.business_name?.en) : v.business_name,
                          business_icon: v.business_icon,
                        });
                      }}>
                      <Scroll className="w-3 h-3 mr-1" /> Контракт
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-400 text-xs">Есть</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVassalsModal(false)} className="border-white/10">Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Contract Proposal Modal */}
      <Dialog open={showContractProposalModal} onOpenChange={setShowContractProposalModal}>
        <DialogContent className="bg-void border-purple-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Scroll className="w-5 h-5 text-purple-400" />
              Заключить альянс
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              {contractTarget && `Вассал: ${contractTarget.owner_username} · ${contractTarget.business_icon} ${contractTarget.business_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contract type selection */}
            <div>
              <Label className="text-white mb-2 block">Тип контракта</Label>
              <div className="space-y-2">
                {Object.entries(CONTRACT_TYPES).map(([id, ct]) => (
                  <button key={id} onClick={() => setProposalType(id)}
                    data-testid={`contract-type-${id}`}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      proposalType === id
                        ? `${ct.border} ${ct.bg}`
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ct.icon}</span>
                      <div className="flex-1">
                        <div className={`text-sm font-bold ${proposalType === id ? ct.color : 'text-white'}`}>{ct.name}</div>
                        <div className="text-xs text-text-muted">{ct.description}</div>
                        {proposalType === id && (
                          <div className="flex gap-3 mt-1">
                            <span className="text-[10px] text-green-400">Вассал: {ct.vassal_note}</span>
                            <span className="text-[10px] text-purple-400">Патрон: {ct.patron_note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* V2: Duration selection */}
            <div>
              <Label className="text-white mb-2 block">Длительность контракта</Label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map(d => (
                  <button key={d} onClick={() => setProposalDuration(d)}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                      proposalDuration === d
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold'
                        : 'border-white/10 bg-white/5 text-text-muted hover:border-white/20'
                    }`}>
                    {d} дн.
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={proposalAutoRenew}
                  onChange={e => setProposalAutoRenew(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-purple-500" />
                <span className="text-xs text-text-muted">Автопродление после истечения</span>
              </div>
            </div>

            {/* Buff selection */}
            <div>
              <Label className="text-white mb-2 block">Баф для вассала</Label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {availableBuffs.length === 0 ? (
                  <p className="text-xs text-text-muted">Загрузка бафов...</p>
                ) : availableBuffs.map(buff => (
                  <button key={buff.id} onClick={() => setProposalBuff(buff.id)}
                    data-testid={`proposal-buff-${buff.id}`}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      proposalBuff === buff.id
                        ? 'border-yellow-500 bg-yellow-500/15'
                        : 'border-white/10 bg-white/5 hover:border-yellow-500/40'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span>{buff.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{buff.name}</div>
                        <div className="text-xs text-text-muted">{buff.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* V2: Contract summary */}
            {proposalBuff && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-white mb-1">Итого по контракту:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-text-muted">Тип: <span className="text-white">{CONTRACT_TYPES[proposalType]?.name}</span></div>
                  <div className="text-text-muted">Срок: <span className="text-white">{proposalDuration} дней</span></div>
                  <div className="text-text-muted">Штраф при разрыве: <span className="text-red-400">{CONTRACT_TYPES[proposalType]?.penalty} $CITY</span></div>
                  <div className="text-text-muted">Грейс-период: <span className="text-blue-400">3 дня</span></div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowContractProposalModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button onClick={handleProposeContract} disabled={isProposing || !proposalBuff}
              className="bg-purple-600 hover:bg-purple-700" data-testid="submit-contract-proposal">
              {isProposing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scroll className="w-4 h-4 mr-2" />}
              Предложить альянс
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === T3 Resource Buff Activation Modal === */}
      <Dialog open={showResourceBuffModal} onOpenChange={setShowResourceBuffModal}>
        <DialogContent className="glass-panel border-purple-500/30 bg-void max-w-md !rounded-2xl" data-testid="resource-buff-modal">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              {selectedBuffResource?.buff?.buff_name || selectedBuffResource?.buff?.resource_name || 'Ресурс'}
            </DialogTitle>
          </DialogHeader>

          {selectedBuffResource && selectedBuffResource.buff && (() => {
            const b = selectedBuffResource.buff;
            const qty = selectedBuffResource.quantity || 0;
            const isActive = selectedBuffResource.isActive;
            const activeCount = (resourceBuffsData.active || []).length;
            const limitReached = activeCount >= 2 && !isActive;
            const canActivate = qty >= 1 && !isActive && !limitReached;

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-4xl">{b.buff_icon}</div>
                    <div>
                      <div className="font-bold text-white text-lg">{b.buff_name}</div>
                      <div className="text-xs text-purple-300">{b.resource_name} · {qty} ед. в наличии</div>
                    </div>
                  </div>
                  <div className="text-sm text-white/90 mt-2">{b.buff_description}</div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Длительность:</span>
                    <span className="font-bold text-purple-300">{b.duration_days} {b.duration_days === 1 ? 'день' : b.duration_days < 5 ? 'дня' : 'дней'} ({b.duration_days * 24}ч)</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Расход:</span>
                    <span className="font-bold text-amber-300">1 ед. (единоразово)</span>
                  </div>
                </div>

                <div className="text-xs text-text-muted space-y-1">
                  <div>• Одновременно может быть активно <b className="text-white">не более 2 бафов</b>.</div>
                  <div>• Нельзя активировать <b className="text-white">одинаковые</b> бафы одновременно.</div>
                  <div>• Сейчас активно: <b className="text-white">{activeCount}</b> / 2.</div>
                </div>

                {isActive && (
                  <div className="text-xs text-green-400 p-2 rounded bg-green-500/10 border border-green-500/30">
                    ● Этот баф уже активирован
                  </div>
                )}
                {limitReached && (
                  <div className="text-xs text-red-400 p-2 rounded bg-red-500/10 border border-red-500/30">
                    Достигнут лимит 2 активных бафов. Дождитесь окончания одного из них.
                  </div>
                )}
                {qty < 1 && !isActive && (
                  <div className="text-xs text-yellow-400 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                    У вас нет этого ресурса в запасах.
                  </div>
                )}

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowResourceBuffModal(false)}
                    className="w-full sm:w-auto"
                    data-testid="resource-buff-cancel"
                  >
                    Закрыть
                  </Button>
                  <Button
                    onClick={() => handleActivateResourceBuff(selectedBuffResource.resource_id)}
                    disabled={!canActivate || isActivatingBuff}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 w-full sm:w-auto"
                    data-testid="resource-buff-activate"
                  >
                    {isActivatingBuff ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    Активировать ({b.duration_days}д)
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
