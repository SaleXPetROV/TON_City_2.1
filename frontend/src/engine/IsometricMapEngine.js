/**
 * TON Island 2.5D Isometric Map Engine v4.0
 * Professional pixel-perfect rendering with fixed anchor points
 */

import { 
  Application, 
  Container, 
  Graphics, 
  Sprite, 
  Text, 
  TextStyle,
  Texture,
  Assets,
  Color
} from 'pixi.js';
import { getSpriteUrl, BUSINESSES } from '../lib/buildingSprites';

// ==============================================
// CONSTANTS
// ==============================================

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_COLS = 35;
export const GRID_ROWS = 35;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;

// SPRITE CONFIGURATION (per TD v2)
// All sprites are 256x256 PNG with visual hierarchy baked into the image:
//   Tier 1: building 30-40% of frame height (small, grounded)
//   Tier 2: building 60% of frame height (medium factory)
//   Tier 3: building 85-90% of frame height (dominant skyscraper)
// Single uniform scale for ALL sprites — NO per-tier scaling in code.
const SPRITE_SCALE = 0.25; // 256 * 0.25 = 64px = exactly one tile width

// Color palette
export const TINTS = {
  free_core: 0x7dd3fc,
  free_inner: 0x60a5fa,
  free_middle: 0x3b82f6,
  free_outer: 0x2563eb,
  owned: 0x4ade80,
  other: 0xc084fc,
  selected: 0xfcd34d,
  hovered: 0xf0f9ff,
};

export const COLORS = {
  water: 0x0c4a6e,
  waterDeep: 0x082f49,
  nightOverlay: 0x1a1a2e, // Deep blue-black for night tint
};

// Building icons for legacy support
export const BUILDING_ICONS = {
  helios: '☀️', nano_dc: '💾', quartz_mine: '💎', signal: '📡',
  cooler: '❄️', bio_farm: '🌱', scrap: '♻️', chip_fab: '🏭',
  nft_studio: '🎨', ai_lab: '🧠', hangar: '🚁', cafe: '☕',
  repair: '🔧', vr_club: '🎮', validator: '⚡', gram_bank: '🏦',
  dex: '📊', casino: '🎰', arena: '🏟️', incubator: '🚀', bridge: '🌉'
};

// ==============================================
// UTILITIES
// ==============================================

export function gridToIso(x, y) {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2)
  };
}

