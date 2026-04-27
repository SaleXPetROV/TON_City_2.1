import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container, Sprite, Graphics, Text, TextStyle, Assets } from 'pixi.js';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const GRID_SIZE = 25; // 25x25 = 625 cells for 500 active + buffer

// Level visual modifiers
const LEVEL_SCALES = {
  1: 0.8, 2: 0.85, 3: 0.9, 4: 0.95, 5: 1.0,
  6: 1.05, 7: 1.1, 8: 1.15, 9: 1.2, 10: 1.25
};

const LEVEL_GLOWS = {
  1: null, 2: null, 3: null, 4: '#4ade80',
  5: '#22d3ee', 6: '#818cf8', 7: '#c084fc',
  8: '#f472b6', 9: '#fb923c', 10: '#fbbf24'
};

// Tier colors for badges
const TIER_COLORS = {
  1: '#22c55e', // Green
  2: '#3b82f6', // Blue
  3: '#a855f7'  // Purple
};

// Building emoji fallbacks (if sprites not loaded)
const BUILDING_EMOJIS = {
  solar_station: '☀️', data_center: '💾', crystal_mine: '💎',
  satellite_signal: '📡', hydro_cooler: '❄️', bio_printer: '🌱',
  nano_collector: '♻️', chip_factory: '🏭', nft_studio: '🎨',
  ai_lab: '🧠', logistics_hangar: '🚁', cyber_cafe: '☕',
  repair_shop: '🔧', vr_club: '🎮', validator_center: '⚡',
  gram_bank: '🏦', dex_exchange: '📊', hotel_casino: '🎰',
  cyber_arena: '🏟️', tech_incubator: '🚀', bridge_portal: '🌉'
};

// Convert grid coordinates to isometric screen coordinates
function gridToScreen(x, y, offsetX = 0, offsetY = 0) {
  const screenX = (x - y) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY;
  return { x: screenX, y: screenY };
}

