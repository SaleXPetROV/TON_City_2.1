import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X, Wrench } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const POLL_INTERVAL_MS = 60_000; // 1 min
const DISMISS_KEY = 'durability_banner_dismissed_until';

/**
 * Global top-of-page alert for any user business with durability < 20%.
 * Mirrors the Telegram `notify_durability_warning_20` broadcast so players
 * without Telegram still get an in-session heads-up.
 */
export default function DurabilityBanner({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const token = localStorage.getItem('ton_city_token') || localStorage.getItem('token');
    if (!token) {
      setAlerts([]);
      return;
    }
    try {
      const res = await fetch(`${API}/notifications/low-durability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setAlerts([]);
        return;
      }
      const data = await res.json();
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    // Honour dismissal snooze (1 hour)
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    if (until && Date.now() < until) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
    if (!user) return;
    fetchAlerts();
    const t = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [user, fetchAlerts]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
    setDismissed(true);
  };

  if (!user || dismissed || alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const headline = critical > 0
    ? `${critical} бизнес${critical === 1 ? '' : 'а'} в критическом состоянии (<10%)`
    : `${alerts.length} бизнес${alerts.length === 1 ? '' : 'а'} с прочностью <20%`;

  return (
    <div
      data-testid="durability-banner"
      className="fixed top-0 inset-x-0 z-[60] bg-gradient-to-r from-red-600/95 via-orange-600/95 to-red-600/95 border-b border-red-400/40 backdrop-blur-sm shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 text-white">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">
            ⚠️ {headline}
          </div>
          <div className="text-xs text-red-100/90 truncate hidden sm:block">
            {alerts.slice(0, 3).map((a) => `${a.business_type} Ур.${a.level} (${a.durability}%)`).join(' · ')}
            {alerts.length > 3 && ` · ещё ${alerts.length - 3}`}
          </div>
        </div>
        <Link
          to="/my-businesses"
          data-testid="durability-banner-cta"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 border border-white/40 rounded-md text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
        >
          <Wrench className="w-3.5 h-3.5" />
          Починить
        </Link>
        <button
          onClick={handleDismiss}
          data-testid="durability-banner-dismiss"
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Закрыть на час"
          title="Закрыть на час"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
