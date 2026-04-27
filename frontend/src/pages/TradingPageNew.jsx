import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Filter, Search, Plus, Minus, ArrowUpDown,
  Package, Coins, TrendingUp, AlertCircle, Loader2, X,
  Check, ChevronDown, Tag, RefreshCw, Handshake, Warehouse, ArrowDown, ArrowUp, Building2,
  Crown, HandshakeIcon, Shield, Clock, Users, Scroll, EyeOff, MessageSquare
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { RESOURCES, getResource, getAllResources, formatPrice, formatAmount } from '@/lib/resourceConfig';
import { tonToCity, formatCity } from '@/lib/currency';
import { useTutorial } from '@/context/TutorialContext';

// Contract types for alliance offers display
const OFFER_CONTRACT_TYPES = {
  tax_haven: {
    name: 'Налоговая Гавань',
    description: 'Вассал платит 10% от дохода при продаже ресурсов',
    vassal_note: '10% от дохода при продаже',
    patron_note: 'Получаете 10% от прибыли вассала',
    icon: '🏝️',
    color: '#f59e0b',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    penalty: 500,
  },
  raw_material: {
    name: 'Сырьевой Придаток',
    description: 'Вассал отдаёт 15% произведённых ресурсов каждый тик',
    vassal_note: '15% произведённых ресурсов',
    patron_note: 'Получаете 15% ресурсов вассала',
    icon: '⚙️',
    color: '#3b82f6',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    penalty: 750,
  },
  tech_umbrella: {
    name: 'Технологический Зонтик',
    description: 'Фиксированная рента 50 $CITY/день',
    vassal_note: '50 $CITY/день',
    patron_note: 'Фиксированная рента 50 $CITY/день',
    icon: '🛡️',
    color: '#22c55e',
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    penalty: 300,
  },
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function TradingPage({ user, refreshBalance, updateBalance }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const tutorial = useTutorial();
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [myResources, setMyResources] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('buy');
  const [tierTaxes, setTierTaxes] = useState({ 1: 15, 2: 23, 3: 30 }); // tier → tax % from admin
  
  // Operations (Cooperation) data
  const [coopContracts, setCoopContracts] = useState([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [contractResource, setContractResource] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractPrice, setContractPrice] = useState('');
  const [contractDuration, setContractDuration] = useState('30');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [myProducedResources, setMyProducedResources] = useState([]);
  const [userHasBusinesses, setUserHasBusinesses] = useState(true);
  
  // Alliance offers state
  const [allianceOffers, setAllianceOffers] = useState([]);
  const [showAllOffersModal, setShowAllOffersModal] = useState(false);
  const [showPublishOfferModal, setShowPublishOfferModal] = useState(false);
  const [offerBuff, setOfferBuff] = useState('');
  const [offerType, setOfferType] = useState('tax_haven');
  const [offerDuration, setOfferDuration] = useState(30);
  const [isPublishing, setIsPublishing] = useState(false);
  const [availableBuffs, setAvailableBuffs] = useState([]);
  const [hasTier3, setHasTier3] = useState(false);
  const OFFERS_PER_PAGE = 3;
  
  // Tab counts
  const [coopCount, setCoopCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  
  // Coop sub-tab
  const [coopSubTab, setCoopSubTab] = useState('available');
  
  // Contracts (alliance) state
  const [contracts, setContracts] = useState({ as_patron: [], as_vassal: [] });
  
  // Counter-offer state
  const [counterOffers, setCounterOffers] = useState({ as_patron: [], as_vassal: [] });
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterTarget, setCounterTarget] = useState(null);
  const [counterType, setCounterType] = useState('tax_haven');
  const [counterDuration, setCounterDuration] = useState(30);
  const [counterComment, setCounterComment] = useState('');
  const [isCountering, setIsCountering] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    resource: 'all',
    minPrice: '',
    maxPrice: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'price_asc'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Sell modal
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellResource, setSellResource] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  
  // Buy modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [listingsRes, myListingsRes, resourcesRes, taxRes] = await Promise.all([
        fetch(`${API}/market/listings`),
        fetch(`${API}/market/my-listings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/my/resources`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/public/tax-settings`).catch(() => null)
      ]);
      
      if (taxRes && taxRes.ok) {
        const taxData = await taxRes.json();
        setTierTaxes({
          1: taxData.small_business_tax ?? 15,
          2: taxData.medium_business_tax ?? 23,
          3: taxData.large_business_tax ?? 30
        });
      }
      
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        setListings(data.listings || []);
      }
      
      if (myListingsRes.ok) {
        const data = await myListingsRes.json();
        setMyListings(data.listings || []);
      }
      
      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        setMyResources(data.resources || {});
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter listings
  // Tutorial: fetch the hidden bot lot on tutorial buy_lot step and merge it
  const [seedLot, setSeedLot] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tutorial?.active && ['buy_lot', 'go_trading_buy'].includes(tutorial?.currentStepId)) {
        const lot = tutorial?.getSeedLot ? await tutorial.getSeedLot() : null;
        if (!cancelled) setSeedLot(lot);
      } else {
        if (!cancelled) setSeedLot(null);
      }
    })();
    return () => { cancelled = true; };
  }, [tutorial?.active, tutorial?.currentStepId]);

  const filteredListings = useMemo(() => {
    let result = [...listings];
    // Prepend tutorial bot lot if visible for current step
    if (seedLot) {
      result = [seedLot, ...result.filter(l => l.id !== seedLot.id)];
    }
    
    // Exclude own listings - user should not see their own items
    if (user?.id) {
      result = result.filter(l => l.seller_id !== user.id);
    }
    
    // Filter by resource
    if (filters.resource !== 'all') {
      result = result.filter(l => l.resource_type === filters.resource);
    }
    
    // Filter by price
    if (filters.minPrice) {
      result = result.filter(l => l.price_per_unit >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      result = result.filter(l => l.price_per_unit <= parseFloat(filters.maxPrice));
    }
    
    // Filter by amount
    if (filters.minAmount) {
      result = result.filter(l => l.amount >= parseInt(filters.minAmount));
    }
    if (filters.maxAmount) {
      result = result.filter(l => l.amount <= parseInt(filters.maxAmount));
    }
    
    // Sort
    switch (filters.sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.price_per_unit - b.price_per_unit);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price_per_unit - a.price_per_unit);
        break;
      case 'amount_desc':
        result.sort((a, b) => b.amount - a.amount);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }
    
    return result;
  }, [listings, filters, seedLot, user?.id]);

  // Get available resources for selling
  const availableResources = useMemo(() => {
    return Object.entries(myResources)
      .filter(([_, amount]) => amount > 0)
      .map(([id, amount]) => ({ id, amount, ...getResource(id) }));
  }, [myResources]);

  // Helper: display price based on tier (Tier 1 = per 10, others = per 1)
  const tier1Resources = ['energy', 'scrap', 'quartz', 'cu', 'traffic', 'cooling', 'biomass'];
  const displayPrice = (listing) => {
    const isTier1 = tier1Resources.includes(listing.resource_type);
    const priceCity = tonToCity(listing.price_per_unit);
    if (isTier1) {
      return { price: formatCity(priceCity * 10), label: '/10' };
    }
    return { price: formatCity(priceCity), label: '/1' };
  };

  // Handle sell
  const handleSell = async () => {
    if (!sellResource || !sellAmount || !sellPrice) {
      toast.error(t('fillAllFieldsCredit'));
      return;
    }
    
    const amount = parseInt(sellAmount);
    const priceCity = parseFloat(sellPrice);
    const tier = getResource(sellResource)?.tier || 1;

    // Tutorial step `create_lot`: cap amount at (warehouse − 1) so the user
    // always keeps at least 1 unit of Neuro Core for the next «T3 = buff» step.
    if (tutorial?.active && tutorial?.currentStepId === 'create_lot') {
      const have = Math.floor(myResources[sellResource] || 0);
      const maxAllowed = Math.max(0, have - 1);
      if (amount > maxAllowed) {
        toast.error(`В обучении можно выставить не более ${maxAllowed} (на 1 меньше, чем у вас на складе).`);
        return;
      }
    }
    
    // For Tier1: price is per 10 units in $CITY, convert to per-unit TON
    // For Tier2/3: price is per 1 unit in $CITY, convert to per-unit TON  
    const pricePerUnitTon = tier === 1 
      ? (priceCity / 10) / 1000   // $CITY per 10 -> TON per 1
      : priceCity / 1000;          // $CITY per 1 -> TON per 1
    
    if (amount <= 0 || priceCity <= 0) {
      toast.error(t('loadingDataError'));
      return;
    }
    
    const available = myResources[sellResource] || 0;
    if (amount > available) {
      toast.error(`Недостаточно ресурсов. Доступно: ${Math.floor(available)}`);
      return;
    }
    
    setIsSelling(true);
    try {
      // Tutorial: intercept create_lot step and use tutorial create-lot endpoint instead
      if (tutorial?.active && tutorial?.currentStepId === 'create_lot') {
        const res = await fetch(`${API}/tutorial/create-lot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            resource_type: sellResource,
            amount,
            price_per_unit: pricePerUnitTon
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || t('loadingDataError'));
        }
        toast.success('🎓 ' + t('resourcesListedMsg'));
        setShowSellModal(false);
        setSellResource('');
        setSellAmount('');
        setSellPrice('');
        if (tutorial?.refreshStatus) await tutorial.refreshStatus();
        refreshBalance?.();
        fetchData();
        setIsSelling(false);
        return;
      }

      const res = await fetch(`${API}/market/list-resource`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          resource_type: sellResource,
          amount,
          price_per_unit: pricePerUnitTon
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || t('loadingDataError'));
      }
      
      toast.success(t('resourcesListedMsg'));
      setShowSellModal(false);
      setSellResource('');
      setSellAmount('');
      setSellPrice('');
      refreshBalance?.();
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSelling(false);
    }
  };

  // Handle buy
  const handleBuy = async () => {
    if (!selectedListing || !buyAmount) {
      toast.error(t('loadingDataError'));
      return;
    }
    
    const amount = formatAmount(parseFloat(buyAmount));
    
    if (amount <= 0) {
      toast.error(t('loadingDataError'));
      return;
    }
    
    if (amount > selectedListing.amount) {
      toast.error(`Максимум: ${selectedListing.amount}`);
      return;
    }
    
    setIsBuying(true);
    try {
      // Tutorial buy_lot: intercept and call /api/tutorial/buy-lot
      if (tutorial?.active && tutorial?.currentStepId === 'buy_lot' && selectedListing?.tutorial) {
        const res = await tutorial.buyTutorialLot({ amount });
        if (!res.ok) {
          throw new Error(res.error || 'Tutorial buy failed');
        }
        toast.success('🎓 +' + amount + ' Neuro Core');
        setShowBuyModal(false);
        setSelectedListing(null);
        setBuyAmount('');
        setSeedLot(null);
        if (tutorial?.refreshStatus) await tutorial.refreshStatus();
        fetchData();
        setIsBuying(false);
        return;
      }

      const res = await fetch(`${API}/market/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: selectedListing.id,
          amount
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || t('loadingDataError'));
      }
      
      const data = await res.json();
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">{t('purchaseSuccess') || 'Покупка успешна!'}</span>
          <span className="text-sm">{t('received') || 'Получено'}: {amount} {getResource(selectedListing.resource_type).name}</span>
          <span className="text-sm text-amber-400">{t('paid') || 'Оплачено'}: {formatCity(tonToCity(data.total_paid))} $CITY</span>
        </div>
      );
      setShowBuyModal(false);
      setBuyAmount('');
      setSelectedListing(null);
      // Update balance immediately
      if (data.new_balance !== undefined) {
        updateBalance?.(data.new_balance);
      } else {
        refreshBalance?.();
      }
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsBuying(false);
    }
  };

  // Cancel listing
  const handleCancelListing = async (listingId) => {
    try {
      const res = await fetch(`${API}/market/cancel/${listingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Ошибка отмены');
      
      toast.success(t('listingCanceledMsg'));
      refreshBalance?.();
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Fetch cooperation contracts
  const fetchCoopContracts = async () => {
    setOperationsLoading(true);
    try {
      const [contractsRes, bizRes, configRes] = await Promise.all([
        fetch(`${API}/cooperation/list`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/my/businesses`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/config`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setCoopContracts(data.contracts || []);
        setCoopCount(data.contracts?.length || 0);
      }
      // Build list of resources produced by user's businesses
      if (bizRes.ok && configRes.ok) {
        const bizData = await bizRes.json();
        const cfgData = await configRes.json();
        const businessesList = bizData.businesses || [];
        setUserHasBusinesses(businessesList.length > 0);
        const businessConfig = cfgData.businesses || {};
        const produced = new Set();
        businessesList.forEach(biz => {
          const cfg = businessConfig[biz.business_type];
          if (cfg?.produces) produced.add(cfg.produces);
        });
        setMyProducedResources([...produced].map(id => getResource(id)));
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setOperationsLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!contractResource || !contractAmount || !contractPrice) {
      toast.error('Заполните все поля');
      return;
    }
    setIsCreatingContract(true);
    try {
      const res = await fetch(`${API}/cooperation/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resource_type: contractResource,
          amount_per_day: parseFloat(contractAmount),
          price_per_unit: parseFloat(contractPrice),
          duration_days: parseInt(contractDuration) || 30,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error');
      }
      toast.success('Контракт создан!');
      setShowCreateContract(false);
      setContractResource('');
      setContractAmount('');
      setContractPrice('');
      fetchCoopContracts();
    } catch (e) { toast.error(e.message); }
    finally { setIsCreatingContract(false); }
  };

  const handleAcceptContract = async (contractId) => {
    try {
      const res = await fetch(`${API}/cooperation/accept/${contractId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error');
      }
      toast.success('Контракт принят!');
      fetchCoopContracts();
    } catch (e) { toast.error(e.message); }
  };

  const handleCancelContract = async (contractId) => {
    try {
      const res = await fetch(`${API}/cooperation/cancel/${contractId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error');
      }
      toast.success('Контракт отменён');
      fetchCoopContracts();
    } catch (e) { toast.error(e.message); }
  };

  // Fetch counts for tab badges on initial load
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [coopRes, offersRes] = await Promise.all([
          fetch(`${API}/cooperation/list`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          fetch(`${API}/alliances/offers`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        ]);
        if (coopRes?.ok) { const d = await coopRes.json(); setCoopCount(d.contracts?.length || 0); setCoopContracts(d.contracts || []); }
        if (offersRes?.ok) { const d = await offersRes.json(); setOffersCount(d.total || 0); }
      } catch {}
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'operations' && coopContracts.length === 0) {
      fetchCoopContracts();
    }
    if (activeTab === 'offers') {
      fetchAllianceOffers();
      fetchContracts();
      fetchCounterOffers();
    }
  }, [activeTab]);

  // Alliance offers functions
  const fetchAllianceOffers = async () => {
    try {
      const [offersRes, bizRes] = await Promise.all([
        fetch(`${API}/alliances/offers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/my/businesses`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      if (offersRes.ok) {
        const data = await offersRes.json();
        setAllianceOffers(data.offers || []);
        setOffersCount(data.total || 0);
      }
      if (bizRes && bizRes.ok) {
        const bizData = await bizRes.json();
        const businesses = bizData.businesses || [];
        setHasTier3(businesses.some(b => (b.config?.tier || 1) === 3));
      }
    } catch (e) {
      console.error('Failed to fetch alliance offers:', e);
    }
  };

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
        body: JSON.stringify({ buff_id: offerBuff, contract_type: offerType, duration_days: offerDuration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success('Оффер опубликован!');
      setShowPublishOfferModal(false);
      setOfferBuff('');
      setOfferType('tax_haven');
      setOfferDuration(30);
      fetchAllianceOffers();
    } catch (e) { toast.error(e.message); }
    finally { setIsPublishing(false); }
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      const res = await fetch(`${API}/alliances/accept/${offerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success(data.message || 'Альянс заключён!');
      fetchAllianceOffers();
    } catch (e) { toast.error(e.message); }
  };

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
    } catch (e) { toast.error(e.message); }
  };

  // Fetch user contracts (alliances)
  const fetchContracts = async () => {
    try {
      const res = await fetch(`${API}/contracts/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      }
    } catch {}
  };

  // Contract action (accept/reject/cancel)
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
      fetchAllianceOffers();
      fetchCounterOffers();
    } catch (e) { toast.error(e.message); }
  };

  // Hide offer / contract — OPTIMISTIC UI (instant removal)
  const handleHideOffer = async (offerId) => {
    // Instantly remove from UI
    setAllianceOffers(prev => prev.filter(o => o.id !== offerId));
    setOffersCount(prev => Math.max(0, prev - 1));
    try {
      const res = await fetch(`${API}/alliances/hide/${offerId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { fetchAllianceOffers(); throw new Error('Ошибка'); }
    } catch (e) { toast.error(e.message); }
  };

  const handleHideContract = async (contractId) => {
    // Instantly remove from UI
    setCoopContracts(prev => prev.filter(c => c.id !== contractId));
    setCoopCount(prev => Math.max(0, prev - 1));
    // Also remove from alliance contracts
    setContracts(prev => ({
      as_patron: prev.as_patron.filter(c => c.id !== contractId),
      as_vassal: prev.as_vassal.filter(c => c.id !== contractId),
    }));
    try {
      const res = await fetch(`${API}/contracts/hide/${contractId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { fetchCoopContracts(); fetchContracts(); throw new Error('Ошибка'); }
    } catch (e) { toast.error(e.message); }
  };

  // Counter-offers
  const fetchCounterOffers = async () => {
    try {
      const res = await fetch(`${API}/alliances/counter-offers`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setCounterOffers(data); }
    } catch {}
  };

  const handleSubmitCounterOffer = async () => {
    if (!counterTarget) return;
    setIsCountering(true);
    try {
      const res = await fetch(`${API}/alliances/counter-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          offer_id: counterTarget.id,
          contract_type: counterType,
          duration_days: counterDuration,
          comment: counterComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success('Встречное предложение отправлено!');
      setShowCounterModal(false);
      setCounterComment('');
      fetchAllianceOffers();
    } catch (e) { toast.error(e.message); }
    finally { setIsCountering(false); }
  };

  const handleCounterOfferAction = async (counterId, action) => {
    try {
      const res = await fetch(`${API}/alliances/counter-offer/${counterId}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка');
      toast.success(data.message || 'Готово');
      fetchCounterOffers();
      fetchContracts();
    } catch (e) { toast.error(e.message); }
  };

  // Apply filters
  const applyFilters = () => {
    setShowFilters(false);
    toast.success(t('confirm'));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      resource: 'all',
      minPrice: '',
      maxPrice: '',
      minAmount: '',
      maxAmount: '',
      sortBy: 'price_asc'
    });
    toast.success(t('confirm'));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-void">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar user={user} />
      
      <main className="flex-1 p-4 lg:p-6 pt-4 lg:pt-6 lg:ml-16">
        <div className="max-w-6xl mx-auto">
          {/* Header with refresh button on the right - aligned with burger menu */}
          <div className="flex items-center justify-between mb-4 pl-10 sm:pl-0">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 text-cyber-cyan" />
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-white uppercase tracking-tight">{t('tradingPageTitle')}</h1>
                <p className="text-text-muted text-sm">{t('buyAndSellResourcesDesc')}</p>
              </div>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" className="border-white/10">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs Row - responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 lg:mb-6">
              <Button
                onClick={() => {
                  setActiveTab('buy');
                  if (tutorial?.active && tutorial?.currentStepId === 'go_trading_buy') {
                    tutorial.advance(tutorial.currentStepId);
                  }
                }}
                variant={activeTab === 'buy' ? 'default' : 'outline'}
                className={activeTab === 'buy' ? 'bg-cyber-cyan text-black' : 'border-white/10'}
                data-testid="tutorial-trading-tab-buy"
              >
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                {t('buyTab')} ({filteredListings.length})
              </Button>
              <Button
                onClick={() => {
                  setActiveTab('my');
                  if (tutorial?.active && tutorial?.currentStepId === 'go_trading_my') {
                    tutorial.advance(tutorial.currentStepId);
                  }
                }}
                variant={activeTab === 'my' ? 'default' : 'outline'}
                className={activeTab === 'my' ? 'bg-amber-500 text-black' : 'border-white/10'}
                data-testid="tutorial-trading-tab-my"
              >
                <Tag className="w-4 h-4 mr-1.5" />
                {t('myTab')} ({myListings.length})
              </Button>
            <Button
              data-testid="operations-tab"
              onClick={() => setActiveTab('operations')}
              variant={activeTab === 'operations' ? 'default' : 'outline'}
              className={activeTab === 'operations' ? 'bg-purple-500 text-white' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'}
            >
              <Handshake className="w-4 h-4 mr-1.5" />
              Контракты
              {coopCount > 0 && <Badge className="ml-1.5 bg-white/20 text-xs px-1.5 py-0">{coopCount}</Badge>}
            </Button>
            <Button
              data-testid="offers-tab"
              onClick={() => setActiveTab('offers')}
              variant={activeTab === 'offers' ? 'default' : 'outline'}
              className={activeTab === 'offers' ? 'bg-amber-500 text-black' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}
            >
              <Shield className="w-4 h-4 mr-1.5" />
              Офферы
              {offersCount > 0 && <Badge className="ml-1.5 bg-white/20 text-xs px-1.5 py-0">{offersCount}</Badge>}
            </Button>
          </div>
          
          {/* Filters section - shown on Buy tab */}
          {activeTab === 'buy' && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <Button onClick={() => setShowFilters(true)} variant="outline" size="sm" className="border-white/10">
                <Filter className="w-4 h-4 mr-2" />
                {t('filtersBtn')}
              </Button>
            </div>
          )}

          {/* Active filters */}
          {(filters.resource !== 'all' || filters.minPrice || filters.maxPrice) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.resource !== 'all' && (
                <Badge variant="outline" className="bg-white/5">
                  {getResource(filters.resource).icon} {getResource(filters.resource).name}
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer" 
                    onClick={() => setFilters(f => ({ ...f, resource: 'all' }))}
                  />
                </Badge>
              )}
              {filters.minPrice && (
                <Badge variant="outline" className="bg-white/5">
                  {t('minPriceLabel')}: {filters.minPrice} $CITY
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer" 
                    onClick={() => setFilters(f => ({ ...f, minPrice: '' }))}
                  />
                </Badge>
              )}
              {filters.maxPrice && (
                <Badge variant="outline" className="bg-white/5">
                  {t('maxPriceLabel')}: {filters.maxPrice} $CITY
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer" 
                    onClick={() => setFilters(f => ({ ...f, maxPrice: '' }))}
                  />
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <RefreshCw className="w-3 h-3 mr-1" /> {t('resetFilters')}
              </Button>
            </div>
          )}

          {/* Content */}
          {activeTab === 'buy' && (
            <>
              {!userHasBusinesses && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-red-300 text-sm">У вас нет бизнесов и складов — покупка ресурсов недоступна. Сначала постройте бизнес.</p>
                </div>
              )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.length === 0 ? (
                <div className="col-span-full text-center py-12 text-text-muted">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('noListingsFound')}</p>
                </div>
              ) : (
                filteredListings.map(listing => {
                  const resource = getResource(listing.resource_type);
                  return (
                    <Card 
                      key={listing.id} 
                      className={`bg-void border ${resource.borderColor} hover:border-opacity-100 transition-all ${userHasBusinesses ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                      onClick={() => {
                        if (!userHasBusinesses) return;
                        setSelectedListing(listing);
                        const isTier1 = resource.tier === 1;
                        const defaultAmount = isTier1 ? 10 : 1;
                        setBuyAmount(String(Math.min(listing.amount, defaultAmount)));
                        setShowBuyModal(true);
                      }}
                    >
                      <CardContent className="p-4">
                        {/* Resource header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-12 h-12 rounded-lg ${resource.bgColor} flex items-center justify-center text-2xl`}>
                            {resource.icon}
                          </div>
                          <div className="flex-1">
                            <div className={`font-bold ${resource.textColor}`}>{resource.name}</div>
                            <div className="text-xs text-text-muted">{listing.seller_username}</div>
                          </div>
                        </div>
                        
                        {/* Price & Amount */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-xs text-text-muted">{t('priceLabel')} {displayPrice(listing).label}</div>
                            <div className="font-bold text-cyber-cyan">{displayPrice(listing).price} $CITY</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-xs text-text-muted">{t('amountLabel')}</div>
                            <div className="font-bold text-white">{formatAmount(listing.amount)}</div>
                          </div>
                        </div>
                        
                        {/* Total */}
                        <div className="text-sm text-right text-text-muted">
                          {t('totalPrice')}: <span className="text-white">{formatCity(tonToCity(listing.amount * listing.price_per_unit))} $CITY</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            </>
          )}

          {activeTab === 'my' && (
            <div className="space-y-4">
              {(() => {
                const MAX_LISTINGS = 3;
                const showButton = myListings.length < MAX_LISTINGS;
                const sellButton = (
                  <Button
                    onClick={() => setShowSellModal(true)}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="tutorial-create-lot-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('sellResource')}
                  </Button>
                );

                if (myListings.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-4">
                      <Tag className="w-12 h-12 opacity-50" />
                      <p>{t('noMyListings')}</p>
                      {showButton && sellButton}
                    </div>
                  );
                }
                return (
                  <>
                    {myListings.map(listing => {
                      const resource = getResource(listing.resource_type);
                      return (
                        <Card key={listing.id} className={`bg-void border ${resource.borderColor}`}>
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg ${resource.bgColor} flex items-center justify-center text-2xl`}>
                              {resource.icon}
                            </div>
                            <div className="flex-1">
                              <div className={`font-bold ${resource.textColor}`}>{resource.name}</div>
                              <div className="text-sm text-text-muted">
                                {formatAmount(listing.amount)} × {displayPrice(listing).price} $CITY{displayPrice(listing).label}
                              </div>
                            </div>
                            <div className="text-right">
                              {(() => {
                                const tier = resource.tier || 1;
                                const tax = tierTaxes[tier] || 15;
                                const gross = tonToCity(listing.amount * listing.price_per_unit);
                                const net = gross * (1 - tax / 100);
                                return (
                                  <>
                                    <div className="text-xs text-text-muted line-through">{formatCity(gross)} $CITY</div>
                                    <div className="text-lg font-bold text-green-400">{formatCity(net)} $CITY</div>
                                    <div className="text-xs text-amber-500">−{tax}% налог</div>
                                  </>
                                );
                              })()}
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-1 text-red-400 border-red-500/30"
                                onClick={() => handleCancelListing(listing.id)}
                              >
                                <X className="w-3 h-3 mr-1" /> {t('cancelAction')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {showButton && (
                      <div className="flex justify-center pt-2">
                        {sellButton}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Operations (Cooperation) Tab — Sub-tabs */}
          {activeTab === 'operations' && (
            <div className="space-y-4" data-testid="operations-content">
              {/* Sub-tabs row */}
              {(() => {
                const myOpen = coopContracts.filter(c => c.seller_id === user?.id && c.status === 'open');
                const active = coopContracts.filter(c => c.status === 'active');
                const othersOpen = coopContracts.filter(c => c.seller_id !== user?.id && c.status === 'open');

                const subtabs = [
                  { id: 'available', label: 'Актуальные', count: othersOpen.length, icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'cyan' },
                  { id: 'mine', label: 'Мои', count: myOpen.length, icon: <Tag className="w-3.5 h-3.5" />, color: 'purple' },
                  { id: 'active', label: 'Активные', count: active.length, icon: <Check className="w-3.5 h-3.5" />, color: 'green' },
                ];

                const renderCard = (contract, variant) => {
                  const res = getResource(contract.resource_type);
                  const isOwn = contract.seller_id === user?.id;
                  const tier = contract.resource_tier || 1;
                  const pricePerUnit = contract.price_per_unit || contract.price_per_10 || 0;
                  const dailyCostCity = tier === 1
                    ? (contract.amount_per_day / 10) * pricePerUnit
                    : contract.amount_per_day * pricePerUnit;
                  const borderMap = { active: 'border-green-500/30', mine: 'border-purple-500/30', available: 'border-cyan-500/30' };

                  return (
                    <Card key={contract.id} className={`bg-void border ${borderMap[variant] || 'border-white/10'}`} data-testid={`coop-card-${contract.id}`}>
                      {variant === 'active' && (
                        <div className="h-1.5 bg-gray-700/50 relative">
                          <div className="h-full rounded-r-full transition-all" style={{
                            width: `${Math.min(100, Math.round(((contract.days_elapsed || 0) / (contract.duration_days || 30)) * 100))}%`,
                            background: 'linear-gradient(90deg, #22c55e, #22c55e88)',
                          }} />
                        </div>
                      )}
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xl">{res.icon}</span>
                              <span className="text-white font-bold text-sm">{res.name}</span>
                              <span className="text-xs text-text-muted">{contract.seller_username}</span>
                              {variant === 'active' && <Badge className="bg-green-500/20 text-green-400 text-[10px]">Активный</Badge>}
                              {variant === 'mine' && <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">Открыт</Badge>}
                              {variant === 'available' && <Badge className="bg-cyan-500/20 text-cyan-400 text-[10px]">Открыт</Badge>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                              <div><span className="text-text-muted">{t('perDay')}:</span> <span className="text-white font-mono">{contract.amount_per_day} ед.</span></div>
                              <div><span className="text-text-muted">{tier === 1 ? t('pricePer10') : t('pricePer1')}:</span> <span className="text-yellow-400 font-mono">{pricePerUnit} $CITY</span></div>
                              <div><span className="text-text-muted">{t('costPerDay')}:</span> <span className="text-amber-400 font-mono">{formatCity(dailyCostCity)} $CITY</span></div>
                              <div><span className="text-text-muted">Срок:</span> <span className="text-white font-mono">{contract.duration_days} дн.</span></div>
                            </div>
                            {variant === 'active' && contract.buyer_username && (
                              <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
                                <span className="text-green-400">{t('buyer')}: {contract.buyer_username}</span>
                                {contract.started_at && (
                                  <span className="text-text-muted"><Clock className="w-3 h-3 inline mr-0.5" />{contract.days_remaining ?? contract.duration_days} дн. осталось</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {variant === 'available' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                                  onClick={() => handleAcceptContract(contract.id)}>
                                  <Check className="w-3.5 h-3.5 mr-1" /> {t('accept')}
                                </Button>
                                <Button size="sm" variant="ghost" className="text-text-muted hover:text-white h-7 text-xs"
                                  onClick={() => handleHideContract(contract.id)} data-testid={`hide-coop-${contract.id}`}>
                                  <EyeOff className="w-3.5 h-3.5 mr-1" /> Скрыть
                                </Button>
                              </>
                            )}
                            {variant === 'mine' && (
                              <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 h-8 text-xs"
                                onClick={() => handleCancelContract(contract.id)}>
                                <X className="w-3.5 h-3.5 mr-1" /> {t('cancelContract')}
                              </Button>
                            )}
                            {variant === 'active' && isOwn && (
                              <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 h-8 text-xs"
                                onClick={() => handleCancelContract(contract.id)}>
                                <X className="w-3.5 h-3.5 mr-1" /> Разорвать
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                };

                const currentList = coopSubTab === 'available' ? othersOpen
                  : coopSubTab === 'mine' ? myOpen : active;

                return (
                  <>
                    {/* Sub-tabs */}
                    <div className="flex gap-2" data-testid="coop-subtabs">
                      {subtabs.map(st => {
                        const isActive = coopSubTab === st.id;
                        const colorMap = {
                          cyan:   isActive ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'border-white/10 text-text-muted hover:border-cyan-500/40',
                          purple: isActive ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-white/10 text-text-muted hover:border-purple-500/40',
                          green:  isActive ? 'bg-green-500/20 border-green-500 text-green-300' : 'border-white/10 text-text-muted hover:border-green-500/40',
                        };
                        return (
                          <button key={st.id} onClick={() => setCoopSubTab(st.id)}
                            data-testid={`coop-subtab-${st.id}`}
                            className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${colorMap[st.color]}`}>
                            {st.icon}
                            <span className="hidden sm:inline">{st.label}</span>
                            <span className="sm:hidden">{st.label.slice(0, 4)}.</span>
                            {st.count > 0 && (
                              <span className={`ml-0.5 px-1.5 py-0 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-white/10'}`}>{st.count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Content */}
                    {(() => {
                      const createContractBtn = (
                        <Button data-testid="create-contract-btn" onClick={() => setShowCreateContract(true)}
                          className="bg-purple-500 hover:bg-purple-600 text-white" size="sm">
                          <Plus className="w-4 h-4 mr-1" /> {t('createContract')}
                        </Button>
                      );
                      if (operationsLoading) {
                        return (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                          </div>
                        );
                      }
                      if (currentList.length > 0) {
                        return (
                          <>
                            <div className="space-y-2">
                              {currentList.map(c => renderCard(c, coopSubTab))}
                            </div>
                            {coopSubTab === 'mine' && (
                              <div className="flex justify-center pt-2">
                                {createContractBtn}
                              </div>
                            )}
                          </>
                        );
                      }
                      return (
                        <Card className="bg-void border-white/10">
                          <CardContent className="p-8 text-center">
                            {coopSubTab === 'available' && (
                              <>
                                <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-cyan-400 opacity-40" />
                                <p className="text-text-muted text-sm">Нет актуальных предложений</p>
                                <p className="text-text-muted text-xs mt-1">Когда другие игроки создадут контракты, они появятся здесь</p>
                              </>
                            )}
                            {coopSubTab === 'mine' && (
                              <div className="flex flex-col items-center gap-4">
                                <Tag className="w-10 h-10 text-purple-400 opacity-40" />
                                <p className="text-text-muted text-sm">У вас нет открытых контрактов</p>
                                <p className="text-text-muted text-xs -mt-3">Создайте контракт на поставку ресурсов</p>
                                {createContractBtn}
                              </div>
                            )}
                            {coopSubTab === 'active' && (
                              <>
                                <Handshake className="w-10 h-10 mx-auto mb-3 text-green-400 opacity-40" />
                                <p className="text-text-muted text-sm">Нет активных контрактов</p>
                                <p className="text-text-muted text-xs mt-1">Примите контракт из «Актуальные» или дождитесь принятия вашего</p>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'offers' && (
            <div className="space-y-6" data-testid="offers-content">

              {/* ═══════ SECTION 1: ОФФЕРЫ АЛЬЯНСОВ ═══════ */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    Офферы альянсов
                  </h3>
                  {hasTier3 && (
                    <Button size="sm" data-testid="publish-offer-btn"
                      onClick={async () => {
                        if (availableBuffs.length === 0) {
                          try {
                            const res = await fetch(`${API}/tier3/buffs`, { headers: { Authorization: `Bearer ${token}` } });
                            const data = await res.json();
                            setAvailableBuffs(data.buffs || []);
                          } catch {}
                        }
                        setShowPublishOfferModal(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white">
                      <Crown className="w-3.5 h-3.5 mr-1.5" />
                      <span className="hidden sm:inline">Опубликовать оффер</span>
                      <span className="sm:hidden">Оффер</span>
                    </Button>
                  )}
                </div>

                {/* My published offers (as patron) */}
                {(() => {
                  const myOffers = allianceOffers.filter(o => o.patron_username === user?.username);
                  return myOffers.length > 0 ? (
                    <div className="mb-3">
                      <div className="text-xs text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5" /> Мои офферы ({myOffers.length})
                      </div>
                      <div className="space-y-2">
                        {myOffers.map(offer => {
                          const ct = OFFER_CONTRACT_TYPES[offer.contract_type] || {};
                          return (
                            <Card key={offer.id} className="bg-void border-purple-500/20" data-testid={`my-offer-${offer.id}`}>
                              <CardContent className="p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-lg">{ct.icon || offer.contract_type_icon}</span>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{ct.name || offer.contract_type_name}</div>
                                    <div className="text-xs text-text-muted truncate">{offer.buff_icon} {offer.buff_name} · {offer.duration_days} дн.</div>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 shrink-0 h-7 text-xs"
                                  data-testid={`cancel-offer-${offer.id}`} onClick={() => handleCancelOffer(offer.id)}>
                                  <X className="w-3 h-3 mr-1" /> Отменить
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Browsable offers from other patrons */}
                {(() => {
                  const otherOffers = allianceOffers.filter(o => o.patron_username !== user?.username);
                  const visibleOffers = otherOffers.slice(0, OFFERS_PER_PAGE);
                  const hasMore = otherOffers.length > OFFERS_PER_PAGE;
                  return otherOffers.length === 0 ? (
                    <Card className="bg-void border-amber-500/20 border-dashed">
                      <CardContent className="p-6 text-center">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-white font-medium text-sm mb-1">Нет доступных офферов</p>
                        <p className="text-text-muted text-xs">Когда Патроны (Эшелон 3) опубликуют офферы, они появятся здесь.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {visibleOffers.map(offer => {
                          const ct = OFFER_CONTRACT_TYPES[offer.contract_type] || {};
                          return (
                            <motion.div key={offer.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                              <Card className={`bg-void ${ct.border || 'border-white/10'} overflow-hidden`} data-testid={`offer-card-${offer.id}`}>
                                <div className="h-1" style={{ background: `linear-gradient(90deg, ${ct.color || '#f59e0b'}, ${ct.color || '#f59e0b'}66)` }} />
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-xl">{offer.patron_business_icon}</span>
                                        <span className="font-bold text-white text-sm">{offer.patron_business_name} ({offer.patron_username}, Ур. {offer.patron_level || 1})</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                                          <div className="text-[10px] text-green-400 font-medium mb-0.5">Вы получите</div>
                                          <div className="text-xs text-white flex items-center gap-1">{offer.buff_icon} {offer.buff_name}</div>
                                          {offer.buff_description && <div className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{offer.buff_description}</div>}
                                        </div>
                                        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                          <div className="text-[10px] text-red-400 font-medium mb-0.5">Вы отдаёте</div>
                                          <div className="text-xs text-white">{offer.vassal_pays || ct.vassal_note}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                                        <span>{ct.icon} {ct.name || offer.contract_type_name}</span>
                                        <span>Срок: <span className="text-white">{offer.duration_days} дн.</span></span>
                                        <span>Грейс: <span className="text-blue-400">3 дня</span></span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                                        data-testid={`accept-offer-${offer.id}`} onClick={() => handleAcceptOffer(offer.id)}>
                                        <Check className="w-3.5 h-3.5 mr-1" /> Вступить
                                      </Button>
                                      <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 h-7 text-xs"
                                        data-testid={`counter-offer-${offer.id}`}
                                        onClick={() => { setCounterTarget(offer); setCounterType(offer.contract_type || 'tax_haven'); setCounterDuration(offer.duration_days || 30); setShowCounterModal(true); }}>
                                        <MessageSquare className="w-3 h-3 mr-1" /> Встречное
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-text-muted hover:text-white h-7 text-xs"
                                        data-testid={`hide-offer-${offer.id}`} onClick={() => handleHideOffer(offer.id)}>
                                        <EyeOff className="w-3 h-3 mr-1" /> Скрыть
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                      {hasMore && (
                        <div className="flex justify-center mt-3">
                          <Button variant="outline" onClick={() => setShowAllOffersModal(true)}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" data-testid="show-all-offers-btn">
                            <ChevronDown className="w-4 h-4 mr-2" /> Показать все ({otherOffers.length})
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* ═══════ DIVIDER ═══════ */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center">
                  <span className="bg-void px-4 text-xs text-text-muted uppercase tracking-widest">Мои альянсы</span>
                </div>
              </div>

              {/* ═══════ SECTION 2: АКТИВНЫЕ АЛЬЯНСЫ ═══════ */}
              {(() => {
                const totalContracts = contracts.as_patron.length + contracts.as_vassal.length;
                const pendingVassal = contracts.as_vassal.filter(c => c.status === 'proposed').length;
                const activeContracts = [...contracts.as_patron, ...contracts.as_vassal].filter(c => c.status === 'active');
                const pendingSent = contracts.as_patron.filter(c => c.status === 'proposed');
                const incomingProposals = contracts.as_vassal.filter(c => c.status === 'proposed');

                return (
                  <div data-testid="alliances-section">
                    {/* Counter-offers received (patron side) */}
                    {counterOffers.as_patron.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-cyan-400 font-semibold mb-2 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" /> Встречные предложения ({counterOffers.as_patron.length})
                        </div>
                        <div className="space-y-2">
                          {counterOffers.as_patron.map(co => {
                            const ct = OFFER_CONTRACT_TYPES[co.proposed_contract_type] || {};
                            const origCt = OFFER_CONTRACT_TYPES[co.original_contract_type] || {};
                            const changed = co.proposed_contract_type !== co.original_contract_type || co.proposed_duration !== co.original_duration;
                            return (
                              <Card key={co.id} className="bg-void border-cyan-500/30 overflow-hidden" data-testid={`counter-offer-${co.id}`}>
                                <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-sm font-bold text-white">{co.vassal_username}</span>
                                        <span className="text-xs text-text-muted">{co.vassal_business_icon} {co.vassal_business_name}</span>
                                      </div>
                                      {changed && (
                                        <div className="text-xs mb-1.5 space-y-0.5">
                                          <div className="text-text-muted">Было: {origCt.icon} {origCt.name}, {co.original_duration} дн.</div>
                                          <div className="text-cyan-400 font-medium">Предлагает: {ct.icon} {ct.name}, {co.proposed_duration} дн.</div>
                                        </div>
                                      )}
                                      {!changed && <div className="text-xs text-cyan-400 mb-1.5">Согласен с условиями, предлагает альянс</div>}
                                      {co.comment && <div className="text-xs text-text-muted italic bg-white/5 rounded p-1.5 mb-1.5">"{co.comment}"</div>}
                                      <div className="text-[10px] text-text-muted">Баф: {co.buff_icon} {co.buff_name}</div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                        onClick={() => handleCounterOfferAction(co.id, 'accept')}>
                                        <Check className="w-3 h-3 mr-1" /> Принять
                                      </Button>
                                      <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 h-7 text-xs"
                                        onClick={() => handleCounterOfferAction(co.id, 'reject')}>
                                        <X className="w-3 h-3 mr-1" /> Отклонить
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-text-muted h-7 text-xs"
                                        onClick={() => handleCounterOfferAction(co.id, 'hide')}>
                                        <EyeOff className="w-3 h-3 mr-1" /> Скрыть
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Incoming proposals */}
                    {incomingProposals.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> Входящие предложения ({incomingProposals.length})
                        </div>
                        <div className="space-y-2">
                          {incomingProposals.map(c => {
                            const ct = OFFER_CONTRACT_TYPES[c.type] || {};
                            return (
                            <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                              <Card className="bg-void border-amber-500/30 overflow-hidden" data-testid={`proposal-card-${c.id}`}>
                                <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-xl">{ct.icon}</span>
                                        <span className="font-bold text-white text-sm">{ct.name}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20">
                                          <div className="text-[10px] text-green-400 font-medium">Вы получите баф</div>
                                          <div className="text-xs text-white">{c.buff_data?.icon} {c.buff_data?.name || 'Баф'}</div>
                                        </div>
                                        <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20">
                                          <div className="text-[10px] text-red-400 font-medium">Вы отдаёте</div>
                                          <div className="text-xs text-white">{ct.vassal_note || c.contract_type_data?.patron_benefit}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                                        <span>Патрон: <span className="text-purple-300">{c.patron_username}</span></span>
                                        <span>{c.patron_business_icon} {c.patron_business_name}</span>
                                        <span>Срок: <span className="text-white">{c.duration_days || 30} дн.</span></span>
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                        data-testid={`accept-contract-${c.id}`} onClick={() => handleContractAction(c.id, 'accept')}>
                                        <Check className="w-3 h-3 mr-1" /> Принять
                                      </Button>
                                      <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 h-7 text-xs"
                                        data-testid={`reject-contract-${c.id}`} onClick={() => handleContractAction(c.id, 'reject')}>
                                        <X className="w-3 h-3 mr-1" /> Отклонить
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-text-muted hover:text-white h-7 text-xs"
                                        onClick={() => handleHideContract(c.id)}>
                                        <EyeOff className="w-3 h-3 mr-1" /> Скрыть
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active contracts */}
                    {activeContracts.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-green-400 font-semibold mb-2 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> Активные альянсы ({activeContracts.length})
                        </div>
                        <div className="space-y-2">
                          {[...contracts.as_patron.filter(c => c.status === 'active').map(c => ({...c, role: 'patron'})),
                             ...contracts.as_vassal.filter(c => c.status === 'active').map(c => ({...c, role: 'vassal'}))].map(c => {
                            const progressPct = c.progress_pct || 0;
                            const daysLeft = c.days_remaining ?? (c.duration_days || 30);
                            const inGrace = c.in_grace_period;
                            const typeInfo = OFFER_CONTRACT_TYPES[c.type] || {};
                            return (
                              <Card key={c.id} className={`bg-void ${typeInfo.border || 'border-white/10'} overflow-hidden`} data-testid={`active-contract-${c.id}`}>
                                <div className="h-1.5 bg-gray-700/50 relative">
                                  <div className="h-full rounded-r-full transition-all duration-1000"
                                    style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${typeInfo.color || '#a855f7'}, ${typeInfo.color || '#a855f7'}88)` }} />
                                </div>
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-lg">{typeInfo.icon}</span>
                                        <span className="font-bold text-white text-sm">{typeInfo.name}</span>
                                        <Badge className={`text-[10px] ${c.role === 'patron' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                          {c.role === 'patron' ? 'Патрон' : 'Вассал'}
                                        </Badge>
                                        {inGrace && <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Грейс</Badge>}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-1.5">
                                        <div className="text-text-muted"><Crown className="w-3 h-3 inline mr-1 text-purple-400" />Патрон: <span className="text-white">{c.patron_username}</span></div>
                                        <div className="text-text-muted"><Users className="w-3 h-3 inline mr-1 text-cyan-400" />Вассал: <span className="text-white">{c.vassal_username}</span></div>
                                        <div className="text-text-muted">{c.patron_business_icon} {c.patron_business_name}</div>
                                        <div className="text-text-muted">{c.vassal_business_icon} {c.vassal_business_name}</div>
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {c.buff_data?.name && <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">{c.buff_data.icon} {c.buff_data.name}</span>}
                                        <span className="text-xs text-text-muted"><Clock className="w-3 h-3 inline mr-0.5" />{daysLeft} дн. осталось</span>
                                        {c.auto_renew && <span className="text-xs text-green-400"><RefreshCw className="w-3 h-3 inline mr-0.5" /> Авто</span>}
                                      </div>
                                      {c.violation_days?.length > 0 && (
                                        <div className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Нарушений: {c.violation_days.length}/3</div>
                                      )}
                                    </div>
                                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 shrink-0 h-7 text-xs"
                                      data-testid={`cancel-contract-${c.id}`} onClick={() => handleContractAction(c.id, 'cancel')}>
                                      <X className="w-3 h-3 mr-1" /> Разорвать
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pending sent proposals */}
                    {pendingSent.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-text-muted font-semibold mb-2 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> Ожидают ответа ({pendingSent.length})
                        </div>
                        <div className="space-y-2">
                          {pendingSent.map(c => {
                            const ct = OFFER_CONTRACT_TYPES[c.type] || {};
                            return (
                            <Card key={c.id} className="bg-void border-white/10">
                              <CardContent className="p-3 flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span>{ct.icon}</span>
                                    <span className="text-sm text-white truncate">{ct.name}</span>
                                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span className="text-xs text-amber-400">Ожидание</span></div>
                                  </div>
                                  <p className="text-xs text-text-muted mt-0.5">
                                    → {c.vassal_username} ({c.vassal_business_icon} {c.vassal_business_name})
                                    <span className="ml-2 text-white/40">|</span><span className="ml-2">{c.duration_days || 30} дн.</span>
                                  </p>
                                </div>
                                <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 shrink-0 h-7 text-xs"
                                  onClick={() => handleContractAction(c.id, 'cancel')}>Отозвать</Button>
                              </CardContent>
                            </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {totalContracts === 0 && (
                      <Card className="bg-void border-purple-500/20 border-dashed">
                        <CardContent className="p-6 text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <Scroll className="w-6 h-6 text-purple-400" />
                          </div>
                          <p className="text-white font-medium text-sm mb-1">Нет активных альянсов</p>
                          <p className="text-text-muted text-xs">Примите оффер от Патрона или получите предложение.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </main>

      {/* Create Contract Modal */}
      <Dialog open={showCreateContract} onOpenChange={setShowCreateContract}>
        <DialogContent className="bg-void border-purple-500/30 w-[calc(100%-2rem)] max-w-lg !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-purple-400" />
              {t('createContract')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('resourceToSupply')}</Label>
              <Select value={contractResource} onValueChange={(v) => { setContractResource(v); setContractAmount(''); }}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Выберите ресурс..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResources.length > 0 ? availableResources.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span>{r.icon}</span>
                        <span>{r.name}</span>
                        <span className="text-xs text-text-muted">({Math.floor(myResources[r.id] || 0)} ед.)</span>
                      </div>
                    </SelectItem>
                  )) : (
                    <SelectItem value="none" disabled>{t('noResources')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selectedRes = contractResource ? getResource(contractResource) : null;
              const tier = selectedRes?.tier || 1;
              const isTier1 = tier === 1;
              const priceLabel = isTier1 ? 'Цена за 10 ед. ($CITY)' : 'Цена за 1 ед. ($CITY)';
              return (
                <>
                  {contractResource && isTier1 && (
                    <div className="text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                      {t('tier1Hint')}
                    </div>
                  )}
                  {contractResource && !isTier1 && (
                    <div className="text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                      {t('tierNHint').replace('{tier}', tier)}
                    </div>
                  )}
                  <div>
                    <Label>{t('amountPerDay')} {isTier1 && <span className="text-xs text-amber-400">({t('amountMultiple10')})</span>}</Label>
                    <Input
                      type="number" min={isTier1 ? "10" : "1"} step={isTier1 ? "10" : "1"}
                      value={contractAmount} onChange={(e) => setContractAmount(e.target.value)}
                      placeholder={isTier1 ? "10" : "1"}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div>
                    <Label>{priceLabel}</Label>
                    <Input
                      type="number" min="1" step="1"
                      value={contractPrice} onChange={(e) => setContractPrice(e.target.value)}
                      placeholder="29"
                      className="bg-white/5 border-white/10"
                    />
                    {contractAmount && contractPrice && (
                      <div className="text-xs text-text-muted mt-1">
                        {t('dailyCostLabel')}: <span className="text-yellow-400 font-bold">
                          {formatCity(
                            tier === 1 
                              ? (parseFloat(contractAmount) / 10) * parseFloat(contractPrice)
                              : parseFloat(contractAmount) * parseFloat(contractPrice)
                          )} $CITY
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            <div>
              <Label>{t('contractDuration')}</Label>
              <Input
                type="number" min="1" max="90" step="1"
                value={contractDuration} onChange={(e) => setContractDuration(e.target.value)}
                placeholder="30"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setShowCreateContract(false)} className="border-white/10 w-full sm:w-auto">
              {t('cancel')}
            </Button>
            <Button
              data-testid="submit-contract-btn"
              onClick={handleCreateContract}
              disabled={isCreatingContract || !contractResource || !contractAmount || !contractPrice}
              className="bg-purple-500 hover:bg-purple-600 w-full sm:w-auto"
            >
              {isCreatingContract ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Handshake className="w-4 h-4 mr-2" />}
              {t('createContract')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Filters Modal */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="bg-void border-white/10 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyber-cyan" />
              {t('filtersBtn')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resource filter with icons */}
            <div>
              <Label>{t('resourceLabel')}</Label>
              <Select value={filters.resource} onValueChange={(v) => setFilters(f => ({ ...f, resource: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder={t('allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">{t('allTypes')}</div>
                  </SelectItem>
                  {getAllResources().map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span>{r.icon}</span>
                        <span>{r.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Price range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('minPriceTon')}</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label>{t('maxPriceTon')}</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="100000"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
            
            {/* Amount range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('minAmountLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={filters.minAmount}
                  onChange={(e) => setFilters(f => ({ ...f, minAmount: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label>{t('maxAmountLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1000"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
            
            {/* Sort */}
            <div>
              <Label>{t('sortLabel')}</Label>
              <Select value={filters.sortBy} onValueChange={(v) => setFilters(f => ({ ...f, sortBy: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">{t('priceAscFull')}</SelectItem>
                  <SelectItem value="price_desc">{t('priceDescFull')}</SelectItem>
                  <SelectItem value="amount_desc">{t('amountDescFull')}</SelectItem>
                  <SelectItem value="newest">{t('newestFull')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={resetFilters} className="border-white/10">
              {t('resetFilters')}
            </Button>
            <Button onClick={applyFilters} className="bg-cyber-cyan text-black">
              <Check className="w-4 h-4 mr-2" />
              {t('apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Modal */}
      <Dialog open={showSellModal} onOpenChange={setShowSellModal}>
        <DialogContent className="bg-void border-green-500/30 !rounded-2xl" data-testid="sell-resource-modal">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-green-400" />
              {t('listForSale')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {availableResources.length === 0 ? (
              <div className="text-center py-6 text-text-muted">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('noResourcesForSale')}</p>
              </div>
            ) : (
              <>
                {/* Resource selection */}
                <div data-testid="sell-resource-select-wrap">
                  <Label>{t('selectResourcePlaceholder')}</Label>
                  <Select value={sellResource} onValueChange={setSellResource}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-14" data-testid="sell-resource-select-trigger">
                      <SelectValue placeholder={t('selectResourcePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableResources.map(r => (
                        <SelectItem key={r.id} value={r.id} data-testid={`sell-resource-option-${r.id}`}>
                          <div className="flex items-center gap-3 py-1">
                            <span className="text-xl">{r.icon}</span>
                            <div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-text-muted">{t('availableLabel')}: {formatAmount(r.amount)}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {sellResource && (
                  <>
                    <div className={`p-3 rounded-lg ${getResource(sellResource).bgColor} border ${getResource(sellResource).borderColor}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getResource(sellResource).icon}</span>
                        <div>
                          <div className="font-bold">{getResource(sellResource).name}</div>
                          <div className="text-sm text-text-muted">
                            {t('availableLabel')}: <span className="text-white font-bold">{formatAmount(myResources[sellResource] || 0)}</span>
                          </div>
                        </div>
                      </div>
                      {getResource(sellResource).tier === 1 && (
                        <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                          {t('tier1Hint')}
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div data-testid="sell-amount-wrap">
                        <Label>{getResource(sellResource).tier === 1 ? t('amountMultiple10') : t('amountPerUnit')}</Label>
                        <Input
                          type="number"
                          min={getResource(sellResource).tier === 1 ? "10" : "1"}
                          step={getResource(sellResource).tier === 1 ? "10" : "1"}
                          max={Math.floor(myResources[sellResource] || 0)}
                          placeholder={getResource(sellResource).tier === 1 ? "10" : "1"}
                          value={sellAmount}
                          onChange={(e) => setSellAmount(e.target.value)}
                          className="bg-white/5 border-white/10"
                          data-testid="sell-amount-input"
                        />
                      </div>
                      <div data-testid="sell-price-wrap">
                        <Label>{getResource(sellResource).tier === 1 ? t('pricePer10') : t('pricePer1')}</Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="10"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          className="bg-white/5 border-white/10"
                          data-testid="sell-price-input"
                        />
                      </div>
                    </div>
                    
                    {sellAmount && sellPrice && (
                      <div className="bg-white/5 rounded-lg p-3 space-y-2">
                        {(() => {
                          const tier = getResource(sellResource).tier || 1;
                          const tax = tierTaxes[tier] || 15;
                          const qty = tier === 1 ? parseInt(sellAmount) / 10 : parseInt(sellAmount);
                          const gross = qty * parseFloat(sellPrice);
                          const taxAmt = gross * tax / 100;
                          const net = gross - taxAmt;
                          return (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-text-muted">Сумма листинга:</span>
                                <span className="text-white font-mono">{formatCity(gross)} $CITY</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-text-muted">Налог ({tax}%, Tier {tier}):</span>
                                <span className="text-red-400 font-mono">−{formatCity(taxAmt)} $CITY</span>
                              </div>
                              <div className="border-t border-white/10 pt-2 flex justify-between">
                                <span className="text-text-muted font-medium">Чистая прибыль:</span>
                                <span className="text-green-400 font-bold text-lg font-mono">~{formatCity(net)} $CITY</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            <Button variant="outline" onClick={() => setShowSellModal(false)} className="border-white/10 w-full sm:w-auto">
              {t('cancelBtn')}
            </Button>
            <Button 
              onClick={handleSell}
              disabled={isSelling || !sellResource || !sellAmount || !sellPrice}
              className="bg-green-500 hover:bg-green-600 w-full sm:w-auto"
              data-testid="sell-confirm-btn"
            >
              {isSelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {t('listBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Modal */}
      <Dialog open={showBuyModal} onOpenChange={setShowBuyModal}>
        <DialogContent className="bg-void border-cyber-cyan/30 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyber-cyan" />
              {t('buyResourceTitle')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedListing && (
            <div className="space-y-4">
              {/* Resource info */}
              <div className={`p-4 rounded-lg ${getResource(selectedListing.resource_type).bgColor} border ${getResource(selectedListing.resource_type).borderColor}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getResource(selectedListing.resource_type).icon}</span>
                  <div>
                    <div className={`font-bold text-lg ${getResource(selectedListing.resource_type).textColor}`}>
                      {getResource(selectedListing.resource_type).name}
                    </div>
                    <div className="text-sm text-text-muted">{t('sellerLabel')}: {selectedListing.seller_username}</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-text-muted">{t('pricePerUnitShort')} {displayPrice(selectedListing).label}</div>
                  <div className="font-bold text-cyber-cyan">{displayPrice(selectedListing).price} $CITY</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-text-muted">{t('availableAmountLabel')}</div>
                  <div className="font-bold text-white">{formatAmount(selectedListing.amount)}</div>
                </div>
              </div>
              
              <div>
                <Label>{t('howManyToBuy')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="icon" variant="outline" onClick={() => {
                    const step = getResource(selectedListing.resource_type).tier === 1 ? 10 : 1;
                    setBuyAmount(String(Math.max(step, parseInt(buyAmount || 0) - step)));
                  }}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={getResource(selectedListing.resource_type).tier === 1 ? "10" : "1"}
                    max={selectedListing.amount}
                    step={getResource(selectedListing.resource_type).tier === 1 ? "10" : "1"}
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="bg-white/5 border-white/10 text-center"
                  />
                  <Button size="icon" variant="outline" onClick={() => {
                    const step = getResource(selectedListing.resource_type).tier === 1 ? 10 : 1;
                    setBuyAmount(String(Math.min(selectedListing.amount, parseInt(buyAmount || 0) + step)));
                  }}>  <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setBuyAmount(String(selectedListing.amount))}>
                    {t('allBtn')}
                  </Button>
                </div>
              </div>
              
              {buyAmount && (
                <div className="bg-cyber-cyan/10 rounded-lg p-4 text-center border border-cyber-cyan/30">
                  <div className="text-sm text-text-muted">{t('totalToPay')}</div>
                  <div className="text-2xl font-bold text-cyber-cyan">
                    {formatCity(tonToCity(parseInt(buyAmount) * selectedListing.price_per_unit))} $CITY
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            <Button variant="outline" onClick={() => setShowBuyModal(false)} className="border-white/10 w-full sm:w-auto">
              {t('cancelBtn')}
            </Button>
            <Button 
              onClick={handleBuy}
              disabled={isBuying || !buyAmount || !userHasBusinesses}
              className="bg-cyber-cyan text-black w-full sm:w-auto"
            >
              {isBuying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              {t('buyBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Alliance Offers Modal */}
      <Dialog open={showAllOffersModal} onOpenChange={setShowAllOffersModal}>
        <DialogContent className="bg-void border-amber-500/30 max-w-lg max-h-[85vh] !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Все доступные офферы
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Выберите оффер от Патрона для вступления в альянс
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-2">
            <div className="space-y-3">
              {allianceOffers.filter(o => o.patron_username !== user?.username).map(offer => {
                const ct = OFFER_CONTRACT_TYPES[offer.contract_type] || {};
                return (
                  <Card key={offer.id} className={`bg-void ${ct.border || 'border-white/10'} overflow-hidden`} data-testid={`modal-offer-${offer.id}`}>
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${ct.color || '#f59e0b'}, ${ct.color || '#f59e0b'}66)` }} />
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-lg">{offer.patron_business_icon}</span>
                            <span className="font-bold text-white text-sm">{offer.patron_business_name}</span>
                            <span className="text-xs text-text-muted">({offer.patron_username}, Ур. {offer.patron_level || 1})</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20">
                              <div className="text-[10px] text-green-400 font-medium">Вы получите</div>
                              <div className="text-xs text-white">{offer.buff_icon} {offer.buff_name}</div>
                              <div className="text-[10px] text-text-muted line-clamp-1">{offer.buff_description}</div>
                            </div>
                            <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20">
                              <div className="text-[10px] text-red-400 font-medium">Вы отдаёте</div>
                              <div className="text-xs text-white">{offer.vassal_pays || ct.vassal_note}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted flex-wrap">
                            <span>{ct.icon} {ct.name}</span><span>|</span>
                            <span>{offer.duration_days} дн.</span><span>|</span>
                            <span>Грейс: 3 дня</span>
                          </div>
                        </div>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs shrink-0"
                          data-testid={`modal-accept-${offer.id}`}
                          onClick={() => { handleAcceptOffer(offer.id); setShowAllOffersModal(false); }}>
                          <Check className="w-3 h-3 mr-1" /> Вступить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {allianceOffers.filter(o => o.patron_username !== user?.username).length === 0 && (
                <div className="text-center py-8 text-text-muted">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Нет доступных офферов</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllOffersModal(false)} className="border-white/10">Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Alliance Offer Modal */}
      <Dialog open={showPublishOfferModal} onOpenChange={setShowPublishOfferModal}>
        <DialogContent className="bg-void border-purple-500/30 max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-400" />
              Опубликовать оффер альянса
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Как Патрон (Эшелон 3), вы публикуете публичный оффер.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-1">
            <div className="space-y-4">
              {/* Contract type */}
              <div>
                <Label className="text-white mb-2 block text-sm">Что вы хотите взамен</Label>
                <div className="space-y-2">
                  {Object.entries(OFFER_CONTRACT_TYPES).map(([id, ct]) => (
                    <button key={id} onClick={() => setOfferType(id)}
                      data-testid={`offer-type-${id}`}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        offerType === id ? `${ct.border} ${ct.bg}` : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ct.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold ${offerType === id ? 'text-white' : 'text-white'}`}>{ct.name}</div>
                          <div className="text-xs text-text-muted">{ct.description}</div>
                          {offerType === id && <div className="mt-1"><span className="text-[10px] text-purple-400">Вы получаете: {ct.patron_note}</span></div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Buff */}
              <div>
                <Label className="text-white mb-2 block text-sm">Баф для вассала</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableBuffs.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">Загрузка бафов...</p>
                  ) : availableBuffs.map(buff => (
                    <button key={buff.id} onClick={() => setOfferBuff(buff.id)}
                      data-testid={`offer-buff-${buff.id}`}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        offerBuff === buff.id ? 'border-yellow-500 bg-yellow-500/15' : 'border-white/10 bg-white/5 hover:border-yellow-500/40'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{buff.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white">{buff.name}</div>
                          <div className="text-[10px] text-text-muted truncate">{buff.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Duration */}
              <div>
                <Label className="text-white mb-2 block text-sm">Срок контракта</Label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map(d => (
                    <button key={d} onClick={() => setOfferDuration(d)}
                      data-testid={`offer-duration-${d}`}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                        offerDuration === d ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold' : 'border-white/10 bg-white/5 text-text-muted hover:border-white/20'
                      }`}>{d} дн.</button>
                  ))}
                </div>
              </div>
              {/* Summary */}
              {offerBuff && offerType && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs font-medium text-white mb-2">Итого по офферу:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-text-muted">Тип: <span className="text-white">{OFFER_CONTRACT_TYPES[offerType]?.name}</span></div>
                    <div className="text-text-muted">Срок: <span className="text-white">{offerDuration} дней</span></div>
                    <div className="text-text-muted">Баф: <span className="text-yellow-400">
                      {availableBuffs.find(b => b.id === offerBuff)?.icon} {availableBuffs.find(b => b.id === offerBuff)?.name}
                    </span></div>
                    <div className="text-text-muted">Штраф: <span className="text-red-400">{OFFER_CONTRACT_TYPES[offerType]?.penalty} $CITY</span></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPublishOfferModal(false)} className="border-white/10">Отмена</Button>
            <Button onClick={handlePublishOffer} disabled={isPublishing || !offerBuff || !offerType}
              className="bg-purple-600 hover:bg-purple-700" data-testid="submit-offer-btn">
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
              Опубликовать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter-Offer Modal */}
      <Dialog open={showCounterModal} onOpenChange={setShowCounterModal}>
        <DialogContent className="bg-void border-cyan-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Встречное предложение
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              {counterTarget && `Патрон: ${counterTarget.patron_username} · ${counterTarget.patron_business_icon} ${counterTarget.patron_business_name}`}
            </DialogDescription>
          </DialogHeader>
          {counterTarget && (
            <div className="space-y-4">
              {/* Original offer info */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-text-muted mb-1">Баф от Патрона (не меняется):</div>
                <div className="text-sm text-yellow-400">{counterTarget.buff_icon} {counterTarget.buff_name}</div>
              </div>

              {/* Proposed payment type */}
              <div>
                <Label className="text-white mb-2 block text-sm">Предлагаемый тип оплаты</Label>
                <div className="space-y-1.5">
                  {Object.entries(OFFER_CONTRACT_TYPES).map(([id, ct]) => (
                    <button key={id} onClick={() => setCounterType(id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        counterType === id ? `${ct.border} ${ct.bg}` : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ct.icon}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">{ct.name}</div>
                          <div className="text-[10px] text-text-muted">{ct.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label className="text-white mb-2 block text-sm">Предлагаемый срок</Label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map(d => (
                    <button key={d} onClick={() => setCounterDuration(d)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                        counterDuration === d ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold' : 'border-white/10 bg-white/5 text-text-muted'
                      }`}>{d}</button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <Label className="text-white mb-2 block text-sm">Комментарий (опционально)</Label>
                <Input value={counterComment} onChange={e => setCounterComment(e.target.value)}
                  placeholder="Почему эти условия лучше..."
                  maxLength={200} className="bg-white/5 border-white/10" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCounterModal(false)} className="border-white/10">Отмена</Button>
            <Button onClick={handleSubmitCounterOffer} disabled={isCountering}
              className="bg-cyan-600 hover:bg-cyan-700" data-testid="submit-counter-btn">
              {isCountering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
