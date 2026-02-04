import React, { useState } from 'react';
import { FaMapMarkedAlt, FaEdit, FaStar, FaCalendarAlt, FaComments, FaHandshake, FaArchive, FaUsers, FaCrown, FaGem, FaMedal, FaAward, FaRocket, FaFire, FaHeart, FaCamera } from 'react-icons/fa';
import { useUserData } from '../../hooks/useUserData';
import { useAchievements } from '../../hooks/useAchievements';
import StarRating from '../Common/StarRating';

interface FriendProfileProps {
  friend: {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
    status?: 'online' | 'recently' | 'offline';
  };
  onClose: () => void;
}

const FriendProfile: React.FC<FriendProfileProps> = ({ friend, onClose }) => {
  const [activeOrbit, setActiveOrbit] = useState<string | null>(null);
  const [hoveredOrbit, setHoveredOrbit] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<any[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [viewMode, setViewMode] = useState<'main' | 'achievements'>('main');

  // Получаем данные друга
  const userData = useUserData(friend.id);
  const { achievements, getUnlockedAchievements, getPublicAchievements } = useAchievements();

  // Цвета орбит (те же, что в ProfileCenter)
  const orbitColors = {
    routes: 'from-green-400 to-green-500',
    posts: 'from-purple-400 to-purple-500',
    places: 'from-orange-400 to-orange-500',
    events: 'from-blue-400 to-blue-500',
    chats: 'from-cyan-400 to-cyan-500',
    meetings: 'from-pink-400 to-pink-500',
    archive: 'from-gray-400 to-gray-500',
    achievements: 'from-yellow-400 to-yellow-500',
    friends: 'from-emerald-400 to-emerald-500'
  };

  // Обработчики событий
  const handleOrbitClick = (orbitType: string) => {
    if (orbitType === 'achievements') {
      setViewMode('achievements');
      return;
    }
    
    setActiveOrbit(orbitType);
    
    // Используем реальные данные друга
    const realData = {
      routes: userData.routes,
      posts: userData.posts,
      places: userData.places,
      events: [], // Пока пустой массив
      chats: [], // Пока пустой массив
      meetings: [], // Пока пустой массив
      archive: [], // Пока пустой массив
      friends: [] // Пока пустой массив
    };
    
    setModalContent(realData[orbitType as keyof typeof realData] || []);
    setModalTitle(getOrbitTitle(orbitType));
    setShowModal(true);
  };

  const handleBackToMain = () => {
    setViewMode('main');
  };

  const handleOrbitHover = (orbitType: string | null) => {
    setHoveredOrbit(orbitType);
  };

  const getOrbitTitle = (orbitType: string): string => {
    const titles = {
      routes: 'Маршруты',
      posts: 'Посты',
      places: 'Места',
      events: 'События',
      chats: 'Чаты',
      meetings: 'Встречи',
      archive: 'Архив',
      achievements: 'Достижения',
      friends: 'Друзья'
    };
    return titles[orbitType as keyof typeof titles] || orbitType;
  };

  const getOrbitCount = (orbitType: string): number => {
    const counts = {
      routes: userData.routes.length,
      posts: userData.posts.length,
      places: userData.places.length,
      events: 0, // Пока 0
      chats: 0, // Пока 0
      meetings: 0, // Пока 0
      archive: 0, // Пока 0
      achievements: getPublicAchievements().length, // Только публичные достижения
      friends: 0 // Пока 0
    };
    return counts[orbitType as keyof typeof counts] || 0;
  };

  const getOrbitIcon = (orbitType: string) => {
    const icons = {
      routes: FaMapMarkedAlt,
      posts: FaEdit,
      places: FaStar,
      events: FaCalendarAlt,
      chats: FaComments,
      meetings: FaHandshake,
      archive: FaArchive,
      achievements: FaAward,
      friends: FaUsers
    };
    return icons[orbitType as keyof typeof icons] || FaUsers;
  };

  // Рендер достижений друга
  const renderAchievementsOrbit = () => {
    const achievementsToShow = getPublicAchievements(); // Только публичные достижения
    
    if (achievementsToShow.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FaAward className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-sm text-gray-500">Нет достижений</div>
          </div>
        </div>
      );
    }

    return achievementsToShow.map((achievement, index) => {
      const angle = (index * 360) / achievementsToShow.length;
      const radius = 80; // Меньший радиус для мини-профиля
      const x = Math.cos(angle * Math.PI / 180) * radius;
      const y = Math.sin(angle * Math.PI / 180) * radius;
      
      // Маппинг иконок достижений
      const iconMap = {
        'trophy': FaAward,
        'star': FaStar,
        'crown': FaCrown,
        'gem': FaGem,
        'medal': FaMedal,
        'award': FaAward,
        'rocket': FaRocket,
        'fire': FaFire,
        'heart': FaHeart,
        'map': FaMapMarkedAlt,
        'camera': FaCamera,
      };
      
      const IconComponent = iconMap[achievement.icon as keyof typeof iconMap] || FaAward;
      
      // Цвета по редкости
      const rarityColors = {
        common: 'from-gray-400 to-gray-500',
        rare: 'from-blue-400 to-blue-500', 
        epic: 'from-purple-400 to-purple-500',
        legendary: 'from-yellow-400 to-yellow-500',
      };

      return (
        <div
          key={achievement.id}
          className="absolute cursor-pointer transition-all duration-500"
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}
          title={`${achievement.title}: ${achievement.description}`}
        >
          {/* Значок достижения */}
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${rarityColors[achievement.rarity]} flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform duration-300`} style={{ animation: 'spin 8s linear infinite' }}>
            <IconComponent className="w-4 h-4" />
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Профиль друга</h3>
              <div className="text-sm text-white/80 mt-1">
                {friend.username} • {friend.status || 'offline'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Контент */}
        <div className="p-6">
          {/* Центральное ядро с орбитами */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            {/* Центральное ядро */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-30 animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl ring-2 ring-white/30">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="text-white text-lg font-bold">{friend.username?.charAt(0).toUpperCase() || 'F'}</div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg">
                  <div className="w-full h-full bg-green-400 rounded-full animate-ping"></div>
                </div>
              </div>
            </div>

            {/* Орбиты */}
            {viewMode === 'main' ? (
              Object.keys(orbitColors).map((orbitType, index) => {
                const angle = (index * 360) / Object.keys(orbitColors).length;
                const radius = 80; // Меньший радиус для мини-профиля
                const x = Math.cos(angle * Math.PI / 180) * radius;
                const y = Math.sin(angle * Math.PI / 180) * radius;
                
                const count = getOrbitCount(orbitType);
                const isHovered = hoveredOrbit === orbitType;
                const isActive = activeOrbit === orbitType;
                const IconComponent = getOrbitIcon(orbitType);
                
                return (
                  <div
                    key={orbitType}
                    className="absolute cursor-pointer transition-all duration-500"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10
                    }}
                    onClick={() => handleOrbitClick(orbitType)}
                    onMouseEnter={() => handleOrbitHover(orbitType)}
                    onMouseLeave={() => handleOrbitHover(null)}
                  >
                    {/* Орбита */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${orbitColors[orbitType as keyof typeof orbitColors]} flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 ${
                      isHovered ? 'ring-2 ring-white/50 scale-110' : 'scale-100'
                    } ${isActive ? 'scale-105 ring-1 ring-white/30' : ''}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    
                    {/* Счетчик */}
                    <div className="absolute -top-1 -right-1 bg-white rounded-full w-3 h-3 flex items-center justify-center text-xs font-bold text-gray-800 shadow-md border border-gray-200">
                      {count}
                    </div>
                  </div>
                );
              })
            ) : (
              // Режим достижений
              <>
                {renderAchievementsOrbit()}
                
                {/* Кнопка возврата */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={handleBackToMain}
                    className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 hover:bg-white hover:text-gray-800 transition-colors shadow-lg border border-gray-200 text-xs"
                    title="Вернуться к основным разделам"
                  >
                    ←
                  </button>
                </div>
                
                {/* Заголовок режима достижений */}
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-800">Достижения</div>
                    <div className="text-xs text-gray-600">
                      {getPublicAchievements().length}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Статистика */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-gray-800">{userData.routes.length + userData.posts.length}</div>
              <div className="text-xs text-gray-600">Всего контента</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-gray-800">{getPublicAchievements().length}</div>
              <div className="text-xs text-gray-600">Достижений</div>
            </div>
          </div>
        </div>

        {/* Модальное окно с контентом */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{modalTitle}</h3>
                    <div className="text-sm text-white/80 mt-1">
                      {friend.username}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {/* Контент модального окна */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="grid gap-3">
                  {modalContent.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">📭</div>
                      <div>Пока нет контента</div>
                    </div>
                  ) : (
                    modalContent.slice(0, 5).map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-800 truncate">{item.title}</h4>
                            <p className="text-sm text-gray-600 truncate">{item.preview}</p>
                          </div>
                          {item.rating && (
                            <div className="ml-2 flex-shrink-0">
                              <StarRating
                                rating={item.rating || 0}
                                isInteractive={false}
                                showNumber={true}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendProfile;
