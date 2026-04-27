import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Rocket, Wallet, Plus, Trash2, RefreshCw, Copy, Check, 
  AlertCircle, CheckCircle2, Loader2, Settings, ExternalLink, Upload, Link, Unlink, Edit, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useTonConnectUI } from '@tonconnect/ui-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Manual Deploy Section Component
function ManualDeploySection({ deployerInfo, onSaveAddress, headers }) {
  const [contractAddress, setContractAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAddress = async () => {
    if (!contractAddress.trim()) {
      toast.error('Введите адрес контракта');
      return;
    }
    
    setIsSaving(true);
    try {
      await axios.post(`${API}/admin/contract-deployer/save-address`, {
        contract_address: contractAddress.trim()
      }, { headers });
      toast.success('Адрес контракта сохранён');
      onSaveAddress();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h3 className="font-medium text-blue-400 mb-3">Инструкция по деплою</h3>
        <ol className="text-sm text-text-muted space-y-2 list-decimal list-inside">
          <li>Скомпилируйте контракт: <code className="text-cyan-400">npx tact --config tact.config.json</code></li>
          <li>Откройте <a href="https://ton.org/wallets" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
            Tonkeeper <ExternalLink className="w-3 h-3" />
          </a> или другой кошелёк</li>
          <li>Задеплойте контракт с адреса: <code className="text-cyan-400">{deployerInfo?.address?.slice(0, 16)}...</code></li>
          <li>Скопируйте адрес задеплоенного контракта</li>
        </ol>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm text-text-muted">Адрес задеплоенного контракта</label>
        <div className="flex gap-3">
          <Input
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="UQ... или EQ..."
            className="flex-1 bg-white/5 border-white/10"
          />
          <Button 
            onClick={handleSaveAddress}
            disabled={isSaving || !contractAddress.trim()}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
          </Button>
        </div>
      </div>
      
      {!deployerInfo?.configured && (
        <p className="text-xs text-yellow-400">
          Сначала настройте кошелёк деплоера выше
        </p>
      )}
    </div>
  );
}

export default function ContractDeployerPanel({ token }) {
  const [deployerInfo, setDeployerInfo] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [onchainState, setOnchainState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingOnchain, setIsLoadingOnchain] = useState(false);
  const [tonConnectUI] = useTonConnectUI();
  
  // Form states
  const [mnemonic, setMnemonic] = useState('');
  const [network, setNetwork] = useState('mainnet');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletPercent, setNewWalletPercent] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  // Change contract states
  const [showChangeContract, setShowChangeContract] = useState(false);
  const [newContractAddress, setNewContractAddress] = useState('');
  const [isChangingContract, setIsChangingContract] = useState(false);
  const [isContractAction, setIsContractAction] = useState(false);
  
  // Withdrawal wallet settings
  const [withdrawalWalletMnemonic, setWithdrawalWalletMnemonic] = useState('');
  const [withdrawalWalletAddress, setWithdrawalWalletAddress] = useState('');
  const [withdrawalWalletBalance, setWithdrawalWalletBalance] = useState(0);
  const [isSavingWithdrawalWallet, setIsSavingWithdrawalWallet] = useState(false);
  const [isLoadingWithdrawalBalance, setIsLoadingWithdrawalBalance] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const saveContractAddress = () => {
    loadData();
  };
  
  const changeContractAddress = async () => {
    if (!newContractAddress.trim()) {
      toast.error('Введите адрес контракта');
      return;
    }
    
    setIsChangingContract(true);
    try {
      await axios.post(`${API}/admin/contract-deployer/save-address`, {
        contract_address: newContractAddress.trim()
      }, { headers });
      
      toast.success('Адрес контракта обновлён');
      setShowChangeContract(false);
      setNewContractAddress('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setIsChangingContract(false);
    }
  };

  // Add single wallet to contract
  const addWalletToContract = async (address, percent) => {
    if (!tonConnectUI.connected) {
      toast.error('Подключите кошелёк владельца контракта');
      return;
    }
    
    setIsContractAction(true);
    try {
      const response = await axios.post(`${API}/admin/contract/build-add-wallet-payload`, {
        address,
        percent: Math.round(percent)
      }, { headers });
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: contractInfo.contract_address,
          amount: '50000000',
          payload: response.data.payload
        }]
      });
      
      toast.success(`Кошелёк добавлен в контракт (${percent}%)`);
      setTimeout(() => loadOnchainState(), 3000);
    } catch (error) {
      console.error('Add wallet error:', error);
      if (!error.message?.includes('User') && !error.message?.includes('Cancelled')) {
        toast.error('Ошибка: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsContractAction(false);
    }
  };

  // Remove wallet from contract
  const removeWalletFromContract = async (address) => {
    if (!tonConnectUI.connected) {
      toast.error('Подключите кошелёк владельца контракта');
      return;
    }
    
    setIsContractAction(true);
    try {
      const response = await axios.post(`${API}/admin/contract/build-remove-wallet-payload`, {
        address,
        percent: 0
      }, { headers });
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: contractInfo.contract_address,
          amount: '50000000',
          payload: response.data.payload
        }]
      });
      
      toast.success('Кошелёк удалён из контракта');
      setTimeout(() => loadOnchainState(), 3000);
    } catch (error) {
      console.error('Remove wallet error:', error);
      if (!error.message?.includes('User') && !error.message?.includes('Cancelled')) {
        toast.error('Ошибка: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsContractAction(false);
    }
  };

  // Withdraw funds from contract
  const [withdrawToAddress, setWithdrawToAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawingFromContract, setIsWithdrawingFromContract] = useState(false);

  const withdrawFromContract = async () => {
    if (!tonConnectUI.connected) {
      toast.error('Подключите кошелёк владельца контракта');
      return;
    }
    
    if (!withdrawToAddress.trim()) {
      toast.error('Введите адрес получателя');
      return;
    }
    
    const amount = parseFloat(withdrawAmount) || 0;
    
    setIsWithdrawingFromContract(true);
    try {
      const response = await axios.post(`${API}/admin/contract/build-owner-withdraw-payload`, {
        to_address: withdrawToAddress.trim(),
        amount: amount
      }, { headers });
      
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: contractInfo.contract_address,
          amount: '50000000',
          payload: response.data.payload
        }]
      });
      
      toast.success(amount > 0 ? `Выведено ${amount} TON` : 'Выведен весь остаток');
      setWithdrawToAddress('');
      setWithdrawAmount('');
      setTimeout(() => loadOnchainState(), 3000);
    } catch (error) {
      console.error('Withdraw error:', error);
      if (!error.message?.includes('User') && !error.message?.includes('Cancelled')) {
        toast.error('Ошибка: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsWithdrawingFromContract(false);
    }
  };

  // Commission section removed

  useEffect(() => {
    loadData();
    loadWithdrawalWalletSettings();
  }, []);

  const loadWithdrawalWalletSettings = async () => {
    setIsLoadingWithdrawalBalance(true);
    try {
      const res = await axios.get(`${API}/admin/settings/withdrawal-wallet`, { headers });
      if (res.data.address) {
        setWithdrawalWalletAddress(res.data.address);
        setWithdrawalWalletBalance(res.data.balance || 0);
      }
    } catch (e) {
      console.log('No withdrawal wallet configured');
    } finally {
      setIsLoadingWithdrawalBalance(false);
    }
  };

  const saveWithdrawalWallet = async () => {
    if (!withdrawalWalletMnemonic.trim()) {
      toast.error('Введите мнемонику кошелька');
      return;
    }
    
    const words = withdrawalWalletMnemonic.trim().split(/\s+/);
    if (words.length !== 24) {
      toast.error('Мнемоника должна содержать 24 слова');
      return;
    }
    
    setIsSavingWithdrawalWallet(true);
    try {
      const res = await axios.post(`${API}/admin/settings/withdrawal-wallet`, {
        mnemonic: withdrawalWalletMnemonic.trim()
      }, { headers });
      
      toast.success('Кошелёк для вывода сохранён');
      setWithdrawalWalletMnemonic('');
      if (res.data.address) {
        setWithdrawalWalletAddress(res.data.address);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setIsSavingWithdrawalWallet(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [deployerRes, contractRes, walletsRes] = await Promise.all([
        axios.get(`${API}/admin/contract-deployer`, { headers }),
        axios.get(`${API}/admin/contract-info`, { headers }),
        axios.get(`${API}/admin/wallets`, { headers })
      ]);
      
      setDeployerInfo(deployerRes.data);
      setContractInfo(contractRes.data);
      setWallets(walletsRes.data.wallets || []);
      
      // Load on-chain state if contract is deployed
      if (contractRes.data?.contract_address) {
        loadOnchainState();
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOnchainState = async () => {
    setIsLoadingOnchain(true);
    try {
      const res = await axios.get(`${API}/admin/contract/onchain-state`, { headers });
      setOnchainState(res.data);
    } catch (error) {
      console.error('On-chain state error:', error);
    } finally {
      setIsLoadingOnchain(false);
    }
  };

  const saveDeployer = async () => {
    if (!mnemonic.trim()) {
      toast.error('Введите мнемоническую фразу');
      return;
    }
    
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 24) {
      toast.error('Мнемоника должна содержать 24 слова');
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await axios.post(`${API}/admin/contract-deployer`, {
        mnemonic: mnemonic.trim(),
        network
      }, { headers });
      
      toast.success('Кошелёк деплоера сохранён');
      setMnemonic('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const changeDeployer = async () => {
    if (!window.confirm('Вы уверены, что хотите сменить аккаунт деплоера?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/contract-deployer`, { headers });
      toast.success('Аккаунт деплоера удалён');
      loadData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const addWallet = async () => {
    if (!newWalletAddress.trim() || !newWalletPercent) {
      toast.error('Заполните адрес и процент');
      return;
    }
    
    const percent = parseFloat(newWalletPercent);
    if (percent < 1 || percent > 100) {
      toast.error('Процент должен быть от 1 до 100');
      return;
    }
    
    const totalPercent = wallets.reduce((sum, w) => sum + (w.percentage || 0), 0);
    if (totalPercent + percent > 100) {
      toast.error(`Превышен лимит 100%. Доступно: ${100 - totalPercent}%`);
      return;
    }
    
    try {
      await axios.post(`${API}/admin/wallets`, {
        address: newWalletAddress.trim(),
        percentage: percent,
        mnemonic: ''
      }, { headers });
      
      toast.success('Кошелёк добавлен');
      setNewWalletAddress('');
      setNewWalletPercent('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления');
    }
  };

  const deleteWallet = async (walletId) => {
    try {
      await axios.delete(`${API}/admin/wallets/${walletId}`, { headers });
      toast.success('Кошелёк удалён');
      loadData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Sync wallets to smart contract via TonConnect
  const syncWalletsToContract = async () => {
    if (!contractInfo?.contract_address) {
      toast.error('Сначала задеплойте контракт');
      return;
    }
    
    if (wallets.length === 0) {
      toast.error('Добавьте кошельки для распределения');
      return;
    }
    
    if (!tonConnectUI.connected) {
      toast.error('Подключите кошелёк владельца контракта через TonConnect');
      try {
        await tonConnectUI.openModal();
      } catch (e) {}
      return;
    }
    
    setIsSyncing(true);
    
    try {
      // First, get on-chain state to see which wallets are already added
      const onchainRes = await axios.get(`${API}/admin/contract/onchain-state`, { headers });
      const onchainWalletCount = onchainRes.data?.onchain_data?.wallet_count || 0;
      const onchainTotalPercent = onchainRes.data?.onchain_data?.total_percent || 0;
      
      // Filter wallets that need to be added (simplified - add all if not 100%)
      // In production, you'd compare actual addresses
      let walletsToAdd = wallets;
      
      if (onchainTotalPercent >= 100) {
        toast.info('Все кошельки уже добавлены в контракт (100%)');
        setIsSyncing(false);
        return;
      }
      
      // Calculate which wallets to add based on remaining percent
      const remainingPercent = 100 - onchainTotalPercent;
      walletsToAdd = wallets.filter(w => {
        // Add wallets that would fit in remaining percent
        // This is a simplified logic - ideally check actual addresses
        return true; // Add all for now, contract will reject duplicates
      });
      
      if (walletsToAdd.length === 0) {
        toast.info('Нет кошельков для добавления');
        setIsSyncing(false);
        return;
      }
      
      toast.info(`Добавление ${walletsToAdd.length} кошелька(ов). В контракте уже: ${onchainWalletCount} (${onchainTotalPercent}%)`);
      
      // Get BOC payloads from backend
      console.log('Building payloads for wallets:', walletsToAdd);
      const response = await axios.post(`${API}/admin/contract/build-add-wallet-payloads`, {
        wallets: walletsToAdd.map(w => ({
          address: w.address,
          percent: Math.round(w.percentage)
        }))
      }, { headers });
      
      const payloads = response.data.payloads;
      console.log('Received payloads:', payloads);
      
      // Send transactions ONE BY ONE to avoid wallet issues with batch
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        toast.info(`Отправка ${i + 1}/${payloads.length}: ${p.address.slice(0, 10)}...`);
        
        const txData = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes (max allowed)
          messages: [{
            address: contractInfo.contract_address,
            amount: '50000000', // 0.05 TON for gas
            payload: p.payload
          }]
        };
        console.log(`Sending transaction ${i + 1}:`, txData);
        
        try {
          const result = await tonConnectUI.sendTransaction(txData);
          console.log(`Transaction ${i + 1} result:`, result);
          
          toast.success(`Кошелёк ${i + 1} добавлен!`);
          
          // Small delay between transactions
          if (i < payloads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (txError) {
          console.error(`Error sending tx ${i + 1}:`, txError);
          console.error('Error details:', JSON.stringify(txError, null, 2));
          
          if (txError.message?.includes('Interrupted') || txError.message?.includes('Cancelled') || txError.message?.includes('User')) {
            toast.error(`Транзакция ${i + 1} отклонена пользователем`);
            break;
          }
          throw txError;
        }
      }
      
      toast.success('Все кошельки добавлены в контракт!');
      
      // Refresh data after a delay
      setTimeout(() => loadData(), 5000);
      
    } catch (error) {
      console.error('Sync error:', error);
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      if (error.message?.includes('Interrupted') || error.message?.includes('User')) {
        toast.error('Транзакция отклонена');
      } else {
        toast.error('Ошибка синхронизации: ' + (error.response?.data?.detail || error.message || 'Неизвестная ошибка'));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual distribution by owner
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeAmount, setDistributeAmount] = useState('');

  const ownerDistribute = async () => {
    if (!contractInfo?.contract_address) {
      toast.error('Контракт не задеплоен');
      return;
    }
    
    if (!distributeAmount || parseFloat(distributeAmount) <= 0) {
      toast.error('Введите сумму для распределения');
      return;
    }
    
    if (wallets.length === 0) {
      toast.error('Добавьте кошельки для распределения');
      return;
    }
    
    if (totalPercent !== 100) {
      toast.error('Сумма процентов должна быть 100%');
      return;
    }
    
    if (!tonConnectUI.connected) {
      toast.error('Подключите кошелёк владельца контракта');
      try {
        await tonConnectUI.openModal();
      } catch (e) {}
      return;
    }
    
    setIsDistributing(true);
    
    try {
      // Get payload from backend
      const response = await axios.post(`${API}/admin/contract/build-owner-distribute-payload`, {
        total_amount: parseFloat(distributeAmount),
        wallets: wallets.slice(0, 5).map(w => ({
          address: w.address,
          percent: Math.round(w.percentage)
        }))
      }, { headers });
      
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
          address: contractInfo.contract_address,
          amount: '100000000', // 0.1 TON for gas
          payload: response.data.payload
        }]
      });
      
      toast.success(`Распределение ${distributeAmount} TON отправлено!`);
      setDistributeAmount('');
      setTimeout(() => loadOnchainState(), 5000);
      
    } catch (error) {
      console.error('Distribute error:', error);
      toast.error('Ошибка: ' + (error.response?.data?.detail || error.message || 'Неизвестная ошибка'));
    } finally {
      setIsDistributing(false);
    }
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const totalPercent = wallets.reduce((sum, w) => sum + (w.percentage || 0), 0);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyber-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deployer Wallet Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-6 h-6 text-cyber-cyan" />
          <h2 className="font-unbounded text-lg font-bold text-text-main">
            Кошелёк деплоера
          </h2>
        </div>

        {deployerInfo?.configured ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Кошелёк настроен</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Адрес:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-cyber-cyan">{deployerInfo.address?.slice(0, 20)}...{deployerInfo.address?.slice(-6)}</code>
                    <button onClick={() => copyAddress(deployerInfo.address)} className="text-text-muted hover:text-white">
                      {copiedAddress ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Сеть:</span>
                  <span className={deployerInfo.network === 'mainnet' ? 'text-green-400' : 'text-yellow-400'}>
                    {deployerInfo.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Баланс:</span>
                  <span className={deployerInfo.balance >= 0.5 ? 'text-green-400' : 'text-red-400'}>
                    {deployerInfo.balance?.toFixed(4)} TON
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={loadData} variant="outline" className="flex-1 border-white/10">
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
              <Button onClick={changeDeployer} variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />
                Сменить аккаунт
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Кошелёк не настроен</span>
              </div>
              <p className="text-sm text-text-muted">
                Введите мнемоническую фразу (24 слова) кошелька с которого будет произведён деплой контракта.
                На кошельке должно быть минимум 0.5 TON.
              </p>
            </div>
            
            <div className="space-y-3">
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="word1 word2 word3 ... word24"
                className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm resize-none focus:border-cyber-cyan focus:outline-none"
              />
              
              <div className="flex gap-3">
                <select 
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="mainnet">Mainnet</option>
                  <option value="testnet">Testnet</option>
                </select>
                
                <Button 
                  onClick={saveDeployer}
                  disabled={isSaving}
                  className="flex-1 bg-cyber-cyan text-black hover:bg-cyber-cyan/80"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                  Сохранить кошелёк
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contract Deploy Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Rocket className="w-6 h-6 text-purple-400" />
          <h2 className="font-unbounded text-lg font-bold text-text-main">
            Смарт-контракт распределения
          </h2>
        </div>

        {contractInfo?.configured ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Контракт задеплоен</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChangeContract(true)}
                  className="text-yellow-400 hover:text-yellow-300"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Сменить
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Адрес контракта:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-purple-400">{contractInfo.contract_address?.slice(0, 16)}...{contractInfo.contract_address?.slice(-6)}</code>
                    <button onClick={() => copyAddress(contractInfo.contract_address)} className="text-text-muted hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Баланс контракта:</span>
                  <span className="text-cyan-400">{contractInfo.balance?.toFixed(4)} TON</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Дата:</span>
                  <span className="text-text-main">{contractInfo.deployed_at?.slice(0, 10)}</span>
                </div>
              </div>
            </div>
            
            {/* Change Contract Modal */}
            {showChangeContract && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <h4 className="font-medium text-yellow-400 mb-3">Сменить адрес контракта</h4>
                <p className="text-sm text-text-muted mb-3">
                  Введите новый адрес смарт-контракта. Убедитесь, что новый контракт задеплоен и настроен.
                </p>
                <div className="flex gap-3">
                  <Input
                    value={newContractAddress}
                    onChange={(e) => setNewContractAddress(e.target.value)}
                    placeholder="UQ... или EQ..."
                    className="flex-1 bg-white/5 border-white/10"
                  />
                  <Button 
                    onClick={changeContractAddress}
                    disabled={isChangingContract || !newContractAddress.trim()}
                    className="bg-yellow-500 text-black hover:bg-yellow-600"
                  >
                    {isChangingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => {
                      setShowChangeContract(false);
                      setNewContractAddress('');
                    }}
                    className="text-text-muted hover:text-white"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
            
            {/* On-chain State Section */}
            <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-indigo-400">Данные из блокчейна (on-chain)</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadOnchainState}
                  disabled={isLoadingOnchain}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {isLoadingOnchain ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {onchainState?.onchain_data ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Кошельков в контракте:</span>
                    <span className={onchainState.onchain_data.wallet_count > 0 ? 'text-green-400' : 'text-yellow-400'}>
                      {onchainState.onchain_data.wallet_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Распределено %:</span>
                    <span className={onchainState.onchain_data.total_percent === 100 ? 'text-green-400' : 'text-yellow-400'}>
                      {onchainState.onchain_data.total_percent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Баланс (on-chain):</span>
                    <span className="text-cyan-400">{onchainState.onchain_data.balance_ton?.toFixed(4)} TON</span>
                  </div>
                  
                  {onchainState.onchain_data.wallet_count === 0 && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-xs">
                      ⚠️ В контракте нет кошельков. Добавьте кошельки через "Синхронизация с контрактом"
                    </div>
                  )}
                  
                  {onchainState.onchain_data.wallet_count > 0 && onchainState.onchain_data.total_percent < 100 && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-xs">
                      ⚠️ Сумма процентов в контракте меньше 100%. Распределение не будет работать оптимально.
                    </div>
                  )}
                  
                  {onchainState.onchain_data.wallet_count > 0 && onchainState.onchain_data.total_percent === 100 && (
                    <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs">
                      ✅ Контракт настроен правильно. Средства будут автоматически распределяться.
                    </div>
                  )}
                  
                  {/* Show wallets from contract */}
                  {onchainState.onchain_data.wallets && onchainState.onchain_data.wallets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h5 className="text-sm font-medium text-indigo-300 mb-2">
                        Кошельки в контракте (on-chain):
                      </h5>
                      <div className="space-y-2">
                        {onchainState.onchain_data.wallets.map((wallet, idx) => (
                          <div key={idx} className="bg-white/5 rounded-lg p-3 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-text-muted text-xs">#{(wallet.index !== undefined ? wallet.index : idx) + 1}</span>
                                {wallet.address ? (
                                  <code className="text-sm text-cyber-cyan font-mono">
                                    {wallet.address}
                                  </code>
                                ) : wallet.address_hash ? (
                                  <code className="text-sm text-yellow-400 font-mono">
                                    WC{wallet.workchain}: {wallet.address_hash}
                                  </code>
                                ) : wallet.cell_raw ? (
                                  <code className="text-xs text-text-muted break-all">
                                    {wallet.cell_raw}
                                  </code>
                                ) : (
                                  <span className="text-text-muted text-xs">Данные загружаются...</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {wallet.percent !== undefined && (
                                <span className="text-amber-400 font-medium">{wallet.percent}%</span>
                              )}
                              {contractInfo?.contract_address && tonConnectUI.connected && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
                                  onClick={() => {
                                    const addr = wallet.address || prompt('Введите адрес кошелька для удаления (UQ... или EQ...):');
                                    if (addr) {
                                      removeWalletFromContract(addr);
                                    }
                                  }}
                                  disabled={isContractAction}
                                >
                                  <Unlink className="w-3 h-3 mr-1" />
                                  Удалить
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {!tonConnectUI.connected && (
                        <p className="text-xs text-amber-400 mt-2">
                          ⚠️ Подключите TonConnect кошелёк владельца для управления кошельками в контракте
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : onchainState?.error ? (
                <div className="text-red-400 text-sm">{onchainState.error}</div>
              ) : (
                <div className="text-text-muted text-sm">
                  {isLoadingOnchain ? 'Загрузка...' : 'Нажмите обновить для загрузки данных'}
                </div>
              )}
              
              {/* Contract Withdrawal Section - Always show when contract is deployed */}
              {contractInfo?.contract_address && (
                <>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h5 className="font-medium text-indigo-300 mb-3 text-sm">
                      Вывод средств с контракта 
                      {onchainState?.onchain_data?.balance_ton > 0 && (
                        <span className="ml-2 text-cyan-400">
                          (Баланс: {onchainState.onchain_data.balance_ton.toFixed(4)} TON)
                        </span>
                      )}
                    </h5>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={withdrawToAddress}
                          onChange={(e) => setWithdrawToAddress(e.target.value)}
                          placeholder="Адрес получателя (UQ... или EQ...)"
                        className="flex-1 bg-white/5 border-white/10 text-sm"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Сумма (0 = всё)"
                        className="w-full sm:w-32 bg-white/5 border-white/10 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={withdrawFromContract}
                        disabled={isWithdrawingFromContract || !withdrawToAddress.trim()}
                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-sm"
                        size="sm"
                      >
                        {isWithdrawingFromContract ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 mr-2" />
                        )}
                        Вывести с контракта
                      </Button>
                    </div>
                    <p className="text-xs text-text-muted">
                      Укажите 0 или оставьте пустым для вывода всего остатка (за вычетом комиссии).
                    </p>
                  </div>
                </div>
                
                {/* Commission section removed */}
                </>
              )}
            </div>
          </div>
        ) : (
          <ManualDeploySection 
            deployerInfo={deployerInfo}
            onSaveAddress={saveContractAddress}
            headers={headers}
          />
        )}
      </div>

      {/* Distribution Wallets Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-amber-400" />
            <h2 className="font-unbounded text-lg font-bold text-text-main">
              Кошельки распределения
            </h2>
          </div>
          <div className="text-sm">
            <span className="text-text-muted">В БД: </span>
            <span className={totalPercent === 100 ? 'text-green-400' : totalPercent > 100 ? 'text-red-400' : 'text-yellow-400'}>
              {totalPercent}%
            </span>
            <span className="text-text-muted"> | В контракте: </span>
            <span className={onchainState?.onchain_data?.total_percent === 100 ? 'text-green-400' : 'text-yellow-400'}>
              {onchainState?.onchain_data?.total_percent || 0}%
            </span>
          </div>
        </div>

        {/* Existing Wallets with Contract Actions */}
        <div className="space-y-3 mb-6">
          {wallets.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              Нет настроенных кошельков для распределения
            </div>
          ) : (
            wallets.map((wallet) => (
              <div key={wallet.id} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-sm text-cyber-cyan">{wallet.address?.slice(0, 20)}...{wallet.address?.slice(-6)}</code>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-medium">{wallet.percentage}%</span>
                    <button 
                      onClick={() => deleteWallet(wallet.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Удалить из БД"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Contract Actions for this wallet */}
                {contractInfo?.contract_address && tonConnectUI.connected && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-green-400 border-green-400/30 hover:bg-green-400/10"
                      onClick={() => addWalletToContract(wallet.address, wallet.percentage)}
                      disabled={isContractAction}
                    >
                      <Link className="w-3 h-3 mr-1" />
                      В контракт
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => removeWalletFromContract(wallet.address)}
                      disabled={isContractAction}
                    >
                      <Unlink className="w-3 h-3 mr-1" />
                      Из контракта
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add New Wallet */}
        {wallets.length < 10 && (
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-medium text-text-muted mb-3">Добавить кошелёк в БД</h3>
            <div className="flex gap-3">
              <Input
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                placeholder="EQ... или UQ... адрес"
                className="flex-1 bg-white/5 border-white/10"
              />
              <Input
                type="number"
                value={newWalletPercent}
                onChange={(e) => setNewWalletPercent(e.target.value)}
                placeholder="%"
                min="1"
                max="100"
                className="w-20 bg-white/5 border-white/10"
              />
              <Button onClick={addWallet} className="bg-amber-500 text-black hover:bg-amber-600">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Используйте кнопки "В контракт" / "Из контракта" для управления on-chain
            </p>
          </div>
        )}
        
        {/* Connect Wallet Reminder */}
        {contractInfo?.contract_address && !tonConnectUI.connected && (
          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-400 mb-3">
                Подключите кошелёк владельца контракта для управления
              </p>
              <Button 
                onClick={() => tonConnectUI.openModal()}
                className="bg-yellow-500 text-black hover:bg-yellow-600"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Подключить кошелёк
              </Button>
            </div>
          </div>
        )}
        
        {/* Batch Sync Button - now without 100% requirement */}
        {wallets.length > 0 && contractInfo?.contract_address && tonConnectUI.connected && (
          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
              <h3 className="font-medium text-purple-400 mb-2">Массовая синхронизация</h3>
              <p className="text-sm text-text-muted mb-3">
                Добавить все кошельки из БД в контракт (по очереди)
              </p>
              
              {/* Show on-chain status */}
              {onchainState?.onchain_data && (
                <div className="mb-4 p-2 bg-black/20 rounded text-sm">
                  <span className="text-text-muted">В контракте:</span>{' '}
                  <span className={onchainState.onchain_data.total_percent === 100 ? 'text-green-400' : 'text-yellow-400'}>
                    {onchainState.onchain_data.wallet_count} кошелёк(а), {onchainState.onchain_data.total_percent}%
                  </span>
                </div>
              )}
              
              <Button 
                onClick={syncWalletsToContract}
                disabled={isSyncing || (onchainState?.onchain_data?.total_percent >= 100)}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Подтвердите транзакцию в кошельке...
                  </>
                ) : onchainState?.onchain_data?.total_percent >= 100 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Все кошельки синхронизированы ✓
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {onchainState?.onchain_data?.total_percent > 0 
                      ? `Добавить оставшиеся кошельки (${100 - onchainState.onchain_data.total_percent}%)`
                      : `Добавить ${wallets.length} кошелёк(а) в контракт`
                    }
                  </>
                )}
              </Button>
              {totalPercent !== 100 && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ Сумма процентов должна быть ровно 100% (сейчас: {totalPercent}%)
                </p>
              )}
              
              {/* Test simple transfer button */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-text-muted mb-2">Тест: Отправить 0.01 TON на контракт (без payload)</p>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!tonConnectUI.connected) {
                      toast.error('Подключите кошелёк');
                      return;
                    }
                    try {
                      await tonConnectUI.sendTransaction({
                        validUntil: Math.floor(Date.now() / 1000) + 300,
                        messages: [{
                          address: contractInfo.contract_address,
                          amount: '10000000' // 0.01 TON
                        }]
                      });
                      toast.success('Тестовая транзакция отправлена!');
                    } catch (e) {
                      console.error('Test tx error:', e);
                      toast.error('Ошибка: ' + e.message);
                    }
                  }}
                  className="text-xs"
                >
                  Тест простого перевода
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Manual Distribution Section */}
        {wallets.length > 0 && contractInfo?.contract_address && onchainState?.onchain_data?.balance_ton > 0 && (
          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <h3 className="font-medium text-green-400 mb-2">Ручное распределение (OwnerDistribute)</h3>
              <p className="text-sm text-text-muted mb-4">
                Распределите средства с баланса контракта на указанные кошельки вручную.
                Баланс контракта: <span className="text-cyan-400">{onchainState?.onchain_data?.balance_ton?.toFixed(4)} TON</span>
              </p>
              <div className="flex gap-3 mb-3">
                <Input
                  type="number"
                  value={distributeAmount}
                  onChange={(e) => setDistributeAmount(e.target.value)}
                  placeholder="Сумма в TON"
                  step="0.01"
                  min="0.1"
                  max={onchainState?.onchain_data?.balance_ton || 0}
                  className="flex-1 bg-white/5 border-white/10"
                />
                <Button 
                  onClick={ownerDistribute}
                  disabled={isDistributing || totalPercent !== 100 || !distributeAmount}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {isDistributing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Распределить'
                  )}
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                Средства будут распределены по кошелькам из списка выше (макс. 5)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h3 className="font-medium text-blue-400 mb-2">Как это работает</h3>
        <ul className="text-sm text-text-muted space-y-1">
          <li>• Пользователь пополняет баланс → TON отправляется на адрес контракта</li>
          <li>• Контракт автоматически распределяет средства между указанными кошельками</li>
          <li>• Каждый кошелёк получает указанный процент от суммы пополнения</li>
          <li>• Владелец может вручную распределить средства через OwnerDistribute</li>
          <li>• В комментарии транзакции указывается "TON City Distribution"</li>
        </ul>
      </div>

      {/* Withdrawal Wallet Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-6 h-6 text-green-400" />
          <h2 className="font-unbounded text-lg font-bold text-text-main">
            Кошелёк для вывода средств
          </h2>
        </div>
        
        <p className="text-text-muted text-sm mb-4">
          Настройте кошелёк, с которого будут автоматически отправляться выводы пользователям
        </p>

        {withdrawalWalletAddress ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Кошелёк настроен</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadWithdrawalWalletSettings}
                  disabled={isLoadingWithdrawalBalance}
                  className="text-green-400 hover:text-green-300"
                >
                  {isLoadingWithdrawalBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-text-muted">Адрес кошелька:</div>
                <div 
                  className="bg-black/30 rounded-lg p-3 font-mono text-sm text-green-400 break-all cursor-pointer hover:bg-black/40 transition-colors flex items-center justify-between gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(withdrawalWalletAddress);
                    toast.success('Адрес скопирован');
                  }}
                >
                  <span>{withdrawalWalletAddress}</span>
                  <Copy className="w-4 h-4 flex-shrink-0 opacity-50" />
                </div>
                
                {/* Balance Display */}
                <div className="flex items-center justify-between mt-3 p-3 bg-black/20 rounded-lg">
                  <span className="text-text-muted text-sm">Баланс кошелька:</span>
                  <span className={`font-mono text-lg ${withdrawalWalletBalance >= 1 ? 'text-green-400' : withdrawalWalletBalance > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {withdrawalWalletBalance.toFixed(4)} TON
                  </span>
                </div>
                {withdrawalWalletBalance < 1 && (
                  <div className="text-xs text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Рекомендуется пополнить кошелёк для автоматических выводов
                  </div>
                )}
                
                <a 
                  href={`https://tonviewer.com/${withdrawalWalletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyber-cyan hover:underline flex items-center gap-1"
                >
                  Открыть в TonViewer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs text-text-muted block">Изменить мнемонику (24 слова)</label>
              <textarea
                value={withdrawalWalletMnemonic}
                onChange={(e) => setWithdrawalWalletMnemonic(e.target.value)}
                placeholder="word1 word2 word3 ... word24"
                className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-sm resize-none focus:border-green-400 focus:outline-none"
              />
              <Button 
                onClick={saveWithdrawalWallet}
                disabled={isSavingWithdrawalWallet}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
              >
                {isSavingWithdrawalWallet ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                Обновить кошелёк
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Кошелёк не настроен</span>
              </div>
              <p className="text-sm text-text-muted">
                Введите мнемоническую фразу (24 слова) кошелька для автоматических выводов
              </p>
            </div>
            
            <div className="space-y-3">
              <textarea
                value={withdrawalWalletMnemonic}
                onChange={(e) => setWithdrawalWalletMnemonic(e.target.value)}
                placeholder="word1 word2 word3 ... word24"
                className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm resize-none focus:border-green-400 focus:outline-none"
              />
              <Button 
                onClick={saveWithdrawalWallet}
                disabled={isSavingWithdrawalWallet}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
              >
                {isSavingWithdrawalWallet ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                Сохранить кошелёк для вывода
              </Button>
            </div>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs text-text-muted">
          <p className="font-medium text-white mb-1">Как работает автовывод:</p>
          <ul className="space-y-1">
            <li>• <span className="text-cyan-400">Мгновенный вывод:</span> средства отправляются автоматически сразу при создании заявки</li>
            <li>• <span className="text-amber-400">Стандартный вывод:</span> автоматически через 24ч или сразу при одобрении админом</li>
            <li>• Защита от двойной отправки: система проверяет статус перед каждой отправкой</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
