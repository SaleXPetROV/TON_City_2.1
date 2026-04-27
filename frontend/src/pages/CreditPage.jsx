import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, Building2, Coins, AlertCircle, Loader2, ChevronDown,
  Check, Clock, Percent, ArrowRight, Shield, Banknote, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { formatCity, tonToCity } from '@/lib/currency';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function CreditPage({ user, refreshBalance, updateBalance }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [loans, setLoans] = useState([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [creditCalc, setCreditCalc] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [lenderType, setLenderType] = useState('government');
  const [amount, setAmount] = useState('');
  const [deductionPercent, setDeductionPercent] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  
  // Repay modal
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [loansRes, bizRes] = await Promise.all([
        fetch(`${API}/credit/my-loans`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/my/businesses`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      let activeLoans = [];
      if (loansRes.ok) {
        const data = await loansRes.json();
        const allLoans = data.loans || [];
        setLoans(allLoans);
        setTotalDebt(data.total_debt || 0);
        activeLoans = allLoans.filter(l => l.status === 'active' || l.status === 'overdue');
      }
      if (bizRes.ok) {
        const data = await bizRes.json();
        const allBiz = data.businesses || [];
        // Filter out businesses already pledged as collateral in active/overdue loans
        const pledgedIds = new Set(activeLoans.map(l => l.collateral_business_id));
        setBusinesses(allBiz.filter(b => !pledgedIds.has(b.id)));
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const calculateCredit = async (bizId) => {
    setCalcLoading(true);
    setCreditCalc(null);
    try {
      const res = await fetch(`${API}/credit/calculate/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCreditCalc(data);
      } else {
        const err = await res.json();
        toast.error(err.detail || t('calcError'));
      }
    } catch (e) { toast.error(t('calcError')); }
    finally { setCalcLoading(false); }
  };

  const handleApply = async () => {
    if (!selectedBusiness || !amount || !deductionPercent) {
      toast.error(t('fillAllFieldsCredit'));
      return;
    }
    setIsApplying(true);
    try {
      const res = await fetch(`${API}/credit/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          collateral_business_id: selectedBusiness,
          amount: parseFloat(amount) / 1000,  // Convert $CITY to TON for backend
          salary_deduction_percent: parseFloat(deductionPercent),
          lender_type: lenderType,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || t('error'));
      }
      const data = await res.json();
      toast.success(`Кредит одобрен! Получено ${formatCity(tonToCity(data.amount))} $CITY`);
      setShowApplyModal(false);
      setSelectedBusiness('');
      setCreditCalc(null);
      setAmount('');
      setDeductionPercent('');
      fetchData();
      // Обновляем баланс в sidebar
      if (refreshBalance) refreshBalance();
      if (updateBalance) updateBalance(data.amount);
    } catch (e) { toast.error(e.message); }
    finally { setIsApplying(false); }
  };

  const handleRepay = async () => {
    if (!selectedLoan) return;
    setIsRepaying(true);
    try {
      const payAmt = repayAmount ? parseFloat(repayAmount) / 1000 : 0;  // Convert $CITY to TON
      const res = await fetch(`${API}/credit/repay/${selectedLoan.id}?amount=${payAmt}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || t('error'));
      }
      const data = await res.json();
      toast.success(data.status === 'paid' ? t('creditPaidFull') : `${t('paidAmountMsg').replace('{amount}', data.paid_amount)}`);
      setShowRepayModal(false);
      setRepayAmount('');
      fetchData();
      // Обновляем баланс в sidebar (вычитаем погашенную сумму)
      if (refreshBalance) refreshBalance();
      if (updateBalance) updateBalance(-data.paid_amount);
    } catch (e) { toast.error(e.message); }
    finally { setIsRepaying(false); }
  };

  const maxDeduction = 40; // Both government and bank now have 40% max

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-void">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar user={user} />
      <main className="flex-1 p-4 lg:p-6 pt-4 lg:pt-6 lg:ml-16">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header - close to burger menu on mobile */}
          <div className="sm:pl-0">
            <PageHeader 
              icon={<Landmark className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />}
              title={t('creditPageTitle')}
              subtitle={t('loansSubtitle')}
              actionButtons={
                <Button onClick={fetchData} variant="outline" size="icon" className="border-white/10 h-8 w-8 sm:h-10 sm:w-10">
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              }
            />
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-void border-amber-500/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Coins className="w-8 h-8 text-amber-400" />
                <div>
                  <div className="text-2xl font-bold text-amber-400">{formatCity(tonToCity(totalDebt))} $CITY</div>
                  <div className="text-xs text-text-muted">{t('totalDebtLabel')}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-void border-green-500/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Check className="w-8 h-8 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {loans.filter(l => l.status === 'paid').length}
                  </div>
                  <div className="text-xs text-text-muted">{t('repaidLabel')}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-void border-red-500/30">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <div>
                  <div className="text-2xl font-bold text-red-400">
                    {loans.filter(l => l.status === 'overdue').length}
                  </div>
                  <div className="text-xs text-text-muted">{t('overdueLabel')}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Loans */}
          <div>
            <h2 className="text-lg font-bold text-white mb-3">{t('myCreditsTitle')}</h2>
            {loans.length === 0 ? (
              <Card className="bg-void border-white/10">
                <CardContent className="p-8 text-center">
                  <Landmark className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-text-muted mb-5">{t('noCreditsMsg')}</p>
                  <Button
                    data-testid="apply-credit-btn"
                    onClick={() => setShowApplyModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-black"
                    disabled={businesses.length === 0}
                  >
                    <Banknote className="w-4 h-4 mr-1.5" />
                    {t('takeCreditBtn')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {loans.map(loan => (
                  <Card key={loan.id} className={`bg-void border ${
                    loan.status === 'overdue' ? 'border-red-500/50' :
                    loan.status === 'active' ? 'border-amber-500/30' :
                    loan.status === 'paid' ? 'border-green-500/30' : 'border-white/10'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={
                              loan.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                              loan.status === 'active' ? 'bg-amber-500/20 text-amber-400' :
                              loan.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              'bg-gray-500/20 text-gray-400'
                            }>
                              {loan.status === 'active' ? t('statusActive') :
                               loan.status === 'overdue' ? t('statusOverdue') :
                               loan.status === 'paid' ? t('statusPaid') : t('statusSeized')}
                            </Badge>
                            <span className="text-xs text-text-muted">{loan.lender_name}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div>
                              <div className="text-text-muted text-xs">{t('amountLabel')}</div>
                              <div className="text-white font-mono">{formatCity(tonToCity(loan.amount))} $CITY</div>
                            </div>
                            <div>
                              <div className="text-text-muted text-xs">{t('rateLabel')}</div>
                              <div className="text-white font-mono">{(loan.interest_rate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <div className="text-text-muted text-xs">{t('remainingLabel')}</div>
                              <div className="text-amber-400 font-mono font-bold">{formatCity(tonToCity(loan.remaining || 0))} $CITY</div>
                            </div>
                            <div>
                              <div className="text-text-muted text-xs">{t('deductionLabel')}</div>
                              <div className="text-white font-mono">{(loan.salary_deduction_percent * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                          {/* Progress */}
                          {loan.total_debt > 0 && (
                            <div className="mt-2">
                              <Progress value={(loan.paid / loan.total_debt) * 100} className="h-1.5" />
                              <div className="text-xs text-text-muted mt-1">
                                {t('paidOfTotal').replace('{paid}', formatCity(tonToCity(loan.paid || 0))).replace('{total}', formatCity(tonToCity(loan.total_debt || 0)))} $CITY
                              </div>
                            </div>
                          )}
                          {loan.status === 'overdue' && (
                            <div className="mt-2 text-red-400 text-xs flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {t('overdueWarning')}
                            </div>
                          )}
                        </div>
                        {(loan.status === 'active' || loan.status === 'overdue') && (
                          <Button
                            data-testid={`repay-btn-${loan.id}`}
                            onClick={() => { setSelectedLoan(loan); setShowRepayModal(true); }}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Coins className="w-4 h-4 mr-1" />
                            {t('repayBtn')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {/* Take Loan button - below last active loan */}
                <div className="flex justify-start pt-2">
                  <Button
                    data-testid="apply-credit-btn"
                    onClick={() => setShowApplyModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-black"
                    disabled={businesses.length === 0}
                  >
                    <Banknote className="w-4 h-4 mr-1.5" />
                    {t('takeCreditBtn')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Apply Credit Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="bg-void border-amber-500/30 w-[calc(100%-2rem)] max-w-lg mx-auto max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-amber-400" />
              Оформить кредит
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Step 1: Select collateral business */}
            <div>
              <Label>{t('collateralStep')}</Label>
              <Select value={selectedBusiness} onValueChange={(v) => {
                setSelectedBusiness(v);
                setCreditCalc(null);
                setAmount('');
                calculateCredit(v);
              }}>
                <SelectTrigger className="bg-white/5 border-white/10 h-12" data-testid="collateral-select">
                  <SelectValue placeholder={t('selectBusinessPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <span>{b.config?.icon || '🏢'}</span>
                        <span>{b.config?.name?.ru || b.business_type} (Ур. {b.level})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {calcLoading && <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>}

            {creditCalc && (
              <>
                {/* Info */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-muted">{t('businessCostLabel') || 'Стоимость бизнеса + земля'}:</span>
                    <span className="text-white font-bold">{formatCity(tonToCity(creditCalc.business_value))} $CITY</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('maxCreditLabel')}</span>
                    <span className="text-amber-400 font-bold">{formatCity(tonToCity(creditCalc.max_credit))} $CITY</span>
                  </div>
                </div>

                {/* Step 2: Lender */}
                <div>
                  <Label>{t('lenderStep')}</Label>
                  <Select value={lenderType} onValueChange={(v) => {
                    setLenderType(v);
                    setDeductionPercent('');
                  }}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="government">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-400" />
                          {t('govLender').replace('{rate}', (creditCalc.government.interest_rate * 100).toFixed(0)).replace('{ded}', (creditCalc.government.max_salary_deduction * 100))}
                        </div>
                      </SelectItem>
                      {creditCalc.banks?.map(bank => (
                        <SelectItem key={bank.bank_id} value={bank.bank_id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-amber-400" />
                            Банк Ур.{bank.level} (ставка {(bank.interest_rate * 100).toFixed(0)}%, удерж. до 25%)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 3: Amount */}
                <div>
                  <Label>{t('creditAmountStepCity') || 'Сумма кредита ($CITY)'}</Label>
                  <Input
                    data-testid="credit-amount-input"
                    type="number"
                    step="1"
                    min="1"
                    max={tonToCity(creditCalc.max_credit)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`${t('upToCityLabel') || 'До'} ${formatCity(tonToCity(creditCalc.max_credit))} $CITY`}
                    className="bg-white/5 border-white/10"
                  />
                  {amount && parseFloat(amount) > 0 && (
                    <div className="text-xs text-text-muted mt-1">
                      {t('returnWithInterest')} <span className="text-amber-400 font-bold">
                        {formatCity(parseFloat(amount) * (1 + (lenderType === 'government' ? creditCalc.government.interest_rate : (creditCalc.banks?.find(b => b.bank_id === lenderType)?.interest_rate || 0.20))))} $CITY
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 4: Deduction */}
                <div>
                  <Label>{t('deductionStep').replace('{min}', '10').replace('{max}', maxDeduction)}</Label>
                  <Input
                    data-testid="deduction-input"
                    type="number"
                    min="10"
                    max="40"
                    step="1"
                    value={deductionPercent}
                    onChange={(e) => setDeductionPercent(e.target.value)}
                    placeholder="10% - 40%"
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    {t('deductionHint')}
                  </p>
                  {deductionPercent && (parseFloat(deductionPercent) < 10 || parseFloat(deductionPercent) > 40) && (
                    <p className="text-xs text-red-400 mt-1">
                      {t('deductionRangeError')}
                    </p>
                  )}
                </div>

                {/* Warning */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  При неуплате в течение 7 дней ваш бизнес и земля будут конфискованы!
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowApplyModal(false)} className="border-white/10 w-full sm:w-auto">{t('cancel')}</Button>
            <Button
              data-testid="apply-credit-submit"
              onClick={handleApply}
              disabled={!creditCalc || !amount || !deductionPercent || isApplying || parseFloat(deductionPercent) < 10 || parseFloat(deductionPercent) > 40}
              className="bg-amber-500 hover:bg-amber-600 text-black w-full sm:w-auto"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
              Оформить кредит
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repay Modal */}
      <Dialog open={showRepayModal} onOpenChange={setShowRepayModal}>
        <DialogContent className="bg-void border-green-500/30">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-green-400" />
              {t('repayCreditTitle')}
            </DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('remainingDebtLabel')}</span>
                  <span className="text-amber-400 font-bold">{formatCity(tonToCity(selectedLoan.remaining || 0))} $CITY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('lenderNameLabel')}</span>
                  <span className="text-white">{selectedLoan.lender_name}</span>
                </div>
              </div>
              <div>
                <Label>{t('repayAmountLabel')} ($CITY)</Label>
                <Input
                  data-testid="repay-amount-input"
                  type="number"
                  step="1"
                  min="1"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder={`${formatCity(tonToCity(selectedLoan.remaining || 0))} $CITY`}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setShowRepayModal(false)} className="border-white/10 w-full sm:w-auto">{t('cancel')}</Button>
            <Button
              data-testid="repay-submit"
              onClick={handleRepay}
              disabled={isRepaying}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              {isRepaying ? <Loader2 className="w-4 h-4 animate-spin" /> : t('repayBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
