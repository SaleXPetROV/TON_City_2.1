import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, Shield, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TreasuryWarning({ treasuryStats, lang = 'ru' }) {
  const [dismissed, setDismissed] = useState(false);
  
  if (!treasuryStats || dismissed) return null;
  
  // Calculate treasury health
  const totalIncome = (treasuryStats.plot_sales_income || 0) + 
                      (treasuryStats.building_sales_income || 0) + 
                      (treasuryStats.total_tax || 0) + 
                      (treasuryStats.withdrawal_fees || 0);
  
  const totalPayouts = treasuryStats.total_withdrawals || 0;
  const pendingWithdrawals = treasuryStats.pending_withdrawals_amount || 0;
  const totalDeposits = treasuryStats.total_deposits || 0;
  
  // Net treasury position
  const netTreasury = totalIncome + totalDeposits - totalPayouts;
  const availableForWithdrawal = netTreasury - pendingWithdrawals;
  
  // Warning levels
  const warningLevel = 
    availableForWithdrawal < 0 ? 'critical' :
    availableForWithdrawal < totalPayouts * 0.1 ? 'warning' :
    availableForWithdrawal < totalPayouts * 0.3 ? 'caution' : 'healthy';
  
  // Calculate sustainability metrics
  const avgDailyWithdrawals = totalPayouts / Math.max(1, treasuryStats.days_active || 30);
  const runwayDays = availableForWithdrawal > 0 ? Math.floor(availableForWithdrawal / Math.max(0.01, avgDailyWithdrawals)) : 0;
  
  const messages = {
    critical: {
      en: 'CRITICAL: Treasury is in deficit! Do NOT approve withdrawals until more deposits/income arrive.',
      ru: 'КРИТИЧНО: Казна в дефиците! НЕ одобряйте выводы пока не поступят депозиты/доход.'
    },
    warning: {
      en: 'WARNING: Treasury reserves are low. Be cautious with withdrawal approvals.',
      ru: 'ВНИМАНИЕ: Резервы казны низкие. Будьте осторожны с одобрением выводов.'
    },
    caution: {
      en: 'CAUTION: Treasury is healthy but reserves could be higher.',
      ru: 'ОСТОРОЖНО: Казна здорова, но резервы могли бы быть выше.'
    },
    healthy: {
      en: 'Treasury is healthy. Safe to approve withdrawals.',
      ru: 'Казна здорова. Безопасно одобрять выводы.'
    }
  };
  
  const colors = {
    critical: 'bg-red-500/10 border-red-500/50 text-red-400',
    warning: 'bg-orange-500/10 border-orange-500/50 text-orange-400',
    caution: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400',
    healthy: 'bg-green-500/10 border-green-500/50 text-green-400'
  };
  
  const icons = {
    critical: AlertTriangle,
    warning: TrendingDown,
    caution: Info,
    healthy: Shield
  };
  
  const Icon = icons[warningLevel];
  
  if (warningLevel === 'healthy') return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 mb-6 ${colors[warningLevel]}`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          warningLevel === 'critical' ? 'bg-red-500/20' :
          warningLevel === 'warning' ? 'bg-orange-500/20' : 'bg-yellow-500/20'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-unbounded font-bold mb-2">
            {warningLevel === 'critical' ? '🚨 ' : warningLevel === 'warning' ? '⚠️ ' : 'ℹ️ '}
            {lang === 'ru' ? 'Состояние казны' : 'Treasury Status'}
          </h3>
          
          <p className="text-sm mb-4">
            {messages[warningLevel][lang]}
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="glass-panel rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">
                {lang === 'ru' ? 'Общий доход' : 'Total Income'}
              </div>
              <div className="font-mono text-success">+{totalIncome.toFixed(2)} TON</div>
            </div>
            
            <div className="glass-panel rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">
                {lang === 'ru' ? 'Депозиты' : 'Deposits'}
              </div>
              <div className="font-mono text-cyber-cyan">+{totalDeposits.toFixed(2)} TON</div>
            </div>
            
            <div className="glass-panel rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">
                {lang === 'ru' ? 'Выплачено' : 'Paid Out'}
              </div>
              <div className="font-mono text-error">-{totalPayouts.toFixed(2)} TON</div>
            </div>
            
            <div className="glass-panel rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">
                {lang === 'ru' ? 'Доступно' : 'Available'}
              </div>
              <div className={`font-mono ${availableForWithdrawal >= 0 ? 'text-success' : 'text-error'}`}>
                {availableForWithdrawal.toFixed(2)} TON
              </div>
            </div>
          </div>
          
          {pendingWithdrawals > 0 && (
            <div className="mt-4 p-3 glass-panel rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">
                  {lang === 'ru' ? 'Ожидающие выводы:' : 'Pending Withdrawals:'}
                </span>
                <span className="font-mono text-signal-amber">{pendingWithdrawals.toFixed(2)} TON</span>
              </div>
            </div>
          )}
          
          {runwayDays > 0 && runwayDays < 30 && (
            <div className="mt-3 text-xs text-text-muted">
              {lang === 'ru' 
                ? `При текущих темпах выводов, резервов хватит на ~${runwayDays} дней`
                : `At current withdrawal rate, reserves will last ~${runwayDays} days`
              }
            </div>
          )}
          
          {warningLevel === 'critical' && (
            <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
              <div className="font-bold text-sm mb-2">
                {lang === 'ru' ? 'Рекомендации:' : 'Recommendations:'}
              </div>
              <ul className="text-xs space-y-1">
                <li>• {lang === 'ru' ? 'Не одобряйте новые выводы' : 'Do not approve new withdrawals'}</li>
                <li>• {lang === 'ru' ? 'Дождитесь новых депозитов' : 'Wait for new deposits'}</li>
                <li>• {lang === 'ru' ? 'Проверьте настройки комиссий' : 'Review commission settings'}</li>
                <li>• {lang === 'ru' ? 'Рассмотрите пополнение казны' : 'Consider treasury top-up'}</li>
              </ul>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-main flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export default TreasuryWarning;
