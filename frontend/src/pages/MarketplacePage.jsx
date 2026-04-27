import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, MapPin, Building2, Plus, ShoppingCart, Trash2,
  Filter, SortAsc, RefreshCw, Package, Coins, ArrowUpRight,
  ArrowDownRight, Search, X, Check, AlertCircle
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';

import { formatCity, tonToCity } from '@/lib/currency';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const RESOURCE_INFO = {
  energy:       { nameKey: 'resourceEnergy',       icon: '⚡', color: 'text-amber-400',  tier: 1 },
  scrap:        { nameKey: 'resourceScrap',         icon: '🔩', color: 'text-slate-300',  tier: 1 },
  quartz:       { nameKey: 'resourceQuartz',        icon: '💠', color: 'text-violet-400', tier: 1 },
  cu:           { nameKey: 'resourceCu',            icon: '🔢', color: 'text-blue-400',   tier: 1 },
  traffic:      { nameKey: 'resourceTraffic',       icon: '📶', color: 'text-cyan-400',   tier: 1 },
  cooling:      { nameKey: 'resourceCooling',       icon: '🧊', color: 'text-sky-400',    tier: 1 },
  biomass:      { nameKey: 'resourceBiomass',       icon: '🍏', color: 'text-green-400',  tier: 1 },
  chips:        { nameKey: 'resourceChips',         icon: '💾', color: 'text-orange-400', tier: 2 },
  neurocode:    { nameKey: 'resourceNeurocode',     icon: '🧠', color: 'text-purple-400', tier: 2 },
  nft:          { nameKey: 'resourceNft',           icon: '🖼️', color: 'text-pink-400',   tier: 2 },
  vr_experience:{ nameKey: 'resourceVrExperience',  icon: '🎬', color: 'text-fuchsia-400',tier: 2 },
  logistics:    { nameKey: 'resourceLogistics',     icon: '⛽', color: 'text-teal-400',   tier: 2 },
  profit_ton:   { nameKey: 'resourceProfitTon',     icon: '🍱', color: 'text-yellow-400', tier: 2 },
  repair_kits:  { nameKey: 'resourceRepairKits',    icon: '🧰', color: 'text-gray-400',   tier: 2 },
  neuro_core:   { nameKey: 'resourceNeuroCore',     icon: '🔮', color: 'text-purple-300', tier: 3 },
  gold_bill:    { nameKey: 'resourceGoldBill',      icon: '📜', color: 'text-amber-300',  tier: 3 },
  license_token:{ nameKey: 'resourceLicense',       icon: '🎫', color: 'text-sky-300',    tier: 3 },
  luck_chip:    { nameKey: 'resourceLuckChip',      icon: '🎲', color: 'text-pink-300',   tier: 3 },
  war_protocol: { nameKey: 'resourceWarProtocol',   icon: '⚔️', color: 'text-red-400',    tier: 3 },
  bio_module:   { nameKey: 'resourceBioModule',     icon: '🧬', color: 'text-green-300',  tier: 3 },
  gateway_code: { nameKey: 'resourceGatewayCode',   icon: '🔑', color: 'text-yellow-300', tier: 3 },
};

const BUSINESS_ICONS = {
  farm: '🌾',
  factory: '🏭',
  shop: '🏪',
  restaurant: '🍽️',
  bank: '🏦',
  power_plant: '⚡',
  quarry: '⛏️',
};

