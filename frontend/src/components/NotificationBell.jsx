import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const token = localStorage.getItem('token');
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const markRead = async (id) => {
    await fetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unread = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        data-testid="notification-bell"
        onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <span className="text-white font-bold text-sm">{t('notifications')}</span>
            {unread > 0 && <span className="text-xs text-gray-400">{unread} {t('newNotifications')}</span>}
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">{t('noNotifications')}</div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="p-3 border-b border-gray-800 hover:bg-gray-800/50 flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-white text-xs font-medium">{n.title}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{n.message}</div>
                </div>
                <button onClick={() => markRead(n.id)} className="text-gray-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
