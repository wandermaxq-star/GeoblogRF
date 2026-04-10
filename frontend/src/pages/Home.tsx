import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore } from '../stores/contentStore';
import { RUSSIA_TOURIST_ATTRACTIONS } from '../config/russia';
import { FEATURES } from '../config/features';
import RussiaContent from '../components/RussiaContent/index';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const layoutContext = useLayoutState();

  // Проверяем, что LayoutContext загружен
  if (!layoutContext) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка главной страницы...</p>
        </div>
      </div>
    );
  }

  const setRightContent = useContentStore((state) => state.setRightContent);
  const setLeftContent = useContentStore((state) => state.setLeftContent);

  const handleNavigateToMap = () => {
    navigate('/map');
  };

  const handleNavigateToPlanner = () => {
    navigate('/planner');
  };

  const handleNavigateToCalendar = () => {
    setLeftContent('map');
    setRightContent('calendar');
    navigate('/map');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Добро пожаловать в{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ГеоБлог.рф
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {FEATURES.RUSSIA_COMPLIANCE_MODE 
              ? 'Откройте для себя удивительные места России, планируйте маршруты по нашей необъятной стране и делитесь впечатлениями'
              : 'Откройте для себя удивительные места, планируйте маршруты и делитесь впечатлениями с друзьями'
            }
          </p>
          {FEATURES.RUSSIA_COMPLIANCE_MODE && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
              <p className="text-blue-800 font-medium">
                🇷🇺 Сервис для путешествий по России
              </p>
              <p className="text-blue-600 text-sm mt-1">
                Все маршруты и достопримечательности только в границах Российской Федерации
              </p>
            </div>
          )}
        </div>

        {/* Основные функции */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Карта */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-map-location-dot text-2xl text-blue-600"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Интерактивная карта</h3>
              <p className="text-gray-600 mb-6">
                Исследуйте достопримечательности, находите интересные места и создавайте свои маршруты
              </p>
              <button
                onClick={handleNavigateToMap}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Открыть карту
              </button>
            </div>
          </div>

          {/* Планировщик */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-route text-2xl text-green-600"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Планировщик маршрутов</h3>
              <p className="text-gray-600 mb-6">
                Создавайте оптимальные маршруты, добавляйте точки интереса и сохраняйте свои планы
              </p>
              <button
                onClick={handleNavigateToPlanner}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Создать маршрут
              </button>
            </div>
          </div>

          {/* Календарь */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-calendar text-2xl text-purple-600"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Календарь событий</h3>
              <p className="text-gray-600 mb-6">
                Отмечайте важные даты, планируйте поездки и не пропускайте интересные события
              </p>
              <button
                onClick={handleNavigateToCalendar}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Открыть календарь
              </button>
            </div>
          </div>
        </div>

        {/* Дополнительные функции */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Дополнительные возможности</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-user-astronaut text-2xl text-white"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Центр Влияния</h4>
              <p className="text-sm text-gray-600">Отслеживайте своё влияние в сообществе</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-blog text-2xl text-white"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Мой блог</h4>
              <p className="text-sm text-gray-600">Делитесь впечатлениями</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-users text-2xl text-white"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Друзья</h4>
              <p className="text-sm text-gray-600">Находите единомышленников</p>
            </div>
          </div>
        </div>

        {/* Российский контент */}
        {FEATURES.RUSSIA_COMPLIANCE_MODE && (
          <div className="mt-16">
            <RussiaContent showAll={false} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