// Convert screen coordinates to grid coordinates
function screenToGrid(screenX, screenY, offsetX = 0, offsetY = 0) {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;
  
  const x = Math.floor((adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2);
  const y = Math.floor((adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2);
  
  return { x, y };
}

export default function IsometricMap({ 
  plots = [], 
  businesses = [], 
  onPlotClick,
  onBusinessClick,
  selectedPlot = null,
  userId = null,
  width = 800,
  height = 600
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const [sprites, setSprites] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Build lookup maps for quick access
  const plotMap = useMemo(() => {
    const map = new Map();
    plots.forEach(p => map.set(`${p.x},${p.y}`, p));
    return map;
  }, [plots]);

  const businessMap = useMemo(() => {
    const map = new Map();
    businesses.forEach(b => map.set(`${b.x},${b.y}`, b));
    return map;
  }, [businesses]);

  // Load building sprites
  useEffect(() => {
    const loadSprites = async () => {
      const loadedSprites = {};
      
      for (const buildingType of Object.keys(BUILDING_EMOJIS)) {
        try {
          const texture = await Assets.load(`/sprites/buildings/${buildingType}.png`);
          loadedSprites[buildingType] = texture;
        } catch (e) {
          // Will use emoji fallback
          console.log(`Sprite not found for ${buildingType}, using emoji`);
        }
      }
      
      setSprites(loadedSprites);
      setIsLoading(false);
    };

    loadSprites();
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const app = new Application();
    
    app.init({
      width,
      height,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    }).then(() => {
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;
      
      // Create main container for camera
      const worldContainer = new Container();
      worldContainer.sortableChildren = true;
      app.stage.addChild(worldContainer);
      
      // Center the map
      worldContainer.x = width / 2;
      worldContainer.y = height / 4;
    });

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  // Draw the map
  const drawMap = useCallback(() => {
    const app = appRef.current;
    if (!app || isLoading) return;

    const worldContainer = app.stage.children[0];
    if (!worldContainer) return;

    // Clear previous drawings
    worldContainer.removeChildren();

    // Apply camera transform
    worldContainer.x = width / 2 + camera.x;
    worldContainer.y = height / 4 + camera.y;
    worldContainer.scale.set(camera.zoom);

    // Calculate visible area for culling
    const visibleTiles = Math.ceil(Math.max(width, height) / (TILE_HEIGHT * camera.zoom)) + 4;
    const centerGrid = screenToGrid(0, 0);

    // Draw tiles in back-to-front order (painter's algorithm)
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        // Culling - skip tiles far from view
        if (Math.abs(x - GRID_SIZE/2) > visibleTiles || Math.abs(y - GRID_SIZE/2) > visibleTiles) {
          continue;
        }

        const screenPos = gridToScreen(x, y);
        const plot = plotMap.get(`${x},${y}`);
        const business = businessMap.get(`${x},${y}`);

        // Draw tile
        const tile = new Graphics();
        
        // Determine tile color based on state
        let tileColor = 0x1a1a2e; // Default empty
        let tileAlpha = 0.6;
        let strokeColor = 0x333344;
        
        if (plot) {
          if (plot.owner === userId) {
            tileColor = 0x22c55e; // Own plot - green
            tileAlpha = 0.3;
            strokeColor = 0x22c55e;
          } else if (plot.is_available) {
            tileColor = 0x3b82f6; // Available - blue
            tileAlpha = 0.2;
            strokeColor = 0x3b82f6;
          } else {
            tileColor = 0x6b7280; // Owned by others
            tileAlpha = 0.2;
          }
        }

        if (selectedPlot && selectedPlot.x === x && selectedPlot.y === y) {
          strokeColor = 0x00f0ff; // Cyan for selected
          tileAlpha = 0.5;
        }

        // Draw isometric diamond
        tile.fill({ color: tileColor, alpha: tileAlpha });
        tile.stroke({ width: 1, color: strokeColor, alpha: 0.5 });
        tile.poly([
          { x: 0, y: -TILE_HEIGHT / 2 },
          { x: TILE_WIDTH / 2, y: 0 },
          { x: 0, y: TILE_HEIGHT / 2 },
          { x: -TILE_WIDTH / 2, y: 0 }
        ]);
        tile.fill();
        tile.stroke();

        tile.x = screenPos.x;
        tile.y = screenPos.y;
        tile.zIndex = x + y; // Sort by depth

        // Make interactive
        tile.eventMode = 'static';
        tile.cursor = 'pointer';
        tile.on('pointerdown', () => {
          if (plot && onPlotClick) {
            onPlotClick(plot);
          }
        });

        worldContainer.addChild(tile);

        // Draw building if exists
        if (business) {
          const level = business.level || 1;
          const scale = LEVEL_SCALES[level] || 1;
          const glowColor = LEVEL_GLOWS[level];
          const tier = business.tier || 1;

          // Check if we have sprite texture
          const texture = sprites[business.business_type];
          
          if (texture) {
            // Use sprite
            const buildingSprite = new Sprite(texture);
            buildingSprite.anchor.set(0.5, 0.8);
            buildingSprite.x = screenPos.x;
            buildingSprite.y = screenPos.y - 10;
            buildingSprite.scale.set(scale * 0.15);
            buildingSprite.zIndex = x + y + 1;
            
            // Add glow effect for high levels
            if (glowColor) {
              buildingSprite.tint = parseInt(glowColor.replace('#', '0x'));
            }
            
            buildingSprite.eventMode = 'static';
            buildingSprite.cursor = 'pointer';
            buildingSprite.on('pointerdown', () => {
              if (onBusinessClick) onBusinessClick(business);
            });
            
            worldContainer.addChild(buildingSprite);
          } else {
            // Use emoji fallback
            const emoji = BUILDING_EMOJIS[business.business_type] || '🏢';
            const textStyle = new TextStyle({
              fontSize: 20 * scale,
              align: 'center'
            });
            const emojiText = new Text({ text: emoji, style: textStyle });
            emojiText.anchor.set(0.5, 0.8);
            emojiText.x = screenPos.x;
            emojiText.y = screenPos.y - 10;
            emojiText.zIndex = x + y + 1;
            
            emojiText.eventMode = 'static';
            emojiText.cursor = 'pointer';
            emojiText.on('pointerdown', () => {
              if (onBusinessClick) onBusinessClick(business);
            });
            
            worldContainer.addChild(emojiText);
          }

          // Level badge
          const badgeBg = new Graphics();
          badgeBg.fill({ color: parseInt(TIER_COLORS[tier].replace('#', '0x')), alpha: 0.9 });
          badgeBg.circle(0, 0, 8);
          badgeBg.fill();
          badgeBg.x = screenPos.x + 15;
          badgeBg.y = screenPos.y - 30;
          badgeBg.zIndex = x + y + 2;
          worldContainer.addChild(badgeBg);

          const levelText = new Text({
            text: String(level),
            style: new TextStyle({
              fontSize: 10,
              fill: 0xffffff,
              fontWeight: 'bold'
            })
          });
          levelText.anchor.set(0.5);
          levelText.x = screenPos.x + 15;
          levelText.y = screenPos.y - 30;
          levelText.zIndex = x + y + 3;
          worldContainer.addChild(levelText);

          // Stopped indicator
          if (business.is_active === false) {
            const stoppedIndicator = new Graphics();
            stoppedIndicator.fill({ color: 0xff0000, alpha: 0.8 });
            stoppedIndicator.circle(0, 0, 6);
            stoppedIndicator.fill();
            stoppedIndicator.x = screenPos.x - 15;
            stoppedIndicator.y = screenPos.y - 30;
            stoppedIndicator.zIndex = x + y + 2;
            worldContainer.addChild(stoppedIndicator);
          }
        }
      }
    }

    // Sort children by zIndex
    worldContainer.sortChildren();
  }, [plots, businesses, sprites, camera, selectedPlot, userId, width, height, plotMap, businessMap, isLoading, onPlotClick, onBusinessClick]);

  // Redraw when data changes
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // Handle mouse events for panning
  const handleMouseDown = useCallback((e) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    setCamera(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({
      ...prev,
      zoom: Math.min(Math.max(prev.zoom * zoomDelta, 0.3), 3)
    }));
  }, []);

  // Touch events for mobile
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    
    const dx = e.touches[0].clientX - lastMouse.current.x;
    const dy = e.touches[0].clientY - lastMouse.current.y;
    
    setCamera(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-white/10"
      style={{ width, height, cursor: isDragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-10">
          <div className="text-cyber-cyan animate-pulse">Загрузка карты...</div>
        </div>
      )}
      
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }))}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-bold"
        >
          +
        </button>
        <button
          onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(prev.zoom * 0.8, 0.3) }))}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-bold"
        >
          -
        </button>
        <button
          onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-xs"
        >
          ⌂
        </button>
      </div>
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1 z-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
          <span className="text-white/80">{t('yourPlots')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span className="text-white/80">{t('available')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-500 rounded-sm" />
          <span className="text-white/80">{t('occupiedLabel')}</span>
        </div>
      </div>
    </div>
  );
}
