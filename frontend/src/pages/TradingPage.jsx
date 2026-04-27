import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Package, Users, History, RefreshCw,
  ArrowUpDown, ShoppingCart, Handshake, Clock,
  Menu, Filter, Plus, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getCurrentUser,
  getAllBusinesses,
  getBusinessTypes,
  getUserContracts,
  createContract,
  spotTrade,
  acceptContract
} from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { formatCity, tonToCity } from '@/lib/currency';

const RESOURCE_INFO = {
  energy: { nameKey: 'resourceEnergy', icon: '⚡', basePrice: 3.0 },
  scrap: { nameKey: 'resourceScrap', icon: '🔩', basePrice: 3.6 },
  quartz: { nameKey: 'resourceQuartz', icon: '💠', basePrice: 3.6 },
  cu: { nameKey: 'resourceCu', icon: '🔢', basePrice: 3.4 },
  traffic: { nameKey: 'resourceTraffic', icon: '📶', basePrice: 3.9 },
  cooling: { nameKey: 'resourceCooling', icon: '🧊', basePrice: 3.5 },
  biomass: { nameKey: 'resourceBiomass', icon: '🍏', basePrice: 3.3 },
  chips: { nameKey: 'resourceChips', icon: '💾', basePrice: 85.0 },
  neurocode: { nameKey: 'resourceNeurocode', icon: '🧠', basePrice: 110.0 },
  nft: { nameKey: 'resourceNft', icon: '🖼️', basePrice: 135.0 },
  vr_experience: { nameKey: 'resourceVrExperience', icon: '🎬', basePrice: 135.0 },
  logistics: { nameKey: 'resourceLogistics', icon: '⛽', basePrice: 145.0 },
  profit_ton: { nameKey: 'resourceProfitTon', icon: '🍱', basePrice: 125.0 },
  repair_kits: { nameKey: 'resourceRepairKits', icon: '🧰', basePrice: 140.0 },
  neuro_core: { nameKey: 'resourceNeuroCore', icon: '🔮', basePrice: 5500.0 },
  gold_bill: { nameKey: 'resourceGoldBill', icon: '📜', basePrice: 6500.0 },
  license_token: { nameKey: 'resourceLicense', icon: '🎫', basePrice: 5500.0 },
  luck_chip: { nameKey: 'resourceLuckChip', icon: '🎲', basePrice: 5500.0 },
  war_protocol: { nameKey: 'resourceWarProtocol', icon: '⚔️', basePrice: 5500.0 },
  bio_module: { nameKey: 'resourceBioModule', icon: '🧬', basePrice: 5700.0 },
  gateway_code: { nameKey: 'resourceGatewayCode', icon: '🔑', basePrice: 5700.0 },
};

