import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MaintenanceOverlay() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [message, setMessage] = useState('Технические работы');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated first
    const token = localStorage.getItem('token') || localStorage.getItem('ton_city_token');
    if (token) {
      setIsAuthenticated(true);
      checkAdminStatus(token);
    }
    
    // Check maintenance status
    checkMaintenanceStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(checkMaintenanceStatus, 30000);
    
    // Listen for login events
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        const newToken = e.newValue;
        if (newToken) {
          setIsAuthenticated(true);
          checkAdminStatus(newToken);
        } else {
          setIsAuthenticated(false);
          setIsAdmin(false);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for same-tab login detection
    const handleAuthEvent = () => {
      const t = localStorage.getItem('token');
      if (t) {
        setIsAuthenticated(true);
        checkAdminStatus(t);
      }
    };
    
    window.addEventListener('ton-city-auth', handleAuthEvent);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ton-city-auth', handleAuthEvent);
    };
  }, []);

  const checkAdminStatus = async (token) => {
    try {
      if (!token) return;
      
      const response = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin === true);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const checkMaintenanceStatus = async () => {
    try {
      const response = await fetch(`${API}/maintenance-status`);
      if (response.ok) {
        const data = await response.json();
        setIsMaintenanceMode(data.enabled === true);
        if (data.message) {
          setMessage(data.message);
        }
      }
    } catch (error) {
      console.error('Failed to check maintenance status:', error);
    }
  };

  // Only show if: maintenance is on AND user is authenticated (tried to login) AND user is NOT admin
  const isOnAdminPage = typeof window !== 'undefined' && window.location.pathname === '/admin';
  const shouldShow = isMaintenanceMode && isAuthenticated && !isAdmin && !isOnAdminPage;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          data-testid="maintenance-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-void/98 backdrop-blur-xl flex items-center justify-center"
        >
          {/* Background Grid Effect */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(rgba(255, 165, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 165, 0, 0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          {/* Content */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative text-center px-8 max-w-md"
          >
            {/* Icon */}
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border-2 border-orange-500/30 flex items-center justify-center"
            >
              <Wrench className="w-16 h-16 text-orange-400" />
            </motion.div>

            {/* Title */}
            <h1 className="font-unbounded text-3xl sm:text-4xl font-bold text-white mb-4 uppercase tracking-tight">
              {message}
            </h1>

            {/* Subtitle */}
            <p className="text-text-muted text-lg mb-8">
              Мы улучшаем TON City для вас. Пожалуйста, вернитесь позже.
            </p>

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-6 py-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-orange-500"
              />
              <span className="text-orange-400 font-semibold uppercase tracking-wider text-sm">
                Проводим работы
              </span>
            </div>

            {/* Animated Dots */}
            <div className="flex justify-center gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    y: [0, -10, 0],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-3 h-3 rounded-full bg-orange-500/50"
                />
              ))}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
                <Clock className="w-4 h-4" />
                <span>Скоро вернёмся!</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
