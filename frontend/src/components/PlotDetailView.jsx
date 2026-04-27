import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stage, Layer, Rect, Text as KonvaText } from 'react-konva';
import { Building2, TrendingUp, MapPin, X } from 'lucide-react';

const ZONE_COLORS = {
  center: '#4ECDC4',
  business: '#45B7D1',
  residential: '#96CEB4',
  industrial: '#DDA0DD',
  outskirts: '#6B6B6B',
};

const ZONE_NAMES = {
  center: { en: 'Center', ru: 'Центр', zh: '中心' },
  business: { en: 'Business', ru: 'Бизнес', zh: '商业区' },
  residential: { en: 'Residential', ru: 'Жилая', zh: '住宅区' },
  industrial: { en: 'Industrial', ru: 'Промышл.', zh: '工业区' },
  outskirts: { en: 'Outskirts', ru: 'Окраина', zh: '郊区' },
};

const BUSINESS_ICONS = {
  farm: '🌾',
  factory: '🏭',
  shop: '🏪',
  bank: '🏦',
  tech_hub: '💻',
  restaurant: '🍽️',
};

export function PlotDetailView({ plot, business, onClose, onBuild, lang = 'ru' }) {
  if (!plot) return null;

  const zoneColor = ZONE_COLORS[plot.zone] || ZONE_COLORS.outskirts;
  const zoneName = ZONE_NAMES[plot.zone]?.[lang] || plot.zone;

  return (
    <Dialog open={!!plot} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl glass-panel border-grid-border">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyber-cyan" />
              <span className="font-unbounded">
                {lang === 'ru' ? 'Участок' : lang === 'zh' ? '地块' : 'Plot'} ({plot.x}, {plot.y})
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Визуализация участка */}
          <div className="space-y-4">
            <Stage width={300} height={300} className="rounded-lg overflow-hidden border-2 border-grid-border">
              <Layer>
                {/* Земля */}
                <Rect
                  x={0}
                  y={0}
                  width={300}
                  height={300}
                  fill={zoneColor}
                  opacity={0.3}
                />
                
                {/* Бизнес (если есть) */}
                {business && (
                  <KonvaText
                    x={150}
                    y={150}
                    text={BUSINESS_ICONS[business.type] || '🏢'}
                    fontSize={100}
                    offsetX={50}
                    offsetY={50}
                  />
                )}
                
                {/* Если пустая земля - показать травку */}
                {!business && (
                  <>
                    <KonvaText x={50} y={80} text="🌿" fontSize={40} />
                    <KonvaText x={150} y={120} text="🌿" fontSize={40} />
                    <KonvaText x={100} y={160} text="🌿" fontSize={40} />
                    <KonvaText x={200} y={100} text="🌿" fontSize={40} />
                    <KonvaText x={180} y={180} text="🌿" fontSize={40} />
                  </>
                )}
              </Layer>
            </Stage>

            <div className="flex items-center justify-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: zoneColor }}
              />
              <span className="text-sm font-medium">{zoneName}</span>
            </div>
          </div>

          {/* Информация */}
          <div className="space-y-4">
            {/* Зона и координаты */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">
                  {lang === 'ru' ? 'Координаты' : lang === 'zh' ? '坐标' : 'Coordinates'}:
                </span>
                <span className="font-mono">({plot.x}, {plot.y})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">
                  {lang === 'ru' ? 'Зона' : lang === 'zh' ? '区域' : 'Zone'}:
                </span>
                <Badge style={{ backgroundColor: zoneColor + '40', color: zoneColor }}>
                  {zoneName}
                </Badge>
              </div>
            </div>

            {/* Бизнес или возможность постройки */}
            {business ? (
              <div className="p-4 bg-void/50 rounded-lg border border-grid-border space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-neon-purple" />
                  <h4 className="font-bold text-lg">
                    {business.type === 'farm' && (lang === 'ru' ? 'Ферма' : 'Farm')}
                    {business.type === 'factory' && (lang === 'ru' ? 'Завод' : 'Factory')}
                    {business.type === 'shop' && (lang === 'ru' ? 'Магазин' : 'Shop')}
                    {business.type === 'bank' && (lang === 'ru' ? 'Банк' : 'Bank')}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-text-muted">
                      {lang === 'ru' ? 'Уровень' : lang === 'zh' ? '等级' : 'Level'}:
                    </div>
                    <div className="font-bold text-cyber-cyan">{business.level || 1}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">
                      {lang === 'ru' ? 'Доход/день' : lang === 'zh' ? '每日收入' : 'Income/day'}:
                    </div>
                    <div className="font-bold text-success">{business.income_per_day || 0} TON</div>
                  </div>
                </div>

                {business.connections > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span>
                      {business.connections} {lang === 'ru' ? 'связей' : 'connections'} 
                      (+{business.connections * 5}% {lang === 'ru' ? 'дохода' : 'income'})
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-void/50 rounded-lg border border-dashed border-grid-border space-y-3 text-center">
                <div className="text-text-muted text-sm">
                  {lang === 'ru' 
                    ? 'Пустая земля - постройте бизнес!' 
                    : lang === 'zh'
                    ? '空地 - 建造企业!'
                    : 'Empty land - build a business!'}
                </div>
                
                <Button 
                  onClick={onBuild}
                  className="w-full bg-neon-purple hover:bg-neon-purple/80"
                  data-testid="build-business-btn"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Построить бизнес' : lang === 'zh' ? '建造企业' : 'Build Business'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
