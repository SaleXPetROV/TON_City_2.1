import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, ZoomIn, ZoomOut, Home, Info, Building2,
  Coins, MapPin, X, ChevronRight, AlertCircle, Crown,
  RefreshCw, Play, Pause, TrendingUp, Building
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import NotificationBell from '@/components/NotificationBell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { tonToCity, cityToTon, formatCity, formatTon } from '@/lib/currency';
import { getResource } from '@/lib/resourceConfig';
import { useTutorial } from '@/context/TutorialContext';

// Import map engine
import IsometricMapEngine, { mapStore, hexToPixel, getZone, GRID_COLS, GRID_ROWS, BUILDING_ICONS } from '@/engine/IsometricMapEngine';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Helper function to get zone name with translations
const getZoneName = (zone, t) => {
  const zoneKey = `zone${zone.charAt(0).toUpperCase() + zone.slice(1)}`;
  return t(zoneKey) || zone;
};

// Helper function to get resource name with translations
const getResourceName = (resource, t) => {
  const resourceKey = `resource${resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, '')}`;
  return t(resourceKey) || resource;
};

// Tier colors
const TIER_STYLES = {
  1: 'bg-green-500/20 text-green-400 border-green-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// Helper to safely get business name from config (handles both object and string)
const getBusinessName = (config, fallback = '') => {
  if (!config?.name) return fallback;
  if (typeof config.name === 'string') return config.name;
  return config.name?.ru || config.name?.en || fallback;
};

export default function TonIslandPage({ user, refreshBalance, updateBalance }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const cellInfoRef = useRef(null);
  const tutorial = useTutorial();
  
  // Get language from context
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);
  
  const [isLoading, setIsLoading] = useState(true);
  const [businessTypes, setBusinessTypes] = useState({});
  const [patrons, setPatrons] = useState([]);
  const [userBalance, setUserBalance] = useState(0);
  
  // Modals
  const [selectedCell, setSelectedCell] = useState(null);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState('');
  const [selectedPatron, setSelectedPatron] = useState('');
  
  // Loading states
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildings, setShowBuildings] = useState(false);
  const [showBuildingsToast, setShowBuildingsToast] = useState(false);
  
  // Track mobile for slide direction
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  // Last user avatar for tracking changes
  const lastAvatarRef = useRef(user?.avatar);

  // Track when modals close to delay outside-click detection
  const modalJustClosedRef = useRef(false);
  
  // Close cell info panel when clicking/tapping outside the map area and info panel
  useEffect(() => {
    const handleOutsideInteraction = (e) => {
      // Skip if a modal just closed (give time for info panel to appear)
      if (modalJustClosedRef.current) return;
      
      const target = e.target;
      if (selectedCell && 
          !showBuildModal &&
          cellInfoRef.current && !cellInfoRef.current.contains(target) &&
          containerRef.current && !containerRef.current.contains(target)) {
        setSelectedCell(null);
      }
    };
    document.addEventListener('click', handleOutsideInteraction);
    document.addEventListener('touchend', handleOutsideInteraction, { passive: true });
    return () => {
      document.removeEventListener('click', handleOutsideInteraction);
      document.removeEventListener('touchend', handleOutsideInteraction);
    };
  }, [selectedCell, showBuildModal]);
  
  // When any modal closes, set a brief cooldown so info panel can appear
  useEffect(() => {
    if (!showBuildModal && selectedCell) {
      modalJustClosedRef.current = true;
      const timer = setTimeout(() => { modalJustClosedRef.current = false; }, 500);
      return () => clearTimeout(timer);
    }
  }, [showBuildModal]);
  
  const token = localStorage.getItem('token');

  // Generate hexagonal grid cells
  const generateCells = useCallback(() => {
    const cells = [];
    const centerQ = Math.floor(GRID_COLS / 2);
    const centerR = Math.floor(GRID_ROWS / 2);
    
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let q = 0; q < GRID_COLS; q++) {
        // Offset for hexagonal shape (island form)
        const dist = Math.abs(q - centerQ) + Math.abs(r - centerR);
        if (dist > Math.min(GRID_COLS, GRID_ROWS) * 0.6) continue; // Island shape
        
        const zone = getZone(q, r, centerQ, centerR);
        const basePrice = { core: 50, inner: 30, middle: 15, outer: 5 }[zone] || 5;
        
        cells.push({
          q,
          r,
          zone,
          price: basePrice,
          owner: null,
          building: null,
        });
      }
    }
    
    return cells;
  }, []);

  // Fetch island data from server (silent mode for background refresh)
  const fetchIslandData = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`${API}/island`);
      if (res.ok) {
        const data = await res.json();
        
        // Convert server data to our cell format
        const cells = (data.cells || []).map(cell => {
          // Handle pre-assigned businesses
          const hasBusiness = cell.business || cell.pre_business;
          const businessType = cell.business?.type || cell.pre_business;
          
          return {
            q: cell.x,
            r: cell.y,
            zone: cell.zone,
            price: cell.price_city || cell.price || 0,
            priceTon: cell.price_ton || cell.price || 0,
            owner: cell.owner,
            ownerAvatar: cell.owner_avatar,
            ownerUsername: cell.owner_username,
            isEmptyPlot: cell.is_empty === true,
            building: hasBusiness ? {
              type: businessType,
              name: cell.business_name || data.businesses?.[businessType]?.name,
              icon: cell.business_icon || data.businesses?.[businessType]?.icon,
              level: cell.business?.level || 1,
              tier: cell.business_tier || cell.business?.tier || data.businesses?.[businessType]?.tier || 1,
              is_active: cell.business?.is_active !== false,
              durability: cell.business?.durability || 100,
              monthlyIncome: cell.monthly_income_city || 0,
            } : null,
          };
        });
        
        // Store businesses config for reference
        if (data.businesses) {
          setBusinessTypes(data.businesses);
        }
        
        // If server returns no cells, generate default grid
        if (cells.length === 0) {
          mapStore.dispatch({ type: 'SET_CELLS', cells: generateCells() });
        } else {
          mapStore.dispatch({ type: 'SET_CELLS', cells });
        }
      } else if (!silent) {
        // Fallback to generated cells only on initial load
        mapStore.dispatch({ type: 'SET_CELLS', cells: generateCells() });
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to fetch island:', error);
        // Fallback to generated cells only on initial load
        mapStore.dispatch({ type: 'SET_CELLS', cells: generateCells() });
      }
    }
  }, [generateCells]);

  // Fetch business types
  const fetchBusinessTypes = useCallback(async () => {
    try {
      const [typesRes, patronsRes] = await Promise.all([
        fetch(`${API}/businesses/types`).then(r => r.json()),
        fetch(`${API}/patrons`).then(r => r.json())
      ]);
      
      setBusinessTypes(typesRes.business_types || typesRes.businesses || typesRes || {});
      setPatrons(patronsRes.patrons || []);
    } catch (error) {
      console.error('Failed to fetch business types:', error);
    }
  }, []);

  // Initialize map engine
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Prevent double initialization in React Strict Mode
    let isMounted = true;
    
    const initEngine = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      
      try {
        // Set user in store
        if (user) {
          mapStore.dispatch({
            type: 'SET_USER',
            userId: user.id,
            userWallet: user.wallet_address
          });
          setUserBalance(user.balance_ton || 0);
        }
        
        // Destroy existing engine if any
        if (engineRef.current) {
          engineRef.current.destroy();
          engineRef.current = null;
        }
        
        // Create engine
        const rect = containerRef.current.getBoundingClientRect();
        
        const engine = new IsometricMapEngine(containerRef.current, {
          width: rect.width,
          height: rect.height,
          onCellClick: handleCellClick,
          onCellHover: handleCellHover,
        });
        
        await engine.init();
        
        if (!isMounted) {
          engine.destroy();
          return;
        }
        
        engineRef.current = engine;
        
        // Now fetch data AFTER engine is initialized and subscribed
        await fetchIslandData();
        await fetchBusinessTypes();
        
      } catch (error) {
        console.error('Error initializing map:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    initEngine();
    
    return () => {
      isMounted = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && engineRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        engineRef.current.resize(rect.width, rect.height);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tutorial: pulsating ring on the predetermined HELIOS plot during fake_buy_plot.
  // Auto-clears the moment the step changes / tutorial ends.
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || typeof eng.setTutorialHighlight !== 'function') return;
    const onFakeBuy = tutorial?.active && tutorial?.currentStepId === 'fake_buy_plot';
    const tp = tutorial?.state?.tutorial_plot;
    if (onFakeBuy && tp && tp.x !== undefined && tp.y !== undefined) {
      eng.setTutorialHighlight({ x: tp.x, y: tp.y });
      // Pan camera so the highlighted cell appears in the LEFT half of the
      // viewport — out of the way of the tutorial info card on desktop, and
      // centered horizontally on mobile (where the card auto-shrinks).
      try {
        const isMobile = window.matchMedia('(max-width: 1024px)').matches;
        const sx = isMobile
          ? Math.round(window.innerWidth * 0.5)
          : Math.round(window.innerWidth * 0.28);
        const sy = isMobile
          ? Math.round(window.innerHeight * 0.4)
          : Math.round(window.innerHeight * 0.55);
        eng.panToCell?.(tp.x, tp.y, 1.6, sx, sy);
      } catch { /* noop */ }
    } else {
      eng.clearTutorialHighlight?.();
    }
    return () => {
      eng?.clearTutorialHighlight?.();
    };
  }, [tutorial?.active, tutorial?.currentStepId, tutorial?.state?.tutorial_plot?.x, tutorial?.state?.tutorial_plot?.y, isLoading]);

  // Removed automatic refresh - data will be fetched on cell click instead
  // This prevents race conditions where multiple users might buy the same cell

  // Track avatar changes and refresh map when avatar changes
  useEffect(() => {
    if (user?.avatar && user.avatar !== lastAvatarRef.current) {
      lastAvatarRef.current = user.avatar;
      // Refresh map data silently when avatar changes
      if (engineRef.current) {
        fetchIslandData(true);
      }
    }
  }, [user?.avatar, fetchIslandData]);

  // Fetch fresh cell data from server before showing modal
  const fetchCellData = useCallback(async (cellX, cellY) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('ton_city_token');
      const response = await fetch(`${API}/island/cell/${cellX}/${cellY}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Failed to fetch cell data:', err);
    }
    return null;
  }, []);

  // Handle cell click - fetch fresh data first
  const handleCellClick = useCallback(async (cell) => {
    if (!cell) return;
    
    // Get coordinates (support both q/r and x/y formats)
    const cellX = cell.x !== undefined ? cell.x : (cell.q !== undefined ? cell.q : null);
    const cellY = cell.y !== undefined ? cell.y : (cell.r !== undefined ? cell.r : null);
    
    // Skip if no valid coordinates
    if (cellX === null || cellY === null) {
      console.warn('Cell click with invalid coordinates:', cell);
      return;
    }

    // Tutorial: lock the user to the predetermined HELIOS plot during fake_buy_plot.
    if (tutorial?.active && tutorial?.currentStepId === 'fake_buy_plot') {
      const tp = tutorial?.state?.tutorial_plot;
      if (tp && (cellX !== tp.x || cellY !== tp.y)) {
        toast.info('🎓 ' + (t('tutorialOnlyHelios') || 'Только подсвеченный участок с HELIOS доступен для покупки во время обучения.'));
        return;
      }
    }

    // Fetch fresh cell data from server to prevent race conditions
    const freshData = await fetchCellData(cellX, cellY);
    const cellToUse = freshData || cell;
    
    // Update cell in local state if we got fresh data
    if (freshData && engineRef.current) {
      // Convert API format (x,y) to engine format (q,r)
      const cellForEngine = {
        q: freshData.x,
        r: freshData.y,
        ...freshData
      };
      mapStore.dispatch({ type: 'UPDATE_CELL', cell: cellForEngine });
    }
    
    setSelectedCell(cellToUse);
    
    // Priority: if no owner, show info panel with buy button
    if (!cellToUse.owner) {
      // info panel (with buy button) will show automatically via selectedCell state
    } else if (cellToUse.owner === user?.id || cellToUse.owner === user?.wallet_address) {
      // Own plot - show build modal if empty, info panel if has business
      if (cellToUse.building || cellToUse.pre_business) {
        // Info panel shows automatically via selectedCell state
      } else {
        setShowBuildModal(true);
      }
    } else {
      // Other player's cell - info panel shows business details automatically
      if (!cellToUse.building && !cellToUse.pre_business) {
        toast.info(t('plotBelongsToOther'));
      }
    }
  }, [user, fetchCellData, t]);

  // Handle cell hover
  const handleCellHover = useCallback((cell) => {
    // Optional: show tooltip or update UI
  }, []);

  // Update local balance when user changes from App.js
  useEffect(() => {
    if (user?.balance_ton !== undefined) {
      setUserBalance(user.balance_ton);
    }
  }, [user?.balance_ton]);

  // Refresh balance periodically and after actions
  const refreshUserBalance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance_ton || 0);
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [token]);

  // Handle purchase with optimistic update + refresh
  const handlePurchase = async () => {
    if (!selectedCell || !token) return;
    
    const cellX = selectedCell.q !== undefined ? selectedCell.q : selectedCell.x;
    const cellY = selectedCell.r !== undefined ? selectedCell.r : selectedCell.y;
    
    // Tutorial fake buy plot: intercept during fake_buy_plot step
    if (tutorial?.active && tutorial?.currentStepId === 'fake_buy_plot') {
      setIsPurchasing(true);
      try {
        const zone = selectedCell.zone || 'outskirts';
        const biz_icon = selectedCell.business_icon || '🏭';
        const res = await tutorial.fakeBuyPlot({ x: cellX, y: cellY, zone, business_icon: biz_icon });
        if (!res.ok) {
          toast.error(res.error || 'Tutorial action failed');
        } else {
          toast.success('🎓 Tutorial plot acquired!');
          setSelectedCell(null);
        }
      } finally {
        setIsPurchasing(false);
      }
      return;
    }

    setIsPurchasing(true);
    try {
      const res = await fetch(`${API}/island/buy/${cellX}/${cellY}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Purchase failed');
      }
      
      const data = await res.json();
      
      // Immediately update balance with server response (use TON for display, convert to CITY internally)
      const newBalanceTon = data.new_balance_ton !== undefined ? data.new_balance_ton : (userBalance - (selectedCell.price_ton || selectedCell.price || 0));
      setUserBalance(newBalanceTon);
      
      // Update global balance in App.js
      if (updateBalance) {
        updateBalance(newBalanceTon);
      }
      
      // Update local state map - mark cell as owned
      mapStore.dispatch({
        type: 'UPDATE_CELL',
        cell: { 
          q: cellX, 
          r: cellY, 
          ...selectedCell, 
          owner: user?.id,
          ownerUsername: user?.username,
          ownerAvatar: user?.avatar,
          building: data.business || null
        }
      });
      
      // Refresh island data to ensure consistency
      await fetchIslandData(true);
      
      toast.success(t('plotPurchased'));
      
      // If Tier 3 business purchased, set flag and redirect to My Businesses for buff selection
      const purchasedTier = selectedCell.business_tier || selectedCell.business?.tier || data?.business?.tier || 1;
      if (purchasedTier === 3) {
        sessionStorage.setItem('pending_tier3_buff', 'true');
        toast.info('Перейдите в "Мои бизнесы" чтобы выбрать баф для вассалов.', { duration: 4000 });
        setTimeout(() => navigate('/my-businesses'), 1500);
      }
      
      setSelectedCell(null);
      
    } catch (error) {
      toast.error(error.message);
      // Refresh balance to get actual value on error
      if (refreshBalance) refreshBalance();
    } finally {
      setIsPurchasing(false);
    }
  };

  // Build business
  const handleBuild = async () => {
    if (!selectedCell || !selectedBusinessType || !token) return;
    
    setIsBuilding(true);
    try {
      const res = await fetch(`${API}/island/build/${selectedCell.q}/${selectedCell.r}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          business_type: selectedBusinessType,
          patron_id: selectedPatron === 'none' ? null : (selectedPatron || null)
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Build failed');
      }
      
      const data = await res.json();
      
      // Update balance with server response
      if (data.new_balance !== undefined) {
        setUserBalance(data.new_balance);
        if (updateBalance) updateBalance(data.new_balance);
      }
      
      // Update local state
      const bizConfig = businessTypes[selectedBusinessType];
      mapStore.dispatch({
        type: 'UPDATE_CELL',
        cell: {
          ...selectedCell,
          building: {
            type: selectedBusinessType,
            level: 1,
            tier: bizConfig?.tier || 1,
            is_active: true
          }
        }
      });
      
      toast.success(t('businessBuilt'));
      setShowBuildModal(false);
      setSelectedBusinessType('');
      
    } catch (error) {
      toast.error(error.message);
      // Refresh balance on error
      if (refreshBalance) refreshBalance();
    } finally {
      setIsBuilding(false);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (engineRef.current) {
      engineRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (engineRef.current) {
      engineRef.current.zoomOut();
    }
  };

  const handleResetCamera = () => {
    if (engineRef.current) {
      engineRef.current.resetCamera();
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchIslandData();
    await fetchBusinessTypes();
    setIsLoading(false);
    toast.success(t('dataRefreshed') || 'Data refreshed');
  };

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col lg:ml-16 overflow-hidden">
        {/* Header - Mobile Adapted */}
        <div className="flex-shrink-0 p-4 pt-4 lg:pt-4 border-b border-white/10 bg-void/95 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pl-10 lg:pl-0">
              <h1 className="font-unbounded text-lg lg:text-xl font-bold text-white flex items-center gap-2 truncate">
                <MapPin className="w-5 h-5 lg:w-6 lg:h-6 text-cyber-cyan flex-shrink-0" />
                <span className="truncate">{t('mapTitle')}</span>
              </h1>
              <p className="text-text-muted text-xs lg:text-sm truncate">
                {t('sidebarBalance')}: {formatCity(tonToCity(userBalance))} $CITY
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                size="sm" 
                className="border-white/10 w-9 h-9 p-0"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <NotificationBell />
              
              <Button
                data-testid="night-mode-toggle"
                onClick={() => {
                  const isNight = !mapStore.getState().isNight;
                  if (engineRef.current) engineRef.current.setNightMode(isNight);
                }}
                variant="outline"
                size="sm"
                className="border-white/10 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-900/40 w-9 h-9 p-0"
              >
                🌙
              </Button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative overflow-hidden">
          {/* Pixi.js Canvas Container */}
          <div 
            ref={containerRef} 
            className="w-full h-full"
            style={{ touchAction: 'none' }}
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-30">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-cyber-cyan animate-spin mx-auto mb-4" />
                <p className="text-white">{t('loadingMap')}</p>
              </div>
            </div>
          )}
          
          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
            {/* Buildings Toggle Button */}
            <Button
              data-testid="buildings-toggle"
              onClick={() => {
                if (!showBuildings) {
                  toast.warning(t('inDevelopment') || 'In development', {
                    description: t('buildingsComingSoon') || 'Building display coming soon',
                    duration: 3000,
                  });
                } else {
                  setShowBuildings(false);
                }
              }}
              variant="outline"
              size="icon"
              className={`w-12 h-12 transition-all ${
                showBuildings 
                  ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30' 
                  : 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
              }`}
              title={showBuildings ? t('hideBuildings') : t('showBuildings')}
            >
              <Building className="w-5 h-5" />
            </Button>
            
            <div className="h-2" />
            
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="icon"
              className="bg-black/60 border-white/20 hover:bg-black/80"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="icon"
              className="bg-black/60 border-white/20 hover:bg-black/80"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleResetCamera}
              variant="outline"
              size="icon"
              className="bg-black/60 border-white/20 hover:bg-black/80"
            >
              <Home className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend - City Island 3 Style (без цен) - Hidden on Mobile */}
          <div className="absolute top-4 left-4 hidden lg:block bg-slate-900/90 backdrop-blur-md rounded-xl p-4 text-xs space-y-2 z-20 max-w-[160px] border border-slate-700/50 shadow-xl">
            <div className="font-bold text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              {t('legend') || 'Legend'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#4ade80'}} />
              <span className="text-white/90">{t('yourPlots') || t('yourPlot')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#c084fc'}} />
              <span className="text-white/90">{t('otherPlots') || 'Other plots'}</span>
            </div>
            <div className="h-px bg-slate-600/50 my-2" />
            <div className="text-sky-400/90 text-[10px] mb-1 font-semibold tracking-wide">{t('freeZones') || 'FREE ZONES'}:</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#7dd3fc'}} />
              <span className="text-white/80">{t('zoneCore')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#60a5fa'}} />
              <span className="text-white/80">{t('zoneCenter')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#3b82f6'}} />
              <span className="text-white/80">{t('zoneMiddle')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm shadow-inner" style={{backgroundColor: '#2563eb'}} />
              <span className="text-white/80">{t('zoneOuter')}</span>
            </div>
          </div>

          {/* Selected Cell Info - slides from right on desktop, up from bottom on mobile */}
          <AnimatePresence>
          {selectedCell && !showBuildModal && (
            <motion.div
              ref={cellInfoRef}
              key="cell-info-panel"
              initial={isMobile ? { y: "100%", opacity: 0 } : { x: "100%", opacity: 0 }}
              animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
              exit={isMobile ? { y: "100%", opacity: 0 } : { x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:top-4 md:right-4 bg-black/90 backdrop-blur-sm rounded-t-2xl md:rounded-xl p-4 text-sm z-20 md:min-w-[280px] md:max-w-[320px] overflow-hidden"
            >
              <button 
                onClick={() => setSelectedCell(null)} 
                className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
                data-testid="close-cell-info"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-cyber-cyan font-bold mb-2">
                {t('coordinates')}: [{selectedCell.q || selectedCell.x}, {selectedCell.r || selectedCell.y}]
              </div>
              <div className="space-y-1 text-white/80">
                <div>{t('zone')}: <span className="text-white capitalize">{getZoneName(selectedCell.zone, t)}</span></div>
                
                {/* Business info - show for any cell with business */}
                {(selectedCell.pre_business || selectedCell.business?.type) && (() => {
                  const bizType = selectedCell.pre_business || selectedCell.business?.type;
                  const bizLevel = selectedCell.business?.level || selectedCell.level || 1;
                  const bizTier = selectedCell.business_tier || selectedCell.business?.tier || 1;
                  const produces = selectedCell.business?.produces || (businessTypes?.[bizType]?.produces) || bizType;
                  const resInfo = produces ? getResource(produces) : null;
                  const baseProduction = selectedCell.business?.base_production || selectedCell.building?.base_production || businessTypes?.[bizType]?.base_production || '';
                  return (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="text-text-muted text-xs mb-1">{t('business') || 'Бизнес'}:</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{selectedCell.business_icon || selectedCell.business?.icon || '🏢'}</span>
                      <div>
                        <div className="text-purple-400 font-bold">
                          {typeof (selectedCell.business_name || selectedCell.business?.name) === 'object' 
                            ? ((selectedCell.business_name || selectedCell.business?.name)?.[lang] || (selectedCell.business_name || selectedCell.business?.name)?.ru || (selectedCell.business_name || selectedCell.business?.name)?.en) 
                            : (selectedCell.business_name || selectedCell.business?.name || selectedCell.pre_business || selectedCell.business?.type)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{t('tierLabel')} {bizTier}</span>
                          <span>•</span>
                          <span>Lv. {bizLevel}</span>
                        </div>
                      </div>
                    </div>
                    {resInfo && (
                      <div className="text-xs mt-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-text-muted">{t('produces') || 'Производит'}:</span>
                          <span>{resInfo.icon}</span>
                          <span className={resInfo.textColor}>{resInfo.name}</span>
                        </div>
                        {baseProduction && (
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted">{t('quantity') || 'Количество'}:</span>
                            <span className="text-green-400">{baseProduction} {t('unitsPerDayShort') || 'ед./сутки'}</span>
                          </div>
                        )}
                        {/* Consumption info */}
                        {(() => {
                          const consumes = selectedCell.business?.consumes || businessTypes?.[bizType]?.consumes || {};
                          const entries = Array.isArray(consumes) 
                            ? consumes.map(c => [c.resource || c.type, c.amount || c.rate || 0])
                            : Object.entries(consumes);
                          return entries.length > 0 && entries.map(([res, amt], i) => {
                            const consumeRes = getResource(res);
                            return (
                              <div key={i} className="flex items-center gap-1">
                                <span className="text-text-muted">{t('consumes') || 'Потребляет'}:</span>
                                <span>{consumeRes?.icon || '📦'}</span>
                                <span className="text-red-400">{consumeRes?.name || res} {amt} {t('unitsPerDayShort') || 'ед./сутки'}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                  );
                })()}
                
                {/* Owner info or "Available" */}
                <div className="mt-2 pt-2 border-t border-white/20">
                  <div className="text-text-muted text-xs mb-1">{t('owner')}:</div>
                  {selectedCell.owner ? (
                    <div className="flex items-center gap-2">
                      {(selectedCell.ownerAvatar || selectedCell.owner_avatar) && (
                        <img src={selectedCell.ownerAvatar || selectedCell.owner_avatar} alt="" className="w-6 h-6 rounded" />
                      )}
                      <span className="text-green-400 font-medium">
                        {selectedCell.ownerUsername || selectedCell.owner_username || t('player')}
                      </span>
                    </div>
                  ) : (
                    <div className="text-amber-400 font-medium">{t('available') || 'Свободно'}</div>
                  )}
                </div>
                
                {/* Price - show only for available cells */}
                {!selectedCell.owner && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="flex justify-between text-xs mb-3">
                      <span className="text-gray-400">{t('price')}:</span>
                      <span className="text-yellow-400 font-bold">{formatCity(selectedCell.price_city || 0)} $CITY</span>
                    </div>
                    <Button
                      onClick={handlePurchase}
                      disabled={isPurchasing || userBalance < (selectedCell?.price_ton || selectedCell?.price || 0)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                      data-testid="buy-plot-btn"
                    >
                      {isPurchasing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                      {t('buy')}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>

        </div>
      </div>

      {/* Build Modal */}
      <Dialog open={showBuildModal} onOpenChange={(open) => { if (!open) setShowBuildModal(false); }} modal={true}>
        <DialogContent className="bg-void border-green-500/30 max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              {t('buildBusiness')}
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              {t('selectBusinessType')} [{selectedCell?.q}, {selectedCell?.r}]
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 pr-2" style={{maxHeight: '350px'}}>
            <div className="space-y-2">
              {Object.entries(businessTypes).map(([type, config]) => {
                // Handle name as object or string
                const displayName = typeof config.name === 'object' 
                  ? (config.name?.ru || config.name?.en || type)
                  : (config.name || type);
                // Handle produces as object or string
                const producesName = typeof config.produces === 'object'
                  ? (config.produces?.ru || config.produces?.en || 'TON')
                  : (getResourceName(config.produces || 'TON', t));
                
                return (
                  <div
                    key={type}
                    onClick={() => setSelectedBusinessType(type)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedBusinessType === type
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon || BUILDING_ICONS[type] || '🏢'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate">
                          {displayName}
                        </div>
                        <div className="text-xs text-text-muted">
                          {config.base_cost_ton || config.cost || '?'} TON • {t('producesColon')} {producesName}
                        </div>
                      </div>
                      <Badge className={TIER_STYLES[config.tier] || TIER_STYLES[1]}>
                        T{config.tier}
                      </Badge>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          
          {/* Show patron selection only for tier 1-2 businesses (not tier 3 large businesses) */}
          {selectedBusinessType && patrons.length > 0 && businessTypes[selectedBusinessType]?.tier !== 3 && (
            <div className="flex-shrink-0 space-y-2 pt-2 border-t border-white/10">
              <label className="text-sm text-text-muted">{t('selectPatronLabel')}</label>
              <Select value={selectedPatron} onValueChange={setSelectedPatron}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder={t('noPatronLabel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noPatronLabel')}</SelectItem>
                  {patrons.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon} {typeof p.name === 'object' ? (p.name?.ru || p.name?.en || p.id) : p.name} (Lvl {p.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <DialogFooter className="flex-shrink-0 pt-4 border-t border-white/10 gap-3">
            <Button variant="outline" onClick={() => setShowBuildModal(false)} className="border-white/10">
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleBuild}
              disabled={isBuilding || !selectedBusinessType}
              className="bg-green-500 text-black hover:bg-green-600"
            >
              {isBuilding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
              {t('buildBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Info Modal removed - info shown in slide panel */}
    </div>
  );
}
