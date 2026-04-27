// Полная система переводов TON City — 8 языков
// en=English, ru=Русский, es=Español, zh=中文, fr=Français, de=Deutsch, ja=日本語, ko=한국어

export const translations = {
  common: {
    loading: { en: 'Loading...', ru: 'Загрузка...', es: 'Cargando...', zh: '加载中...', fr: 'Chargement...', de: 'Laden...', ja: '読み込み中...', ko: '로딩...' },
    error: { en: 'Error', ru: 'Ошибка', es: 'Error', zh: '错误', fr: 'Erreur', de: 'Fehler', ja: 'エラー', ko: '오류' },
    success: { en: 'Success', ru: 'Успешно', es: 'Éxito', zh: '成功', fr: 'Succès', de: 'Erfolg', ja: '成功', ko: '성공' },
    cancel: { en: 'Cancel', ru: 'Отмена', es: 'Cancelar', zh: '取消', fr: 'Annuler', de: 'Abbrechen', ja: 'キャンセル', ko: '취소' },
    confirm: { en: 'Confirm', ru: 'Подтвердить', es: 'Confirmar', zh: '确认', fr: 'Confirmer', de: 'Bestätigen', ja: '確認', ko: '확인' },
    close: { en: 'Close', ru: 'Закрыть', es: 'Cerrar', zh: '关闭', fr: 'Fermer', de: 'Schließen', ja: '閉じる', ko: '닫기' },
    save: { en: 'Save', ru: 'Сохранить', es: 'Guardar', zh: '保存', fr: 'Sauvegarder', de: 'Speichern', ja: '保存', ko: '저장' },
    delete: { en: 'Delete', ru: 'Удалить', es: 'Eliminar', zh: '删除', fr: 'Supprimer', de: 'Löschen', ja: '削除', ko: '삭제' },
    edit: { en: 'Edit', ru: 'Редактировать', es: 'Editar', zh: '编辑', fr: 'Modifier', de: 'Bearbeiten', ja: '編集', ko: '편집' },
    back: { en: 'Back', ru: 'Назад', es: 'Atrás', zh: '返回', fr: 'Retour', de: 'Zurück', ja: '戻る', ko: '뒤로' },
    next: { en: 'Next', ru: 'Далее', es: 'Siguiente', zh: '下一步', fr: 'Suivant', de: 'Weiter', ja: '次へ', ko: '다음' },
    previous: { en: 'Previous', ru: 'Назад', es: 'Anterior', zh: '上一步', fr: 'Précédent', de: 'Zurück', ja: '前へ', ko: '이전' },
    refresh: { en: 'Refresh', ru: 'Обновить', es: 'Actualizar', zh: '刷新', fr: 'Rafraîchir', de: 'Aktualisieren', ja: '更新', ko: '새로고침' },
    collect: { en: 'Collect', ru: 'Собрать', es: 'Recoger', zh: '收取', fr: 'Collecter', de: 'Einsammeln', ja: '収集', ko: '수집' },
    collect_all: { en: 'Collect All', ru: 'Собрать всё', es: 'Recoger todo', zh: '全部收取', fr: 'Tout collecter', de: 'Alles einsammeln', ja: 'すべて収集', ko: '모두 수집' },
    under_dev: { en: 'Under Development', ru: 'В разработке', es: 'En desarrollo', zh: '开发中', fr: 'En développement', de: 'In Entwicklung', ja: '開発中', ko: '개발 중' },
    visit: { en: 'Visit', ru: 'Посетить', es: 'Visitar', zh: '访问', fr: 'Visiter', de: 'Besuchen', ja: '訪問', ko: '방문' },
  },

  nav: {
    home: { en: 'Home', ru: 'Главная', es: 'Inicio', zh: '主页', fr: 'Accueil', de: 'Startseite', ja: 'ホーム', ko: '홈' },
    map: { en: 'Map', ru: 'Карта', es: 'Mapa', zh: '地图', fr: 'Carte', de: 'Karte', ja: 'マップ', ko: '지도' },
    my_businesses: { en: 'My Businesses', ru: 'Мои бизнесы', es: 'Mis negocios', zh: '我的企业', fr: 'Mes entreprises', de: 'Meine Unternehmen', ja: 'マイビジネス', ko: '내 사업' },
    marketplace: { en: 'Marketplace', ru: 'Маркетплейс', es: 'Mercado', zh: '市场', fr: 'Marché', de: 'Marktplatz', ja: 'マーケット', ko: '마켓' },
    trading: { en: 'Trading', ru: 'Торговля', es: 'Comercio', zh: '交易', fr: 'Commerce', de: 'Handel', ja: 'トレード', ko: '거래' },
    leaderboard: { en: 'Leaderboard', ru: 'Рейтинг', es: 'Clasificación', zh: '排行榜', fr: 'Classement', de: 'Rangliste', ja: 'ランキング', ko: '순위' },
    chat: { en: 'Chat', ru: 'Чат', es: 'Chat', zh: '聊天', fr: 'Chat', de: 'Chat', ja: 'チャット', ko: '채팅' },
    calculator: { en: 'Calculator', ru: 'Калькулятор', es: 'Calculadora', zh: '计算器', fr: 'Calculateur', de: 'Rechner', ja: '計算機', ko: '계산기' },
    tutorial: { en: 'Tutorial', ru: 'Обучение', es: 'Tutorial', zh: '教程', fr: 'Tutoriel', de: 'Anleitung', ja: 'チュートリアル', ko: '튜토리얼' },
    support: { en: 'Support', ru: 'Поддержка', es: 'Soporte', zh: '支持', fr: 'Support', de: 'Support', ja: 'サポート', ko: '지원' },
    settings: { en: 'Settings', ru: 'Настройки', es: 'Ajustes', zh: '设置', fr: 'Paramètres', de: 'Einstellungen', ja: '設定', ko: '설정' },
  },

  balance: {
    title: { en: 'Balance', ru: 'Баланс', es: 'Saldo', zh: '余额', fr: 'Solde', de: 'Guthaben', ja: '残高', ko: '잔액' },
    deposit: { en: 'Deposit', ru: 'Пополнить', es: 'Depositar', zh: '充值', fr: 'Déposer', de: 'Einzahlen', ja: '入金', ko: '입금' },
    withdraw: { en: 'Withdraw', ru: 'Вывести', es: 'Retirar', zh: '提款', fr: 'Retirer', de: 'Abheben', ja: '出金', ko: '출금' },
    insufficient: { en: 'Insufficient funds', ru: 'Недостаточно средств', es: 'Fondos insuficientes', zh: '余额不足', fr: 'Fonds insuffisants', de: 'Unzureichende Mittel', ja: '残高不足', ko: '잔액 부족' },
  },

  plots: {
    title: { en: 'Plots', ru: 'Участки', es: 'Parcelas', zh: '地块', fr: 'Parcelles', de: 'Grundstücke', ja: '区画', ko: '부지' },
    available: { en: 'Available Plots', ru: 'Доступные участки', es: 'Parcelas disponibles', zh: '可用地块', fr: 'Parcelles disponibles', de: 'Verfügbare Grundstücke', ja: '利用可能な区画', ko: '이용 가능한 부지' },
    owned: { en: 'Owned', ru: 'Куплено', es: 'Comprado', zh: '已拥有', fr: 'Possédé', de: 'Im Besitz', ja: '所有済み', ko: '보유' },
    buy: { en: 'Buy Plot', ru: 'Купить участок', es: 'Comprar parcela', zh: '购买地块', fr: 'Acheter une parcelle', de: 'Grundstück kaufen', ja: '区画を購入', ko: '부지 구매' },
    sell: { en: 'Sell Plot', ru: 'Продать участок', es: 'Vender parcela', zh: '出售地块', fr: 'Vendre parcelle', de: 'Grundstück verkaufen', ja: '区画を売却', ko: '부지 판매' },
    price: { en: 'Price', ru: 'Цена', es: 'Precio', zh: '价格', fr: 'Prix', de: 'Preis', ja: '価格', ko: '가격' },
    zone: { en: 'Zone', ru: 'Зона', es: 'Zona', zh: '区域', fr: 'Zone', de: 'Zone', ja: 'ゾーン', ko: '구역' },
    fields_left: { en: 'Fields left', ru: 'Полей осталось', es: 'Campos restantes', zh: '剩余字段', fr: 'Champs restants', de: 'Verbleibende Felder', ja: '残りフィールド', ko: '남은 필드' },
    owner: { en: 'Owner', ru: 'Владелец', es: 'Propietario', zh: '所有者', fr: 'Propriétaire', de: 'Eigentümer', ja: 'オーナー', ko: '소유자' },
    offer_buy: { en: 'Offer to Buy', ru: 'Предложить купить', es: 'Ofrecer comprar', zh: '出价购买', fr: 'Offrir d\'acheter', de: 'Kaufangebot', ja: '購入を提案', ko: '구매 제안' },
  },

  zones: {
    core: { en: 'Core', ru: 'Ядро', es: 'Núcleo', zh: '核心', fr: 'Noyau', de: 'Kern', ja: 'コア', ko: '코어' },
    inner: { en: 'Inner', ru: 'Центр', es: 'Interior', zh: '内圈', fr: 'Intérieur', de: 'Innen', ja: '内側', ko: '내부' },
    middle: { en: 'Middle', ru: 'Средняя', es: 'Media', zh: '中圈', fr: 'Milieu', de: 'Mitte', ja: '中間', ko: '중간' },
    outer: { en: 'Outer', ru: 'Внешняя', es: 'Exterior', zh: '外圈', fr: 'Extérieur', de: 'Außen', ja: '外側', ko: '외부' },
  },

  businesses: {
    title: { en: 'Businesses', ru: 'Бизнесы', es: 'Negocios', zh: '企业', fr: 'Entreprises', de: 'Unternehmen', ja: 'ビジネス', ko: '비즈니스' },
    build: { en: 'Build Business', ru: 'Построить бизнес', es: 'Construir negocio', zh: '建造企业', fr: 'Construire une entreprise', de: 'Unternehmen bauen', ja: 'ビジネスを建設', ko: '비즈니스 건설' },
    upgrade: { en: 'Upgrade', ru: 'Улучшить', es: 'Mejorar', zh: '升级', fr: 'Améliorer', de: 'Upgraden', ja: 'アップグレード', ko: '업그레이드' },
    level: { en: 'Level', ru: 'Уровень', es: 'Nivel', zh: '等级', fr: 'Niveau', de: 'Stufe', ja: 'レベル', ko: '레벨' },
    income: { en: 'Income', ru: 'Доход', es: 'Ingresos', zh: '收入', fr: 'Revenu', de: 'Einkommen', ja: '収入', ko: '수입' },
    income_day: { en: 'Income/day', ru: 'Доход/день', es: 'Ingresos/día', zh: '日收入', fr: 'Revenu/jour', de: 'Einkommen/Tag', ja: '日収', ko: '일일 수입' },
    cost: { en: 'Cost', ru: 'Стоимость', es: 'Coste', zh: '成本', fr: 'Coût', de: 'Kosten', ja: '費用', ko: '비용' },
    daily_income: { en: 'Daily Income', ru: 'Доход в день', es: 'Ingresos diarios', zh: '每日收入', fr: 'Revenu quotidien', de: 'Tägliches Einkommen', ja: '日収', ko: '일일 수입' },
    total_businesses: { en: 'Total Businesses', ru: 'Всего бизнесов', es: 'Total negocios', zh: '总企业数', fr: 'Total entreprises', de: 'Gesamte Unternehmen', ja: '総ビジネス数', ko: '총 비즈니스' },
    pending_income: { en: 'Pending Income', ru: 'Доход (TON)', es: 'Ingresos pendientes', zh: '待收收入', fr: 'Revenus en attente', de: 'Ausstehende Einnahmen', ja: '保留中の収入', ko: '대기 중인 수입' },
    durability: { en: 'Durability', ru: 'Прочность', es: 'Durabilidad', zh: '耐久度', fr: 'Durabilité', de: 'Haltbarkeit', ja: '耐久性', ko: '내구도' },
    repair: { en: 'Repair', ru: 'Ремонт', es: 'Reparar', zh: '维修', fr: 'Réparer', de: 'Reparieren', ja: '修理', ko: '수리' },
    needs_repair: { en: 'Needs repair!', ru: 'Требуется ремонт!', es: '¡Necesita reparación!', zh: '需要维修!', fr: 'Réparation nécessaire!', de: 'Reparatur nötig!', ja: '修理が必要!', ko: '수리 필요!' },
    status: { en: 'Status', ru: 'Статус', es: 'Estado', zh: '状态', fr: 'Statut', de: 'Status', ja: 'ステータス', ko: '상태' },
    active: { en: 'Active', ru: 'Активен', es: 'Activo', zh: '活跃', fr: 'Actif', de: 'Aktiv', ja: 'アクティブ', ko: '활성' },
    wear: { en: 'Wear', ru: 'Износ', es: 'Desgaste', zh: '磨损', fr: 'Usure', de: 'Verschleiß', ja: '摩耗', ko: '마모' },
    stopped: { en: 'Stopped', ru: 'Остановлен', es: 'Detenido', zh: '已停止', fr: 'Arrêté', de: 'Gestoppt', ja: '停止', ko: '중지' },
    patron: { en: 'Patron', ru: 'Патрон', es: 'Patrón', zh: '赞助人', fr: 'Patron', de: 'Patron', ja: 'パトロン', ko: '후원자' },
    priority_build: { en: 'Priority to build', ru: 'Приоритет постройки', es: 'Prioridad de construcción', zh: '优先建造', fr: 'Priorité de construction', de: 'Baupriorität', ja: '建設優先度', ko: '건설 우선순위' },
    for_sale: { en: 'Businesses for sale', ru: 'Бизнесов на продаже', es: 'Negocios en venta', zh: '出售中的企业', fr: 'Entreprises à vendre', de: 'Unternehmen zum Verkauf', ja: '売り出し中のビジネス', ko: '판매 중인 비즈니스' },
    land_value: { en: 'Land value', ru: 'Стоимость земель', es: 'Valor de tierras', zh: '土地价值', fr: 'Valeur des terrains', de: 'Grundstückswert', ja: '土地価値', ko: '토지 가치' },
  },

  marketplace: {
    title: { en: 'Marketplace', ru: 'Маркетплейс', es: 'Mercado', zh: '市场', fr: 'Marché', de: 'Marktplatz', ja: 'マーケットプレイス', ko: '마켓플레이스' },
    land: { en: 'Land', ru: 'Земля', es: 'Tierra', zh: '土地', fr: 'Terrain', de: 'Land', ja: '土地', ko: '토지' },
    my_listings: { en: 'My Listings', ru: 'Мои листинги', es: 'Mis listados', zh: '我的上架', fr: 'Mes annonces', de: 'Meine Angebote', ja: 'マイリスト', ko: '내 목록' },
    sell_land: { en: 'Sell Land', ru: 'Продать землю', es: 'Vender tierra', zh: '出售土地', fr: 'Vendre terrain', de: 'Land verkaufen', ja: '土地を売却', ko: '토지 판매' },
    plots_for_sale: { en: 'Plots for sale', ru: 'Участков на продаже', es: 'Parcelas en venta', zh: '出售中的地块', fr: 'Parcelles à vendre', de: 'Grundstücke zum Verkauf', ja: '売り出し中の区画', ko: '판매 중인 부지' },
    ton_balance: { en: 'TON Balance', ru: 'TON баланс', es: 'Saldo TON', zh: 'TON余额', fr: 'Solde TON', de: 'TON Guthaben', ja: 'TON残高', ko: 'TON 잔액' },
  },

  map: {
    title: { en: 'Map', ru: 'Карта', es: 'Mapa', zh: '地图', fr: 'Carte', de: 'Karte', ja: 'マップ', ko: '지도' },
    island: { en: 'TON Island', ru: 'Остров TON', es: 'Isla TON', zh: 'TON岛', fr: 'Île TON', de: 'TON Insel', ja: 'TONアイランド', ko: 'TON 섬' },
    isometric_map: { en: 'Isometric map', ru: 'Изометрическая карта', es: 'Mapa isométrico', zh: '等距地图', fr: 'Carte isométrique', de: 'Isometrische Karte', ja: 'アイソメトリックマップ', ko: '아이소메트릭 맵' },
    legend: { en: 'Legend', ru: 'Легенда', es: 'Leyenda', zh: '图例', fr: 'Légende', de: 'Legende', ja: '凡例', ko: '범례' },
    your_plots: { en: 'Your plots', ru: 'Ваши участки', es: 'Tus parcelas', zh: '你的地块', fr: 'Vos parcelles', de: 'Ihre Grundstücke', ja: 'あなたの区画', ko: '내 부지' },
    other_plots: { en: "Others' plots", ru: 'Чужие участки', es: 'Parcelas de otros', zh: '他人地块', fr: 'Parcelles d\'autres', de: 'Andere Grundstücke', ja: '他のプレイヤーの区画', ko: '다른 부지' },
    free_zones: { en: 'Free zones', ru: 'Свободные зоны', es: 'Zonas libres', zh: '空闲区域', fr: 'Zones libres', de: 'Freie Zonen', ja: 'フリーゾーン', ko: '자유 구역' },
    recommendations: { en: 'Recommendations', ru: 'Рекомендации', es: 'Recomendaciones', zh: '推荐', fr: 'Recommandations', de: 'Empfehlungen', ja: 'おすすめ', ko: '추천' },
    profitable_biz: { en: 'Profitable Business', ru: 'Выгодный бизнес', es: 'Negocio rentable', zh: '盈利企业', fr: 'Entreprise rentable', de: 'Profitables Unternehmen', ja: '収益性の高いビジネス', ko: '수익성 비즈니스' },
    cities: { en: 'Cities', ru: 'Города', es: 'Ciudades', zh: '城市', fr: 'Villes', de: 'Städte', ja: '都市', ko: '도시' },
    loading_map: { en: 'Loading map...', ru: 'Загрузка карты...', es: 'Cargando mapa...', zh: '加载地图...', fr: 'Chargement de la carte...', de: 'Karte wird geladen...', ja: 'マップを読み込み中...', ko: '지도 로딩...' },
  },

  calculator: {
    title: { en: 'Calculator', ru: 'Калькулятор', es: 'Calculadora', zh: '计算器', fr: 'Calculateur', de: 'Rechner', ja: '計算機', ko: '계산기' },
    select_business: { en: 'Select business', ru: 'Выберите бизнес', es: 'Seleccionar negocio', zh: '选择企业', fr: 'Sélectionner entreprise', de: 'Unternehmen wählen', ja: 'ビジネスを選択', ko: '비즈니스 선택' },
    select_zone: { en: 'Select zone', ru: 'Выберите зону', es: 'Seleccionar zona', zh: '选择区域', fr: 'Sélectionner zone', de: 'Zone wählen', ja: 'ゾーンを選択', ko: '구역 선택' },
    investment: { en: 'Investment', ru: 'Инвестиция', es: 'Inversión', zh: '投资', fr: 'Investissement', de: 'Investition', ja: '投資', ko: '투자' },
    daily_profit: { en: 'Daily Profit', ru: 'Дневная прибыль', es: 'Beneficio diario', zh: '每日利润', fr: 'Profit quotidien', de: 'Täglicher Gewinn', ja: '日次利益', ko: '일일 이익' },
    monthly_profit: { en: 'Monthly Profit', ru: 'Месячная прибыль', es: 'Beneficio mensual', zh: '月利润', fr: 'Profit mensuel', de: 'Monatlicher Gewinn', ja: '月次利益', ko: '월간 이익' },
    payback: { en: 'Payback', ru: 'Окупаемость', es: 'Recuperación', zh: '回本', fr: 'Rentabilité', de: 'Amortisation', ja: '回収期間', ko: '회수 기간' },
    tax_rate: { en: 'Tax Rate', ru: 'Налог', es: 'Impuesto', zh: '税率', fr: 'Taux d\'imposition', de: 'Steuersatz', ja: '税率', ko: '세율' },
    land_cost: { en: 'Land Cost', ru: 'Стоимость земли', es: 'Coste del terreno', zh: '土地成本', fr: 'Coût du terrain', de: 'Grundstückskosten', ja: '土地費用', ko: '토지 비용' },
    build_cost: { en: 'Build Cost', ru: 'Стоимость постройки', es: 'Coste de construcción', zh: '建造成本', fr: 'Coût de construction', de: 'Baukosten', ja: '建設費用', ko: '건설 비용' },
    total_cost: { en: 'Total Cost', ru: 'Общая стоимость', es: 'Coste total', zh: '总成本', fr: 'Coût total', de: 'Gesamtkosten', ja: '総費用', ko: '총 비용' },
    roi: { en: 'ROI', ru: 'ROI', es: 'ROI', zh: '投资回报率', fr: 'ROI', de: 'ROI', ja: 'ROI', ko: 'ROI' },
    days: { en: 'days', ru: 'дней', es: 'días', zh: '天', fr: 'jours', de: 'Tage', ja: '日', ko: '일' },
  },

  leaderboard: {
    title: { en: 'Leaderboard', ru: 'Таблица лидеров', es: 'Clasificación', zh: '排行榜', fr: 'Classement', de: 'Rangliste', ja: 'ランキング', ko: '순위표' },
    rank: { en: 'Rank', ru: 'Место', es: 'Rango', zh: '排名', fr: 'Rang', de: 'Rang', ja: '順位', ko: '순위' },
    player: { en: 'Player', ru: 'Игрок', es: 'Jugador', zh: '玩家', fr: 'Joueur', de: 'Spieler', ja: 'プレイヤー', ko: '플레이어' },
    businesses: { en: 'Businesses', ru: 'Бизнесов', es: 'Negocios', zh: '企业', fr: 'Entreprises', de: 'Unternehmen', ja: 'ビジネス', ko: '비즈니스' },
  },

  chat: {
    title: { en: 'Chat', ru: 'Чат', es: 'Chat', zh: '聊天', fr: 'Chat', de: 'Chat', ja: 'チャット', ko: '채팅' },
    global: { en: 'Global', ru: 'Глобальный', es: 'Global', zh: '全球', fr: 'Global', de: 'Global', ja: 'グローバル', ko: '글로벌' },
    send: { en: 'Send', ru: 'Отправить', es: 'Enviar', zh: '发送', fr: 'Envoyer', de: 'Senden', ja: '送信', ko: '보내기' },
    type_message: { en: 'Type a message...', ru: 'Введите сообщение...', es: 'Escribe un mensaje...', zh: '输入消息...', fr: 'Tapez un message...', de: 'Nachricht eingeben...', ja: 'メッセージを入力...', ko: '메시지를 입력하세요...' },
    messages: { en: 'Messages', ru: 'Сообщения', es: 'Mensajes', zh: '消息', fr: 'Messages', de: 'Nachrichten', ja: 'メッセージ', ko: '메시지' },
    dm: { en: 'Direct Message', ru: 'Личное сообщение', es: 'Mensaje directo', zh: '私信', fr: 'Message direct', de: 'Direktnachricht', ja: 'ダイレクトメッセージ', ko: '다이렉트 메시지' },
    accept: { en: 'Accept', ru: 'Принять', es: 'Aceptar', zh: '接受', fr: 'Accepter', de: 'Akzeptieren', ja: '承認', ko: '수락' },
    decline: { en: 'Decline', ru: 'Отклонить', es: 'Rechazar', zh: '拒绝', fr: 'Refuser', de: 'Ablehnen', ja: '拒否', ko: '거절' },
  },

  landing: {
    title: { en: 'Build Your Digital City', ru: 'Построй свой цифровой город', es: 'Construye tu ciudad digital', zh: '建造你的数字城市', fr: 'Construisez votre ville numérique', de: 'Bauen Sie Ihre digitale Stadt', ja: 'デジタルシティを建設', ko: '디지털 도시 건설' },
    subtitle: { en: 'on TON Blockchain', ru: 'на блокчейне TON', es: 'en la blockchain TON', zh: '基于TON区块链', fr: 'sur la blockchain TON', de: 'auf der TON-Blockchain', ja: 'TONブロックチェーン上で', ko: 'TON 블록체인에서' },
    description: { en: 'Economic strategy with real cryptocurrency. Buy land, build businesses, create connections with other players and earn TON.', ru: 'Экономическая стратегия с реальной криптовалютой. Покупайте землю, стройте бизнесы, создавайте связи с другими игроками и зарабатывайте TON.', es: 'Estrategia económica con criptomoneda real. Compra terrenos, construye negocios y gana TON.', zh: '使用真实加密货币的经济策略游戏。购买土地，建造企业，与其他玩家建立联系并赚取TON。', fr: 'Stratégie économique avec de la cryptomonnaie réelle. Achetez des terrains, construisez des entreprises et gagnez des TON.', de: 'Wirtschaftsstrategie mit echter Kryptowährung. Kaufen Sie Land, bauen Sie Unternehmen und verdienen Sie TON.', ja: '本物の暗号通貨を使った経済戦略ゲーム。土地を購入し、ビジネスを構築し、TONを稼ぎましょう。', ko: '실제 암호화폐를 사용하는 경제 전략 게임. 토지를 구매하고, 사업을 건설하고, TON을 벌어보세요.' },
    start_building: { en: 'Start Building', ru: 'Начать строить', es: 'Empezar a construir', zh: '开始建造', fr: 'Commencer à construire', de: 'Starte zu bauen', ja: '建設を開始', ko: '건설 시작' },
    tutorial: { en: 'Tutorial', ru: 'Обучение', es: 'Tutorial', zh: '教程', fr: 'Tutoriel', de: 'Anleitung', ja: 'チュートリアル', ko: '튜토리얼' },
    players: { en: 'Players', ru: 'Игроков', es: 'Jugadores', zh: '玩家', fr: 'Joueurs', de: 'Spieler', ja: 'プレイヤー', ko: '플레이어' },
    plots_bought: { en: 'Plots Bought', ru: 'Куплено участков', es: 'Parcelas compradas', zh: '已购地块', fr: 'Parcelles achetées', de: 'Gekaufte Grundstücke', ja: '購入された区画', ko: '구매된 부지' },
    ton_circulation: { en: 'TON in Circulation', ru: 'TON в обороте', es: 'TON en circulación', zh: '流通中的TON', fr: 'TON en circulation', de: 'TON im Umlauf', ja: '流通中のTON', ko: '유통 중인 TON' },
    build_city: { en: 'Build City', ru: 'Строй город', es: 'Construir ciudad', zh: '建造城市', fr: 'Construire ville', de: 'Stadt bauen', ja: '都市を建設', ko: '도시 건설' },
    earn_money: { en: 'Earn Money', ru: 'Зарабатывай', es: 'Ganar dinero', zh: '赚钱', fr: 'Gagner de l\'argent', de: 'Geld verdienen', ja: 'お金を稼ぐ', ko: '돈 벌기' },
    trade: { en: 'Trade', ru: 'Торгуй', es: 'Comercia', zh: '交易', fr: 'Commercer', de: 'Handeln', ja: 'トレード', ko: '거래' },
    grow: { en: 'Grow', ru: 'Расти', es: 'Crecer', zh: '成长', fr: 'Grandir', de: 'Wachsen', ja: '成長', ko: '성장' },
    how_it_works: { en: 'How It Works', ru: 'Как это работает', es: 'Cómo funciona', zh: '如何运作', fr: 'Comment ça marche', de: 'So funktioniert es', ja: '仕組み', ko: '작동 방식' },
    your_stats: { en: 'Your Stats', ru: 'Ваша статистика', es: 'Tus estadísticas', zh: '你的统计', fr: 'Vos statistiques', de: 'Ihre Statistiken', ja: 'あなたの統計', ko: '내 통계' },
    login: { en: 'Login', ru: 'Войти', es: 'Iniciar sesión', zh: '登录', fr: 'Connexion', de: 'Anmelden', ja: 'ログイン', ko: '로그인' },
    register: { en: 'Register', ru: 'Регистрация', es: 'Registrarse', zh: '注册', fr: 'S\'inscrire', de: 'Registrieren', ja: '登録', ko: '회원가입' },
    to_city: { en: 'To City', ru: 'В город', es: 'A la ciudad', zh: '进入城市', fr: 'Vers la ville', de: 'Zur Stadt', ja: '都市へ', ko: '도시로' },
  },

  stats: {
    total_players: { en: 'Total Players', ru: 'Всего игроков', es: 'Total jugadores', zh: '总玩家数', fr: 'Total joueurs', de: 'Gesamte Spieler', ja: '総プレイヤー数', ko: '전체 플레이어' },
    businesses: { en: 'Businesses', ru: 'Бизнесов', es: 'Negocios', zh: '企业数', fr: 'Entreprises', de: 'Unternehmen', ja: 'ビジネス', ko: '비즈니스' },
    ton: { en: 'TON', ru: 'TON', es: 'TON', zh: 'TON', fr: 'TON', de: 'TON', ja: 'TON', ko: 'TON' },
    coins: { en: 'Coins', ru: 'Монет', es: 'Monedas', zh: '金币', fr: 'Pièces', de: 'Münzen', ja: 'コイン', ko: '코인' },
  },

  time: {
    day: { en: 'day', ru: 'день', es: 'día', zh: '天', fr: 'jour', de: 'Tag', ja: '日', ko: '일' },
    days: { en: 'days', ru: 'дней', es: 'días', zh: '天', fr: 'jours', de: 'Tage', ja: '日', ko: '일' },
    hour: { en: 'hour', ru: 'час', es: 'hora', zh: '小时', fr: 'heure', de: 'Stunde', ja: '時間', ko: '시간' },
    hours: { en: 'hours', ru: 'часов', es: 'horas', zh: '小时', fr: 'heures', de: 'Stunden', ja: '時間', ko: '시간' },
    minute: { en: 'minute', ru: 'минута', es: 'minuto', zh: '分钟', fr: 'minute', de: 'Minute', ja: '分', ko: '분' },
    minutes: { en: 'minutes', ru: 'минут', es: 'minutos', zh: '分钟', fr: 'minutes', de: 'Minuten', ja: '分', ko: '분' },
    ago: { en: 'ago', ru: 'назад', es: 'hace', zh: '前', fr: 'il y a', de: 'vor', ja: '前', ko: '전' },
  },

  modals: {
    deposit_title: { en: 'Deposit TON', ru: 'Пополнить баланс', es: 'Depositar TON', zh: '充值TON', fr: 'Déposer TON', de: 'TON einzahlen', ja: 'TONを入金', ko: 'TON 입금' },
    withdraw_title: { en: 'Withdraw TON', ru: 'Вывести средства', es: 'Retirar TON', zh: '提取TON', fr: 'Retirer TON', de: 'TON abheben', ja: 'TONを出金', ko: 'TON 출금' },
    amount: { en: 'Amount', ru: 'Сумма', es: 'Cantidad', zh: '金额', fr: 'Montant', de: 'Betrag', ja: '金額', ko: '금액' },
  },

  messages: {
    transaction_success: { en: 'Transaction successful', ru: 'Транзакция успешна', es: 'Transacción exitosa', zh: '交易成功', fr: 'Transaction réussie', de: 'Transaktion erfolgreich', ja: '取引成功', ko: '거래 성공' },
    plot_purchased: { en: 'Plot purchased!', ru: 'Участок куплен!', es: '¡Parcela comprada!', zh: '地块已购买!', fr: 'Parcelle achetée!', de: 'Grundstück gekauft!', ja: '区画を購入しました!', ko: '부지 구매 완료!' },
    business_built: { en: 'Business built!', ru: 'Бизнес построен!', es: '¡Negocio construido!', zh: '企业已建造!', fr: 'Entreprise construite!', de: 'Unternehmen gebaut!', ja: 'ビジネスを建設しました!', ko: '비즈니스 건설 완료!' },
    insufficient_balance: { en: 'Insufficient balance', ru: 'Недостаточно средств', es: 'Saldo insuficiente', zh: '余额不足', fr: 'Solde insuffisant', de: 'Unzureichendes Guthaben', ja: '残高不足', ko: '잔액 부족' },
    income_collected: { en: 'Income collected!', ru: 'Доход собран!', es: '¡Ingresos recogidos!', zh: '收入已收取!', fr: 'Revenus collectés!', de: 'Einkommen eingesammelt!', ja: '収入を回収しました!', ko: '수입 수집 완료!' },
    repaired: { en: 'Repaired!', ru: 'Отремонтировано!', es: '¡Reparado!', zh: '已修复!', fr: 'Réparé!', de: 'Repariert!', ja: '修理完了!', ko: '수리 완료!' },
  },

  admin: {
    title: { en: 'Admin Panel', ru: 'Админ панель', es: 'Panel de administración', zh: '管理面板', fr: 'Panneau d\'administration', de: 'Admin-Panel', ja: '管理パネル', ko: '관리자 패널' },
    approve: { en: 'Approve', ru: 'Одобрить', es: 'Aprobar', zh: '批准', fr: 'Approuver', de: 'Genehmigen', ja: '承認', ko: '승인' },
    reject: { en: 'Reject', ru: 'Отклонить', es: 'Rechazar', zh: '拒绝', fr: 'Rejeter', de: 'Ablehnen', ja: '拒否', ko: '거절' },
  },
};

// Маппинг кодов языков UI -> ключей в translations
const LANG_MAP = {
  en: 'en', gb: 'en',
  ru: 'ru',
  es: 'es',
  cn: 'zh', zh: 'zh',
  fr: 'fr',
  de: 'de',
  jp: 'ja', ja: 'ja',
  kr: 'ko', ko: 'ko',
};

export const t = (path, lang = 'en') => {
  const mappedLang = LANG_MAP[lang?.toLowerCase()] || 'en';
  const keys = path.split('.');
  let value = translations;

  for (const key of keys) {
    value = value?.[key];
    if (!value) return path;
  }

  return value[mappedLang] || value['en'] || path;
};
