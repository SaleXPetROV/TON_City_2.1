import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, Users, Coins, MapPin, TrendingUp, 
  Globe, Search, Filter, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation, languages } from '@/lib/translations';
import { useLanguage } from '@/context/LanguageContext';

// City silhouette preview using Canvas
function CitySilhouette({ grid, style, size = 120 }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !grid) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const height = grid.length;
    const width = grid[0]?.length || 0;
    
    // Calculate cell size to fit
    const cellSize = Math.min(size / width, size / height);
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Style colors
    const colors = {
      cyber: { land: '#00f0ff', shadow: '#0088aa' },
      tropical: { land: '#4ade80', shadow: '#22c55e' },
      industrial: { land: '#f59e0b', shadow: '#d97706' },
      neon: { land: '#a855f7', shadow: '#7c3aed' }
    };
    
    const color = colors[style] || colors.cyber;
    
    // Draw grid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === 1) {
          // Shadow
          ctx.fillStyle = color.shadow;
          ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 1, cellSize - 1);
          
          // Main cell
          ctx.fillStyle = color.land;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }
  }, [grid, style, size]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="opacity-80 group-hover:opacity-100 transition-opacity"
      style={{ maxWidth: size, maxHeight: size }}
    />
  );
}

export default function MapPage({ user }) {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const { language: lang } = useLanguage();
  const { t } = useTranslation(lang);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const res = await fetch('/api/cities');
      const data = await res.json();
      setCities(data.cities || []);
    } catch (error) {
      console.error('Failed to load cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCities = cities
    .filter(city => {
      const name = city.name[lang] || city.name.en || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name[lang] || a.name.en).localeCompare(b.name[lang] || b.name.en);
      }
      if (sortBy === 'price') {
        return a.base_price - b.base_price;
      }
      if (sortBy === 'players') {
        return (b.stats?.active_players || 0) - (a.stats?.active_players || 0);
      }
      return 0;
    });

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('ton_city_lang', newLang);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center font-rajdhani">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-cyber-cyan animate-pulse">{t('loading') || 'Loading cities...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void relative overflow-hidden font-rajdhani pb-20 lg:pb-0">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-cyan to-neon-purple flex items-center justify-center">
                <Building2 className="w-6 h-6 text-black" />
              </div>
              <span className="font-unbounded text-xl font-bold text-text-main tracking-tighter">
                TON <span className="text-cyber-cyan">CITY</span>
              </span>
            </motion.div>

            <div className="flex items-center gap-4">
              <Select value={lang} onValueChange={changeLang}>
                <SelectTrigger className="w-24 bg-panel/30 border-white/5 text-text-main h-9 text-sm">
                  <Globe className="w-4 h-4 mr-1 text-cyber-cyan" />
                  <SelectValue>{languages.find(l => l.code === lang)?.flag}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-panel border-grid-border">
                  {languages.map(language => (
                    <SelectItem key={language.code} value={language.code}>
                      <span className="flex items-center gap-2">
                        <span>{language.flag}</span>
                        <span>{language.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {user && (
                <div 
                  onClick={() => navigate('/settings')}
                  className="flex items-center gap-2 bg-white/5 p-1 pr-3 rounded-full border border-white/10 cursor-pointer hover:bg-white/10"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border border-cyber-cyan" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-cyber-cyan to-neon-purple rounded-full flex items-center justify-center text-sm font-bold text-black">
                      {(user.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm font-medium hidden sm:block">{user.username}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Title */}
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="font-unbounded text-3xl sm:text-4xl font-bold text-white mb-3 uppercase flex items-center justify-center gap-3">
              <MapPin className="w-8 h-8 text-cyber-cyan" />
              {t('worldMap') || 'World Map'}
            </h1>
            <p className="text-text-muted max-w-xl mx-auto">
              Выберите город для покупки земли и строительства бизнес-империи
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4 mb-8 max-w-2xl mx-auto"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск городов..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-text-muted"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40 bg-white/5 border-white/10 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-grid-border">
                <SelectItem value="name">По названию</SelectItem>
                <SelectItem value="price">По цене</SelectItem>
                <SelectItem value="players">По игрокам</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* Cities Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filteredCities.map((city, index) => (
              <motion.div
                key={city.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="group glass-panel rounded-2xl p-6 border border-white/5 hover:border-cyber-cyan/30 transition-all cursor-pointer"
                onClick={() => navigate(`/game/${city.id}`)}
              >
                {/* City Preview */}
                <div className="flex justify-center mb-4 h-32 items-center">
                  <CitySilhouette 
                    grid={city.grid_preview} 
                    style={city.style}
                    size={120}
                  />
                </div>
                
                {/* City Name */}
                <h3 className="font-unbounded text-lg font-bold text-white mb-2 uppercase tracking-tight group-hover:text-cyber-cyan transition-colors">
                  {city.name[lang] || city.name.en}
                </h3>
                
                {/* Description */}
                <p className="text-text-muted text-sm mb-4 line-clamp-2">
                  {city.description[lang] || city.description.en}
                </p>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-cyber-cyan font-mono text-sm font-bold">
                      {city.stats?.total_plots || 0}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">
                      {t('plots') || 'Plots'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-signal-amber font-mono text-sm font-bold">
                      {city.base_price} TON
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">
                      {t('basePrice') || 'Base Price'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-green-400 font-mono text-sm font-bold">
                      {city.stats?.owned_plots || 0}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">
                      {t('owned') || 'Owned'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-neon-purple font-mono text-sm font-bold">
                      {city.stats?.total_businesses || 0}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">
                      {t('businesses') || 'Businesses'}
                    </div>
                  </div>
                </div>
                
                {/* Visit Button */}
                <Button 
                  className="w-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan hover:text-black transition-all group-hover:border-cyber-cyan"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('visit') || 'VISIT'}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            ))}
          </div>

          {filteredCities.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
              <p className="text-text-muted">{t('noCitiesFound') || 'No cities found'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
