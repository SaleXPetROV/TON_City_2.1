import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldX, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BlockedOverlay({ user }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    if (user?.is_blocked) {
      setIsBlocked(true);
      setBlockReason(user.block_reason || 'Нарушение правил');
    } else {
      setIsBlocked(false);
    }
  }, [user]);

  // Check block status periodically
  useEffect(() => {
    const checkBlockStatus = async () => {
      const token = localStorage.getItem('token') || localStorage.getItem('ton_city_token');
      if (!token) return;
      
      try {
        const response = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.is_blocked) {
            setIsBlocked(true);
            setBlockReason(data.block_reason || 'Нарушение правил');
          } else {
            setIsBlocked(false);
          }
        }
      } catch (error) {
        // Silently ignore — this is a background poll
      }
    };

    const interval = setInterval(checkBlockStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {isBlocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-lg"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="text-center px-6 max-w-md mx-auto"
          >
            {/* Icon */}
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 mx-auto mb-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center"
            >
              <ShieldX className="w-12 h-12 text-red-500" />
            </motion.div>

            {/* Title */}
            <h1 className="text-3xl font-unbounded font-bold text-red-500 mb-4">
              Аккаунт заблокирован
            </h1>
            
            {/* Reason */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <p className="text-white/80 text-sm mb-2">Причина блокировки:</p>
              <p className="text-white font-medium">{blockReason}</p>
            </div>

            {/* Description */}
            <p className="text-white/60 text-sm mb-8">
              Ваш аккаунт был заблокирован за нарушение правил платформы. 
              Если вы считаете, что это ошибка, обратитесь в службу поддержки.
            </p>

            {/* Support Contacts */}
            <div className="space-y-3">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Контакты поддержки</p>
              
              <a 
                href="mailto:support@toncity.com"
                className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4 text-cyan-400" />
                <span className="text-white">support@toncity.com</span>
              </a>
              
              <a 
                href="https://t.me/toncity_support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-white">@toncity_support</span>
              </a>
            </div>

            {/* Logout button */}
            <Button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('ton_city_token');
                window.location.href = '/';
              }}
              className="mt-8 bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              Выйти
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
