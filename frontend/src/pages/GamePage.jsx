import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Building2, Wallet, X, ArrowLeft,
  ZoomIn, ZoomOut, RefreshCw, Loader2, TrendingUp, 
  ArrowDownToLine, ArrowUpFromLine, Users, Coins,
  Info, ShoppingCart, Hammer, Check, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DepositModal, WithdrawModal } from '@/components/BalanceModals';
import { useTranslation } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';
import { BUSINESSES, BUSINESS_CONFIG, getSpriteUrl } from '@/lib/buildingSprites';
import { IslandMapRenderer } from '@/lib/IslandMapRenderer';
import { toast } from 'sonner';

export default function GamePage({ user }) {
  const navigate = useNavigate();
  const { cityId } = useParams();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  
  const [city, setCity] = useState(null);
  const [plots, setPlots] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState(null);
  const [userBalance, setUserBalance] = useState(user?.balance_ton || 0);
  const [depositAddress, setDepositAddress] = useState('');
  
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);

  // Load config including deposit address
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setDepositAddress(data.deposit_address || '');
        }
      } catch (e) { console.error('Failed to load config:', e); }
    };
    loadConfig();
  }, []);

  // Load city data
  useEffect(() => {
    if (cityId) {
      loadCityData();
    } else {
      navigate('/map');
    }
  }, [cityId]);

  const loadCityData = async () => {
    try {
      setLoading(true);
      
      const res = await fetch(`/api/cities/${cityId}/plots`);
      if (!res.ok) throw new Error('City not found');
      
      const data = await res.json();
      setCity(data.city);
      setPlots(data.plots || []);
      
      const token = localStorage.getItem('token');
      if (token) {
        const userRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserBalance(userData.balance_ton || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load city:', error);
      toast.error(t('cityNotFound') || 'City not found');
      navigate('/map');
    } finally {
      setLoading(false);
    }
  };

  // Initialize renderer when data is loaded
  useEffect(() => {
    if (!canvasRef.current || loading || !city || plots.length === 0) return;
    
    const initRenderer = async () => {
      // Destroy previous renderer if exists
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
      
      // Create new renderer
      const renderer = new IslandMapRenderer(canvasRef.current, {
        backgroundColor: 0x001122,
        onPlotSelect: handlePlotSelect,
        onPlotHover: handlePlotHover
      });
      
      await renderer.init();
      renderer.setUserId(user?.id);
      await renderer.setPlots(plots, city.style);
      
      rendererRef.current = renderer;
      setZoomLevel(renderer.getZoom());
    };
    
    initRenderer();
    
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [loading, city, plots, user?.id]);

  // Handle plot selection
  const handlePlotSelect = useCallback((plot) => {
    setSelectedPlot(plot);
    if (!plot.owner) {
      setShowPurchaseModal(true);
    } else if ((plot.owner === user?.id || plot.owner === user?.wallet_address) && !plot.business_type) {
      setShowBuildModal(true);
    }
  }, [user]);

  // Handle plot hover
  const handlePlotHover = useCallback((plot) => {
    // Could show tooltip here
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    if (rendererRef.current) {
      rendererRef.current.zoomIn();
      setZoomLevel(rendererRef.current.getZoom());
    }
  };

  const handleZoomOut = () => {
    if (rendererRef.current) {
      rendererRef.current.zoomOut();
      setZoomLevel(rendererRef.current.getZoom());
    }
  };

  const handleResetView = () => {
    if (rendererRef.current) {
      rendererRef.current.resetView();
      setZoomLevel(rendererRef.current.getZoom());
    }
  };

  // Purchase plot
  const handlePurchase = async () => {
    if (!selectedPlot || !user) return;
    
    setIsPurchasing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cities/${cityId}/plots/${selectedPlot.x}/${selectedPlot.y}/buy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Purchase failed');
      
      toast.success('Участок куплен!');
      setShowPurchaseModal(false);
      setSelectedPlot(null);
      setUserBalance(data.new_balance);
      
      // Update the plot in renderer with owner info including avatar
      if (rendererRef.current && data.plot) {
        const updatedPlot = { 
          ...selectedPlot, 
          owner: user.id,
          owner_avatar: user.avatar,
          owner_username: user.username,
          owner_info: {
            id: user.id,
            avatar: user.avatar,
            username: user.username,
            display_name: user.display_name || user.username
          }
        };
        rendererRef.current.updatePlot(updatedPlot);
      }
      
      loadCityData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Build business
  const handleBuild = async () => {
    if (!selectedPlot || !selectedBusinessType || !user) return;
    
    setIsBuilding(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cities/${cityId}/plots/${selectedPlot.x}/${selectedPlot.y}/build`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: selectedBusinessType })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Build failed');
      
      toast.success('Бизнес построен!');
      setShowBuildModal(false);
      setSelectedPlot(null);
      setSelectedBusinessType(null);
      setUserBalance(data.new_balance);
      loadCityData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsBuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center font-rajdhani">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-cyber-cyan animate-spin" />
          <p className="text-cyber-cyan animate-pulse">{t('loadingIsland')}</p>
        </div>
      </div>
    );
  }

  const isMyPlot = selectedPlot?.owner === user?.id || selectedPlot?.owner === user?.wallet_address;

  // Get businesses by tier for build modal
  const getBusinessesByTier = (tier) => {
    return Object.entries(BUSINESSES)
      .filter(([_, config]) => config.tier === tier)
      .map(([key, config]) => ({ key, ...config, ...BUSINESS_CONFIG[key] }));
  };

  return (
    <div className="h-screen bg-void relative overflow-hidden font-rajdhani flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 z-20">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/map')} className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('map') || 'Map'}
            </Button>
            
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-cyan to-neon-purple flex items-center justify-center">
                <MapPin className="w-4 h-4 text-black" />
              </div>
              <div>
                <h1 className="font-unbounded text-sm font-bold text-white uppercase tracking-tight">
                  {city?.name?.[lang] || city?.name?.en || cityId}
                </h1>
                <p className="text-[10px] text-cyber-cyan uppercase tracking-widest">
                  {plots.length} {t('plots') || 'plots'} • {t('hexGrid')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
              <Coins className="w-4 h-4 text-signal-amber" />
              <span className="text-white font-mono text-sm font-bold">{userBalance?.toFixed(2) || '0.00'}</span>
              <span className="text-text-muted text-xs">TON</span>
            </div>
            
            <Button size="sm" variant="ghost" onClick={() => setShowDepositModal(true)} className="text-green-400 hover:bg-green-400/10 gap-1">
              <ArrowDownToLine className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">{t('deposit')}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowWithdrawModal(true)} className="text-red-400 hover:bg-red-400/10 gap-1">
              <ArrowUpFromLine className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">{t('withdraw')}</span>
            </Button>
            
            {user && (
              <div onClick={() => navigate('/settings')} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border border-cyber-cyan" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-full flex items-center justify-center text-sm font-bold text-black">
                    {(user.username || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Canvas - Hexagonal Map */}
      <div className="flex-1 relative">
        <div ref={canvasRef} className="absolute inset-0" style={{ touchAction: 'none' }} />
        
        {/* Zoom Controls */}
        <div className="absolute bottom-20 lg:bottom-6 right-4 flex flex-col gap-2 z-10">
          <Button size="sm" variant="outline" onClick={handleZoomIn} className="bg-black/60 border-white/10 text-white hover:bg-black/80">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut} className="bg-black/60 border-white/10 text-white hover:bg-black/80">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetView} className="bg-black/60 border-white/10 text-white hover:bg-black/80">
            <Home className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={loadCityData} className="bg-black/60 border-white/10 text-white hover:bg-black/80">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="text-xs text-center text-white/50 mt-1">
            {zoomLevel}%
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-20 lg:bottom-6 left-4 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="text-xs text-text-muted mb-2 font-bold uppercase">{t('zonesLabel')}</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#00D4FF' }} />
                <span className="text-white">{t('coreZone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0098EA' }} />
                <span className="text-white">{t('innerZone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0057FF' }} />
                <span className="text-white">{t('middleZone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#1a1a2e' }} />
                <span className="text-white">{t('outerZone')}</span>
              </div>
              <div className="border-t border-white/10 mt-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-700" />
                  <span className="text-white">{t('occupiedLabel')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-white">{t('withBusinessLabel')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Selected Plot Info */}
        <AnimatePresence>
          {selectedPlot && !showPurchaseModal && !showBuildModal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 lg:translate-x-0 lg:left-auto lg:right-20 w-80 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 p-4 z-10"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                    Участок ({selectedPlot.x}, {selectedPlot.y})
                  </h3>
                  <p className="text-xs text-text-muted">
                    {selectedPlot.zone && (
                      <span className="text-cyber-cyan">
                        {selectedPlot.zone === 'core' ? 'Ядро' : 
                         selectedPlot.zone === 'inner' ? 'Внутреннее кольцо' :
                         selectedPlot.zone === 'middle' ? 'Среднее кольцо' : 'Внешнее кольцо'}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-1">
                    {selectedPlot.business_type ? (
                      <span className="text-signal-amber flex items-center gap-1">
                        {BUSINESSES[selectedPlot.business_type]?.icon} 
                        {BUSINESSES[selectedPlot.business_type]?.name?.[lang] || selectedPlot.business_type}
                        {selectedPlot.business_level && ` (Ур. ${selectedPlot.business_level})`}
                      </span>
                    ) : isMyPlot ? (
                      <span className="text-green-400">Ваш участок</span>
                    ) : selectedPlot.owner ? (
                      <span className="text-gray-400">Занят</span>
                    ) : (
                      <span className="text-cyber-cyan">Доступен для покупки</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedPlot(null)} className="text-white/60 hover:text-white -mr-2 -mt-2">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-signal-amber font-mono font-bold text-lg">
                    {selectedPlot.price?.toFixed(2)} TON
                  </span>
                </div>
                
                {!selectedPlot.owner && (
                  <Button size="sm" onClick={() => setShowPurchaseModal(true)} className="bg-cyber-cyan text-black hover:bg-cyber-cyan/80">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Купить
                  </Button>
                )}
                
                {isMyPlot && !selectedPlot.business_type && (
                  <Button size="sm" onClick={() => setShowBuildModal(true)} className="bg-neon-purple text-white hover:bg-neon-purple/80">
                    <Hammer className="w-4 h-4 mr-2" />
                    Построить
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="bg-panel border-grid-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-white uppercase tracking-tight">
              {t('buyPlot')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlot && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-muted text-sm">{t('coordinatesLabel')}</span>
                  <span className="text-white font-mono">({selectedPlot.x}, {selectedPlot.y})</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-muted text-sm">{t('zoneLabel')}</span>
                  <span className="text-cyber-cyan">
                    {selectedPlot.zone === 'core' ? t('coreZone') : 
                     selectedPlot.zone === 'inner' ? t('innerZone') :
                     selectedPlot.zone === 'middle' ? t('middleZone') : t('outerZone')}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-muted text-sm">{t('price')}</span>
                  <span className="text-signal-amber font-mono font-bold">{selectedPlot.price?.toFixed(2)} TON</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted text-sm">{t('yourBalance')}</span>
                  <span className={`font-mono font-bold ${userBalance >= selectedPlot.price ? 'text-green-400' : 'text-red-400'}`}>
                    {userBalance?.toFixed(2)} TON
                  </span>
                </div>
              </div>
              
              {userBalance < selectedPlot.price && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-red-400 text-sm">{t('insufficientFunds')}</p>
                  <Button size="sm" variant="outline" onClick={() => { setShowPurchaseModal(false); setShowDepositModal(true); }}
                    className="mt-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                    {t('topUpBalance')}
                  </Button>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPurchaseModal(false)} className="flex-1 border-white/10">
                  {t('cancel')}
                </Button>
                <Button onClick={handlePurchase} disabled={isPurchasing || userBalance < selectedPlot.price} className="flex-1 bg-cyber-cyan text-black hover:bg-cyber-cyan/80">
                  {isPurchasing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                  {t('confirm')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Build Modal - with 21 business types by tier */}
      <Dialog open={showBuildModal} onOpenChange={setShowBuildModal}>
        <DialogContent className="bg-panel border-grid-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-white uppercase tracking-tight flex items-center gap-2">
              <Hammer className="w-5 h-5 text-neon-purple" />
              {t('buildBusiness')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              {t('selectBusinessType')}
            </p>
            
            {/* Tier 1 - Basic Production */}
            <div>
              <h4 className="text-xs text-green-400 font-bold uppercase mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                {t('tier1Basic')}
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {getBusinessesByTier(1).map(({ key, name, icon, cost }) => {
                  const canAfford = userBalance >= cost;
                  const isSelected = selectedBusinessType === key;
                  
                  return (
                    <div
                      key={key}
                      onClick={() => canAfford && setSelectedBusinessType(key)}
                      className={`relative p-2 rounded-lg border cursor-pointer transition-all text-center ${
                        isSelected 
                          ? 'border-neon-purple bg-neon-purple/20' 
                          : canAfford 
                            ? 'border-white/10 bg-white/5 hover:border-white/20' 
                            : 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-neon-purple rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                      <div className="text-xl">{icon}</div>
                      <div className="font-bold text-white text-xs truncate">{name[lang] || name.en}</div>
                      <div className="text-signal-amber font-mono text-[10px]">{cost} TON</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tier 2 - Processing */}
            <div>
              <h4 className="text-xs text-blue-400 font-bold uppercase mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {t('tier2Processing')}
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {getBusinessesByTier(2).map(({ key, name, icon, cost }) => {
                  const canAfford = userBalance >= cost;
                  const isSelected = selectedBusinessType === key;
                  
                  return (
                    <div
                      key={key}
                      onClick={() => canAfford && setSelectedBusinessType(key)}
                      className={`relative p-2 rounded-lg border cursor-pointer transition-all text-center ${
                        isSelected 
                          ? 'border-neon-purple bg-neon-purple/20' 
                          : canAfford 
                            ? 'border-white/10 bg-white/5 hover:border-white/20' 
                            : 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-neon-purple rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                      <div className="text-xl">{icon}</div>
                      <div className="font-bold text-white text-xs truncate">{name[lang] || name.en}</div>
                      <div className="text-signal-amber font-mono text-[10px]">{cost} TON</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tier 3 - Financial/Entertainment (Patrons) */}
            <div>
              <h4 className="text-xs text-purple-400 font-bold uppercase mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                {t('tier3Finance')}
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {getBusinessesByTier(3).map(({ key, name, icon, cost, isPatron }) => {
                  const canAfford = userBalance >= cost;
                  const isSelected = selectedBusinessType === key;
                  
                  return (
                    <div
                      key={key}
                      onClick={() => canAfford && setSelectedBusinessType(key)}
                      className={`relative p-2 rounded-lg border cursor-pointer transition-all text-center ${
                        isSelected 
                          ? 'border-neon-purple bg-neon-purple/20' 
                          : canAfford 
                            ? 'border-white/10 bg-white/5 hover:border-white/20' 
                            : 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-neon-purple rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                      {isPatron && (
                        <div className="absolute top-1 left-1 text-[8px] text-yellow-400">👑</div>
                      )}
                      <div className="text-xl">{icon}</div>
                      <div className="font-bold text-white text-xs truncate">{name[lang] || name.en}</div>
                      <div className="text-signal-amber font-mono text-[10px]">{cost} TON</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Selected Business Info */}
            {selectedBusinessType && BUSINESSES[selectedBusinessType] && (
              <div className="bg-neon-purple/10 border border-neon-purple/20 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{BUSINESSES[selectedBusinessType].icon}</span>
                    <div>
                      <span className="text-white font-bold">
                        {BUSINESSES[selectedBusinessType].name[lang] || BUSINESSES[selectedBusinessType].name.en}
                      </span>
                      <p className="text-xs text-text-muted">
                        {BUSINESSES[selectedBusinessType].description?.[lang] || BUSINESSES[selectedBusinessType].description?.en}
                      </p>
                    </div>
                  </div>
                  <span className="text-signal-amber font-mono font-bold">
                    {BUSINESS_CONFIG[selectedBusinessType]?.cost} TON
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowBuildModal(false); setSelectedBusinessType(null); }} className="flex-1 border-white/10">
                Отмена
              </Button>
              <Button onClick={handleBuild} disabled={isBuilding || !selectedBusinessType} className="flex-1 bg-neon-purple text-white hover:bg-neon-purple/80">
                {isBuilding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Hammer className="w-4 h-4 mr-2" />}
                Построить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} onSuccess={loadCityData} receiverAddress={depositAddress} updateBalance={setUserBalance} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} currentBalance={userBalance || 0} onSuccess={loadCityData} userWallet={user?.wallet_address} updateBalance={setUserBalance} />
    </div>
  );
}