export function isoToGrid(screenX, screenY) {
  const x = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const y = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

// Pixel Perfect Snapping
function snapToGrid(value) {
  return Math.round(value);
}

export function getZone(x, y, centerX, centerY) {
  const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
  const maxDist = Math.max(centerX, centerY);
  if (dist <= maxDist * 0.15) return 'core';
  if (dist <= maxDist * 0.35) return 'inner';
  if (dist <= maxDist * 0.6) return 'middle';
  return 'outer';
}

// ==============================================
// MAP STORE
// ==============================================

class MapStore {
  constructor() {
    this.state = {
      cells: new Map(),
      selectedCell: null,
      hoveredCell: null,
      userId: null,
      userWallet: null,
      isNight: false, // Night mode state
    };
    this.listeners = [];
    this.dirtySet = new Set();
  }
  
  subscribe(listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
  
  getState() { return this.state; }
  
  dispatch(action) {
    switch (action.type) {
      case 'SET_CELLS':
        this.state.cells.clear();
        action.cells.forEach(cell => {
          const key = `${cell.q},${cell.r}`;
          this.state.cells.set(key, cell);
          this.dirtySet.add(key);
        });
        break;
      case 'UPDATE_CELL':
        const key = `${action.cell.q},${action.cell.r}`;
        this.state.cells.set(key, { ...this.state.cells.get(key), ...action.cell });
        this.dirtySet.add(key);
        break;
      case 'SET_SELECTED':
        if (this.state.selectedCell) this.dirtySet.add(`${this.state.selectedCell.q},${this.state.selectedCell.r}`);
        this.state.selectedCell = action.cell;
        if (action.cell) this.dirtySet.add(`${action.cell.q},${action.cell.r}`);
        break;
      case 'SET_HOVERED':
        if (this.state.hoveredCell) this.dirtySet.add(`${this.state.hoveredCell.q},${this.state.hoveredCell.r}`);
        this.state.hoveredCell = action.cell;
        if (action.cell) this.dirtySet.add(`${action.cell.q},${action.cell.r}`);
        break;
      case 'SET_USER':
        this.state.userId = action.userId;
        this.state.userWallet = action.userWallet;
        this.state.cells.forEach((_, k) => this.dirtySet.add(k));
        break;
      case 'SET_NIGHT_MODE':
        this.state.isNight = action.isNight;
        // Mark ALL cells dirty — tiles AND buildings need re-tinting
        this.state.cells.forEach((_, k) => this.dirtySet.add(k));
        break;
      default:
        break;
    }
    this.listeners.forEach(l => l(this.state));
  }
  
  getCell(q, r) { return this.state.cells.get(`${q},${r}`); }
  getDirtyAndClear() {
    const dirty = new Set(this.dirtySet);
    this.dirtySet.clear();
    return dirty;
  }
}

export const mapStore = new MapStore();

// ==============================================
// BUILDING SPRITE CLASS (Multi-layer)
// ==============================================

class BuildingSprite extends Container {
  constructor(buildingData, texture) {
    super();
    
    this.buildingData = buildingData;
    this.buildingType = buildingData.type;
    this.level = buildingData.level || 1;
    
    // Main building sprite
    this.buildingSprite = null;
    // Night glow overlay (windows/neon)
    this.glowSprite = null;
    
    // Add building sprite
    if (texture) {
      this.buildingSprite = new Sprite(texture);
      
      // Anchor at bottom-center: base of building sits on bottom tip of diamond
      this.buildingSprite.anchor.set(0.5, 1.0);
      
      // Uniform scale for ALL sprites — visual hierarchy is in the PNG content
      this.buildingSprite.scale.set(SPRITE_SCALE);
      
      this.addChild(this.buildingSprite);
      
      // Create glow overlay for night mode (same texture, additive blend)
      this.glowSprite = new Sprite(texture);
      this.glowSprite.anchor.set(0.5, 1.0);
      this.glowSprite.scale.set(SPRITE_SCALE);
      this.glowSprite.alpha = 0;
      this.glowSprite.tint = 0x44aaff; // Cyan-blue window glow
      this.glowSprite.blendMode = 'add';
      this.addChild(this.glowSprite);
    }
    
    // UI Overlay (Level badge, etc)
    this.uiLayer = new Container();
    this.addChild(this.uiLayer);
    
    // Add level badge for level 3+
    this.createLevelBadge();
    
    // Apply initial state
    this.updateAppearance(mapStore.getState().isNight);
  }
  
  createLevelBadge() {
    if (this.level < 3) return;
    
    const tier = BUSINESSES[this.buildingType]?.tier || 1;
    const badgeColors = { 1: 0x22c55e, 2: 0x3b82f6, 3: 0xa855f7 };
    // Badge at bottom-right, offset up by ~20% of rendered sprite height
    const badgeX = 10;
    const badgeY = -(256 * SPRITE_SCALE * 0.2);
    
    const badgeG = new Graphics();
    const radius = 5 + Math.floor(this.level / 4);
    badgeG.circle(0, 0, radius);
    badgeG.fill({ color: badgeColors[tier] || 0x666666 });
    badgeG.stroke({ color: 0xffffff, width: 1 });
    
    badgeG.x = badgeX;
    badgeG.y = badgeY;
    this.uiLayer.addChild(badgeG);
    
    const lvlText = new Text({
      text: String(this.level),
      style: new TextStyle({ 
        fontSize: 7 + Math.floor(this.level / 4),
        fill: 0xffffff,
        fontWeight: 'bold'
      })
    });
    lvlText.anchor.set(0.5);
    lvlText.x = badgeX;
    lvlText.y = badgeY;
    this.uiLayer.addChild(lvlText);
  }
  
  updateAppearance(isNight) {
    if (!this.buildingSprite) return;
    
    if (isNight) {
      // Night: moderate dark tint, buildings still recognizable
      this.buildingSprite.tint = 0x556688;
      if (this.glowSprite) {
        this.glowSprite.alpha = 0.5;
        this.glowSprite.tint = 0x66ccff; // Bright cyan glow for windows
      }
    } else {
      // Day: full color, no glow
      this.buildingSprite.tint = 0xffffff;
      if (this.glowSprite) {
        this.glowSprite.alpha = 0;
      }
    }
  }
  
  setOwnershipTint(isOwn) {
    if (!this.buildingSprite) return;
    
    // Only apply ownership tint in day mode (night mode overrides)
    if (!mapStore.getState().isNight) {
        this.buildingSprite.tint = isOwn ? 0xffffff : 0xdddddd;
    }
  }
}

// ==============================================
// OPTIMIZED MAP ENGINE v4.0
// ==============================================

export class IsometricMapEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || 800,
      height: options.height || 600,
      onCellClick: options.onCellClick || (() => {}),
      onCellHover: options.onCellHover || (() => {}),
    };
    
    this.app = null;
    this.world = null;
    this.layers = {};
    this.canvas = null;
    this.initialized = false;
    
    // Texture cache
    this.tileTexture = null;
    this.buildingTextures = new Map();
    this.avatarTextures = new Map();
    this.loadingTextures = new Set();
    
    // Object pools
    this.tilePool = new Map();
    this.buildingPool = new Map();
    this.avatarPool = new Map();
    
    // Interaction
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.lastMouse = { x: 0, y: 0 };
    
    // Viewport
    this.viewport = { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity };
    
    // Render loop
    this.rafId = null;
    this.needsUpdate = false;
  }
  
  async init() {
    if (this.initialized) return;
    
    try {
      this.app = new Application();
      await this.app.init({
        width: this.options.width,
        height: this.options.height,
        backgroundColor: COLORS.water,
        antialias: false,
        resolution: 1, // Pixel perfect
        powerPreference: 'low-power',
      });
      
      this.canvas = this.app.canvas;
      if (!this.canvas) return;
      
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);
      this.initialized = true;
      
      this.generateTileTexture();
      
      this.world = new Container();
      this.world.sortableChildren = true;
      this.app.stage.addChild(this.world);
      
      this.createLayers();
      this.setupInput();
      
      mapStore.subscribe(() => { this.needsUpdate = true; });
      
      this.startRenderLoop();
      
    } catch (error) {
      console.error('IsometricMapEngine init error:', error);
    }
  }
  
  generateTileTexture() {
    if (!this.app?.renderer) return;
    const tileG = new Graphics();
    
    // Isometric Rhombus
    tileG.poly([
      TILE_WIDTH / 2, 0,
      TILE_WIDTH, TILE_HEIGHT / 2,
      TILE_WIDTH / 2, TILE_HEIGHT,
      0, TILE_HEIGHT / 2
    ]);
    tileG.fill({ color: 0xffffff });
    tileG.stroke({ color: 0x000000, width: 1, alpha: 0.15 });
    
    this.tileTexture = this.app.renderer.generateTexture({
      target: tileG,
      resolution: 1,
    });
    tileG.destroy();
  }
  
  createLayers() {
    this.layers.tiles = new Container();
    this.layers.tiles.zIndex = 1;
    this.layers.tiles.sortableChildren = true;
    this.world.addChild(this.layers.tiles);
    
    this.layers.buildings = new Container();
    this.layers.buildings.zIndex = 2;
    this.layers.buildings.sortableChildren = true;
    this.world.addChild(this.layers.buildings);
    
    // Avatar layer for showing owner avatars
    this.layers.avatars = new Container();
    this.layers.avatars.zIndex = 3;
    this.layers.avatars.sortableChildren = true;
    this.world.addChild(this.layers.avatars);
  }
  
  setupInput() {
    const canvas = this.canvas;
    
    // Touch pinch-to-zoom support
    let touches = [];
    let lastPinchDistance = 0;
    
    const getTouchDistance = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const getTouchCenter = (t1, t2) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    });
    
    canvas.addEventListener('touchstart', (e) => {
      touches = [...e.touches];
      if (touches.length === 2) {
        lastPinchDistance = getTouchDistance(touches[0], touches[1]);
      } else if (touches.length === 1) {
        this.isDragging = true;
        this.dragStart = { x: touches[0].clientX, y: touches[0].clientY };
        this.lastMouse = { x: touches[0].clientX, y: touches[0].clientY };
      }
    }, { passive: true });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      touches = [...e.touches];
      
      if (touches.length === 2 && this.world) {
        // Pinch-to-zoom
        const newDistance = getTouchDistance(touches[0], touches[1]);
        const center = getTouchCenter(touches[0], touches[1]);
        const rect = canvas.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;
        
        if (lastPinchDistance > 0) {
          const scaleFactor = newDistance / lastPinchDistance;
          const oldZoom = this.world.scale.x;
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * scaleFactor));
          
          const worldX = (centerX - this.world.x) / oldZoom;
          const worldY = (centerY - this.world.y) / oldZoom;
          this.world.scale.set(newZoom);
          this.world.x = centerX - worldX * newZoom;
          this.world.y = centerY - worldY * newZoom;
          this.updateViewportBounds();
        }
        lastPinchDistance = newDistance;
      } else if (touches.length === 1 && this.isDragging && this.world) {
        // Single finger drag
        const dx = touches[0].clientX - this.lastMouse.x;
        const dy = touches[0].clientY - this.lastMouse.y;
        this.world.x += dx;
        this.world.y += dy;
        this.lastMouse = { x: touches[0].clientX, y: touches[0].clientY };
        this.updateViewportBounds();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0 && touches.length === 1) {
        // Was single touch - check for tap
        const dx = Math.abs(touches[0].clientX - this.dragStart.x);
        const dy = Math.abs(touches[0].clientY - this.dragStart.y);
        if (dx < 10 && dy < 10) {
          const rect = canvas.getBoundingClientRect();
          this.handleClick(touches[0].clientX - rect.left, touches[0].clientY - rect.top);
        }
      }
      touches = [...e.touches];
      lastPinchDistance = 0;
      this.isDragging = false;
    }, { passive: true });
    
    // Mouse/pointer events
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // Handled by touch events
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return; // Handled by touch events
      if (this.isDragging && this.world) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.world.x += dx;
        this.world.y += dy;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.updateViewportBounds();
      } else {
        const rect = canvas.getBoundingClientRect();
        this.handleHover(e.clientX - rect.left, e.clientY - rect.top);
      }
    });
    
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return; // Handled by touch events
      const dx = Math.abs(e.clientX - this.dragStart.x);
      const dy = Math.abs(e.clientY - this.dragStart.y);
      if (dx < 5 && dy < 5) {
        const rect = canvas.getBoundingClientRect();
        this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
      }
      this.isDragging = false;
    });
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.world) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const oldZoom = this.world.scale.x;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta));
      const worldX = (mouseX - this.world.x) / oldZoom;
      const worldY = (mouseY - this.world.y) / oldZoom;
      this.world.scale.set(newZoom);
      this.world.x = mouseX - worldX * newZoom;
      this.world.y = mouseY - worldY * newZoom;
      this.updateViewportBounds();
    }, { passive: false });
  }
  
  updateViewportBounds() {
    if (!this.world || !this.world.scale) return;
    const scale = this.world.scale.x;
    const margin = 200;
    this.viewport = {
      left: (-this.world.x / scale) - margin,
      right: (this.options.width - this.world.x) / scale + margin,
      top: (-this.world.y / scale) - margin,
      bottom: (this.options.height - this.world.y) / scale + margin
    };
    this.applyCulling();
  }
  
  applyCulling() {
    this.tilePool.forEach((sprite) => {
      const visible = sprite.x >= this.viewport.left && sprite.x <= this.viewport.right &&
                      sprite.y >= this.viewport.top && sprite.y <= this.viewport.bottom;
      sprite.visible = visible;
    });
    this.buildingPool.forEach((container) => {
      const visible = container.x >= this.viewport.left && container.x <= this.viewport.right &&
                      container.y >= this.viewport.top && container.y <= this.viewport.bottom;
      container.visible = visible;
    });
    this.avatarPool.forEach((container) => {
      const visible = container.x >= this.viewport.left && container.x <= this.viewport.right &&
                      container.y >= this.viewport.top && container.y <= this.viewport.bottom;
      container.visible = visible;
    });
  }
  
  startRenderLoop() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      if (this.needsUpdate) {
        this.needsUpdate = false;
        this.processUpdates();
      }
    };
    loop();
  }
  
  processUpdates() {
    const state = mapStore.getState();
    const dirty = mapStore.getDirtyAndClear();
    
    // Update background color for night mode
    if (this.app?.renderer) {
      this.app.renderer.background.color = state.isNight ? COLORS.waterDeep : COLORS.water;
    }
    
    if (dirty.size === state.cells.size && dirty.size > 0) {
      this.setupAllTiles(state);
      this.centerCamera();
      return;
    }
    
    for (const key of dirty) {
      const cell = state.cells.get(key);
      if (cell) this.updateCell(cell, state);
    }
  }
  
  async setupAllTiles(state) {
    this.layers.tiles.removeChildren();
    this.layers.buildings.removeChildren();
    this.layers.avatars.removeChildren();
    this.tilePool.clear();
    this.buildingPool.clear();
    this.avatarPool.clear();
    
    // Sort cells by Z (top-left to bottom-right)
    const sortedCells = Array.from(state.cells.values()).sort((a, b) => (a.q + a.r) - (b.q + b.r));
    const buildingsToLoad = [];
    const cellsWithAvatars = [];
    
    for (const cell of sortedCells) {
      this.createTile(cell, state);
      if (cell.building) buildingsToLoad.push(cell);
      // Collect cells with owner avatars (show on ALL owned tiles)
      if (cell.owner) {
        cellsWithAvatars.push(cell);
      }
    }
    
    this.layers.tiles.sortChildren();
    await this.loadBuildingSprites(buildingsToLoad, state);
    await this.loadAvatarSprites(cellsWithAvatars, state);
    this.layers.buildings.sortChildren();
    this.layers.avatars.sortChildren();
    this.updateViewportBounds();
  }
  
  createTile(cell, state) {
    const key = `${cell.q},${cell.r}`;
    const pos = gridToIso(cell.q, cell.r);
    
    if (!this.tileTexture) return;
    
    const sprite = new Sprite(this.tileTexture);
    sprite.anchor.set(0.5, 0.5);
    
    // Snap to grid for sharp lines
    sprite.x = snapToGrid(pos.x + TILE_WIDTH / 2);
    sprite.y = snapToGrid(pos.y + TILE_HEIGHT / 2);
    
    sprite.zIndex = (cell.q + cell.r);
    sprite.tint = this.getTint(cell, state);
    
    this.layers.tiles.addChild(sprite);
    this.tilePool.set(key, sprite);
  }
  
  async loadBuildingSprites(cells, state) {
    const uniqueTextures = new Map();
    for (const cell of cells) {
      const building = cell.building;
      const key = `${building.type}_${building.level || 1}`;
      if (!uniqueTextures.has(key) && !this.buildingTextures.has(key)) {
        uniqueTextures.set(key, getSpriteUrl(building.type, building.level || 1));
      }
    }
    
    await Promise.all(Array.from(uniqueTextures.entries()).map(async ([key, url]) => {
      try {
        if (!this.loadingTextures.has(key)) {
          this.loadingTextures.add(key);
          const texture = await Assets.load(url);
          this.buildingTextures.set(key, texture);
          this.loadingTextures.delete(key);
        }
      } catch (e) {}
    }));
    
    for (const cell of cells) this.createBuilding(cell, state);
  }
  
  createBuilding(cell, state) {
    const key = `${cell.q},${cell.r}`;
    const building = cell.building;
    const pos = gridToIso(cell.q, cell.r);
    const textureKey = `${building.type}_${building.level || 1}`;
    const texture = this.buildingTextures.get(textureKey);
    
    const buildingSprite = new BuildingSprite(building, texture);
    
    // CRITICAL POSITIONING:
    // x = center of tile
    // y = bottom tip of tile (pos.y + TILE_HEIGHT/2 + TILE_HEIGHT/2)
    // The previous logic put it at center. With anchor(0.5, 1.0), we need it at the BOTTOM tip.
    // TILE_HEIGHT is 32. 
    // pos.y is the top-left of the bounding box. 
    // Center is pos.y + 16. Bottom tip is pos.y + 32.
    
    buildingSprite.x = snapToGrid(pos.x + TILE_WIDTH / 2);
    buildingSprite.y = snapToGrid(pos.y + TILE_HEIGHT); 
    
    // Strict Z-Index for proper depth sorting (per TD)
    buildingSprite.zIndex = (cell.q + cell.r);
    
    // Apply ownership tint or night mode
    const isOwn = cell.owner && (cell.owner === state.userId || cell.owner === state.userWallet);
    buildingSprite.setOwnershipTint(isOwn);
    buildingSprite.updateAppearance(state.isNight);
    
    this.layers.buildings.addChild(buildingSprite);
    this.buildingPool.set(key, buildingSprite);
  }
  
  async loadAvatarSprites(cells, state) {
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
    
    // Load unique avatar textures
    const uniqueAvatars = new Map();
    for (const cell of cells) {
      if (cell.ownerAvatar && !this.avatarTextures.has(cell.ownerAvatar)) {
        let avatarUrl = cell.ownerAvatar;
        // Handle different avatar URL types
        if (avatarUrl.startsWith('data:')) {
          // Data URL - can load directly
          uniqueAvatars.set(cell.ownerAvatar, avatarUrl);
        } else if (avatarUrl.startsWith('http')) {
          // Full URL
          uniqueAvatars.set(cell.ownerAvatar, avatarUrl);
        } else if (avatarUrl.startsWith('/')) {
          // Relative path - add backend URL
          uniqueAvatars.set(cell.ownerAvatar, `${BACKEND_URL}${avatarUrl}`);
        }
      }
    }
    
    await Promise.all(Array.from(uniqueAvatars.entries()).map(async ([key, url]) => {
      try {
        if (!this.loadingTextures.has(`avatar_${key}`)) {
          this.loadingTextures.add(`avatar_${key}`);
          
          // For data URLs, create texture from image element
          if (url.startsWith('data:')) {
            const img = new Image();
            img.src = url;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            const texture = Texture.from(img);
            this.avatarTextures.set(key, texture);
          } else {
            const texture = await Assets.load(url);
            this.avatarTextures.set(key, texture);
          }
          
          this.loadingTextures.delete(`avatar_${key}`);
        }
      } catch (e) {
        console.log('Failed to load avatar:', url.substring(0, 50));
      }
    }));
    
    for (const cell of cells) this.createAvatar(cell, state);
  }
  
  createAvatar(cell, state) {
    const key = `${cell.q},${cell.r}`;
    const pos = gridToIso(cell.q, cell.r);
    const texture = this.avatarTextures.get(cell.ownerAvatar);
    
    // Create avatar container
    const avatarContainer = new Container();
    
    // Размеры изометрического ромба (на всё поле)
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    
    if (!texture) {
      // Create fallback with initials - ромбовидная форма на всё поле
      const initial = (cell.ownerUsername || 'U')[0].toUpperCase();
      
      // Ромбовидный фон (изометрический алмаз) на всё поле
      const diamond = new Graphics();
      diamond.poly([
        0, -halfH,      // Верхняя точка
        halfW, 0,       // Правая точка
        0, halfH,       // Нижняя точка
        -halfW, 0       // Левая точка
      ]);
      diamond.fill({ color: 0x4ade80, alpha: 0.95 });
      diamond.stroke({ color: 0xffffff, width: 2 });
      avatarContainer.addChild(diamond);
      
      // Initial letter - крупнее
      const style = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#000000',
      });
      const text = new Text({ text: initial, style });
      text.anchor.set(0.5, 0.5);
      avatarContainer.addChild(text);
    } else {
      // Ромбовидная рамка на всё поле
      const diamondBorder = new Graphics();
      diamondBorder.poly([
        0, -halfH - 1,
        halfW + 1, 0,
        0, halfH + 1,
        -halfW - 1, 0
      ]);
      diamondBorder.fill({ color: 0xffffff, alpha: 1 });
      avatarContainer.addChild(diamondBorder);
      
      // Внутренний ромб для заливки
      const diamondFill = new Graphics();
      diamondFill.poly([
        0, -halfH,
        halfW, 0,
        0, halfH,
        -halfW, 0
      ]);
      diamondFill.fill({ color: 0x333333, alpha: 1 });
      avatarContainer.addChild(diamondFill);
      
      // Create avatar sprite with texture - на всё поле
      const avatarSprite = new Sprite(texture);
      avatarSprite.anchor.set(0.5, 0.5);
      avatarSprite.width = TILE_WIDTH;
      avatarSprite.height = TILE_WIDTH; // Квадратная для лучшего масштабирования
      
      // Создаём маску ромбовидной формы на всё поле
      const mask = new Graphics();
      mask.poly([
        0, -halfH,
        halfW, 0,
        0, halfH,
        -halfW, 0
      ]);
      mask.fill({ color: 0xffffff });
      avatarContainer.addChild(mask);
      avatarSprite.mask = mask;
      
      avatarContainer.addChild(avatarSprite);
    }
    
    // Position at center of tile
    avatarContainer.x = snapToGrid(pos.x + TILE_WIDTH / 2);
    avatarContainer.y = snapToGrid(pos.y + TILE_HEIGHT / 2);
    // zIndex ниже чем у зданий, чтобы здание было сверху
    avatarContainer.zIndex = (cell.q + cell.r) + 0.1;
    // Store avatar key for change detection
    avatarContainer.avatarKey = cell.ownerAvatar;
    
    this.layers.avatars.addChild(avatarContainer);
    this.avatarPool.set(key, avatarContainer);
  }
  
  updateCell(cell, state) {
    const key = `${cell.q},${cell.r}`;
    
    // Tile update
    const tileSprite = this.tilePool.get(key);
    if (tileSprite) tileSprite.tint = this.getTint(cell, state);
    
    // Building update
    const buildingSprite = this.buildingPool.get(key);
    if (cell.building) {
      if (buildingSprite) {
        const isOwn = cell.owner && (cell.owner === state.userId || cell.owner === state.userWallet);
        buildingSprite.setOwnershipTint(isOwn);
        buildingSprite.updateAppearance(state.isNight);
      } else {
        this.loadBuildingSprites([cell], state);
      }
    } else if (buildingSprite) {
      this.layers.buildings.removeChild(buildingSprite);
      buildingSprite.destroy();
      this.buildingPool.delete(key);
    }
    
    // Avatar update - show for ALL owned tiles (even with buildings)
    const avatarSprite = this.avatarPool.get(key);
    if (cell.owner) {
      // Check if avatar changed - need to reload
      const currentAvatarKey = avatarSprite?.avatarKey;
      if (!avatarSprite || currentAvatarKey !== cell.ownerAvatar) {
        // Remove old avatar if exists
        if (avatarSprite) {
          this.layers.avatars.removeChild(avatarSprite);
          avatarSprite.destroy();
          this.avatarPool.delete(key);
        }
        // If avatar URL changed, remove old texture from cache
        if (currentAvatarKey && currentAvatarKey !== cell.ownerAvatar) {
          this.avatarTextures.delete(currentAvatarKey);
        }
        this.loadAvatarSprites([cell], state);
      }
    } else if (avatarSprite) {
      this.layers.avatars.removeChild(avatarSprite);
      avatarSprite.destroy();
      this.avatarPool.delete(key);
    }
  }
  
  getTint(cell, state) {
    if (state.isNight) {
      // Night mode: darker version of zone colors
      const { selectedCell, hoveredCell, userId, userWallet } = state;
      if (selectedCell?.q === cell.q && selectedCell?.r === cell.r) return 0x886622;
      if (hoveredCell?.q === cell.q && hoveredCell?.r === cell.r) return 0x445566;
      if (cell.owner && (cell.owner === userId || cell.owner === userWallet)) return 0x226644;
      if (cell.owner) return 0x443366;
      // Darker zone colors
      const nightZones = { core: 0x334466, inner: 0x2d3d5c, middle: 0x263350, outer: 0x1f2944 };
      return nightZones[cell.zone || 'outer'] || 0x1f2944;
    }
    
    const { selectedCell, hoveredCell, userId, userWallet } = state;
    if (selectedCell?.q === cell.q && selectedCell?.r === cell.r) return TINTS.selected;
    if (hoveredCell?.q === cell.q && hoveredCell?.r === cell.r) return TINTS.hovered;
    if (cell.owner && (cell.owner === userId || cell.owner === userWallet)) return TINTS.owned;
    if (cell.owner) return TINTS.other;
    return TINTS[`free_${cell.zone || 'outer'}`] || TINTS.free_outer;
  }
  
  screenToWorld(screenX, screenY) {
    if (!this.world) return { x: 0, y: 0 };
    return {
      x: (screenX - this.world.x) / this.world.scale.x,
      y: (screenY - this.world.y) / this.world.scale.y
    };
  }
  
  findCellAt(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    const grid = isoToGrid(world.x, world.y);
    // Search neighborhood for precise rhombus hit
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = mapStore.getCell(grid.x + dx, grid.y + dy);
        if (cell) {
          const pos = gridToIso(cell.q, cell.r);
          if (this.isInDiamond(world.x, world.y, pos.x + TILE_WIDTH / 2, pos.y + TILE_HEIGHT / 2)) {
            return cell;
          }
        }
      }
    }
    return null;
  }
  
  isInDiamond(px, py, cx, cy) {
    const dx = Math.abs(px - cx) / (TILE_WIDTH / 2);
    const dy = Math.abs(py - cy) / (TILE_HEIGHT / 2);
    return dx + dy <= 1;
  }
  
  handleClick(screenX, screenY) {
    const cell = this.findCellAt(screenX, screenY);
    if (cell) {
      mapStore.dispatch({ type: 'SET_SELECTED', cell });
      this.options.onCellClick(cell);
    }
  }
  
  handleHover(screenX, screenY) {
    const cell = this.findCellAt(screenX, screenY);
    const currentHovered = mapStore.getState().hoveredCell;
    if (cell !== currentHovered) {
      mapStore.dispatch({ type: 'SET_HOVERED', cell });
      if (cell) this.options.onCellHover(cell);
    }
  }
  
  centerCamera() {
    if (!this.world) return;
    const cells = Array.from(mapStore.getState().cells.values());
    if (cells.length === 0) return;
    
    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cells.forEach(cell => {
      const pos = gridToIso(cell.q, cell.r);
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + TILE_WIDTH);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + TILE_HEIGHT);
    });
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;
    
    const scaleX = (this.options.width - 40) / mapWidth;
    const scaleY = (this.options.height - 40) / mapHeight;
    const zoom = Math.min(scaleX, scaleY, MAX_ZOOM) * 0.85;
    
    this.world.scale.set(zoom);
    this.world.x = this.options.width / 2 - centerX * zoom;
    this.world.y = this.options.height / 2 - centerY * zoom;
    
    this.updateViewportBounds();
  }
  
  // Smoothly pan the camera so the given grid cell sits at a target screen point.
  // If `screenX`/`screenY` are provided, use those. Otherwise center the cell.
  panToCell(gridX, gridY, zoom, screenX, screenY) {
    if (!this.world) return;
    const pos = gridToIso(gridX, gridY);
    const tileCx = pos.x + TILE_WIDTH / 2;
    const tileCy = pos.y + TILE_HEIGHT / 2;
    const targetZoom = (typeof zoom === 'number')
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      : this.world.scale.x;
    const sx = (typeof screenX === 'number') ? screenX : (this.options.width / 2);
    const sy = (typeof screenY === 'number') ? screenY : (this.options.height / 2);
    this.world.scale.set(targetZoom);
    this.world.x = sx - tileCx * targetZoom;
    this.world.y = sy - tileCy * targetZoom;
    this.updateViewportBounds();
  }

  zoomIn() { this.setZoom(this.world.scale.x * 1.2); }
  zoomOut() { this.setZoom(this.world.scale.x / 1.2); }
  setZoom(z) {
    if (this.world) {
      this.world.scale.set(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)));
      this.updateViewportBounds();
    }
  }
  resetCamera() { this.centerCamera(); }
  resize(width, height) {
    if (!this.app?.renderer) return;
    this.options.width = width;
    this.options.height = height;
    this.app.renderer.resize(width, height);
    this.updateViewportBounds();
  }
  
  setNightMode(isNight) {
    mapStore.dispatch({ type: 'SET_NIGHT_MODE', isNight });
  }
  
  // ===========================
  // TUTORIAL HIGHLIGHT (animated pulsating ring on a single tile)
  // ===========================
  setTutorialHighlight(plot) {
    if (!this.world) return;

    // Tear down previous highlight (if any)
    if (this.tutorialHighlight) {
      try {
        if (this.tutorialHighlightTicker) {
          this.app?.ticker?.remove(this.tutorialHighlightTicker);
          this.tutorialHighlightTicker = null;
        }
        this.tutorialHighlight.destroy({ children: true });
      } catch { /* noop */ }
      this.tutorialHighlight = null;
    }

    if (!plot || plot.x === undefined || plot.y === undefined) return;

    // Create a Graphics ring that mirrors the diamond tile shape (PixiJS v8 API)
    const ring = new Graphics();
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const drawDiamond = (lineWidth, color, alpha) => {
      ring.clear();
      ring.moveTo(w / 2, 0);
      ring.lineTo(w, h / 2);
      ring.lineTo(w / 2, h);
      ring.lineTo(0, h / 2);
      ring.lineTo(w / 2, 0);
      ring.stroke({ width: lineWidth, color, alpha, alignment: 0.5 });
    };
    drawDiamond(5, 0xFFD24A, 1);

    // Position it on the target tile (top-left corner of the diamond bbox)
    const pos = gridToIso(plot.x, plot.y);
    ring.x = snapToGrid(pos.x);
    ring.y = snapToGrid(pos.y);
    // Render on TOP of everything so the ring is always visible
    ring.zIndex = 9999;
    ring.alpha = 1;

    // Attach to the avatars layer (highest zIndex among existing layers)
    (this.layers.avatars || this.layers.buildings || this.layers.tiles)?.addChild(ring);
    this.tutorialHighlight = ring;
    console.log('[tutorial-highlight] placed at grid', plot.x, plot.y, '→ iso', pos);

    // Pulsation: oscillate scale 1.0 → 1.18 and alpha 1.0 → 0.55
    const startTime = performance.now();
    const period = 1200; // ms full cycle
    const ticker = () => {
      if (!this.tutorialHighlight) return;
      const t = (performance.now() - startTime) / period;
      const phase = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
      const scale = 1 + 0.3 * phase;
      const alpha = 0.6 + 0.4 * (1 - phase);
      // Pivot at center of the diamond so scale pulses outward symmetrically
      this.tutorialHighlight.pivot.set(w / 2, h / 2);
      this.tutorialHighlight.position.set(snapToGrid(pos.x) + w / 2, snapToGrid(pos.y) + h / 2);
      this.tutorialHighlight.scale.set(scale);
      this.tutorialHighlight.alpha = alpha;
      // Cycle color slightly between gold and cyan for "tutorial" vibe
      const color = phase > 0.5 ? 0x00FFFF : 0xFFD24A;
      drawDiamond(5, color, 1);
    };
    this.tutorialHighlightTicker = ticker;
    this.app?.ticker?.add(ticker);
  }

  clearTutorialHighlight() {
    this.setTutorialHighlight(null);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.initialized = false;
    if (this.tutorialHighlightTicker) {
      try { this.app?.ticker?.remove(this.tutorialHighlightTicker); } catch { /* noop */ }
      this.tutorialHighlightTicker = null;
    }
    if (this.tutorialHighlight) {
      try { this.tutorialHighlight.destroy({ children: true }); } catch { /* noop */ }
      this.tutorialHighlight = null;
    }
    if (this.tileTexture) this.tileTexture.destroy(true);
    this.buildingTextures.clear();
    this.tilePool.clear();
    this.buildingPool.forEach(b => b.destroy());
    this.buildingPool.clear();
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.app) this.app.destroy(true, { children: true });
  }
}

export default IsometricMapEngine;
