import { useState, useEffect } from 'react';
import { Wallet, Globe, AlertCircle, Save, Plus, Trash2, Percent, Send, ArrowDownToLine, Key, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function WalletSettings({ token }) {
  const [settings, setSettings] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Receiver wallets (for deposits)
  const [wallets, setWallets] = useState([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWallet, setNewWallet] = useState({ address: '', percentage: 100 });
  
  // Sender wallet (for withdrawals)
  const [senderWallet, setSenderWallet] = useState({ address: '', mnemonic: '' });
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  
  // Telegram bot settings
  const [telegramSettings, setTelegramSettings] = useState({
    bot_username: 'sale2x_bot',
    admin_telegram_id: '',
    bot_token: ''
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  
  // Form
  const [network, setNetwork] = useState('testnet');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, depositsRes, walletsRes, senderRes, telegramRes] = await Promise.all([
        axios.get(`${API}/admin/wallet-settings`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/deposits?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/wallets`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { wallets: [] } })),
        axios.get(`${API}/admin/sender-wallet`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { address: '', has_mnemonic: false } })),
        axios.get(`${API}/admin/telegram-settings`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { bot_username: 'sale2x_bot', admin_telegram_id: '' } }))
      ]);
      
      const s = settingsRes.data;
      setSettings(s);
      setNetwork(s.network || 'testnet');
      setDeposits(depositsRes.data.deposits || []);
      setWallets(walletsRes.data.wallets || []);
      
      if (senderRes.data) {
        setSenderWallet({
          address: senderRes.data.address || '',
          mnemonic: '', // Never returned from server
          has_mnemonic: senderRes.data.has_mnemonic || false
        });
      }
      
      if (telegramRes.data) {
        setTelegramSettings({
          bot_username: telegramRes.data.bot_username || 'sale2x_bot',
          admin_telegram_id: telegramRes.data.admin_telegram_id || '',
          bot_token: '',
          has_bot_token: telegramRes.data.has_bot_token || false
        });
      }
    } catch (error) {
      console.error('Failed to load wallet settings:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveNetwork = async () => {
    setIsSaving(true);
    try {
      await axios.post(
        `${API}/admin/wallet-settings?network=${network}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Сеть сохранена!');
      loadData();
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddWallet = async () => {
    if (!newWallet.address) {
      toast.error('Введите адрес кошелька');
      return;
    }
    
    const totalPercentage = wallets.reduce((sum, w) => sum + w.percentage, 0) + newWallet.percentage;
    if (totalPercentage > 100) {
      toast.error(`Общий процент превысит 100%! Доступно: ${100 - wallets.reduce((sum, w) => sum + w.percentage, 0)}%`);
      return;
    }
    
    try {
      const res = await axios.post(
        `${API}/admin/wallets`,
        newWallet,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setWallets([...wallets, res.data.wallet]);
      setShowAddWallet(false);
      setNewWallet({ address: '', percentage: 100 });
      toast.success('Кошелёк для пополнений добавлен!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления');
    }
  };
  
  const handleDeleteWallet = async (walletId) => {
    try {
      await axios.delete(`${API}/admin/wallets/${walletId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWallets(wallets.filter(w => w.id !== walletId));
      toast.success('Кошелёк удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };
  
  const handleSaveSenderWallet = async () => {
    if (!senderWallet.address) {
      toast.error('Введите адрес кошелька отправителя');
      return;
    }
    
    setSavingSender(true);
    try {
      await axios.post(
        `${API}/admin/sender-wallet`,
        {
          address: senderWallet.address,
          mnemonic: senderWallet.mnemonic || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Кошелёк отправителя сохранён!');
      setSenderWallet(prev => ({ ...prev, mnemonic: '', has_mnemonic: !!senderWallet.mnemonic }));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingSender(false);
    }
  };
  
  const handleSaveTelegramSettings = async () => {
    if (!telegramSettings.bot_username) {
      toast.error('Введите username бота');
      return;
    }
    
    setSavingTelegram(true);
    try {
      await axios.post(
        `${API}/admin/telegram-settings`,
        {
          bot_username: telegramSettings.bot_username,
          admin_telegram_id: telegramSettings.admin_telegram_id,
          bot_token: telegramSettings.bot_token || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Настройки Telegram сохранены!');
      setTelegramSettings(prev => ({ ...prev, bot_token: '', has_bot_token: !!telegramSettings.bot_token }));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingTelegram(false);
    }
  };
  
  const totalPercentage = wallets.reduce((sum, w) => sum + w.percentage, 0);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue mx-auto"></div>
          <p className="mt-4 text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Network Configuration */}
      <Card className="bg-white/5 border-white/10" data-testid="wallet-config-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-neon-blue" />
            Настройки сети
          </CardTitle>
          <CardDescription>
            Выберите сеть TON для приёма платежей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger data-testid="network-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="testnet">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Test</Badge>
                  <span>Testnet (для тестирования)</span>
                </div>
              </SelectItem>
              <SelectItem value="mainnet">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">Live</Badge>
                  <span>Mainnet (реальные деньги)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {network === 'mainnet' && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-400">
                Mainnet режим - будут использоваться реальные TON!
              </span>
            </div>
          )}
          
          {network === 'testnet' && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">
                Testnet режим - используйте тестовые TON для проверки
              </span>
            </div>
          )}
          
          <Button
            onClick={handleSaveNetwork}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить сеть'}
          </Button>
        </CardContent>
      </Card>
      
      {/* Sender Wallet (for withdrawals) */}
      <Card className="bg-white/5 border-orange-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-400" />
            Кошелёк отправителя (для выводов)
          </CardTitle>
          <CardDescription>
            Адрес и мнемоническая фраза для автоматической отправки выводов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-text-muted">Адрес кошелька отправителя</Label>
            <Input 
              value={senderWallet.address}
              onChange={(e) => setSenderWallet({...senderWallet, address: e.target.value})}
              placeholder="EQ..."
              className="bg-white/5 border-white/10 font-mono"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-text-muted flex items-center gap-2">
              <Key className="w-4 h-4" />
              Мнемоническая фраза (24 слова)
            </Label>
            <div className="relative">
              <Input 
                type={showMnemonic ? 'text' : 'password'}
                value={senderWallet.mnemonic}
                onChange={(e) => setSenderWallet({...senderWallet, mnemonic: e.target.value})}
                placeholder={senderWallet.has_mnemonic ? '••••••• (уже сохранена)' : '24 слова через пробел...'}
                className="bg-white/5 border-white/10 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowMnemonic(!showMnemonic)}
              >
                {showMnemonic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {senderWallet.has_mnemonic && (
              <p className="text-xs text-green-400">
                ✓ Мнемоническая фраза сохранена. Оставьте пустым чтобы не менять.
              </p>
            )}
            <p className="text-xs text-amber-400">
              ⚠️ Храните мнемонику в безопасности! С ней можно отправлять средства с этого кошелька.
            </p>
          </div>
          
          <Button
            onClick={handleSaveSenderWallet}
            disabled={savingSender}
            className="w-full bg-orange-500 hover:bg-orange-600 text-black"
          >
            {savingSender ? 'Сохранение...' : 'Сохранить кошелёк отправителя'}
          </Button>
        </CardContent>
      </Card>
      
      {/* Telegram Bot Settings */}
      <Card className="bg-white/5 border-[#26A5E4]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#26A5E4]" />
            Настройки Telegram бота
          </CardTitle>
          <CardDescription>
            Бот для привязки аккаунтов и уведомлений
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-text-muted">Username бота (без @)</Label>
            <Input 
              value={telegramSettings.bot_username}
              onChange={(e) => setTelegramSettings({...telegramSettings, bot_username: e.target.value.replace('@', '')})}
              placeholder="sale2x_bot"
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-text-muted">
              Ссылка для привязки: t.me/{telegramSettings.bot_username || 'your_bot'}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-text-muted">Telegram ID администратора</Label>
            <Input 
              value={telegramSettings.admin_telegram_id}
              onChange={(e) => setTelegramSettings({...telegramSettings, admin_telegram_id: e.target.value})}
              placeholder="6661676176"
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-text-muted">
              Администратор будет получать уведомления и иметь доступ к админ-командам бота
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-text-muted">Bot Token (опционально)</Label>
            <Input 
              type="password"
              value={telegramSettings.bot_token}
              onChange={(e) => setTelegramSettings({...telegramSettings, bot_token: e.target.value})}
              placeholder={telegramSettings.has_bot_token ? '••••••• (уже сохранён)' : 'Получите в @BotFather'}
              className="bg-white/5 border-white/10"
            />
            {telegramSettings.has_bot_token && (
              <p className="text-xs text-green-400">✓ Bot token сохранён</p>
            )}
          </div>
          
          <Button
            onClick={handleSaveTelegramSettings}
            disabled={savingTelegram}
            className="w-full bg-[#26A5E4] hover:brightness-110 text-white"
          >
            {savingTelegram ? 'Сохранение...' : 'Сохранить настройки Telegram'}
          </Button>
        </CardContent>
      </Card>
      
      {/* Receiver Wallets (for deposits) */}
      <Card className="bg-white/5 border-green-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-green-400" />
                Кошельки для пополнений
              </CardTitle>
              <CardDescription>
                Адреса для получения платежей от пользователей
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddWallet(true)}
              className="bg-green-500 text-black hover:bg-green-600"
              disabled={totalPercentage >= 100}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Total percentage indicator */}
          <div className="mb-4 p-3 bg-white/5 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-muted text-sm">Общий процент распределения:</span>
              <span className={`font-bold ${totalPercentage === 100 ? 'text-green-400' : totalPercentage > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                {totalPercentage}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${totalPercentage === 100 ? 'bg-green-500' : totalPercentage > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(totalPercentage, 100)}%` }}
              />
            </div>
            {totalPercentage !== 100 && (
              <p className="text-xs text-amber-400 mt-2">
                {totalPercentage < 100 
                  ? `⚠️ Не распределено: ${100 - totalPercentage}% (средства не будут зачисляться полностью)` 
                  : '⚠️ Сумма процентов превышает 100%!'
                }
              </p>
            )}
          </div>
          
          {wallets.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Кошельки не добавлены</p>
              <p className="text-sm">При пополнении средства не будут распределяться</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet, idx) => (
                <div 
                  key={wallet.id || idx}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm text-white break-all">
                      {wallet.address}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Percent className="w-3 h-3 mr-1" />
                        {wallet.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteWallet(wallet.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Recent Deposits */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Последние пополнения</CardTitle>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Пополнений пока нет</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {deposits.map((deposit) => (
                  <div 
                    key={deposit.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div>
                      <div className="font-mono text-sm text-white">
                        {deposit.from_address?.slice(0, 10)}...{deposit.from_address?.slice(-8)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(deposit.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">+{deposit.amount} TON</div>
                      <Badge variant={deposit.status === 'completed' ? 'default' : 'secondary'}>
                        {deposit.status === 'completed' ? 'Зачислено' : deposit.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Add Wallet Dialog */}
      <Dialog open={showAddWallet} onOpenChange={setShowAddWallet}>
        <DialogContent className="bg-void border-green-500/30">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-green-400" />
              Добавить кошелёк для пополнений
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Укажите адрес кошелька и процент от суммы пополнений
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-text-muted">Адрес кошелька</Label>
              <Input 
                value={newWallet.address}
                onChange={(e) => setNewWallet({...newWallet, address: e.target.value})}
                placeholder="EQ..."
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-text-muted">Процент от пополнений (%)</Label>
              <Input 
                type="number"
                min="1"
                max={100 - totalPercentage}
                value={newWallet.percentage}
                onChange={(e) => setNewWallet({...newWallet, percentage: parseInt(e.target.value) || 0})}
                className="bg-white/5 border-white/10"
              />
              <p className="text-xs text-text-muted">
                Доступно для распределения: {100 - totalPercentage}%
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddWallet(false)}
              className="border-white/10"
            >
              Отмена
            </Button>
            <Button 
              onClick={handleAddWallet}
              className="bg-green-500 text-black hover:bg-green-600"
            >
              Добавить кошелёк
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
