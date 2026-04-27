import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, Factory, Coins, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getResource } from '@/lib/resourceConfig';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { tonToCity, formatCity } from '@/lib/currency';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TIER_COLORS = {
  1: { bg: 'from-green-900/40 to-green-800/20', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400', label: 'I Эшелон: Ресурсы' },
  2: { bg: 'from-yellow-900/40 to-yellow-800/20', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-400', label: 'II Эшелон: Производство' },
  3: { bg: 'from-red-900/40 to-red-800/20', border: 'border-red-500/30', badge: 'bg-red-500/20 text-red-400', label: 'III Эшелон: Инфраструктура' },
};

// Level multipliers for production
const LEVEL_MULTIPLIERS = {
  1: 1.0, 2: 1.2, 3: 1.5, 4: 1.8, 5: 2.2,
  6: 2.7, 7: 3.3, 8: 4.0, 9: 5.0, 10: 6.5
};

export default function IncomeTablePage({ user }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [businesses, setBusinesses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Calculator state
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [level, setLevel] = useState(1);
  const [durability, setDurability] = useState(100);
  const [pricePerUnit, setPricePerUnit] = useState(0.01);
  const [result, setResult] = useState(null);

  // Tax settings
  const [taxRate, setTaxRate] = useState(10);
  
  useEffect(() => {
    loadBusinesses();
    loadTaxSettings();
  }, []);

  const loadTaxSettings = async () => {
    try {
      const response = await axios.get(`${API}/public/tax-settings`);
      setTaxRate(response.data.land_business_sale_tax || 10);
    } catch (error) {
      console.error('Failed to load tax settings:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      const response = await axios.get(`${API}/stats/income-table?lang=ru`);
      setBusinesses(response.data.income_table || {});
      const firstKey = Object.keys(response.data.income_table || {})[0];
      if (firstKey) setSelectedBusiness(firstKey);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateIncome = () => {
    if (!selectedBusiness || !businesses[selectedBusiness]) return;
    
    const biz = businesses[selectedBusiness];
    const levelKey = `L${level}`;
    const baseProduction = biz.levels?.[levelKey]?.production || biz.levels?.[level]?.production || biz.production_rate || 100;
    
    // Calculate effective production based on level and durability
    const levelMult = LEVEL_MULTIPLIERS[level] || 1;
    const durabilityMult = durability / 100;
    
    // Production per hour
    const productionPerHour = (baseProduction * levelMult * durabilityMult) / 24;
    const productionPerDay = baseProduction * levelMult * durabilityMult;
    const productionPerMonth = productionPerDay * 30;
    
    // Income calculation based on user-defined price (before tax)
    const grossIncomePerDay = productionPerDay * pricePerUnit;
    const grossIncomePerMonth = productionPerMonth * pricePerUnit;
    
    // Apply tax
    const taxMultiplier = 1 - (taxRate / 100);
    const netIncomePerDay = grossIncomePerDay * taxMultiplier;
    const netIncomePerMonth = grossIncomePerMonth * taxMultiplier;
    
    setResult({
      productionPerHour: productionPerHour.toFixed(2),
      productionPerDay: productionPerDay.toFixed(2),
      productionPerMonth: productionPerMonth.toFixed(0),
      grossIncomePerDay: grossIncomePerDay.toFixed(4),
      grossIncomePerMonth: grossIncomePerMonth.toFixed(2),
      netIncomePerDay: netIncomePerDay.toFixed(4),
      netIncomePerMonth: netIncomePerMonth.toFixed(2),
      taxAmount: (grossIncomePerMonth - netIncomePerMonth).toFixed(2),
      taxRate: taxRate,
      produces: biz.produces,
      businessName: biz.name,
      businessIcon: biz.icon
    });
  };

  const bizData = businesses[selectedBusiness];

  if (isLoading) {
    return (
      <div className="flex h-screen bg-void">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center lg:ml-16">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-hidden lg:ml-16">
        <ScrollArea className="h-full">
          <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-3 py-3">
              <div className="max-w-4xl mx-auto flex items-center gap-2 min-h-[40px]">
                {/* Space for burger menu on mobile */}
                <div className="lg:hidden w-10 flex-shrink-0" />
                <Calculator className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <h1 className="text-base sm:text-lg font-bold text-white">{t('incomeCalculator')}</h1>
              </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 space-y-6">
              {/* Calculator Card */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Factory className="w-5 h-5 text-cyan-400" />
                    {t('selectBusiness')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Business Selector */}
                  <div className="space-y-2">
                    <Label className="text-gray-400">{t('selectBusinessPlaceholder')}</Label>
                    <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder={t('selectBusinessPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {Object.entries(businesses).map(([key, biz]) => (
                          <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">
                            <span className="flex items-center gap-2">
                              <span>{biz.icon}</span>
                              <span>{biz.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_COLORS[biz.tier]?.badge}`}>
                                Tier {biz.tier}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {bizData?.produces && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <span>{t('producesLabel')}:</span>
                        <span className="text-cyan-400">
                          {getResource(bizData.produces).icon} {getResource(bizData.produces).name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Level Selector */}
                  <div className="space-y-2">
                    <Label className="text-gray-400">{t('levelLabel')}: {level}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => (
                        <button
                          key={l}
                          onClick={() => setLevel(l)}
                          className={`w-10 h-10 rounded-lg font-bold transition-all ${
                            level === l
                              ? 'bg-cyan-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('production')}: x{LEVEL_MULTIPLIERS[level]}
                    </div>
                  </div>

                  {/* Durability Slider */}
                  <div className="space-y-2">
                    <Label className="text-gray-400">{t('durabilityLabel')}: {durability}%</Label>
                    <Slider
                      value={[durability]}
                      onValueChange={([val]) => setDurability(val)}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span className={durability < 30 ? 'text-red-400' : durability < 70 ? 'text-yellow-400' : 'text-green-400'}>
                        {durability < 30 ? t('criticallyLow') : durability < 70 ? t('averageDurability') : t('goodDurability')}
                      </span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Price Per Unit */}
                  <div className="space-y-2">
                    <Label className="text-gray-400">{t('pricePerUnitCity') || 'Цена за единицу товара ($CITY)'}</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                      className="bg-gray-800 border-gray-700 text-white"
                      placeholder="0.01"
                    />
                    <div className="text-xs text-gray-500">
                      Укажите цену, по которой планируете продавать ресурс на маркетплейсе
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <Button 
                    onClick={calculateIncome} 
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    data-testid="calculate-btn"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Рассчитать
                  </Button>
                </CardContent>
              </Card>

              {/* Results Card */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-3">
                        <span className="text-3xl">{result.businessIcon}</span>
                        <div>
                          <div>{result.businessName}</div>
                          <div className="text-sm text-gray-400 font-normal">
                            Уровень {level} • Прочность {durability}%
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Production Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                          <div className="text-xs text-gray-400 uppercase mb-1">{t('productionPerHour') || 'Производство в час'}</div>
                          <div className="text-xl font-bold text-cyan-400">
                            {result.productionPerHour} {getResource(result.produces)?.icon}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                          <div className="text-xs text-gray-400 uppercase mb-1">{t('productionPerDay') || 'Производство в сутки'}</div>
                          <div className="text-xl font-bold text-cyan-400">
                            {result.productionPerDay} {getResource(result.produces)?.icon}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                          <div className="text-xs text-gray-400 uppercase mb-1">{t('productionPerMonth') || 'Производство в месяц'}</div>
                          <div className="text-xl font-bold text-cyan-400">
                            {result.productionPerMonth} {getResource(result.produces)?.icon}
                          </div>
                        </div>
                      </div>

                      {/* Income Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-500/30">
                          <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            Доход до налога
                          </div>
                          <div className="text-xl font-bold text-yellow-400">
                            {formatCity(tonToCity(parseFloat(result.grossIncomePerDay)))} $CITY/день
                          </div>
                          <div className="text-sm text-yellow-400/80">
                            {formatCity(tonToCity(parseFloat(result.grossIncomePerMonth)))} $CITY/мес
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30">
                          <div className="text-xs text-gray-400 uppercase mb-1">
                            Налог ({result.taxRate}%)
                          </div>
                          <div className="text-xl font-bold text-red-400">
                            -{formatCity(tonToCity(parseFloat(result.taxAmount)))} $CITY/мес
                          </div>
                        </div>
                      </div>
                      
                      {/* Net Income Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-green-900/30 border border-green-500/30">
                          <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            Чистый доход в сутки
                          </div>
                          <div className="text-2xl font-bold text-green-400">
                            {formatCity(tonToCity(parseFloat(result.netIncomePerDay)))} $CITY
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            При цене {formatCity(tonToCity(pricePerUnit))} $CITY за единицу
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-green-900/30 border border-green-500/30">
                          <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Чистый доход в месяц
                          </div>
                          <div className="text-2xl font-bold text-green-400">
                            {formatCity(tonToCity(parseFloat(result.netIncomePerMonth)))} $CITY
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            ~{formatCity(tonToCity(parseFloat(result.netIncomePerMonth) * 12))} $CITY/год
                          </div>
                        </div>
                      </div>

                      {/* Info Note */}
                      <div className="p-3 rounded-xl bg-cyan-900/20 border border-cyan-500/30 flex items-start gap-2">
                        <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-cyan-200/80">
                          Расчёт учитывает налог на продажу ({result.taxRate}%). 
                          Фактический доход зависит от реальной цены продажи на рынке и наличия покупателей.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
