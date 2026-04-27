import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-void text-white p-6">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-6 border-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Политика конфиденциальности TON-City</h1>
        <p className="text-text-muted mb-4">Дата вступления в силу: 27 марта 2026 г.</p>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Введение</h2>
            <p>Настоящая Политика конфиденциальности описывает, как TON-City (далее — «мы», «нас» или «наш») собирает, использует и защищает информацию, которую вы предоставляете при использовании нашей платформы.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Собираемая информация</h2>
            <p>Мы можем собирать следующую информацию:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong>Данные аккаунта:</strong> адрес электронной почты, имя пользователя, адрес криптовалютного кошелька.</li>
              <li><strong>Данные об использовании:</strong> информация о ваших действиях на платформе, история транзакций.</li>
              <li><strong>Технические данные:</strong> IP-адрес, тип браузера, устройство, операционная система.</li>
              <li><strong>Данные безопасности:</strong> информация о двухфакторной аутентификации, журналы входа.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Использование информации</h2>
            <p>Собранная информация используется для:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Предоставления и улучшения наших услуг.</li>
              <li>Обеспечения безопасности вашего аккаунта.</li>
              <li>Связи с вами по вопросам, связанным с платформой.</li>
              <li>Предотвращения мошенничества и злоупотреблений.</li>
              <li>Выполнения требований законодательства.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Защита данных</h2>
            <p>Мы применяем технические и организационные меры для защиты вашей информации, включая:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Шифрование данных при передаче (SSL/TLS).</li>
              <li>Хеширование паролей и секретных ключей.</li>
              <li>Ограниченный доступ к персональным данным.</li>
            </ul>
            <p className="mt-2 text-amber-400">Однако ни один метод передачи или хранения данных не является полностью безопасным. Мы не можем гарантировать абсолютную безопасность ваших данных.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Передача данных третьим лицам</h2>
            <p>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением случаев:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Когда это необходимо для предоставления услуг (например, обработка платежей).</li>
              <li>По требованию законодательства или судебных органов.</li>
              <li>Для защиты наших прав и безопасности пользователей.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Ваши права</h2>
            <p>Вы имеете право:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Запросить доступ к своим персональным данным.</li>
              <li>Запросить исправление неточных данных.</li>
              <li>Запросить удаление ваших данных (с учётом законодательных ограничений).</li>
              <li>Отозвать согласие на обработку данных.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Хранение данных</h2>
            <p>Мы храним ваши данные столько, сколько необходимо для предоставления услуг или выполнения требований законодательства. После удаления аккаунта данные могут храниться в резервных копиях ограниченное время.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Файлы cookie</h2>
            <p>Мы используем файлы cookie и аналогичные технологии для:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Поддержания сессии авторизации.</li>
              <li>Запоминания ваших настроек.</li>
              <li>Анализа использования платформы.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Изменения политики</h2>
            <p>Мы можем обновлять настоящую Политику конфиденциальности. О существенных изменениях мы уведомим вас через платформу или по электронной почте.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Контакты</h2>
            <p>По вопросам, связанным с конфиденциальностью, обращайтесь через раздел поддержки на платформе.</p>
          </section>
          
          <section className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
            <p className="text-cyan-400 font-semibold">Продолжая использовать платформу TON-City, вы соглашаетесь с условиями настоящей Политики конфиденциальности.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