export default function MarketplacePage({ user, refreshBalance, updateBalance }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Helper to get translated resource name
  const getResName = (key) => {
    const info = RESOURCE_INFO[key];
    return info ? t(info.nameKey) : key;
  };
  const [activeTab, setActiveTab] = useState('land');
  const [isLoading, setIsLoading] = useState(true);
  
  // Tax settings from admin
  const [taxSettings, setTaxSettings] = useState({ land_business_sale_tax: 10 });
  
  // Data
  const [resourceListings, setResourceListings] = useState([]);
  const [landListings, setLandListings] = useState([]);
  const [myResourceListings, setMyResourceListings] = useState([]);
  const [myLandListings, setMyLandListings] = useState([]);
  const [myPlots, setMyPlots] = useState([]);
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Filters
  const [resourceFilter, setResourceFilter] = useState('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('price');
  
  // Modals
  const [showSellResourceModal, setShowSellResourceModal] = useState(false);
  const [showSellLandModal, setShowSellLandModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBuyLandModal, setShowBuyLandModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedLandListing, setSelectedLandListing] = useState(null);
  
  // Forms
  const [sellResourceForm, setSellResourceForm] = useState({
    business_id: '',
    resource_type: '',
    amount: 0,
    price_per_unit: 0
  });
  
  const [sellLandForm, setSellLandForm] = useState({
    plot_id: '',
    price: ''
  });
  
  const [buyAmount, setBuyAmount] = useState(0);

  const token = localStorage.getItem('token');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all listings and tax settings
      const [resListings, landList, myRes, myLand, citiesData, taxData] = await Promise.all([
        fetch(`${API}/market/listings`).then(r => r.json()),
        fetch(`${API}/market/land/listings`).then(r => r.json()),
        token ? fetch(`${API}/market/my-listings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()) : { listings: [] },
        token ? fetch(`${API}/market/land/my-listings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()) : { listings: [] },
        fetch(`${API}/cities`).then(r => r.json()),
        fetch(`${API}/public/tax-settings`).then(r => r.json()).catch(() => ({ land_business_sale_tax: 10 }))
      ]);
      
      setResourceListings(resListings.listings || []);
      setLandListings(landList.listings || []);
      setMyResourceListings(myRes.listings || []);
      setMyLandListings(myLand.listings || []);
      setCities(citiesData.cities || []);
      setTaxSettings(taxData);
      
      // Fetch user's plots and businesses for selling
      if (token && user) {
        const plotsRes = await fetch(`${API}/users/me/plots`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ plots: [] }));
        const bizRes = await fetch(`${API}/users/me/businesses`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ businesses: [] }));
        setMyPlots(plotsRes.plots || []);
        setMyBusinesses(bizRes.businesses || []);
      }
    } catch (error) {
      console.error('Failed to fetch marketplace data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleBuyResource = async () => {
    if (!selectedListing || buyAmount <= 0) return;
    
    try {
      const res = await fetch(`${API}/market/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: selectedListing.id,
          amount: buyAmount
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Purchase failed');
      }
      
      const data = await res.json();
      toast.success(t('boughtResourcesMsg').replace('{amount}', buyAmount).replace('{name}', getResName(selectedListing.resource_type)).replace('{total}', data.total_paid.toFixed(2)));
      setShowBuyModal(false);
      setSelectedListing(null);
      setBuyAmount(0);
      
      // Update balance immediately
      if (data.new_balance !== undefined) {
        updateBalance?.(data.new_balance);
      } else {
        refreshBalance?.();
      }
      
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const MAX_PLOTS_PER_USER = 3;
  
  const openBuyLandModal = (listing) => {
    // Check if this is user's own listing (check both seller_id and seller_user_id)
    const sellerId = listing.seller_id || listing.seller_user_id;
    if (sellerId === user?.id || sellerId === user?.wallet_address) {
      toast.error(t('cantBuyOwn'));
      return;
    }
    
    // Check plots limit (excluding plots that are on sale)
    const ownedPlotsCount = myPlots.filter(p => !p.on_sale).length;
    if (ownedPlotsCount >= MAX_PLOTS_PER_USER) {
      toast.error(`У вас уже лимит участков (${MAX_PLOTS_PER_USER}). Продайте один из участков чтобы купить новый.`);
      return;
    }
    
    setSelectedLandListing(listing);
    setShowBuyLandModal(true);
  };

  const handleBuyLand = async () => {
    if (!selectedLandListing) return;
    
    const listing = selectedLandListing;
    
    try {
      const res = await fetch(`${API}/market/land/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listing_id: listing.id })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Purchase failed');
      }
      
      const data = await res.json();
      toast.success(`${t('plotBoughtMsg').replace('{total}', data.total_paid)} ${data.has_business ? t('withBusinessLabel') : ''}`);
      setShowBuyLandModal(false);
      setSelectedLandListing(null);
      
      // Update balance immediately
      if (data.new_balance !== undefined) {
        updateBalance?.(data.new_balance);
      } else {
        refreshBalance?.();
      }
      
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSellResource = async () => {
    if (!sellResourceForm.business_id || sellResourceForm.amount <= 0 || sellResourceForm.price_per_unit <= 0) {
      toast.error(t('fillAllFieldsCredit'));
      return;
    }
    
    try {
      const res = await fetch(`${API}/market/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...sellResourceForm,
          price_per_unit: sellResourceForm.price_per_unit / 1000  // Convert $CITY to TON for backend
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Listing failed');
      }
      
      toast.success(t('resourcesListedMsg'));
      setShowSellResourceModal(false);
      setSellResourceForm({ business_id: '', resource_type: '', amount: 0, price_per_unit: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSellLand = async () => {
    if (!sellLandForm.plot_id || sellLandForm.price <= 0) {
      toast.error(t('selectPlotAndPrice'));
      return;
    }
    
    try {
      const selectedPlot = myPlots.find(p => p.id === sellLandForm.plot_id);
      const businessId = selectedPlot?.business_id;
      
      let res;
      if (businessId) {
        // Plot has a business - use business sell endpoint (marks both business and plot as on_sale)
        res = await fetch(`${API}/business/${businessId}/sell`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            price: sellLandForm.price / 1000  // Convert $CITY to TON for backend
          })
        });
      } else {
        // Empty plot - use land listing endpoint
        res = await fetch(`${API}/market/land/list`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            plot_id: sellLandForm.plot_id,
            price: sellLandForm.price / 1000  // Convert $CITY to TON for backend
          })
        });
      }
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Listing failed');
      }
      
      toast.success(t('plotListedMsg'));
      setShowSellLandModal(false);
      setSellLandForm({ plot_id: '', price: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCancelListing = async (type, listingId) => {
    const endpoint = type === 'resource' ? `/market/listing/${listingId}` : `/market/land/listing/${listingId}`;
    
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to cancel');
      
      toast.success(t('listingCanceledMsg'));
      refreshBalance?.();
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const filteredResourceListings = resourceListings.filter(l => 
    resourceFilter === 'all' || l.resource_type === resourceFilter
  );

  const filteredLandListings = landListings.filter(l => {
    // Don't show user's own listings in main list (check both seller_id and seller_user_id)
    const sellerId = l.seller_id || l.seller_user_id;
    if (user && (sellerId === user.id || sellerId === user.wallet_address)) return false;
    // Filter by business type
    if (businessTypeFilter !== 'all') {
      if (!l.business || l.business.type !== businessTypeFilter) return false;
    }
    // Filter by price range
    if (priceMin && l.price < parseFloat(priceMin)) return false;
    if (priceMax && l.price > parseFloat(priceMax)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    return 0;
  });

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-hidden lg:ml-16">
        <ScrollArea className="h-full">
          <div className="p-4 lg:p-6 pt-4 lg:pt-6 space-y-4 lg:space-y-6">
            {/* Header - Mobile Optimized */}
            <PageHeader 
              icon={<Store className="w-6 h-6 lg:w-8 lg:h-8 text-cyber-cyan" />}
              title={t('marketplaceHeader')}
              actionButtons={
                <Button 
                  onClick={fetchData} 
                  variant="outline" 
                  size="icon"
                  className="border-white/10 h-8 w-8 sm:h-10 sm:w-10"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              }
            />

            {/* Stats - Mobile Optimized */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              <Card className="glass-panel border-white/10">
                <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
                  <Building2 className="w-6 h-6 lg:w-8 lg:h-8 text-cyber-cyan flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-lg lg:text-2xl font-bold text-white">{resourceListings.length}</div>
                    <div className="text-[10px] lg:text-xs text-text-muted truncate">{t('businessesLabel')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
                  <MapPin className="w-6 h-6 lg:w-8 lg:h-8 text-amber-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-lg lg:text-2xl font-bold text-white">{landListings.length}</div>
                    <div className="text-[10px] lg:text-xs text-text-muted truncate">{t('plotsLabel')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
                  <ArrowUpRight className="w-6 h-6 lg:w-8 lg:h-8 text-green-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-lg lg:text-2xl font-bold text-white">{formatCity(tonToCity(landListings.reduce((sum, l) => sum + (l.price || 0), 0)))}</div>
                    <div className="text-[10px] lg:text-xs text-text-muted truncate">{t('tonLands')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="p-3 lg:p-4 flex items-center gap-2 lg:gap-3">
                  <Coins className="w-6 h-6 lg:w-8 lg:h-8 text-yellow-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-lg lg:text-2xl font-bold text-white">{formatCity(tonToCity(user?.balance_ton || 0))}</div>
                    <div className="text-[10px] lg:text-xs text-text-muted truncate">{t('tonBalance')}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="land" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                  <MapPin className="w-4 h-4 mr-2" />
                  {t('landTab')}
                </TabsTrigger>
                <TabsTrigger value="my-listings" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
                  <Store className="w-4 h-4 mr-2" />
                  {t('myListingsTab')}
                </TabsTrigger>
              </TabsList>

              {/* Land Tab */}
              <TabsContent value="land" className="mt-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                  {/* Business Type Filter */}
                  <Select value={businessTypeFilter} onValueChange={setBusinessTypeFilter}>
                    <SelectTrigger className="w-32 sm:w-44 bg-white/5 border-white/10 text-sm">
                      <Building2 className="w-4 h-4 mr-2 hidden sm:block" />
                      <SelectValue placeholder={t('allBusinessTypes')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="all">{t('allTypes')}</SelectItem>
                      {/* Tier 1 */}
                      <SelectItem value="helios">☀️ Helios</SelectItem>
                      <SelectItem value="scrap_yard">🏗️ Scrap Yard</SelectItem>
                      <SelectItem value="quartz_mine">💎 Quartz Mine</SelectItem>
                      <SelectItem value="nano_dc">🖥️ Nano DC</SelectItem>
                      <SelectItem value="signal_tower">📡 Signal Tower</SelectItem>
                      <SelectItem value="hydro_cooling">❄️ Cold Storage</SelectItem>
                      <SelectItem value="bio_farm">🌿 Bio Farm</SelectItem>
                      {/* Tier 2 */}
                      <SelectItem value="chips_factory">🏭 Chip Factory</SelectItem>
                      <SelectItem value="ai_lab">🧪 AI Lab</SelectItem>
                      <SelectItem value="nft_studio">🎨 NFT Studio</SelectItem>
                      <SelectItem value="vr_club">👓 VR Club</SelectItem>
                      <SelectItem value="logistics_hub">🚁 Logistics</SelectItem>
                      <SelectItem value="cyber_cafe">☕ Cyber Cafe</SelectItem>
                      <SelectItem value="repair_shop">🛠️ Repair Zone</SelectItem>
                      {/* Tier 3 */}
                      <SelectItem value="validator">🛡️ Validator</SelectItem>
                      <SelectItem value="gram_bank">🏦 Gram Bank</SelectItem>
                      <SelectItem value="dex">💹 DEX</SelectItem>
                      <SelectItem value="casino">🎰 Casino</SelectItem>
                      <SelectItem value="arena">🏟️ Arena</SelectItem>
                      <SelectItem value="incubator">🐣 Incubator</SelectItem>
                      <SelectItem value="bridge">🌉 Bridge</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Sort - на мобильном справа от фильтра типа */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-28 sm:w-36 bg-white/5 border-white/10 text-sm">
                      <SortAsc className="w-4 h-4 mr-1 sm:mr-2" />
                      <SelectValue placeholder={t('sortLabel')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">{t('priceAsc')}</SelectItem>
                      <SelectItem value="price_desc">{t('priceDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Price Range Filters - скрыты на мобильном */}
                  <div className="hidden sm:flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t('fromTonPlaceholder')}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-24 bg-white/5 border-white/10"
                    />
                    <span className="text-text-muted">-</span>
                    <Input
                      type="number"
                      placeholder={t('toTonPlaceholder')}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-24 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {filteredLandListings.length === 0 ? (
                    <div className="col-span-2 text-center py-12 text-text-muted">
                      <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>{t('noPlotsSale')}</p>
                    </div>
                  ) : (
                    filteredLandListings.map(listing => {
                      // Handle localized city_name - default to TON Island
                      let cityName = 'TON Island';
                      if (listing.city_name) {
                        if (typeof listing.city_name === 'object') {
                          cityName = listing.city_name?.ru || listing.city_name?.en || 'TON Island';
                        } else if (listing.city_name !== 'Unknown') {
                          cityName = listing.city_name;
                        }
                      }
                      
                      return (
                        <Card key={listing.id} className="glass-panel border-white/10 hover:border-amber-500/50 transition-all">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-amber-400" />
                                  Участок [{listing.x}, {listing.y}]
                                </div>
                                <div className="text-sm text-amber-400">{cityName}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-amber-300">{formatCity(tonToCity(listing.price || 0))}</div>
                                <div className="text-xs text-text-muted">$CITY</div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm mb-4">
                              <div className="flex justify-between">
                                <span className="text-text-muted">Продавец:</span>
                                <span className="text-white">{listing.seller_username || t('unknown')}</span>
                              </div>
                              
                      {listing.business && (
                        <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-purple-300 text-sm">
                              {typeof listing.business.name === 'object'
                                ? (listing.business.name?.ru || listing.business.name?.en || listing.business.type)
                                : (listing.business.name || listing.business.type)}
                            </span>
                            <span className="text-xs text-text-muted">Lv.{listing.business.level || 1}</span>
                            {listing.business.tier && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Tier {listing.business.tier}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {listing.business.produces && (
                              <div className="flex items-center gap-1">
                                <span className="text-green-400">▲</span>
                                <span className="text-text-muted">Произв.:</span>
                                <span className="text-green-300 font-mono">
                                  {listing.business.production_per_day || '?'} {RESOURCE_INFO[listing.business.produces]?.nameKey ? t(RESOURCE_INFO[listing.business.produces].nameKey) : listing.business.produces}/сут.
                                </span>
                              </div>
                            )}
                            {listing.business.consumes && Object.keys(listing.business.consumes).length > 0 && (
                              <div className="flex items-start gap-1">
                                <span className="text-red-400 mt-0.5">▼</span>
                                <div>
                                  <span className="text-text-muted">Потр.:</span>
                                  {Object.entries(listing.business.consumes).map(([res, amt]) => (
                                    <div key={res} className="text-red-300 font-mono">
                                      {Math.round(amt)} {RESOURCE_INFO[res]?.nameKey ? t(RESOURCE_INFO[res].nameKey) : res}/сут.
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                            </div>
                            
                            <Button 
                              onClick={() => openBuyLandModal(listing)}
                              className="w-full bg-amber-500 text-black hover:brightness-110"
                              disabled={!user || (listing.seller_id || listing.seller_user_id) === user?.id || (listing.seller_id || listing.seller_user_id) === user?.wallet_address}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {((listing.seller_id || listing.seller_user_id) === user?.id || (listing.seller_id || listing.seller_user_id) === user?.wallet_address) ? t('yourListingLabel') : t('buyPlotBtnMarket')}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* My Listings Tab */}
              <TabsContent value="my-listings" className="mt-4">
                <div className="space-y-6">
                  {/* My Land Listings */}
                  <div>
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-amber-400" />
                      Мои участки на продаже
                    </h3>
                    {(() => {
                      const activeListings = [...myLandListings, ...landListings.filter(l => {
                        const sellerId = l.seller_id || l.seller_user_id;
                        return (sellerId === user?.id || sellerId === user?.wallet_address) && !myLandListings.find(m => m.id === l.id);
                      })].filter(l => l.status === 'active');

                      const sellButton = (
                        <Button
                          onClick={() => setShowSellLandModal(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-black"
                          disabled={myPlots.filter(p => !p.on_sale).length === 0}
                          data-testid="marketplace-sell-plot-btn"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Продать участок
                        </Button>
                      );

                      if (activeListings.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-4">
                            <MapPin className="w-8 h-8 opacity-50" />
                            <p className="text-sm">Нет активных листингов</p>
                            {sellButton}
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeListings.map(listing => {
                          const cityName = typeof listing.city_name === 'object' 
                            ? (listing.city_name?.ru || listing.city_name?.en || 'TON Island') 
                            : (listing.city_name || 'TON Island');
                          return (
                          <Card key={listing.id} className="glass-panel border-white/10 hover:border-amber-500/30 transition-all">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="text-white font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-amber-400" />
                                    [{listing.x}, {listing.y}]
                                  </div>
                                  <div className="text-xs text-amber-400">{cityName}</div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-400">На продаже</Badge>
                              </div>
                              <div className="mb-3">
                                {(() => {
                                  const taxPct = taxSettings.land_business_sale_tax || 20;
                                  const gross = tonToCity(listing.price || 0);
                                  const net = gross * (1 - taxPct / 100);
                                  return (
                                    <>
                                      <div className="text-xs text-text-muted line-through">{formatCity(gross)} $CITY</div>
                                      <div className="text-lg font-bold text-green-400">{formatCity(net)} $CITY</div>
                                      <div className="text-xs text-amber-500">−{taxPct}% налог</div>
                                    </>
                                  );
                                })()}
                              </div>
                              {listing.business && (
                                <div className="text-xs text-purple-400 mb-3 p-2 bg-purple-500/10 rounded-lg">
                                  🏢 {listing.business.icon} {
                                    typeof listing.business.name === 'object' 
                                      ? (listing.business.name?.ru || listing.business.name?.en || listing.business.type)
                                      : (listing.business.name || listing.business.type)
                                  } (Ур. {listing.business.level || 1})
                                </div>
                              )}
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="w-full"
                                onClick={() => handleCancelListing('land', listing.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Снять с продажи
                              </Button>
                            </CardContent>
                          </Card>
                          );
                        })}
                          </div>
                          <div className="flex justify-center mt-6">
                            {sellButton}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Buy Resource Modal */}
      <Dialog open={showBuyModal} onOpenChange={setShowBuyModal}>
        <DialogContent className="bg-void border-white/10 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyber-cyan" />
              Купить ресурсы
            </DialogTitle>
          </DialogHeader>
          
          {selectedListing && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{RESOURCE_INFO[selectedListing.resource_type]?.icon}</span>
                  <div>
                    <div className="text-white font-bold">{getResName(selectedListing.resource_type)}</div>
                    <div className="text-sm text-text-muted">от {selectedListing.seller_username}</div>
                  </div>
                </div>
                <div className="text-sm text-text-muted">
                  Доступно: {selectedListing.amount} шт по {formatCity(tonToCity(selectedListing.price_per_unit))} $CITY
                </div>
              </div>
              
              <div>
                <Label className="text-white">Количество</Label>
                <Input 
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Math.min(parseFloat(e.target.value) || 0, selectedListing.amount))}
                  max={selectedListing.amount}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              
              <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Итого к оплате:</span>
                  <span className="text-cyber-cyan font-bold font-mono">
                    {formatCity(tonToCity(buyAmount * selectedListing.price_per_unit))} $CITY
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuyModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button onClick={handleBuyResource} className="bg-cyber-cyan text-black">
              <Check className="w-4 h-4 mr-2" />
              Подтвердить покупку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Resource Modal */}
      <Dialog open={showSellResourceModal} onOpenChange={setShowSellResourceModal}>
        <DialogContent className="bg-void border-white/10 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
              Продать ресурсы
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-white">{t('selectBizSell')}</Label>
              <Select 
                value={sellResourceForm.business_id} 
                onValueChange={(v) => {
                  const biz = myBusinesses.find(b => b.id === v);
                  setSellResourceForm({
                    ...sellResourceForm,
                    business_id: v,
                    resource_type: biz?.produces || ''
                  });
                }}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder={t('selectBizSell')} />
                </SelectTrigger>
                <SelectContent>
                  {myBusinesses.length === 0 ? (
                    <SelectItem value="none" disabled>У вас нет бизнесов</SelectItem>
                  ) : (
                    myBusinesses.map(biz => (
                      <SelectItem key={biz.id} value={biz.id}>
                        {BUSINESS_ICONS[biz.business_type]} {biz.business_type} (Lv.{biz.level})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-white">Количество</Label>
              <Input 
                type="number"
                value={sellResourceForm.amount}
                onChange={(e) => setSellResourceForm({...sellResourceForm, amount: parseFloat(e.target.value) || 0})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            
            <div>
              <Label className="text-white">Цена за единицу ($CITY)</Label>
              <Input 
                type="number"
                step="0.0001"
                value={sellResourceForm.price_per_unit}
                onChange={(e) => setSellResourceForm({...sellResourceForm, price_per_unit: parseFloat(e.target.value) || 0})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            
            {sellResourceForm.amount > 0 && sellResourceForm.price_per_unit > 0 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1">
                {(() => {
                  const rTier = RESOURCE_INFO[sellResourceForm.resource_type]?.tier || 1;
                  const taxPct = rTier === 1 ? taxSettings.small_business_tax
                               : rTier === 2 ? taxSettings.medium_business_tax
                               : taxSettings.large_business_tax;
                  const gross = sellResourceForm.amount * sellResourceForm.price_per_unit;
                  const taxAmt = gross * taxPct / 100;
                  const net = gross - taxAmt;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Сумма листинга:</span>
                        <span className="text-white font-mono">{formatCity(gross)} $CITY</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Налог ({taxPct}%, Tier {rTier}):</span>
                        <span className="text-red-400 font-mono">−{formatCity(taxAmt)} $CITY</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-white/10 pt-1">
                        <span className="text-white font-medium">Чистая прибыль:</span>
                        <span className="text-green-400 font-bold font-mono">{formatCity(net)} $CITY</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSellResourceModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button onClick={handleSellResource} className="bg-green-600">
              <Plus className="w-4 h-4 mr-2" />
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Land Modal */}
      <Dialog open={showSellLandModal} onOpenChange={setShowSellLandModal}>
        <DialogContent className="bg-void border-white/10 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Продать участок
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-white">{t('selectPlotSell')}</Label>
              <Select 
                value={sellLandForm.plot_id} 
                onValueChange={(v) => {
                  setSellLandForm({
                    ...sellLandForm,
                    plot_id: v,
                    price: ''
                  });
                }}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder={t('selectPlotSell')} />
                </SelectTrigger>
                <SelectContent>
                  {myPlots.filter(p => !p.on_sale).length === 0 ? (
                    <SelectItem value="none" disabled>У вас нет доступных участков</SelectItem>
                  ) : (
                    myPlots.filter(p => !p.on_sale).map(plot => {
                      const cityName = plot.island_id === 'ton_island' ? 'TON Island' : 
                        (typeof plot.city_name === 'object' ? (plot.city_name?.ru || plot.city_name?.en || 'TON Island') : (plot.city_name || 'TON Island'));
                      return (
                        <SelectItem key={plot.id} value={plot.id}>
                          [{plot.x}, {plot.y}] - {cityName}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Show selected plot details */}
            {sellLandForm.plot_id && (() => {
              const selectedPlot = myPlots.find(p => p.id === sellLandForm.plot_id);
              if (!selectedPlot) return null;
              const cityName = selectedPlot.island_id === 'ton_island' ? 'TON Island' : 
                (typeof selectedPlot.city_name === 'object' ? (selectedPlot.city_name?.ru || selectedPlot.city_name?.en || 'TON Island') : (selectedPlot.city_name || 'TON Island'));
              const businessName = selectedPlot.business_type 
                ? (typeof selectedPlot.business_name === 'object' ? (selectedPlot.business_name?.ru || selectedPlot.business_name?.en) : selectedPlot.business_name) || selectedPlot.business_type
                : null;
              const totalSpent = (selectedPlot.price || 0) + (selectedPlot.business_cost || 0);
              
              return (
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Город:</span>
                    <span className="text-amber-400">{cityName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Координаты:</span>
                    <span className="text-white">[{selectedPlot.x}, {selectedPlot.y}]</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Бизнес на участке:</span>
                    {businessName ? (
                      <span className="text-green-400">{businessName}</span>
                    ) : (
                      <span className="text-gray-400 italic">Нет бизнеса</span>
                    )}
                  </div>
                  {selectedPlot.business_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Стоимость бизнеса:</span>
                      <span className="text-white font-mono">{formatCity(tonToCity(selectedPlot.business_cost || 0))} $CITY</span>
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div>
              <Label className="text-white">Цена продажи ($CITY)</Label>
              <Input 
                type="number"
                step="0.01"
                min="0"
                placeholder="Введите цену"
                value={sellLandForm.price || ''}
                onChange={(e) => setSellLandForm({...sellLandForm, price: parseFloat(e.target.value) || 0})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            
            {sellLandForm.price > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                {(() => {
                  const taxPct = taxSettings.land_business_sale_tax || 20;
                  const gross = sellLandForm.price;
                  const taxAmt = gross * taxPct / 100;
                  const net = gross - taxAmt;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Цена продажи:</span>
                        <span className="text-white font-mono">{formatCity(gross)} $CITY</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Налог ({taxPct}%):</span>
                        <span className="text-red-400 font-mono">−{formatCity(taxAmt)} $CITY</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-white/10 pt-1">
                        <span className="text-white font-medium">Чистая прибыль:</span>
                        <span className="text-amber-400 font-bold font-mono">{formatCity(net)} $CITY</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowSellLandModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button onClick={handleSellLand} className="bg-amber-500 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Выставить на продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Land Confirmation Modal */}
      <Dialog open={showBuyLandModal} onOpenChange={setShowBuyLandModal}>
        <DialogContent className="bg-void border-white/10 max-w-md !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              Подтверждение покупки
            </DialogTitle>
          </DialogHeader>
          
          {selectedLandListing && (
            <div className="space-y-4">
              {/* Location Info */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-bold mb-2">📍 Информация об участке</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Координаты:</span>
                    <span className="text-white">[{selectedLandListing.x}, {selectedLandListing.y}]</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Расположение:</span>
                    <span className="text-white">{
                      typeof selectedLandListing.city_name === 'object' 
                        ? (selectedLandListing.city_name?.ru || selectedLandListing.city_name?.en || 'TON Island')
                        : (selectedLandListing.city_name || 'TON Island')
                    }</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Продавец:</span>
                    <span className="text-white">{selectedLandListing.seller_username || t('anonymous')}</span>
                  </div>
                </div>
              </div>
              
              {/* Business Info (if exists) */}
              {selectedLandListing.business && (
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <h4 className="text-purple-400 font-bold mb-2">🏢 Бизнес на участке</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Тип:</span>
                      <span className="text-white">{selectedLandListing.business.icon} {typeof selectedLandListing.business.name === 'object' ? (selectedLandListing.business.name?.ru || selectedLandListing.business.name?.en || selectedLandListing.business.type) : (selectedLandListing.business.name || selectedLandListing.business.type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Уровень:</span>
                      <span className="text-white">Ур. {selectedLandListing.business.level || 1}</span>
                    </div>
                    {selectedLandListing.business.tier && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Тир:</span>
                        <span className="text-white">Tier {selectedLandListing.business.tier}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {!selectedLandListing.business && (
                <div className="p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
                  <p className="text-text-muted text-sm text-center">
                    На участке нет построенного бизнеса
                  </p>
                </div>
              )}
              
              {/* Price */}
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Цена:</span>
                  <span className="text-2xl font-bold text-amber-400">{formatCity(tonToCity(selectedLandListing.price || 0))} $CITY</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-text-muted">Ваш баланс:</span>
                  <span className={`font-mono ${(user?.balance_ton || 0) >= selectedLandListing.price ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCity(tonToCity(user?.balance_ton || 0))} $CITY
                  </span>
                </div>
              </div>
              
              {/* Warning if insufficient balance */}
              {(user?.balance_ton || 0) < selectedLandListing.price && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm text-center">
                    ⚠️ Недостаточно средств для покупки
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBuyLandModal(false)} className="border-white/10">
              Отмена
            </Button>
            <Button 
              onClick={handleBuyLand} 
              className="bg-amber-500 text-black hover:bg-amber-600"
              disabled={!user || (user?.balance_ton || 0) < (selectedLandListing?.price || 0)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Подтвердить покупку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
