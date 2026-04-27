import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, MapPin, Building2, 
  Zap, Coins, TrendingUp, Users, ArrowRight, CheckCircle2,
  Wallet, ShoppingCart, ArrowUpDown, CreditCard, Landmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: { en: 'Welcome to TON City!', ru: 'Добро пожаловать в TON City!', zh: '欢迎来到TON城市!' },
    description: {
      en: 'This guide will show you how the game works — from buying land to earning and withdrawing TON.',
      ru: 'Этот гид покажет как работает игра — от покупки земли до заработка и вывода TON.',
      zh: '本指南将向您展示游戏如何运作——从购买土地到赚取和提取TON。'
    },
    icon: Building2,
    color: 'cyber-cyan',
    image_url: 'https://images.unsplash.com/photo-1493134799591-2c9eed26201a?w=800&q=80'
  },
  {
    id: 'deposit',
    title: { en: 'Depositing TON', ru: 'Пополнение баланса', zh: '充值TON' },
    description: {
      en: 'To start playing, you need to deposit TON:\n\n1. Click "Deposit" button in the game\n2. Enter the amount you want to deposit\n3. Confirm the transaction in your wallet\n4. Wait for confirmation (~15 seconds)\n5. Your game balance will be credited!\n\nAll in-game purchases use this internal balance.',
      ru: 'Для начала игры нужно пополнить баланс:\n\n1. Нажмите кнопку "Пополнить" в игре\n2. Введите сумму для пополнения\n3. Подтвердите транзакцию в кошельке\n4. Дождитесь подтверждения (~15 сек)\n5. Баланс будет зачислен!\n\nВсе покупки в игре используют этот внутренний баланс.',
      zh: '要开始游戏，您需要充值TON:\n\n1. 点击游戏中的"充值"按钮\n2. 输入要充值的金额\n3. 在钱包中确认交易\n4. 等待确认（约15秒）\n5. 您的游戏余额将被计入！\n\n所有游戏内购买都使用此内部余额。'
    },
    icon: Wallet,
    color: 'success',
    image_url: 'https://images.unsplash.com/photo-1660139099083-03e0777ac6a7?w=800&q=80'
  },
  {
    id: 'buying-plots',
    title: { en: 'Buying Land Plots', ru: 'Покупка участков', zh: '购买土地' },
    description: {
      en: 'How to buy a plot:\n\n1. Look at the map — plots are colored by zone\n2. Select a plot from the list on the right\n3. Click "Buy" and confirm\n4. The plot is now yours!\n\nPrices depend on the zone:\n• Center: 100 TON (highest income)\n• Business: 50 TON\n• Residential: 25 TON\n• Industrial: 15 TON\n• Outskirts: 10 TON (lowest price)',
      ru: 'Как купить участок:\n\n1. Смотрите карту — участки окрашены по зонам\n2. Выберите участок из списка справа\n3. Нажмите "Купить" и подтвердите\n4. Участок ваш!\n\nЦены зависят от зоны:\n• Центр: 100 TON (макс. доход)\n• Бизнес: 50 TON\n• Жилая: 25 TON\n• Промышленная: 15 TON\n• Окраина: 10 TON (мин. цена)',
      zh: '如何购买地块:\n\n1. 查看地图——地块按区域着色\n2. 从右侧列表中选择地块\n3. 点击"购买"并确认\n4. 地块现在是您的了！\n\n价格取决于区域:\n• 中心: 100 TON（最高收入）\n• 商业区: 50 TON\n• 住宅区: 25 TON\n• 工业区: 15 TON\n• 郊区: 10 TON（最低价格）'
    },
    icon: ShoppingCart,
    color: 'cyber-cyan',
    image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80'
  },
  {
    id: 'building',
    title: { en: 'Building Businesses', ru: 'Строительство бизнеса', zh: '建造企业' },
    description: {
      en: 'After buying a plot, build a business:\n\n1. Click on your plot\n2. Choose a business type\n3. Pay the construction cost\n4. Start earning income!\n\nBusiness types:\n🌾 Farm — produces raw materials\n🏭 Factory — processes materials\n🏪 Shop — sells to customers\n🏦 Bank — financial services\n\nEach earns different amounts!',
      ru: 'После покупки участка стройте бизнес:\n\n1. Кликните на свой участок\n2. Выберите тип бизнеса\n3. Оплатите строительство\n4. Начните получать доход!\n\nТипы бизнесов:\n🌾 Ферма — производит сырьё\n🏭 Завод — обрабатывает сырьё\n🏪 Магазин — продаёт клиентам\n🏦 Банк — финансовые услуги\n\nКаждый приносит разный доход!',
      zh: '购买地块后，建造企业:\n\n1. 点击您的地块\n2. 选择企业类型\n3. 支付建设费用\n4. 开始赚取收入！\n\n企业类型:\n🌾 农场——生产原材料\n🏭 工厂——加工材料\n🏪 商店——向客户销售\n🏦 银行——金融服务\n\n每种赚取不同的金额！'
    },
    icon: Building2,
    color: 'neon-purple',
    image_url: 'https://images.unsplash.com/photo-1551295022-de5522c94e08?w=800&q=80'
  },
  {
    id: 'connections',
    title: { en: 'Business Connections', ru: 'Связи бизнесов', zh: '商业联系' },
    description: {
      en: 'Nearby businesses boost each other:\n\n• Each connection = +5% income\n• Maximum 5 connections per business\n• Farm next to Factory = both earn more\n• Factory next to Shop = both earn more\n\nStrategy tip:\nBuild related businesses close together!',
      ru: 'Соседние бизнесы усиливают друг друга:\n\n• Каждая связь = +5% дохода\n• Максимум 5 связей на бизнес\n• Ферма рядом с Заводом = оба зарабатывают больше\n• Завод рядом с Магазином = оба зарабатывают больше\n\nСовет:\nСтройте связанные бизнесы рядом!',
      zh: '相邻企业相互增强:\n\n• 每个联系 = +5%收入\n• 每个企业最多5个联系\n• 农场靠近工厂 = 双方都赚更多\n• 工厂靠近商店 = 双方都赚更多\n\n策略提示:\n将相关企业建在一起！'
    },
    icon: Zap,
    color: 'success',
    image_url: 'https://images.unsplash.com/photo-1480944657103-7fed22359e1d?w=800&q=80'
  },
  {
    id: 'trading',
    title: { en: 'Trading Resources', ru: 'Торговля ресурсами', zh: '资源交易' },
    description: {
      en: 'Trade with other players:\n\n1. Go to "Trading" page\n2. Create a sell offer:\n   • Choose resource type\n   • Set quantity and price\n3. Or buy from others:\n   • Browse market listings\n   • Click "Buy" on desired offer\n\nCommission: 5% on each trade\n\nTip: Watch market prices to buy low, sell high!',
      ru: 'Торгуйте с другими игроками:\n\n1. Перейдите на страницу "Торговля"\n2. Создайте предложение продажи:\n   • Выберите тип ресурса\n   • Укажите количество и цену\n3. Или покупайте у других:\n   • Смотрите листинги рынка\n   • Нажмите "Купить" на нужном\n\nКомиссия: 5% с каждой сделки\n\nСовет: следите за ценами — покупайте дёшево, продавайте дорого!',
      zh: '与其他玩家交易:\n\n1. 转到"交易"页面\n2. 创建卖出报价:\n   • 选择资源类型\n   • 设置数量和价格\n3. 或从他人处购买:\n   • 浏览市场列表\n   • 点击所需报价上的"购买"\n\n佣金: 每笔交易5%\n\n提示: 关注市场价格，低买高卖！'
    },
    icon: ArrowUpDown,
    color: 'signal-amber',
    image_url: 'https://images.unsplash.com/photo-1719464521902-4dc9595b182d?w=800&q=80'
  },
  {
    id: 'taxes',
    title: { en: 'Taxes & Fees', ru: 'Налоги и комиссии', zh: '税费' },
    description: {
      en: 'The city collects:\n\n📊 Income Tax (progressive):\n• Base: 13%\n• >15% market share: 18%\n• >20% market share: 25%\n• >25% market share: 35%\n\n💸 Other fees:\n• Plot resale: 15%\n• Trading: 5%\n• Withdrawal: 3%\n\nTaxes fund the game economy!',
      ru: 'Город взимает:\n\n📊 Налог на доход (прогрессивный):\n• Базовый: 13%\n• >15% рынка: 18%\n• >20% рынка: 25%\n• >25% рынка: 35%\n\n💸 Другие комиссии:\n• Перепродажа участка: 15%\n• Торговля: 5%\n• Вывод: 3%\n\nНалоги поддерживают экономику игры!',
      zh: '城市收取:\n\n📊 所得税（累进）:\n• 基础: 13%\n• >15%市场份额: 18%\n• >20%市场份额: 25%\n• >25%市场份额: 35%\n\n💸 其他费用:\n• 地块转售: 15%\n• 交易: 5%\n• 提款: 3%\n\n税收为游戏经济提供资金！'
    },
    icon: Landmark,
    color: 'signal-amber',
    image_url: 'https://images.unsplash.com/photo-1765868017260-6e22bbf96095?w=800&q=80'
  },
  {
    id: 'withdrawal',
    title: { en: 'Withdrawing TON', ru: 'Вывод средств', zh: '提取TON' },
    description: {
      en: 'To withdraw your earnings:\n\n1. Click "Withdraw" in the game\n2. Enter the amount\n3. Check the fees:\n   • Commission: 3%\n   • Network fee: ~0.01 TON\n4. Confirm the request\n5. Admin approves → TON sent to your wallet!\n\nMinimum withdrawal: 1 TON\nProcessing time: up to 24 hours',
      ru: 'Чтобы вывести заработанное:\n\n1. Нажмите "Вывести" в игре\n2. Введите сумму\n3. Проверьте комиссии:\n   • Комиссия: 3%\n   • Сетевая: ~0.01 TON\n4. Подтвердите запрос\n5. Админ одобряет → TON на вашем кошельке!\n\nМинимум для вывода: 1 TON\nВремя обработки: до 24 часов',
      zh: '提取您的收益:\n\n1. 在游戏中点击"提取"\n2. 输入金额\n3. 检查费用:\n   • 佣金: 3%\n   • 网络费: ~0.01 TON\n4. 确认请求\n5. 管理员批准 → TON发送到您的钱包！\n\n最低提款: 1 TON\n处理时间: 最多24小时'
    },
    icon: CreditCard,
    color: 'error',
    image_url: 'https://images.unsplash.com/photo-1681826291722-70bd7e9e6fc3?w=800&q=80'
  },
  {
    id: 'strategy',
    title: { en: 'Winning Strategy', ru: 'Выигрышная стратегия', zh: '制胜策略' },
    description: {
      en: '1. Start with cheap plots on outskirts\n2. Build farms (low cost, quick ROI)\n3. Save up for a factory nearby\n4. Create connections between them\n5. Build shop in business zone\n6. Level up your businesses\n7. Reinvest profits wisely!\n\nDiversify to reduce risks!',
      ru: '1. Начните с дешёвых участков на окраине\n2. Стройте фермы (низкая цена, быстрая окупаемость)\n3. Накопите на завод поблизости\n4. Создайте связи между ними\n5. Постройте магазин в бизнес-зоне\n6. Прокачивайте бизнесы\n7. Реинвестируйте прибыль!\n\nДиверсифицируйте для снижения рисков!',
      zh: '1. 从郊区的便宜地块开始\n2. 建造农场（低成本，快速回报）\n3. 攒钱在附近建工厂\n4. 在它们之间建立联系\n5. 在商业区建商店\n6. 升级您的企业\n7. 明智地再投资利润！\n\n多元化以降低风险！'
    },
    icon: CheckCircle2,
    color: 'success',
    image_url: 'https://images.unsplash.com/photo-1523875194681-bedd468c58bf?w=800&q=80'
  }
];

