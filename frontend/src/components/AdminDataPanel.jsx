import { useState, useEffect } from 'react';
import { Search, User, Package, Edit2, Save, AlertTriangle, TrendingUp, Shield, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { toUserFriendlyAddress, shortenAddress } from '@/lib/tonAddress';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDataPanel({ token }) {
  const [tab, setTab] = useState('players');
  const headers = { Authorization: `Bearer ${token}` };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('players')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'players' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-gray-800/50 text-gray-400 border border-gray-700'}`}>
          👤 Игроки
        </button>
        <button onClick={() => setTab('prices')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'prices' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-gray-800/50 text-gray-400 border border-gray-700'}`}>
          💰 Цены товаров
        </button>
      </div>

      {tab === 'players' && <PlayersTab token={token} headers={headers} />}
      {tab === 'prices' && <PricesTab token={token} headers={headers} />}
    </div>
  );
}

function PlayersTab({ token, headers }) {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerDetails, setPlayerDetails] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(false);

  const searchPlayers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/players/search?query=${encodeURIComponent(query)}`, { headers });
      setPlayers(res.data.players || []);
    } catch (e) {
      toast.error('Ошибка поиска');
    }
    setLoading(false);
  };

  const loadPlayerDetails = async (playerId) => {
    try {
      const res = await axios.get(`${API}/admin/players/${playerId}`, { headers });
      setPlayerDetails(res.data);
      setSelectedPlayer(playerId);
      setEditData({
        balance_ton: res.data.user?.balance_ton || 0,
        display_name: res.data.user?.display_name || '',
        is_banned: res.data.user?.is_banned || false,
      });
    } catch (e) {
      toast.error('Ошибка загрузки данных игрока');
    }
  };

  const savePlayerChanges = async () => {
    try {
      await axios.post(`${API}/admin/players/${selectedPlayer}/update`, editData, { headers });
      toast.success('Данные обновлены');
      setEditMode(false);
      loadPlayerDetails(selectedPlayer);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  useEffect(() => { searchPlayers(); }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPlayers()}
            placeholder="Поиск по ID, кошельку, имени, email..."
            className="pl-10 bg-gray-900/50 border-gray-700 text-white"
          />
        </div>
        <Button onClick={searchPlayers} className="bg-cyan-600 hover:bg-cyan-700">Найти</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Players List */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          <div className="text-xs text-gray-500 mb-1">Найдено: {players.length}</div>
          {players.map(p => {
            const pid = p.id || p.wallet_address;
            return (
              <button
                key={pid}
                onClick={() => loadPlayerDetails(pid)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedPlayer === pid ? 'bg-cyan-900/30 border-cyan-700/50' : 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/60'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{p.display_name || p.username || 'Anonymous'}</div>
                    <div className="text-xs text-gray-500">{p.email || (p.wallet_address ? shortenAddress(toUserFriendlyAddress(p.wallet_address)) : pid?.slice(0, 12))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-cyan-400">{(p.balance_ton || 0).toFixed(2)} TON</div>
                    <div className="text-xs text-gray-500">{p.is_banned ? '🚫 Бан' : '✅'}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Player Details */}
        {playerDetails && (
          <div className="p-4 rounded-2xl bg-gray-800/40 border border-gray-700/50 space-y-4 max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {playerDetails.user?.display_name || 'Игрок'}
              </h3>
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <Button size="sm" onClick={savePlayerChanges} className="bg-green-600 hover:bg-green-700"><Save className="w-3 h-3 mr-1" /> Сохранить</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditMode(false)} className="text-gray-400"><X className="w-3 h-3" /></Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setEditMode(true)} className="bg-amber-600 hover:bg-amber-700"><Edit2 className="w-3 h-3 mr-1" /> Редактировать</Button>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">ID</div>
                <div className="text-white font-mono text-xs break-all">{playerDetails.user?.id}</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Email</div>
                <div className="text-white text-xs">{playerDetails.user?.email || '—'}</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Баланс TON</div>
                {editMode ? (
                  <Input type="number" step="0.01" value={editData.balance_ton} onChange={(e) => setEditData({...editData, balance_ton: parseFloat(e.target.value)})} className="h-7 bg-gray-800 border-gray-600 text-white text-xs" />
                ) : (
                  <div className="text-cyan-400 font-bold">{(playerDetails.user?.balance_ton || 0).toFixed(4)} TON</div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Общий доход</div>
                <div className="text-green-400">{(playerDetails.user?.total_income || 0).toFixed(4)} TON</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">TON Кошелёк</div>
                <div className="text-white text-xs font-mono break-all">{playerDetails.user?.wallet_address ? toUserFriendlyAddress(playerDetails.user.wallet_address) : '—'}</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Уровень</div>
                <div className="text-white">{playerDetails.user?.level || 'novice'} (XP: {playerDetails.user?.xp || 0})</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Имя</div>
                {editMode ? (
                  <Input value={editData.display_name} onChange={(e) => setEditData({...editData, display_name: e.target.value})} className="h-7 bg-gray-800 border-gray-600 text-white text-xs" />
                ) : (
                  <div className="text-white">{playerDetails.user?.display_name}</div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-gray-900/40">
                <div className="text-xs text-gray-500">Регистрация</div>
                <div className="text-white text-xs">{playerDetails.user?.created_at ? new Date(playerDetails.user.created_at).toLocaleDateString('ru') : '—'}</div>
              </div>
            </div>

            {/* Resources */}
            {playerDetails.user?.resources && Object.keys(playerDetails.user.resources).length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2">📦 Ресурсы</div>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(playerDetails.user.resources).map(([r, a]) => (
                    <div key={r} className="p-1.5 rounded-lg bg-gray-900/30 text-xs">
                      <span className="text-gray-500">{r}:</span> <span className="text-white font-mono">{typeof a === 'number' ? a.toFixed(0) : a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Businesses */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2">🏢 Бизнесы ({playerDetails.businesses_count})</div>
              <div className="space-y-1">
                {playerDetails.businesses?.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30 text-xs">
                    <span className="text-white">{b.business_type} L{b.level}</span>
                    <span className="text-cyan-400">💎 {b.durability?.toFixed(0)}%</span>
                  </div>
                ))}
                {playerDetails.businesses_count === 0 && <div className="text-xs text-gray-500">Нет бизнесов</div>}
              </div>
            </div>

            {/* Plots */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2">🗺️ Участки ({playerDetails.plots_count})</div>
              {playerDetails.plots_count === 0 && <div className="text-xs text-gray-500">Нет участков</div>}
            </div>

            {/* Device / Multi-account / Login History */}
            <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-700/30">
              <div className="text-xs font-bold text-gray-400 mb-2">📱 Устройство и IP</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">IP:</span>
                  <span className="text-white font-mono">{playerDetails.user?.last_ip || 'Не определено'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Браузер:</span>
                  <span className="text-white">{playerDetails.user?.last_browser || 'Не определено'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Устройство:</span>
                  <span className="text-white">{playerDetails.user?.last_device || 'Не определено'}</span>
                </div>
              </div>
              
              {/* Login history */}
              {playerDetails.user?.login_history?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-bold text-gray-400 mb-1">История входов (последние {playerDetails.user.login_history.length}):</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {[...playerDetails.user.login_history].reverse().map((entry, i) => (
                      <div key={i} className="p-1.5 rounded bg-gray-800/50 text-xs flex items-center gap-2">
                        <span className="text-gray-500 w-28 shrink-0">{new Date(entry.timestamp).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                        <span className="text-cyan-400 font-mono w-28 shrink-0">{entry.ip}</span>
                        <span className="text-white">{entry.browser}</span>
                        <span className="text-gray-500">{entry.device}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {playerDetails.is_multi_account && (
                <div className="mt-3 p-2 rounded-lg bg-red-900/30 border border-red-700/50">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {playerDetails.multi_account_warning}
                  </div>
                </div>
              )}
              
              {playerDetails.same_device_accounts?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-gray-400">Аккаунты на этом устройстве:</div>
                  {playerDetails.same_device_accounts.map((a, i) => (
                    <div key={i} className="p-1.5 rounded-lg bg-red-900/20 text-xs flex justify-between">
                      <span className="text-white">{a.display_name || a.username || a.id?.slice(0, 12)}</span>
                      <span className="text-gray-500">{a.wallet_address ? shortenAddress(toUserFriendlyAddress(a.wallet_address)) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PricesTab({ token, headers }) {
  const [prices, setPrices] = useState({});
  const [editPrices, setEditPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [botResource, setBotResource] = useState('');
  const [botAmount, setBotAmount] = useState(100);
  const [botPrice, setBotPrice] = useState(0);
  const [botListings, setBotListings] = useState([]);

  const loadPrices = async () => {
    try {
      const res = await axios.get(`${API}/admin/market/prices`, { headers });
      setPrices(res.data.prices || {});
      const edits = {};
      Object.entries(res.data.prices || {}).forEach(([r, d]) => {
        edits[r] = d.current_price;
      });
      setEditPrices(edits);
    } catch (e) {
      toast.error('Ошибка загрузки цен');
    }
    setLoading(false);
  };

  const loadBotListings = async () => {
    try {
      const res = await axios.get(`${API}/admin/market/bot-listings`, { headers });
      setBotListings(res.data.listings || []);
    } catch (e) {}
  };

  const savePrices = async () => {
    try {
      const updates = {};
      Object.entries(editPrices).forEach(([r, p]) => {
        if (prices[r] && Math.abs(p - prices[r].current_price) > 0.0001) {
          updates[r] = Math.max(0.01, p);
        }
      });
      if (Object.keys(updates).length === 0) {
        toast.info('Нет изменений');
        return;
      }
      await axios.post(`${API}/admin/market/prices/update`, updates, { headers });
      toast.success(`Обновлено ${Object.keys(updates).length} цен`);
      loadPrices();
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  const stabilizeResource = async (resource) => {
    const target = editPrices[resource] || prices[resource]?.base_price;
    try {
      await axios.post(`${API}/admin/market/stabilize?resource=${resource}&target_price=${target}`, {}, { headers });
      toast.success(`Бот-стабилизатор запущен для ${resource}`);
    } catch (e) {
      toast.error('Ошибка запуска стабилизатора');
    }
  };

  const createBotListing = async () => {
    if (!botResource) { toast.error('Выберите ресурс'); return; }
    if (botAmount <= 0) { toast.error('Количество должно быть > 0'); return; }
    try {
      const res = await axios.post(`${API}/admin/market/bot-listing`, {
        resource_type: botResource,
        amount: botAmount,
        price_per_unit: botPrice > 0 ? botPrice : 0,
      }, { headers });
      toast.success(`Бот выставил ${res.data.amount} ${res.data.icon} ${res.data.resource_name} по ${res.data.price_per_unit} $CITY`);
      setBotResource('');
      setBotAmount(100);
      setBotPrice(0);
      loadBotListings();
    } catch (e) {
      toast.error('Ошибка создания листинга');
    }
  };

  const removeBotListing = async (id) => {
    try {
      await axios.delete(`${API}/admin/market/bot-listing/${id}`, { headers });
      toast.success('Листинг удалён');
      loadBotListings();
    } catch (e) {
      toast.error('Ошибка удаления');
    }
  };

  useEffect(() => { loadPrices(); loadBotListings(); }, []);

  if (loading) return <div className="text-gray-500 text-center py-8">Загрузка цен...</div>;

  return (
    <div className="space-y-6">
      {/* Section: Resource prices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-300">💰 Управление ценами ресурсов ($CITY)</h3>
          <Button onClick={savePrices} size="sm" className="bg-green-600 hover:bg-green-700">
            <Save className="w-3 h-3 mr-1" /> Сохранить
          </Button>
        </div>

        <div className="space-y-2">
          {Object.entries(prices).sort((a, b) => (a[1].tier || 0) - (b[1].tier || 0)).map(([resource, data]) => (
            <div key={resource} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
              <span className="text-xl w-8 text-center">{data.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{data.name_ru}</div>
                <div className="text-xs text-gray-500">Tier {data.tier} • Дефолт: {data.base_price} $CITY</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.01"
                  value={editPrices[resource] || 0}
                  onChange={(e) => setEditPrices({...editPrices, [resource]: parseFloat(e.target.value) || 0.01})}
                  className="w-24 h-8 bg-gray-900 border-gray-600 text-white text-xs text-right"
                />
                <span className="text-xs text-gray-500 w-12">$CITY</span>
                <Button size="sm" variant="ghost" onClick={() => stabilizeResource(resource)} className="text-amber-400 hover:bg-amber-900/20 text-xs h-8 px-2" title="Стабилизатор">
                  <Shield className="w-3 h-3 mr-1" /> Бот
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Bot listings */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-300">🤖 Бот-листинг: выставить товар на торговлю</h3>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-cyan-500/20 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Ресурс</label>
              <select
                value={botResource}
                onChange={(e) => {
                  setBotResource(e.target.value);
                  const base = prices[e.target.value]?.base_price || 0;
                  setBotPrice(base);
                }}
                className="w-full h-9 bg-gray-900 border border-gray-600 rounded-md text-white text-sm px-2"
              >
                <option value="">Выберите...</option>
                {Object.entries(prices).sort((a, b) => (a[1].tier || 0) - (b[1].tier || 0)).map(([r, d]) => (
                  <option key={r} value={r}>{d.icon} {d.name_ru}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Количество</label>
              <Input
                type="number"
                min="1"
                value={botAmount}
                onChange={(e) => setBotAmount(parseInt(e.target.value) || 0)}
                className="h-9 bg-gray-900 border-gray-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Цена за ед. ($CITY)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={botPrice}
                onChange={(e) => setBotPrice(parseFloat(e.target.value) || 0)}
                className="h-9 bg-gray-900 border-gray-600 text-white text-sm"
                placeholder="0 = дефолт"
              />
            </div>
          </div>
          <Button onClick={createBotListing} size="sm" className="bg-cyan-600 hover:bg-cyan-700 w-full">
            Выставить от бота
          </Button>
        </div>

        {botListings.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-text-muted">Активные бот-листинги ({botListings.length}):</div>
            {botListings.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/20 border border-gray-700/30 text-sm">
                <span className="text-lg">{prices[l.resource_type]?.icon || '📦'}</span>
                <span className="text-white flex-1">{prices[l.resource_type]?.name_ru || l.resource_type}</span>
                <span className="text-cyan-400 font-mono">{l.amount} шт</span>
                <span className="text-amber-400 font-mono">{l.price_per_unit} $CITY</span>
                <Button size="sm" variant="ghost" onClick={() => removeBotListing(l.id)} className="text-red-400 hover:bg-red-900/20 h-7 px-2">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