export default function TradingPage() {
  const navigate = useNavigate();
  const wallet = useTonWallet();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const getResName = (key) => {
    const info = RESOURCE_INFO[key];
    return info ? t(info.nameKey) : key;
  };
  
  const [user, setUser] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [businessTypes, setBusinessTypes] = useState({});
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for mobile UI
  const [activeTab, setActiveTab] = useState('buy');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  
  // Modals
  const [showContractModal, setShowContractModal] = useState(false);
  const [showSpotTradeModal, setShowSpotTradeModal] = useState(false);
  
  // Contract form
  const [contractForm, setContractForm] = useState({
    sellerBusinessId: '',
    buyerBusinessId: '',
    resourceType: '',
    amountPerHour: 0,
    pricePerUnit: 0,
    durationDays: 7
  });
  
  // Spot trade form
  const [spotTradeForm, setSpotTradeForm] = useState({
    sellerBusinessId: '',
    buyerBusinessId: '',
    resourceType: '',
    amount: 0
  });
  
  useEffect(() => {
    // Проверяем авторизацию через token или wallet
    const token = localStorage.getItem('token');
    if (!token && !wallet?.account) {
      navigate('/auth?mode=login');
      return;
    }
    loadData();
  }, [wallet]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userData, businessesData, typesData, contractsData] = await Promise.all([
        getCurrentUser(),
        getAllBusinesses(),
        getBusinessTypes(),
        getUserContracts().catch(() => ({ contracts: [] }))
      ]);
      
      setUser(userData);
      setBusinesses(businessesData.businesses || []);
      setMyBusinesses((businessesData.businesses || []).filter(b => b.owner === wallet.account.address));
      setBusinessTypes(typesData.business_types || {});
      setContracts(contractsData.contracts || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error(t('loadingDataError'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateContract = async () => {
    try {
      await createContract(contractForm);
      toast.success(t('contractCreatedMsg'));
      setShowContractModal(false);
      loadData();
    } catch (error) {
      toast.error(t('loadingDataError'));
    }
  };
  
  const handleSpotTrade = async () => {
    try {
      const result = await spotTrade(spotTradeForm);
      toast.success(`Сделка выполнена! ${formatCity(tonToCity(result.seller_receives))} $CITY`);
      setShowSpotTradeModal(false);
      loadData();
    } catch (error) {
      toast.error(t('loadingDataError'));
    }
  };
  
  const handleAcceptContract = async (contractId) => {
    try {
      await acceptContract(contractId);
      toast.success(t('contractAcceptedMsg'));
      loadData();
    } catch (error) {
      toast.error(t('loadingDataError'));
    }
  };
  
  // Get available resources from businesses
  const getAvailableResources = () => {
    const resources = {};
    businesses.forEach(business => {
      const bt = businessTypes[business.business_type];
      if (bt?.produces && bt.produces !== 'none') {
        if (!resources[bt.produces]) {
          resources[bt.produces] = [];
        }
        resources[bt.produces].push(business);
      }
    });
    return resources;
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-neon-blue mx-auto mb-4" />
          <p className="text-gray-400">Загрузка торговой площадки...</p>
        </div>
      </div>
    );
  }
  
  const availableResources = getAvailableResources();
  
  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-white/10 bg-void/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-3 py-3">
          {/* Top row with menu, title and action buttons */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Space for burger menu on mobile */}
              <div className="lg:hidden w-10 flex-shrink-0" />
              <ShoppingCart className="w-5 h-5 text-neon-blue flex-shrink-0" />
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">ТОРГОВЛЯ</h1>
            </div>
            
            {/* Action buttons - right corner */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button 
                variant="outline" 
                size="icon"
                className="border-white/20 h-8 w-8 sm:h-10 sm:w-10"
                onClick={fetchListings}
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                className="border-white/20 h-8 w-8 sm:h-10 sm:w-10"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          
          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-gray-400 mb-3 ml-12 lg:ml-0">Покупайте и продавайте ресурсы</p>
          
          {/* Tabs row 1 - Buy/My */}
          <div className="flex gap-1.5 sm:gap-2 mb-2">
            <Button
              variant={activeTab === 'buy' ? 'default' : 'outline'}
              onClick={() => setActiveTab('buy')}
              size="sm"
              className={`flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4 h-9 ${activeTab === 'buy' ? 'bg-neon-blue text-black' : 'border-white/20'}`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              Купить
            </Button>
            <Button
              variant={activeTab === 'my' ? 'default' : 'outline'}
              onClick={() => setActiveTab('my')}
              size="sm"
              className={`flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4 h-9 ${activeTab === 'my' ? 'bg-neon-blue text-black' : 'border-white/20'}`}
            >
              <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              Мои
            </Button>
          </div>
          
          {/* Tabs row 2 - Cooperation + Create Listing */}
          <div className="flex gap-1.5 sm:gap-2">
            <Button
              variant={activeTab === 'coop' ? 'default' : 'outline'}
              onClick={() => setActiveTab('coop')}
              size="sm"
              className={`flex-1 sm:flex-none text-xs sm:text-sm px-3 sm:px-4 h-9 ${activeTab === 'coop' ? 'bg-neon-blue text-black' : 'border-white/20'}`}
            >
              <Handshake className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              Кооперация
            </Button>
            <Button 
              className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 h-9 text-xs sm:text-sm px-3 sm:px-4"
              onClick={() => setShowCreateListing(true)}
            >
              <Plus className="w-4 h-4 mr-1.5 text-black" />
              <span className="text-black">Продать товар</span>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="px-3 sm:px-4 py-4">
        {/* Empty state */}
        {activeTab === 'buy' && listings.filter(l => l.type === 'sell').length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-2">
            <Package className="w-10 h-10 sm:w-16 sm:h-16 text-gray-600 mb-3" />
            <p className="text-gray-400 text-xs sm:text-base leading-tight">Нет предложений<br className="sm:hidden"/> по заданным фильтрам</p>
          </div>
        )}
        
        {activeTab === 'my' && myListings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-2">
            <Tag className="w-10 h-10 sm:w-16 sm:h-16 text-gray-600 mb-3" />
            <p className="text-gray-400 text-xs sm:text-base leading-tight">У вас пока нет<br className="sm:hidden"/> активных листингов</p>
            <Button 
              className="mt-3 bg-green-500 hover:bg-green-600 text-sm"
              onClick={() => setShowCreateListing(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Создать
            </Button>
          </div>
        )}
        
        {activeTab === 'coop' && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-2">
            <Handshake className="w-10 h-10 sm:w-16 sm:h-16 text-gray-600 mb-3" />
            <p className="text-gray-400 text-xs sm:text-base leading-tight">Кооперативные предложения<br className="sm:hidden"/> скоро появятся</p>
          </div>
        )}
        
        {/* Listings grid */}
        {activeTab === 'buy' && listings.filter(l => l.type === 'sell').length > 0 && (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {listings.filter(l => l.type === 'sell').map((listing) => (
              <Card key={listing.id} className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{RESOURCE_INFO[listing.resource]?.icon || '📦'}</span>
                    <div>
                      <p className="font-medium text-white">{RESOURCE_INFO[listing.resource]?.name || listing.resource}</p>
                      <p className="text-sm text-gray-400">{listing.amount} ед.</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-blue font-bold">{formatCity(tonToCity(listing.price))} $CITY</span>
                    <Button size="sm" className="bg-green-500 hover:bg-green-600">Купить</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      {/* Original Tabs Content - Desktop */}
      <main className="container mx-auto px-4 py-8 hidden lg:block">
        <Tabs defaultValue="market" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/5">
            <TabsTrigger value="market" data-testid="market-tab">
              <Package className="w-4 h-4 mr-2" />
              Рынок ресурсов
            </TabsTrigger>
            <TabsTrigger value="contracts" data-testid="contracts-tab">
              <Handshake className="w-4 h-4 mr-2" />
              Контракты
            </TabsTrigger>
            <TabsTrigger value="my-resources" data-testid="my-resources-tab">
              <Users className="w-4 h-4 mr-2" />
              Мои ресурсы
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="history-tab">
              <History className="w-4 h-4 mr-2" />
              История сделок
            </TabsTrigger>
          </TabsList>
          
          {/* Market Tab */}
          <TabsContent value="market" className="space-y-4 sm:space-y-6">
            <div className="grid gap-3 sm:gap-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    Доступные ресурсы
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Ресурсы от всех игроков</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(availableResources).map(([resource, providers]) => {
                      const info = RESOURCE_INFO[resource] || { name: resource, icon: '📦', basePrice: 0.001 };
                      return (
                        <Card key={resource} className="bg-white/5 border-white/10" data-testid={`resource-card-${resource}`}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{info.icon}</span>
                              {info.name}
                            </CardTitle>
                            <CardDescription>
                              Базовая цена: {formatCity(tonToCity(info.basePrice))} $CITY/ед.
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-gray-400 mb-3">
                              Поставщики: {providers.length}
                            </p>
                            <Button
                              onClick={() => {
                                setSpotTradeForm(prev => ({ ...prev, resourceType: resource }));
                                setShowSpotTradeModal(true);
                              }}
                              className="w-full"
                              size="sm"
                              data-testid={`buy-${resource}-btn`}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Купить
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  
                  {Object.keys(availableResources).length === 0 && (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Пока нет доступных ресурсов</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-neon-blue/10 border-neon-blue/30">
                <CardHeader>
                  <CardTitle>Спотовая торговля</CardTitle>
                  <CardDescription>Мгновенная покупка/продажа ресурсов</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowSpotTradeModal(true)}
                    className="w-full"
                    data-testid="spot-trade-btn"
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    Создать сделку
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-neon-purple/10 border-neon-purple/30">
                <CardHeader>
                  <CardTitle>Долгосрочные контракты</CardTitle>
                  <CardDescription>Автоматическая поставка ресурсов</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowContractModal(true)}
                    className="w-full"
                    data-testid="create-contract-btn"
                  >
                    <Handshake className="w-4 h-4 mr-2" />
                    Создать контракт
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Мои контракты</CardTitle>
                <CardDescription>Активные и ожидающие контракты</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {contracts.length > 0 ? (
                    <div className="space-y-3">
                      {contracts.map((contract) => {
                        const resource = RESOURCE_INFO[contract.resource_type] || {};
                        const isMyContract = contract.seller_id === wallet?.account?.address;
                        const isPending = !contract.is_active;
                        
                        return (
                          <Card key={contract.id} className="bg-white/5 border-white/10" data-testid={`contract-${contract.id}`}>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">{resource.icon || '📦'}</span>
                                  <div>
                                    <p className="font-semibold">{resource.name || contract.resource_type}</p>
                                    <p className="text-sm text-gray-400">
                                      {contract.amount_per_hour} ед/час × {formatCity(tonToCity(contract.price_per_unit))} $CITY
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <Badge variant={isPending ? "secondary" : "default"}>
                                    {isPending ? t('pendingStatus') : t('activeStatus')}
                                  </Badge>
                                  {!isMyContract && isPending && (
                                    <Button
                                      size="sm"
                                      className="mt-2"
                                      onClick={() => handleAcceptContract(contract.id)}
                                      data-testid={`accept-contract-${contract.id}`}
                                    >
                                      Принять
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Handshake className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">У вас пока нет контрактов</p>
                      <Button
                        onClick={() => setShowContractModal(true)}
                        className="mt-4"
                      >
                        Создать контракт
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* My Resources Tab */}
          <TabsContent value="my-resources" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Мои бизнесы и ресурсы</CardTitle>
                <CardDescription>Ваши производства и запасы</CardDescription>
              </CardHeader>
              <CardContent>
                {myBusinesses.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {myBusinesses.map((business) => {
                      const bt = businessTypes[business.business_type] || {};
                      const resource = bt.produces ? RESOURCE_INFO[bt.produces] : null;
                      
                      return (
                        <Card key={business.id} className="bg-white/5 border-white/10" data-testid={`my-business-${business.id}`}>
                          <CardContent className="pt-6">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-2xl">{business.business_icon}</span>
                              <div>
                                <p className="font-semibold">{business.business_name}</p>
                                <p className="text-sm text-gray-400">Уровень {business.level}</p>
                              </div>
                            </div>
                            
                            {resource && (
                              <div className="mt-3 p-3 bg-white/5 rounded-lg">
                                <p className="text-sm text-gray-400">Производит:</p>
                                <p className="font-semibold flex items-center gap-2">
                                  {resource.icon} {resource.name}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">У вас пока нет бизнесов</p>
                    <Button onClick={() => navigate('/game')} className="mt-4">
                      Начать строительство
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>История сделок</CardTitle>
                <CardDescription>Последние торговые операции</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">История сделок будет отображаться здесь</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Create Contract Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="bg-void border-white/10 text-white" data-testid="contract-modal">
          <DialogHeader>
            <DialogTitle>Создать контракт на поставку</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Мой бизнес (продавец)</Label>
              <Select
                onValueChange={(value) => setContractForm(prev => ({ ...prev, sellerBusinessId: value }))}
              >
                <SelectTrigger data-testid="seller-business-select">
                  <SelectValue placeholder={t('selectBusinessPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {myBusinesses.map(b => {
                    const bt = businessTypes[b.business_type] || {};
                    if (bt.produces && bt.produces !== 'none') {
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          {b.business_icon} {b.business_name}
                        </SelectItem>
                      );
                    }
                    return null;
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Покупатель (бизнес)</Label>
              <Select
                onValueChange={(value) => setContractForm(prev => ({ ...prev, buyerBusinessId: value }))}
              >
                <SelectTrigger data-testid="buyer-business-select">
                  <SelectValue placeholder={t('selectBuyerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {businesses
                    .filter(b => b.owner !== wallet?.account?.address)
                    .map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.business_icon} {b.business_name} ({b.owner.slice(0, 8)}...)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Ресурс</Label>
              <Select
                onValueChange={(value) => setContractForm(prev => ({ ...prev, resourceType: value }))}
              >
                <SelectTrigger data-testid="resource-select">
                  <SelectValue placeholder={t('selectResourcePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.icon} {info.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Количество в час</Label>
              <Input
                type="number"
                value={contractForm.amountPerHour}
                onChange={(e) => setContractForm(prev => ({ ...prev, amountPerHour: parseFloat(e.target.value) }))}
                data-testid="amount-per-hour-input"
              />
            </div>
            
            <div>
              <Label>Цена за единицу ($CITY)</Label>
              <Input
                type="number"
                step="0.0001"
                value={contractForm.pricePerUnit}
                onChange={(e) => setContractForm(prev => ({ ...prev, pricePerUnit: parseFloat(e.target.value) }))}
                data-testid="price-per-unit-input"
              />
            </div>
            
            <div>
              <Label>Длительность (дней)</Label>
              <Input
                type="number"
                value={contractForm.durationDays}
                onChange={(e) => setContractForm(prev => ({ ...prev, durationDays: parseInt(e.target.value) }))}
                data-testid="duration-days-input"
              />
            </div>
            
            <Button
              onClick={handleCreateContract}
              className="w-full"
              data-testid="submit-contract-btn"
            >
              Создать контракт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Spot Trade Modal */}
      <Dialog open={showSpotTradeModal} onOpenChange={setShowSpotTradeModal}>
        <DialogContent className="bg-void border-white/10 text-white" data-testid="spot-trade-modal">
          <DialogHeader>
            <DialogTitle>Спотовая сделка</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Продавец (бизнес)</Label>
              <Select
                onValueChange={(value) => setSpotTradeForm(prev => ({ ...prev, sellerBusinessId: value }))}
              >
                <SelectTrigger data-testid="spot-seller-select">
                  <SelectValue placeholder={t('selectSellerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map(b => {
                    const bt = businessTypes[b.business_type] || {};
                    if (bt.produces && bt.produces !== 'none') {
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          {b.business_icon} {b.business_name} ({b.owner.slice(0, 8)}...)
                        </SelectItem>
                      );
                    }
                    return null;
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Покупатель (мой бизнес)</Label>
              <Select
                onValueChange={(value) => setSpotTradeForm(prev => ({ ...prev, buyerBusinessId: value }))}
              >
                <SelectTrigger data-testid="spot-buyer-select">
                  <SelectValue placeholder={t('selectYourBizPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {myBusinesses.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.business_icon} {b.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Ресурс</Label>
              <Select
                value={spotTradeForm.resourceType}
                onValueChange={(value) => setSpotTradeForm(prev => ({ ...prev, resourceType: value }))}
              >
                <SelectTrigger data-testid="spot-resource-select">
                  <SelectValue placeholder={t('selectResourcePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.icon} {info.name} ({formatCity(tonToCity(info.basePrice))} $CITY/ед.)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Количество</Label>
              <Input
                type="number"
                value={spotTradeForm.amount}
                onChange={(e) => setSpotTradeForm(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                data-testid="spot-amount-input"
              />
            </div>
            
            {spotTradeForm.resourceType && spotTradeForm.amount > 0 && (
              <div className="p-3 bg-neon-blue/10 rounded-lg">
                <p className="text-sm text-gray-400">Приблизительная стоимость:</p>
                <p className="text-lg font-bold text-neon-blue">
                  {formatCity(tonToCity(RESOURCE_INFO[spotTradeForm.resourceType]?.basePrice * spotTradeForm.amount))} $CITY
                </p>
              </div>
            )}
            
            <Button
              onClick={handleSpotTrade}
              className="w-full"
              data-testid="submit-spot-trade-btn"
            >
              Выполнить сделку
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
