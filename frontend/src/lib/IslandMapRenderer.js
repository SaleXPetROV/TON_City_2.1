/**
 * Hexagonal Island Map Renderer
 * Optimized 2.5D isometric renderer using PixiJS
 * 
 * Features:
 * - Hexagonal grid with isometric projection (45°)
 * - Layer-based rendering (background → land → buildings)
 * - Frustum culling for performance
 * - Sprite atlases for minimal draw calls
 * - Touch/mouse interactions
 */

import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { getSpriteUrl, getConstructionSpriteUrl, BUSINESSES } from './buildingSprites';

// Hexagon dimensions for isometric view
const HEX_WIDTH = 64;
const HEX_HEIGHT = 56; // Slightly less than width for isometric effect
const HEX_SIDE = HEX_WIDTH / 2;

// Building sprite size (slightly smaller than hex)
const BUILDING_WIDTH = 56;
const BUILDING_HEIGHT = 64;

// Zone colors
const ZONE_COLORS = {
  core: 0x00D4FF,
  inner: 0x0098EA,
  middle: 0x0057FF,
  outer: 0x1a1a2e,
  water: 0x001122
};

// Owner state colors
const STATE_COLORS = {
  available: 0x00ff88,
  owned: 0x4a1a6b,
  otherOwned: 0x444444,
  selected: 0x00ffff,
  hasBusiness: 0x00ff88
};

/**
 * Convert axial hex coordinates to screen position (isometric)
 */
function hexToScreen(q, r) {
  // Pointy-top hexagon layout
  const x = HEX_WIDTH * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = HEX_HEIGHT * (3 / 4 * r);
  return { x, y };
}

/**
 * Convert screen position to hex coordinates
 */
function screenToHex(screenX, screenY) {
  const q = (Math.sqrt(3) / 3 * screenX - 1 / 3 * screenY) / (HEX_WIDTH / 2);
  const r = (2 / 3 * screenY) / (HEX_HEIGHT * 3 / 4);
  return hexRound(q, r);
}

/**
 * Round fractional hex coordinates to nearest hex
 */
function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  
  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  
  return { q: rq, r: rr };
}

/**
 * Draw a hexagon shape
 */
function drawHexagon(graphics, x, y, fillColor, strokeColor = 0x00ffff, alpha = 0.9) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(
      x + HEX_SIDE * Math.cos(angle),
      y + HEX_SIDE * 0.866 * Math.sin(angle) // 0.866 for isometric compression
    );
  }
  
  graphics.poly(points);
  graphics.fill({ color: fillColor, alpha });
  graphics.stroke({ width: 1, color: strokeColor, alpha: 0.3 });
}

/**
 * IslandMapRenderer class
 */
export class IslandMapRenderer {
  constructor(container, options = {}) {
    this.containerElement = container;
    this.options = {
      width: options.width || container.clientWidth || 800,
      height: options.height || container.clientHeight || 600,
      backgroundColor: options.backgroundColor || ZONE_COLORS.water,
      onPlotSelect: options.onPlotSelect || (() => {}),
      onPlotHover: options.onPlotHover || (() => {}),
      ...options
    };
    
    this.app = null;
    this.layers = {
      background: null,
      terrain: null,
      buildings: null,
      ui: null
    };
    
    this.plots = [];
    this.plotGraphics = new Map(); // Map of plot coords to graphics
    this.buildingSprites = new Map(); // Map of plot coords to sprites
    this.textureCache = new Map();
    
    this.selectedPlot = null;
    this.hoveredPlot = null;
    this.userId = null;
    
    // View state
    this.scale = 1;
    this.minScale = 0.3;
    this.maxScale = 2.5;
    this.offset = { x: 0, y: 0 };
    
    // Interaction state
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.lastDragPos = { x: 0, y: 0 };
  }
  
