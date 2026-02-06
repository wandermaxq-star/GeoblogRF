import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useEffect } from 'react';
import InfluenceHub from '../components/InfluenceHub';

export default function CentrePage() {
  const { user } = useAuth();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel(); // Основная панель центра влияния
    registerPanel(); // Боковая панель с достижениями
    return () => {
      unregisterPanel(); // Основная панель
      unregisterPanel(); // Боковая панель
    };
  }, [registerPanel, unregisterPanel]);

  if (!user) return (
    <MirrorGradientContainer>
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="deep-container p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Загрузка...</p>
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );

  return (
    <MirrorGradientContainer className="page-layout-container">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="embossed-container full-height-container p-6">
            {/* Первый блок */}
            <div className="deep-card p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gradient">Центр управления</h2>
              <p className="text-gray-600 mb-6">
                Управляйте всеми аспектами вашего путешествия из одного места
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 hover-lift">
                  <div className="text-3xl mb-2">🗺️</div>
                  <h3 className="font-semibold">Карты</h3>
                  <p className="text-sm text-gray-600">Интерактивные карты</p>
                </div>
                <div className="text-center p-4 hover-lift">
                  <div className="text-3xl mb-2">📅</div>
                  <h3 className="font-semibold">Календарь</h3>
                  <p className="text-sm text-gray-600">Планирование маршрутов</p>
                </div>
                <div className="text-center p-4 hover-lift">
                  <div className="text-3xl mb-2">💬</div>
                  <h3 className="font-semibold">Чат</h3>
                  <p className="text-sm text-gray-600">Общение с сообществом</p>
                </div>
              </div>
            </div>
            {/* Второй блок */}
            <div className="deep-card p-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gradient mb-4">Добро пожаловать, {user.username}!</h2>
                <p className="text-gray-600">
                  Здесь появится ваша персональная галактика достижений, квесты, лидерборды и многое другое!
                </p>
              </div>
              {/* Заглушка для будущего контента */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="deep-card p-6 text-center hover-scale">
                  <div className="text-4xl mb-4">🏆</div>
                  <h3 className="text-lg font-semibold mb-2">Достижения</h3>
                  <p className="text-sm text-gray-600">Ваши награды и достижения</p>
                </div>
                <div className="deep-card p-6 text-center hover-scale">
                  <div className="text-4xl mb-4">🎯</div>
                  <h3 className="text-lg font-semibold mb-2">Квесты</h3>
                  <p className="text-sm text-gray-600">Активные и выполненные задания</p>
                </div>
                <div className="deep-card p-6 text-center hover-scale">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-2">Рейтинги</h3>
                  <p className="text-sm text-gray-600">Ваша позиция в лидербордах</p>
                </div>
              </div>
            </div>
            <InfluenceHub />
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );
}