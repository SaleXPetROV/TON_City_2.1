/**
 * FingerprintJS OSS helper — собирает локальный visitor_id устройства.
 * Подписан и кэшируется в sessionStorage, чтобы не инициализировать агент
 * при каждом вызове.
 */
import FingerprintJS from '@fingerprintjs/fingerprintjs';

let _agentPromise = null;
let _visitorIdPromise = null;

function _getAgent() {
  if (!_agentPromise) {
    _agentPromise = FingerprintJS.load({ monitoring: false });
  }
  return _agentPromise;
}

/**
 * Получить visitor_id. Кэшируется на всё время жизни вкладки.
 * Возвращает пустую строку в случае ошибки — backend всё равно сохранит событие.
 */
export async function getVisitorId() {
  if (_visitorIdPromise) return _visitorIdPromise;

  _visitorIdPromise = (async () => {
    try {
      const cached = sessionStorage.getItem('fpjs_visitor_id');
      if (cached) return cached;
      const agent = await _getAgent();
      const result = await agent.get();
      const id = result.visitorId || '';
      if (id) sessionStorage.setItem('fpjs_visitor_id', id);
      return id;
    } catch (e) {
      console.warn('[fingerprint] failed:', e);
      return '';
    }
  })();

  return _visitorIdPromise;
}