  /**
   * Initialize the renderer
   */
  async init() {
    // Create PixiJS application
    this.app = new Application();
    await this.app.init({
      width: this.options.width,
      height: this.options.height,
      backgroundColor: this.options.backgroundColor,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true
    });
    
    // Add canvas to container
    this.containerElement.innerHTML = '';
    this.containerElement.appendChild(this.app.canvas);
    
    // Create layer containers
    this.layers.background = new Container();
    this.layers.terrain = new Container();
    this.layers.buildings = new Container();
    this.layers.ui = new Container();
    
    // Add layers in order (bottom to top)
    this.app.stage.addChild(this.layers.background);
    this.app.stage.addChild(this.layers.terrain);
    this.app.stage.addChild(this.layers.buildings);
    this.app.stage.addChild(this.layers.ui);
    
    // Setup interactions
    this.setupInteractions();
    
    // Handle resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    
    return this;
  }
  
  /**
   * Setup mouse/touch interactions
   */
  setupInteractions() {
    const canvas = this.app.canvas;
    
    // Mouse down - start drag
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = false;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.lastDragPos = { x: e.clientX, y: e.clientY };
    });
    
    // Mouse move - pan
    canvas.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) {
        const dx = e.clientX - this.lastDragPos.x;
        const dy = e.clientY - this.lastDragPos.y;
        
        // If moved more than 5px, it's a drag
        if (Math.abs(e.clientX - this.dragStart.x) > 5 || 
            Math.abs(e.clientY - this.dragStart.y) > 5) {
          this.isDragging = true;
        }
        
        this.offset.x += dx;
        this.offset.y += dy;
        this.updateTransform();
        
        this.lastDragPos = { x: e.clientX, y: e.clientY };
      } else {
        // Hover detection
        this.handleHover(e);
      }
    });
    
    // Mouse up - end drag or click
    canvas.addEventListener('mouseup', (e) => {
      if (!this.isDragging) {
        this.handleClick(e);
      }
      this.isDragging = false;
    });
    
    // Mouse leave
    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.setHoveredPlot(null);
    });
    
    // Wheel - zoom (disabled per requirements, but keeping for optional use)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Zoom disabled per ТЗ - use buttons instead
    });
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.dragStart = { x: touch.clientX, y: touch.clientY };
        this.lastDragPos = { x: touch.clientX, y: touch.clientY };
        this.isDragging = false;
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - this.lastDragPos.x;
        const dy = touch.clientY - this.lastDragPos.y;
        
        if (Math.abs(touch.clientX - this.dragStart.x) > 10 || 
            Math.abs(touch.clientY - this.dragStart.y) > 10) {
          this.isDragging = true;
        }
        
        this.offset.x += dx;
        this.offset.y += dy;
        this.updateTransform();
        
        this.lastDragPos = { x: touch.clientX, y: touch.clientY };
      }
    });
    
    canvas.addEventListener('touchend', (e) => {
      if (!this.isDragging && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        this.handleClick({ clientX: touch.clientX, clientY: touch.clientY });
      }
      this.isDragging = false;
    });
  }
  
  /**
   * Handle click on canvas
   */
  handleClick(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = (e.clientX - rect.left - this.offset.x) / this.scale;
    const screenY = (e.clientY - rect.top - this.offset.y) / this.scale;
    
    // Find clicked plot
    const clickedPlot = this.findPlotAtScreen(screenX, screenY);
    
    if (clickedPlot) {
      this.setSelectedPlot(clickedPlot);
      this.options.onPlotSelect(clickedPlot);
    }
  }
  
  /**
   * Handle hover on canvas
   */
  handleHover(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = (e.clientX - rect.left - this.offset.x) / this.scale;
    const screenY = (e.clientY - rect.top - this.offset.y) / this.scale;
    
    const hoveredPlot = this.findPlotAtScreen(screenX, screenY);
    this.setHoveredPlot(hoveredPlot);
  }
  
  /**
   * Find plot at screen coordinates
   */
  findPlotAtScreen(screenX, screenY) {
    // Check each plot's bounds
    for (const plot of this.plots) {
      const { x, y } = hexToScreen(plot.x, plot.y);
      const dx = screenX - x;
      const dy = screenY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < HEX_SIDE * 0.9) {
        return plot;
      }
    }
    return null;
  }
  
  /**
   * Update view transform (pan/zoom)
   */
  updateTransform() {
    const container = this.layers.terrain.parent;
    if (container) {
      this.layers.background.position.set(this.offset.x, this.offset.y);
      this.layers.background.scale.set(this.scale);
      
      this.layers.terrain.position.set(this.offset.x, this.offset.y);
      this.layers.terrain.scale.set(this.scale);
      
      this.layers.buildings.position.set(this.offset.x, this.offset.y);
      this.layers.buildings.scale.set(this.scale);
    }
  }
  
  /**
   * Set zoom level
   */
  setZoom(newScale) {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    this.updateTransform();
  }
  
  /**
   * Zoom in
   */
  zoomIn() {
    this.setZoom(this.scale * 1.2);
  }
  
  /**
   * Zoom out
   */
  zoomOut() {
    this.setZoom(this.scale / 1.2);
  }
  
  /**
   * Reset view to center
   */
  resetView() {
    if (this.plots.length === 0) return;
    
    // Calculate bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    this.plots.forEach(plot => {
      const { x, y } = hexToScreen(plot.x, plot.y);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    
    const mapWidth = maxX - minX + HEX_WIDTH;
    const mapHeight = maxY - minY + HEX_HEIGHT;
    
    // Calculate scale to fit
    const scaleX = (this.options.width - 100) / mapWidth;
    const scaleY = (this.options.height - 100) / mapHeight;
    this.scale = Math.min(scaleX, scaleY, 1.5);
    
    // Center the map
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.offset.x = this.options.width / 2 - centerX * this.scale;
    this.offset.y = this.options.height / 2 - centerY * this.scale;
    
    this.updateTransform();
  }
  
  /**
   * Set current user ID for ownership highlighting
   */
  setUserId(userId) {
    this.userId = userId;
  }
  
  /**
   * Load and set plots data
   */
  async setPlots(plots, cityStyle = 'cyber') {
    this.plots = plots;
    this.cityStyle = cityStyle;
    
    // Preload building sprites
    await this.preloadSprites();
    
    // Clear existing graphics
    this.layers.terrain.removeChildren();
    this.layers.buildings.removeChildren();
    this.plotGraphics.clear();
    this.buildingSprites.clear();
    
    // Sort plots for correct z-ordering (back to front)
    const sortedPlots = [...plots].sort((a, b) => {
      return (a.y - b.y) || (a.x - b.x);
    });
    
    // Draw each plot
    sortedPlots.forEach(plot => {
      this.drawPlot(plot);
    });
    
    // Reset view to show all
    this.resetView();
  }
  
  /**
   * Preload sprites for visible buildings
   */
  async preloadSprites() {
    const urls = new Set();
    
    // Collect all needed sprite URLs
    this.plots.forEach(plot => {
      if (plot.business_type && plot.business_level) {
        urls.add(getSpriteUrl(plot.business_type, plot.business_level));
      }
      if (plot.is_constructing) {
        const tier = BUSINESSES[plot.business_type]?.tier || 1;
        urls.add(getConstructionSpriteUrl(tier));
      }
    });
    
    // Load all sprites
    await Promise.all(
      Array.from(urls).map(async (url) => {
        if (!this.textureCache.has(url)) {
          try {
            const texture = await Assets.load(url);
            this.textureCache.set(url, texture);
          } catch (e) {
            console.warn(`Failed to load sprite: ${url}`);
          }
        }
      })
    );
  }
  
  /**
   * Draw a single plot (hexagon + building)
   */
  drawPlot(plot) {
    const { x: screenX, y: screenY } = hexToScreen(plot.x, plot.y);
    
    // Determine colors based on state
    let fillColor = ZONE_COLORS[plot.zone] || ZONE_COLORS.middle;
    let strokeColor = 0x00ffff;
    
    const isOwned = plot.owner === this.userId;
    const hasOwner = !!plot.owner;
    const hasBusiness = !!plot.business_type;
    
    if (isOwned) {
      fillColor = hasBusiness ? STATE_COLORS.hasBusiness : STATE_COLORS.owned;
    } else if (hasOwner) {
      fillColor = STATE_COLORS.otherOwned;
    }
    
    // Create hexagon graphics
    const hex = new Graphics();
    drawHexagon(hex, 0, 0, fillColor, strokeColor);
    hex.position.set(screenX, screenY);
    hex.eventMode = 'static';
    hex.cursor = 'pointer';
    
    // Store reference
    const key = `${plot.x},${plot.y}`;
    this.plotGraphics.set(key, hex);
    this.layers.terrain.addChild(hex);
    
    // Draw building sprite if exists
    if (hasBusiness && plot.business_level) {
      this.drawBuilding(plot, screenX, screenY);
    }
    
    // Draw owner avatar badge if owned
    if (hasOwner && (plot.owner_avatar || plot.owner_info?.avatar)) {
      this.drawOwnerAvatar(plot, screenX, screenY);
    }
  }
  
  /**
   * Draw building sprite on a plot
   */
  drawBuilding(plot, screenX, screenY) {
    const url = plot.is_constructing 
      ? getConstructionSpriteUrl(BUSINESSES[plot.business_type]?.tier || 1)
      : getSpriteUrl(plot.business_type, plot.business_level);
    
    const texture = this.textureCache.get(url);
    if (!texture) return;
    
    const sprite = new Sprite(texture);
    sprite.width = BUILDING_WIDTH;
    sprite.height = BUILDING_HEIGHT;
    sprite.anchor.set(0.5, 0.9); // Anchor at bottom-center (0.9 to align better with hex center)
    sprite.position.set(screenX, screenY);
    
    const key = `${plot.x},${plot.y}`;
    this.buildingSprites.set(key, sprite);
    this.layers.buildings.addChild(sprite);
  }
  
  /**
   * Draw owner avatar badge on a plot (2.5D isometric style)
   */
  async drawOwnerAvatar(plot, screenX, screenY) {
    // Only draw for owned plots
    if (!plot.owner_avatar && !plot.owner_info?.avatar) return;
    
    const avatarUrl = plot.owner_avatar || plot.owner_info?.avatar;
    if (!avatarUrl) return;
    
    try {
      // Load avatar if not cached
      const cacheKey = `avatar_${avatarUrl.substring(0, 50)}`;
      if (!this.textureCache.has(cacheKey)) {
        const texture = await Assets.load(avatarUrl);
        this.textureCache.set(cacheKey, texture);
      }
      
      const texture = this.textureCache.get(cacheKey);
      if (!texture) return;
      
      // Create 2.5D avatar container
      const container = new Container();
      
      // Create isometric "podium" base
      const podium = new Graphics();
      podium.beginFill(0x1a1a2e, 0.9);
      // Draw ellipse for isometric base
      podium.drawEllipse(0, 8, 14, 7);
      podium.endFill();
      podium.lineStyle(1, 0x00ffff, 0.5);
      podium.drawEllipse(0, 8, 14, 7);
      
      // Avatar sprite with slight rotation for 2.5D effect
      const avatar = new Sprite(texture);
      avatar.width = 28;
      avatar.height = 28;
      avatar.anchor.set(0.5, 0.5);
      
      // Create circular mask
      const mask = new Graphics();
      mask.beginFill(0xffffff);
      mask.drawCircle(0, 0, 14);
      mask.endFill();
      
      avatar.mask = mask;
      
      // Glow effect
      const glow = new Graphics();
      glow.beginFill(0x00ffff, 0.2);
      glow.drawCircle(0, 0, 18);
      glow.endFill();
      
      // Border circle with gradient effect
      const border = new Graphics();
      border.lineStyle(2, 0x00ffff);
      border.drawCircle(0, 0, 15);
      
      // Add shadow for 3D effect
      const shadow = new Graphics();
      shadow.beginFill(0x000000, 0.3);
      shadow.drawEllipse(2, 16, 12, 4);
      shadow.endFill();
      
      container.addChild(shadow);
      container.addChild(podium);
      container.addChild(glow);
      container.addChild(mask);
      container.addChild(avatar);
      container.addChild(border);
      
      // Position floating above the hex center
      container.position.set(screenX, screenY - 5);
      
      // Add slight scale for depth effect
      container.scale.set(0.8);
      
      const key = `avatar_${plot.x},${plot.y}`;
      this.plotGraphics.set(key, container);
      this.layers.buildings.addChild(container);
    } catch (e) {
      console.warn('Avatar load failed:', e);
      // Silent fail for avatar loading
    }
  }
  
  /**
   * Update a single plot (for incremental updates)
   */
  updatePlot(plot) {
    const key = `${plot.x},${plot.y}`;
    
    // Update in plots array
    const index = this.plots.findIndex(p => p.x === plot.x && p.y === plot.y);
    if (index >= 0) {
      this.plots[index] = plot;
    }
    
    // Remove old graphics
    const oldHex = this.plotGraphics.get(key);
    if (oldHex) {
      this.layers.terrain.removeChild(oldHex);
    }
    
    const oldSprite = this.buildingSprites.get(key);
    if (oldSprite) {
      this.layers.buildings.removeChild(oldSprite);
    }
    
    // Redraw
    this.drawPlot(plot);
  }
  
  /**
   * Set selected plot
   */
  setSelectedPlot(plot) {
    // Unhighlight previous
    if (this.selectedPlot) {
      const prevKey = `${this.selectedPlot.x},${this.selectedPlot.y}`;
      const prevHex = this.plotGraphics.get(prevKey);
      if (prevHex) {
        prevHex.alpha = 1;
      }
    }
    
    this.selectedPlot = plot;
    
    // Highlight new
    if (plot) {
      const key = `${plot.x},${plot.y}`;
      const hex = this.plotGraphics.get(key);
      if (hex) {
        hex.alpha = 0.7;
      }
    }
  }
  
  /**
   * Set hovered plot
   */
  setHoveredPlot(plot) {
    if (this.hoveredPlot === plot) return;
    
    // Reset previous hover
    if (this.hoveredPlot && this.hoveredPlot !== this.selectedPlot) {
      const prevKey = `${this.hoveredPlot.x},${this.hoveredPlot.y}`;
      const prevHex = this.plotGraphics.get(prevKey);
      if (prevHex) {
        prevHex.alpha = 1;
      }
    }
    
    this.hoveredPlot = plot;
    
    // Apply hover effect
    if (plot && plot !== this.selectedPlot) {
      const key = `${plot.x},${plot.y}`;
      const hex = this.plotGraphics.get(key);
      if (hex) {
        hex.alpha = 0.8;
      }
      this.options.onPlotHover(plot);
    }
  }
  
  /**
   * Handle window resize
   */
  handleResize() {
    if (!this.app || !this.containerElement) return;
    
    this.options.width = this.containerElement.clientWidth;
    this.options.height = this.containerElement.clientHeight;
    
    this.app.renderer.resize(this.options.width, this.options.height);
  }
  
  /**
   * Get current zoom level
   */
  getZoom() {
    return Math.round(this.scale * 100);
  }
  
  /**
   * Destroy the renderer
   */
  destroy() {
    window.removeEventListener('resize', this.handleResize);
    
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    
    this.textureCache.clear();
    this.plotGraphics.clear();
    this.buildingSprites.clear();
  }
}

export default IslandMapRenderer;