export function TutorialModal({ isOpen, onClose, lang = 'ru' }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  
  const next = () => {
    if (isLast) {
      onClose();
      setCurrentStep(0);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const prev = () => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleClose = () => {
    onClose();
    setCurrentStep(0);
  };
  
  const Icon = step?.icon || Building2;
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-panel border-grid-border text-text-main max-w-lg p-0 overflow-hidden" hideCloseButton>
        <VisuallyHidden>
          <DialogTitle>
            {step?.title[lang] || step?.title?.en || 'Tutorial'}
          </DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <div className="bg-void/50 p-6 border-b border-grid-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-${step?.color || 'cyber-cyan'}/20 flex items-center justify-center`}>
                <Icon className={`w-6 h-6 text-${step?.color || 'cyber-cyan'}`} />
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">
                  {lang === 'ru' ? 'Шаг' : 'Step'} {currentStep + 1}/{TUTORIAL_STEPS.length}
                </div>
                <h2 className="font-unbounded text-lg font-bold">
                  {step?.title[lang] || step?.title.en}
                </h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-text-muted hover:text-text-main"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="flex gap-1">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentStep ? 'bg-cyber-cyan' : 'bg-grid-border'
                }`}
              />
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step?.image_url && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-grid-border">
                  <img 
                    src={step.image_url} 
                    alt={step.title[lang] || step.title.en}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-text-muted whitespace-pre-line leading-relaxed text-sm">
                {step?.description[lang] || step?.description.en}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-grid-border flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={isFirst}
            className="text-text-muted"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Назад' : 'Back'}
          </Button>
          
          <Button
            onClick={next}
            className="btn-cyber"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Начать игру!' : 'Start Playing!'}
              </>
            ) : (
              <>
                {lang === 'ru' ? 'Далее' : 'Next'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TutorialModal;
