import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';
import { 
  Wallet, Building2, MapPin, TrendingUp, ArrowLeft, 
  RefreshCw, ExternalLink, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  getCurrentUser, getTransactions, getAllBusinesses, getLeaderboard 
} from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { formatCity, tonToCity } from '@/lib/currency';

export default function DashboardPage() {
  const navigate = useNavigate();
  const wallet = useTonWallet();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!wallet?.account) {
      navigate('/');
      return;
    }
    loadData();
  }, [wallet]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userData, txData, bizData, leaderData] = await Promise.all([
        getCurrentUser(),
        getTransactions().catch(() => ({ transactions: [] })),
        getAllBusinesses(),
        getLeaderboard(),
      ]);
      
      setUser(userData);
      setTransactions(txData.transactions || []);
      setBusinesses(bizData.businesses?.filter(b => b.owner === wallet?.account?.address) || []);
      setLeaderboard(leaderData.leaderboard || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error(t('loadingError'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTxTypeLabel = (type) => {
    const labels = {
      'purchase_plot': t('purchasePlotTx'),
      'build_business': t('constructionTx'),
      'income': t('incomeTx'),
      'transfer': t('transferTx'),
    };
    return labels[type] || type;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-signal-amber" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-error" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="glass-panel border-b border-grid-border px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/game')}
              className="text-text-muted hover:text-text-main"
              data-testid="back-to-game-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              К карте
            </Button>
            <h1 className="font-unbounded text-xl font-bold text-text-main">
              Dashboard
            </h1>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="border-grid-border"
            data-testid="refresh-dashboard-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyber-cyan-dim flex items-center justify-center">
                <Wallet className="w-5 h-5 text-cyber-cyan" />
              </div>
              <span className="text-text-muted text-sm">Кошелёк</span>
            </div>
            <div className="font-mono text-sm text-cyber-cyan truncate">
              {formatAddress(user?.wallet_address)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyber-cyan-dim flex items-center justify-center">
                <MapPin className="w-5 h-5 text-cyber-cyan" />
              </div>
              <span className="text-text-muted text-sm">Участков</span>
            </div>
            <div className="font-mono text-3xl text-text-main">
              {user?.plots_owned?.length || 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-signal-amber/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-signal-amber" />
              </div>
              <span className="text-text-muted text-sm">Бизнесов</span>
            </div>
            <div className="font-mono text-3xl text-text-main">
              {businesses.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <span className="text-text-muted text-sm">Общий доход</span>
            </div>
            <div className="font-mono text-3xl text-success">
              {formatCity(tonToCity(user?.total_income || 0))} <span className="text-lg">$CITY</span>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="businesses" className="space-y-6">
          <TabsList className="glass-panel border-grid-border">
            <TabsTrigger 
              value="businesses" 
              className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan"
              data-testid="tab-businesses"
            >
              {t('myBusinessesCard')}
            </TabsTrigger>
            <TabsTrigger 
              value="transactions"
              className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan"
              data-testid="tab-transactions"
            >
              {t('transactions')}
            </TabsTrigger>
            <TabsTrigger 
              value="leaderboard"
              className="data-[state=active]:bg-cyber-cyan/10 data-[state=active]:text-cyber-cyan"
              data-testid="tab-leaderboard"
            >
              {t('leaders')}
            </TabsTrigger>
          </TabsList>

          {/* Businesses Tab */}
          <TabsContent value="businesses">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-2xl p-6"
            >
              <h2 className="font-unbounded text-lg font-bold text-text-main mb-6">
                {t('myBusinessesCard')} ({businesses.length})
              </h2>
              
              {businesses.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noBusinessesYet')}</p>
                  <Button
                    className="mt-4 btn-cyber"
                    onClick={() => navigate('/game')}
                    data-testid="go-build-btn"
                  >
                    {t('buildFirstBusiness')}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {businesses.map((biz) => (
                    <div
                      key={biz.id}
                      className="glass-panel rounded-xl p-4 flex items-center gap-4"
                    >
                      <span className="text-4xl">{biz.business_icon}</span>
                      <div className="flex-1">
                        <div className="font-unbounded font-bold text-text-main">
                          {biz.business_name}
                        </div>
                        <div className="text-sm text-text-muted">
                          Координаты: ({biz.x}, {biz.y}) • Уровень {biz.level}
                        </div>
                        {biz.connected_businesses?.length > 0 && (
                          <div className="text-sm text-cyber-cyan">
                            Связей: {biz.connected_businesses.length}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl text-success">
                          +{biz.income_rate?.toFixed(2)}
                        </div>
                        <div className="text-xs text-text-muted">$CITY/день</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-2xl p-6"
            >
              <h2 className="font-unbounded text-lg font-bold text-text-main mb-6">
                История транзакций
              </h2>
              
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Транзакций пока нет</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="glass-panel rounded-lg p-4 flex items-center gap-4"
                      >
                        {getStatusIcon(tx.status)}
                        <div className="flex-1">
                          <div className="font-rajdhani font-semibold text-text-main">
                            {getTxTypeLabel(tx.tx_type)}
                          </div>
                          <div className="text-xs text-text-muted">
                            {formatDate(tx.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg text-signal-amber">
                            -{formatCity(tonToCity(tx.amount_ton))} $CITY
                          </div>
                          {tx.blockchain_hash && (
                            <a
                              href={`https://tonscan.org/tx/${tx.blockchain_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyber-cyan hover:underline inline-flex items-center gap-1"
                            >
                              Explorer <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </motion.div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-2xl p-6"
            >
              <h2 className="font-unbounded text-lg font-bold text-text-main mb-6">
                Таблица лидеров
              </h2>
              
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Данные о лидерах пока недоступны</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((player, index) => (
                    <div
                      key={player.wallet_address}
                      className={`glass-panel rounded-lg p-4 flex items-center gap-4 ${
                        player.wallet_address === user?.wallet_address
                          ? 'border border-cyber-cyan/30'
                          : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold ${
                        index === 0 ? 'bg-signal-amber text-black' :
                        index === 1 ? 'bg-text-muted text-black' :
                        index === 2 ? 'bg-orange-600 text-black' :
                        'bg-panel text-text-muted'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-mono text-sm text-text-main">
                          {player.wallet_address === user?.wallet_address 
                            ? t('youSender') 
                            : formatAddress(player.wallet_address)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {player.plots_count} участков • {player.businesses_count} бизнесов
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg text-success">
                          {(player.total_income || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-text-muted">$CITY заработано</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
