import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2, Landmark } from 'lucide-react';

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

const BUSINESS_NAMES = {
  farm: { en: 'Farm', ru: 'Ферма', zh: '农场' },
  factory: { en: 'Factory', ru: 'Завод', zh: '工厂' },
  shop: { en: 'Shop', ru: 'Магазин', zh: '商店' },
  bank: { en: 'Bank', ru: 'Банк', zh: '银行' },
  tech_hub: { en: 'Tech Hub', ru: 'Тех центр', zh: '科技中心' },
  restaurant: { en: 'Restaurant', ru: 'Ресторан', zh: '餐厅' },
};

export function MyPlotsModal({ isOpen, onClose, plots = [], onPlotSelect, lang = 'ru' }) {
  if (!isOpen) return null;

  const groupedPlots = plots.reduce((acc, plot) => {
    const zone = plot.zone || 'outskirts';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(plot);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl glass-panel border-grid-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-cyber-cyan" />
            <span className="font-unbounded">
              {lang === 'ru' ? 'Мои территории' : lang === 'zh' ? '我的地块' : 'My Plots'}
            </span>
            <Badge variant="secondary" className="ml-2">
              {plots.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {plots.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {lang === 'ru' 
                ? 'У вас пока нет участков. Купите участок на карте!' 
                : lang === 'zh'
                ? '您还没有地块。在地图上购买！'
                : 'You don\'t have any plots yet. Buy one on the map!'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {Object.entries(groupedPlots).map(([zone, zonePlots]) => (
                <div key={zone} className="space-y-2">
                  <div className="flex items-center gap-2 sticky top-0 bg-void/90 backdrop-blur py-2 z-10">
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: ZONE_COLORS[zone] }}
                    />
                    <h4 className="font-bold text-sm uppercase tracking-wider">
                      {ZONE_NAMES[zone]?.[lang] || zone}
                    </h4>
                    <Badge variant="outline" className="ml-auto">
                      {zonePlots.length}
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    {zonePlots.map((plot) => (
                      <Button
                        key={plot.id || `${plot.x}-${plot.y}`}
                        onClick={() => {
                          onPlotSelect(plot);
                          onClose();
                        }}
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto hover:bg-cyber-cyan/10 border border-transparent hover:border-cyber-cyan/50"
                        data-testid={`plot-${plot.x}-${plot.y}`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-text-muted" />
                            <span className="font-mono text-sm">
                              ({plot.x}, {plot.y})
                            </span>
                          </div>

                          {plot.business_id && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-neon-purple" />
                              <span className="text-sm">
                                {BUSINESS_NAMES[plot.business_type]?.[lang] || plot.business_type}
                              </span>
                              {plot.business_level && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: ZONE_COLORS[zone] + '30',
                                    color: ZONE_COLORS[zone]
                                  }}
                                >
                                  Lvl {plot.business_level}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {plot.daily_income > 0 && (
                          <div className="text-success text-sm font-mono">
                            +{plot.daily_income} TON/
                            {lang === 'ru' ? 'день' : lang === 'zh' ? '天' : 'day'}
                          </div>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
