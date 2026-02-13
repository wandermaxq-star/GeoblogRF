/**
 * Скрипт для тестирования цикла "Гость → Пост → Одобрение → Регистрация → XP"
 * 
 * Использование:
 * 1. Откройте приложение в режиме гостя (инкогнито)
 * 2. Откройте консоль браузера (F12)
 * 3. Скопируйте и выполните этот скрипт
 * 4. Следуйте инструкциям
 */

(async function testGuestCycle() {
  console.log('🧪 ========================================');
  console.log('🧪 ТЕСТ ЦИКЛА: Гость → Пост → Регистрация → XP');
  console.log('🧪 ========================================');
  console.log('');
  
  try {
    // Импортируем функции (нужно будет адаптировать под ваш проект)
    console.log('📦 Загрузка модулей...');
    
    // Проверяем, что мы в режиме гостя
    const token = localStorage.getItem('token');
    if (token) {
      console.warn('⚠️ ВНИМАНИЕ: Вы авторизованы! Для теста нужно быть гостем.');
      console.warn('⚠️ Откройте приложение в режиме инкогнито или выйдите из аккаунта.');
      return;
    }
    
    // Получаем guestId
    const guestData = localStorage.getItem('guest_session_data');
    let guestId;
    if (guestData) {
      guestId = JSON.parse(guestData).sessionId;
    } else {
      guestId = `guest_${Date.now()}`;
      localStorage.setItem('guest_session_data', JSON.stringify({ sessionId: guestId }));
    }
    
    console.log('✅ Guest ID:', guestId);
    console.log('');
    
    // Шаг 1: Создаем тестовый пост
    console.log('📝 ШАГ 1: Создание тестового поста...');
    
    const postData = {
      title: `Тестовый пост для проверки цикла ${new Date().toLocaleTimeString()}`,
      body: 'Этот пост создан автоматически для проверки ретроактивного начисления XP при регистрации гостя.',
      photo_urls: null,
      marker_id: null,
      route_id: null,
      event_id: null
    };
    
    // Загружаем guestDrafts
    const STORAGE_KEY_DRAFTS = 'geoblog_guest_drafts_v1';
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY_DRAFTS) || '[]');
    const draft = {
      id: `post:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      type: 'post',
      data: postData,
      createdAt: new Date().toISOString()
    };
    drafts.unshift(draft);
    localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(drafts));
    
    console.log('✅ Пост создан (draft):', draft.id);
    
    // Загружаем guestActions
    const STORAGE_KEY_ACTIONS = 'geoblog_guest_actions_v1';
    const actions = JSON.parse(localStorage.getItem(STORAGE_KEY_ACTIONS) || '[]');
    const action = {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      guestId: guestId,
      actionType: 'post',
      contentId: draft.id,
      contentData: postData,
      createdAt: new Date().toISOString(),
      approved: false,
      moderationStatus: 'pending',
      metadata: {
        hasPhoto: false,
        hasMarker: false
      }
    };
    actions.push(action);
    localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(actions));
    
    console.log('✅ Действие гостя записано:', action.id);
    console.log('');
    
    // Шаг 2: Помечаем как одобренный (для теста)
    console.log('✅ ШАГ 2: Помечаем пост как одобренный (для теста)...');
    
    const actionToApprove = actions.find(a => a.id === action.id);
    if (actionToApprove) {
      actionToApprove.approved = true;
      actionToApprove.moderatedAt = new Date().toISOString();
      actionToApprove.moderationStatus = 'approved';
      localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(actions));
      console.log('✅ Пост помечен как одобренный!');
    } else {
      console.error('❌ Действие не найдено!');
      return;
    }
    
    // Проверяем результат
    const approvedActions = actions.filter(a => a.guestId === guestId && a.approved);
    console.log(`✅ Одобренных действий: ${approvedActions.length}`);
    console.log('');
    
    // Шаг 3: Инструкции
    console.log('📋 ШАГ 3: Инструкции для завершения теста');
    console.log('');
    console.log('1. Зарегистрируйтесь через интерфейс приложения');
    console.log('2. После регистрации должно появиться модальное окно "Добро пожаловать!"');
    console.log('3. В модальном окне будет показано начисленное XP');
    console.log('');
    console.log('📊 Для проверки после регистрации выполните:');
    console.log(`
      // Проверка уровня и XP
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const user = JSON.parse(userStr);
      
      const levelRes = await fetch(\`/api/gamification/level/\${user.id}\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const level = await levelRes.json();
      console.log('Уровень:', level);
      
      const xpRes = await fetch(\`/api/gamification/xp-history\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const xpHistory = await xpRes.json();
      console.log('История XP:', xpHistory);
    `);
    console.log('');
    console.log('✅ Тестовые данные подготовлены!');
    console.log('');
    console.log('📝 Данные для отладки:');
    console.log('  - Guest ID:', guestId);
    console.log('  - Draft ID:', draft.id);
    console.log('  - Action ID:', action.id);
    console.log('  - Одобренных действий:', approvedActions.length);
    
    return {
      success: true,
      guestId: guestId,
      draftId: draft.id,
      actionId: action.id,
      approvedActions: approvedActions.length
    };
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error);
    return {
      success: false,
      error: error.message
    };
  }
})();

