import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { getMarkerVisualClasses, getRouteVisualClasses, getEventVisualClasses } from '../utils/visualStates';
import { FaUser, FaCog, FaSignOutAlt, FaTrophy, FaMapMarkedAlt, FaStar, FaChartLine, FaTimes, FaCamera, FaUsers, FaEnvelope, FaChevronDown, FaFileAlt, FaBell, FaCloud, FaChartBar } from 'react-icons/fa';
import { moderationNotificationsService } from '../services/moderationNotificationsService';
import { RouteData } from '../types/route';
import { getRoutes } from '../api/routes';
import { listPosts, PostDTO } from '../services/postsService';
import AchievementsDashboard from './Achievements/AchievementsDashboard';
import { useFriends } from '../hooks/useFriends';
import FriendProfile from './Profile/FriendProfile';
import ProfileCenter from './Profile/ProfileCenter';
import CategoryButton from './CategoryButton';
import { useAnalyticsConsent } from '../hooks/useAnalyticsConsent';
import OfflineDraftsPanel from './Posts/OfflineDraftsPanel';
import { offlineContentStorage } from '../services/offlineContentStorage';
// import { getUserBlogs } from '../api/blogs';
// import { Blog } from '../types/blog';

// Стили для счетчиков избранного
const counterBaseClasses = 'rounded-lg p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-xl';
const counterGradient = {
	blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
	green: 'bg-gradient-to-r from-green-500 to-green-600 text-white',
	purple: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
};
const counterMuted = 'opacity-60';
const counterActiveRing = 'ring-2 ring-offset-2 ring-white/50 shadow-xl scale-105';

// Стили для подкатегорий маршрутов
const subcategoryBaseClasses = 'rounded-lg p-3 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-xl';
const subcategoryGradient = {
	posts: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white',
	events: 'bg-gradient-to-r from-pink-500 to-pink-600 text-white',
	personal: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
};
const subcategoryMuted = 'opacity-60';
const subcategoryActiveRing = 'ring-2 ring-offset-2 ring-white/50 shadow-xl scale-105';

// Стили для подкатегорий мест
const placeSubcategoryGradient = {
	attraction: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
	restaurant: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
	hotel: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
	shop: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
	transport: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white',
	other: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white'
};

// Стили для подкатегорий событий
const eventSubcategoryGradient = {
	upcoming: 'bg-gradient-to-r from-green-500 to-green-600 text-white',
	past: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white',
	created: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
	participating: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
};

interface ProfilePanelProps {
  onClose: () => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ onClose }) => {
  const auth = useAuth();
  const favorites = useFavorites();
  const { friends } = useFriends();
  
  // Если AuthContext еще загружается, показываем загрузку только для критических элементов
  if (!auth) {
    return (
      <div className="profile-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  const { user, logout, updateUserAvatar } = auth;
  const favoritesStats = favorites.getFavoritesStats();
  const [activeTab, setActiveTab] = useState<'profile' | 'friends' | 'achievements' | 'favorites' | 'posts' | 'settings'>('profile');
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [draftsCount, setDraftsCount] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(user?.avatar_url || null);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFavCategory, setActiveFavCategory] = useState<'routes' | 'places' | 'events'>('routes');
  const [activePlaceCategory, setActivePlaceCategory] = useState<'posts' | 'events' | 'personal'>('personal');
  const [activeEventCategory, setActiveEventCategory] = useState<'posts' | 'events' | 'personal'>('personal');
  const [activeRouteSubcategory, setActiveRouteSubcategory] = useState<'posts' | 'events' | 'personal'>('personal');
  const [activePlaceSubcategory, setActivePlaceSubcategory] = useState<'attraction' | 'restaurant' | 'hotel' | 'shop' | 'transport' | 'other'>('attraction');
  const [activePlacePurposeSubcategory, setActivePlacePurposeSubcategory] = useState<'posts' | 'events' | 'personal'>('personal');
  const [activeEventSubcategory, setActiveEventSubcategory] = useState<'upcoming' | 'past' | 'created' | 'participating'>('upcoming');
  const [activeEventPurposeSubcategory, setActiveEventPurposeSubcategory] = useState<'posts' | 'events' | 'personal'>('personal');
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<PostDTO[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    moderationNotificationsService.isEnabled()
  );
  const { isTrackingEnabled, setAnalyticsOptOut, isLoading: isAnalyticsLoading } = useAnalyticsConsent();


  // Загрузка постов пользователя при открытии вкладки "Мои посты"
  useEffect(() => {
    const loadUserPosts = async () => {
      if (activeTab !== 'posts') return;
      if (!auth.token) return;
      
      setPostsLoading(true);
      try {
        const response = await listPosts({ limit: 50 });
        // Фильтруем только посты текущего пользователя
        const myPosts = response.data.filter((post: PostDTO) => post.author_id === user?.id);
        setUserPosts(myPosts);
      } catch (error) {
        console.error('Ошибка загрузки постов:', error);
        setUserPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };
    
    loadUserPosts();
  }, [activeTab, auth.token, user?.id]);
  // const [userBlogs, setUserBlogs] = useState<Blog[]>([]);
  // const [blogsLoading, setBlogsLoading] = useState(false);
  // const [hasDraft, setHasDraft] = useState(false);


  // Загрузка блогов пользователя при открытии вкладки "Блоги"
  // useEffect(() => {
  //   const load = async () => {
  //     if (activeTab !== 'blogs') return;
  //     setBlogsLoading(true);
  //     try {
  //       const blogs = await getUserBlogs();
  //       setUserBlogs(Array.isArray(blogs) ? blogs : []);
  //     } catch (e) {
  //       //       setUserBlogs([]);
  //     } finally {
  //       setBlogsLoading(false);
  //     }
  //   };
  //   load();
  // }, [activeTab]);

  // Наличие локального черновика
  // useEffect(() => {
  //   if (activeTab !== 'blogs') return;
  //   try {
  //     const autosave = localStorage.getItem('blog_autosave');
  //     setHasDraft(Boolean(autosave));
  //   } catch {}
  // }, [activeTab]);

  // Загрузка реальных маршрутов при открытии вкладки Избранное → Маршруты
  useEffect(() => {
    const load = async () => {
      if (activeTab !== 'favorites' || activeFavCategory !== 'routes') return;
      if (!auth.token) return;
      try {
        setRoutesLoading(true);
        const list = await getRoutes(auth.token);
        setRoutes(list);
      } catch (e) {
        setRoutes([]);
      } finally {
        setRoutesLoading(false);
      }
    };
    load();
  }, [activeTab, activeFavCategory, auth.token]);

  // Загружаем счётчик черновиков
  useEffect(() => {
    const loadDraftsCount = async () => {
      try {
        await offlineContentStorage.init();
        const count = await offlineContentStorage.getDraftsCount();
        setDraftsCount(count);
      } catch (error) {
        console.error('Ошибка загрузки счётчика черновиков:', error);
      }
    };

    loadDraftsCount();
    
    // Обновляем счётчик каждые 5 секунд
    const interval = setInterval(loadDraftsCount, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'profile', label: 'Профиль', icon: <FaUser /> },
    { id: 'friends', label: 'Друзья', icon: <FaUsers /> },
    { id: 'achievements', label: 'Достижения', icon: <FaTrophy /> },
    { id: 'favorites', label: 'Избранное', icon: <FaStar /> },
    { id: 'posts', label: 'Мои посты', icon: <FaFileAlt /> },
    { id: 'settings', label: 'Настройки', icon: <FaCog /> },
  ] as const;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        // Конвертируем файл в base64
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Image = e.target?.result as string;
          setTempProfileImage(base64Image);
          setHasUnsavedChanges(true);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        alert('Ошибка при загрузке аватара. Попробуйте еще раз.');
        setIsUploading(false);
      }
    }
  };

  const handleApplyChanges = async () => {
    if (tempProfileImage) {
      setIsUploading(true);
      try {
        await updateUserAvatar(tempProfileImage);
        setProfileImage(tempProfileImage);
        setTempProfileImage(null);
        setHasUnsavedChanges(false);
        } catch (error) {
        alert('Ошибка при сохранении аватара. Попробуйте еще раз.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelChanges = () => {
    setTempProfileImage(null);
    setHasUnsavedChanges(false);
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Обновляем profileImage при изменении user.avatar_url
  useEffect(() => {
    setProfileImage(user?.avatar_url || null);
    setTempProfileImage(null);
    setHasUnsavedChanges(false);
  }, [user?.avatar_url]);

  if (!user) {
    return (
      <>
        {/* Затемнение */}
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
        {/* Модальное окно */}
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6">
                             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-semibold text-gray-800">Профиль</h2>
                 <button
                   onClick={onClose}
                   className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
                 >
                   <FaTimes size={20} />
                 </button>
               </div>
              <div className="text-center py-8">
                <p className="text-gray-500">Пожалуйста, войдите в систему</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Затемнение */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      {/* Модальное окно */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                 <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold">Личный кабинет</h2>
           <button
             onClick={onClose}
             className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
           >
             <FaTimes size={20} />
           </button>
         </div>
        
                 {/* Информация о пользователе */}
         <div className="flex items-center space-x-4">
                       <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {(tempProfileImage || profileImage) ? (
                  <img 
                    src={tempProfileImage || profileImage || ''} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser className="text-2xl" />
                )}
              </div>
              <button
                onClick={triggerImageUpload}
                disabled={isUploading}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <FaCamera className="text-white text-sm" />
                )}
              </button>
            </div>
           <div>
             <h3 className="text-lg font-semibold">{user.username}</h3>
             <p className="text-white/80 text-sm">{user.email}</p>
             <p className="text-white/60 text-xs">Роль: {user.role}</p>
           </div>
         </div>
         
                   {/* Кнопки для применения/отмены изменений аватара */}
          {hasUnsavedChanges && (
            <div className="flex space-x-2 mt-3">
              <button
                onClick={handleApplyChanges}
                disabled={isUploading}
                className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <span>✓ Применить</span>
                )}
              </button>
              <button
                onClick={handleCancelChanges}
                disabled={isUploading}
                className="flex items-center space-x-1 bg-gray-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <span>✕ Отменить</span>
              </button>
            </div>
          )}

          {/* Скрытый input для загрузки файлов */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
      </div>

      {/* Навигация по вкладкам */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

             {/* Контент вкладок */}
       <div className="overflow-y-auto p-6" style={{ height: 'calc(85vh - 200px)' }}>
        {activeTab === 'profile' && (
          <div className="h-full flex flex-col">
            {/* Центр влияния */}
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <ProfileCenter 
                userId={user?.id}
                isOwnProfile={true}
              />
            </div>

          </div>
                 )}


         {activeTab === 'friends' && (
           <div className="space-y-4 h-full flex flex-col justify-center">
             <div className="flex items-center justify-between mb-4">
               <h4 className="font-semibold text-gray-800">Мои друзья</h4>
               <button
                 onClick={() => {
                   onClose();
                   // Открываем полную страницу друзей
                   window.location.href = '/friends';
                 }}
                 className="text-blue-600 hover:text-blue-700 text-sm font-medium"
               >
                 Открыть полный список →
               </button>
             </div>
             
             {/* Краткий список друзей (максимум 6) */}
             <div className="grid grid-cols-2 gap-3">
               {friends.slice(0, 6).map((friend, index) => {
                 const colors = [
                   'from-blue-500 to-purple-600',
                   'from-green-500 to-teal-600',
                   'from-orange-500 to-red-600',
                   'from-purple-500 to-pink-600',
                   'from-cyan-500 to-blue-600',
                   'from-yellow-500 to-orange-600'
                 ];
                 
                 const statuses = ['Онлайн', 'Онлайн', '2 часа назад', 'Вчера', '3 дня назад', 'Неделю назад'];
                 
                 return (
                   <div 
                     key={friend.id}
                     className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                     onClick={() => setSelectedFriend(friend)}
                   >
                     <div className={`w-12 h-12 bg-gradient-to-r ${colors[index % colors.length]} rounded-full flex items-center justify-center mx-auto mb-2`}>
                       <span className="text-white font-semibold">
                         {friend.username.charAt(0).toUpperCase()}
                       </span>
                 </div>
                     <div className="text-sm font-medium truncate">{friend.username}</div>
                     <div className="text-xs text-gray-500">{statuses[index % statuses.length]}</div>
               </div>
                 );
               })}
             </div>
             
             {/* Статистика друзей */}
             <div className="bg-blue-50 rounded-lg p-4">
               <div className="flex items-center justify-between">
                 <div>
                   <div className="text-lg font-semibold text-blue-800">{friends.length} друзей</div>
                   <div className="text-sm text-blue-600">2 онлайн</div>
                 </div>
                 <div className="text-right">
                   <div className="text-lg font-semibold text-blue-800">3 заявки</div>
                   <div className="text-sm text-blue-600">Новые</div>
                 </div>
               </div>
             </div>
           </div>
         )}

                  {activeTab === 'achievements' && (
                    <AchievementsDashboard />
                  )}

                 {activeTab === 'favorites' && (
           <div className="space-y-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800 text-lg">Избранное</h4>
              <div className="flex items-center space-x-3">
                {/* Круговой индикатор полноты контента */}
                <div className="relative">
                  <svg width="24" height="24" className="transform -rotate-90">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#10b981"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="62.83"
                      strokeDashoffset="18.85"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-700">70%</span>
                  </div>
                </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">{favoritesStats.totalItems}</span>
                <span className="text-sm text-gray-600">элементов</span>
                </div>
              </div>
            </div>

            {/* Статистика избранного */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div
                className={`${counterBaseClasses} ${counterGradient.blue} ${activeFavCategory==='routes' ? counterActiveRing : counterMuted} ${activeFavCategory==='routes' ? 'relative' : ''}`}
                onClick={() => setActiveFavCategory('routes')}
                aria-label="Показать сохранённые маршруты"
              >
                <div className="text-2xl font-bold">{favorites.favoriteRoutes.length}</div>
                <div className="text-sm opacity-90">Маршрутов</div>
                {activeFavCategory === 'routes' && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
                )}
              </div>
              <div
                className={`${counterBaseClasses} ${counterGradient.green} ${activeFavCategory==='places' ? counterActiveRing : counterMuted} ${activeFavCategory==='places' ? 'relative' : ''}`}
                onClick={() => setActiveFavCategory('places')}
                aria-label="Показать сохранённые места"
              >
                <div className="text-2xl font-bold">{favoritesStats.totalPlaces}</div>
                <div className="text-sm opacity-90">Мест</div>
                {activeFavCategory === 'places' && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500"></div>
                )}
              </div>
              <div
                className={`${counterBaseClasses} ${counterGradient.purple} ${activeFavCategory==='events' ? counterActiveRing : counterMuted} ${activeFavCategory==='events' ? 'relative' : ''}`}
                onClick={() => setActiveFavCategory('events')}
                aria-label="Показать сохранённые события"
              >
                <div className="text-2xl font-bold">{favoritesStats.totalEvents}</div>
                <div className="text-sm opacity-90">События</div>
                {activeFavCategory === 'events' && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-500"></div>
                )}
              </div>
            </div>

            {/* Категории – показываем только активную */}
            <div className="space-y-4">
              {activeFavCategory === 'routes' && (
                <>
                  {/* Хлебный след */}
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                    <span>Избранное</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className="text-blue-600 font-medium">Маршруты</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className={`font-medium ${
                      activeRouteSubcategory === 'posts' ? 'text-orange-600' :
                      activeRouteSubcategory === 'events' ? 'text-pink-600' :
                      'text-indigo-600'
                    }`}>
                      {activeRouteSubcategory === 'posts' ? 'Посты' :
                       activeRouteSubcategory === 'events' ? 'События' :
                       'Личные'}
                    </span>
                  </div>

                  {/* Заголовок подкатегорий */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <h5 className="text-sm font-semibold text-gray-700">Категории маршрутов</h5>
                    </div>
                    <div className="text-xs text-gray-500">
                      Выберите категорию для просмотра
                    </div>
                  </div>

                  {/* Визуальная связь */}
                  <div className="flex justify-center mb-2">
                    <div className="flex items-center space-x-2 text-blue-500">
                      <div className="w-4 h-0.5 bg-blue-300"></div>
                      <FaChevronDown className="text-xs" />
                      <div className="w-4 h-0.5 bg-blue-300"></div>
                    </div>
                  </div>

                  {/* Подкатегории маршрутов */}
                  <div className="grid grid-cols-3 gap-3 mb-4 -ml-1">
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.posts} ${activeRouteSubcategory === 'posts' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveRouteSubcategory('posts')}
                      aria-label="Маршруты для постов"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteRoutes.filter(route => route.categories?.post).length}
                      </div>
                      <div className="text-xs opacity-90">Посты</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.events} ${activeRouteSubcategory === 'events' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveRouteSubcategory('events')}
                      aria-label="Маршруты для событий"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteRoutes.filter(route => route.categories?.event).length}
                      </div>
                      <div className="text-xs opacity-90">События</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.personal} ${activeRouteSubcategory === 'personal' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveRouteSubcategory('personal')}
                      aria-label="Личные маршруты"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteRoutes.filter(route => route.categories?.personal).length}
                      </div>
                      <div className="text-xs opacity-90">Избранное</div>
                    </div>
                  </div>

                  {/* Список маршрутов по подкатегориям */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FaMapMarkedAlt className="text-blue-600" />
                          <span className="font-semibold text-blue-800">
                            {activeRouteSubcategory === 'posts' && 'Маршруты для постов'}
                            {activeRouteSubcategory === 'events' && 'Маршруты для событий'}
                            {activeRouteSubcategory === 'personal' && 'Избранные маршруты'}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            activeRouteSubcategory === 'posts' ? 'bg-orange-500' :
                            activeRouteSubcategory === 'events' ? 'bg-pink-500' :
                            'bg-indigo-500'
                          }`}></div>
                    </div>
                    <div className="flex items-center space-x-2">
                          <span className="text-sm text-blue-600 font-medium">
                            {(() => {
                              const all = favorites.favoriteRoutes;
                              const filteredRoutes = all.filter(route => {
                                if (activeRouteSubcategory === 'personal') {
                                  return route.categories?.personal;
                                } else if (activeRouteSubcategory === 'posts') {
                                  return route.categories?.post;
                                } else if (activeRouteSubcategory === 'events') {
                                  return route.categories?.event;
                                }
                                return true;
                              });
                              return filteredRoutes.length;
                            })()} сохранено
                          </span>
                          {activeRouteSubcategory === 'personal' && (() => {
                            const personalRoutes = favorites.favoriteRoutes.filter(route => route.categories?.personal);
                            return personalRoutes.length > 0;
                          })() && (
                        <button
                          onClick={() => {
                                if (confirm('Вы уверены, что хотите удалить все избранные маршруты?')) {
                              favorites.clearAllRoutes();
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-300 hover:border-red-500 transition-colors"
                              title="Очистить все избранные маршруты"
                        >
                          Очистить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                      {(() => {
                        // Фильтруем маршруты по выбранной категории
                        const allRoutes = favorites.favoriteRoutes;
                        const filteredRoutes = allRoutes.filter(route => {
                          if (activeRouteSubcategory === 'personal') {
                            return route.categories?.personal;
                          } else if (activeRouteSubcategory === 'posts') {
                            return route.categories?.post;
                          } else if (activeRouteSubcategory === 'events') {
                            return route.categories?.event;
                          }
                          return true;
                        });
                        
                        return (
                          <>
                    {routesLoading && (
                      <div className="text-sm text-gray-500">Загрузка маршрутов…</div>
                    )}
                            {!routesLoading && filteredRoutes.length === 0 && (
                              <div className="text-sm text-gray-500 text-center py-8">
                                Пока нет маршрутов для {activeRouteSubcategory === 'posts' ? 'постов' : activeRouteSubcategory === 'events' ? 'событий' : 'избранного'}
                              </div>
                            )}
                            {!routesLoading && filteredRoutes.map((route: any) => {
                      const classes = getRouteVisualClasses({ isFavorite: true, isUserModified: route.is_user_modified, usedInBlogs: route.used_in_blogs });
                      return (
                        <div key={route.id} className={`flex items-center justify-between p-3 rounded-lg border ${classes}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FaMapMarkedAlt className="text-white text-sm" />
                      </div>
                      <div>
                              <div className="font-medium text-gray-800">{route.title || route.name || 'Без названия'}</div>
                              <div className="text-sm text-gray-600">
                                {(route.points?.length || route.waypoints?.length || 0)} точек
                                {route.created_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(route.created_at).toLocaleDateString('ru-RU')}
                                  </div>
                                )}
                              </div>
                      </div>
                    </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className="flex items-center space-x-2">
                              {/* Новые строгие кнопки категорий для маршрутов */}
                              <div className="flex items-center space-x-1">
                                <CategoryButton
                                  category="post"
                                  isActive={route.categories?.post || false}
                                  onToggle={(category) => {
                                    // Переключаем категорию через контекст
                                    const updatedRoute = {
                                      ...route,
                                      categories: {
                                        ...route.categories,
                                        [category]: !route.categories?.[category]
                                      }
                                    };
                                    favorites.updateFavoriteRoute(route.id, updatedRoute);
                                  }}
                                  label="Посты"
                                />
                                <CategoryButton
                                  category="event"
                                  isActive={route.categories?.event || false}
                                  onToggle={(category) => {
                                    // Переключаем категорию через контекст
                                    const updatedRoute = {
                                      ...route,
                                      categories: {
                                        ...route.categories,
                                        [category]: !route.categories?.[category]
                                      }
                                    };
                                    favorites.updateFavoriteRoute(route.id, updatedRoute);
                                  }}
                                  label="События"
                                />
                              </div>
                              <button
                                className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
                                onClick={() => {
                                  if (confirm('Удалить маршрут из избранного?')) {
                                    favorites.removeFavoriteRoute(route.id);
                                  }
                                }}
                                title="Удалить из избранного"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="text-right text-xs text-gray-500">
                              {(route.createdAt || route.addedAt) ? new Date(route.createdAt || route.addedAt).toLocaleDateString('ru-RU') : ''}
                    </div>
                  </div>
                      </div>
                      );
                    })}
                          </>
                        );
                      })()}
                      </div>
                    </div>
                </>
              )}

              {activeFavCategory === 'places' && (
                <>
                  {/* Хлебный след */}
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                    <span>Избранное</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className="text-green-600 font-medium">Метки</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className={`font-medium ${
                      activePlaceCategory === 'posts' ? 'text-orange-600' :
                      activePlaceCategory === 'events' ? 'text-pink-600' :
                      'text-indigo-600'
                    }`}>
                      {activePlaceCategory === 'posts' ? 'Посты' :
                       activePlaceCategory === 'events' ? 'События' :
                       'Избранное'}
                    </span>
                  </div>

                  {/* Заголовок подкатегорий */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h5 className="text-sm font-semibold text-gray-700">Категории меток</h5>
                    </div>
                    <div className="text-xs text-gray-500">
                      Выберите категорию для просмотра
                    </div>
                  </div>

                  {/* Визуальная связь */}
                  <div className="flex justify-center mb-2">
                    <div className="flex items-center space-x-2 text-green-500">
                      <div className="w-4 h-0.5 bg-green-300"></div>
                      <FaChevronDown className="text-xs" />
                      <div className="w-4 h-0.5 bg-green-300"></div>
                    </div>
                  </div>

                  {/* Подкатегории меток */}
                  <div className="grid grid-cols-3 gap-2 mb-4 -ml-1">
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.posts} ${activePlaceCategory === 'posts' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActivePlaceCategory('posts')}
                      aria-label="Метки для постов"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoritePlaces.filter(place => place.categories?.post).length}
                      </div>
                      <div className="text-xs opacity-90">Посты</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.events} ${activePlaceCategory === 'events' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActivePlaceCategory('events')}
                      aria-label="Метки для событий"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoritePlaces.filter(place => place.categories?.event).length}
                      </div>
                      <div className="text-xs opacity-90">События</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.personal} ${activePlaceCategory === 'personal' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActivePlaceCategory('personal')}
                      aria-label="Избранные метки"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoritePlaces.filter(place => place.categories?.personal).length}
                      </div>
                      <div className="text-xs opacity-90">Избранное</div>
                    </div>
                  </div>

                  {/* Список мест по подкатегориям */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FaStar className="text-green-600" />
                          <span className="font-semibold text-green-800">
                            {activePlaceCategory === 'posts' && 'Метки для постов'}
                            {activePlaceCategory === 'events' && 'Метки для событий'}
                            {activePlaceCategory === 'personal' && 'Избранные метки'}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            activePlaceCategory === 'posts' ? 'bg-orange-500' :
                            activePlaceCategory === 'events' ? 'bg-pink-500' :
                            'bg-indigo-500'
                          }`}></div>
                    </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-green-600 font-medium">
                            {(() => {
                              const filteredPlaces = favorites.favoritePlaces.filter(place => {
                                if (activePlaceCategory === 'personal') {
                                  return place.categories?.personal;
                                } else if (activePlaceCategory === 'posts') {
                                  return place.categories?.post;
                                } else if (activePlaceCategory === 'events') {
                                  return place.categories?.event;
                                }
                                return true;
                              });
                              return filteredPlaces.length;
                            })()} сохранено
                          </span>
                        </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                      {(() => {
                        // Фильтруем места по выбранной категории
                        const filteredPlaces = favorites.favoritePlaces.filter(place => {
                          if (activePlaceCategory === 'personal') {
                            return place.categories?.personal;
                          } else if (activePlaceCategory === 'posts') {
                            return place.categories?.post;
                          } else if (activePlaceCategory === 'events') {
                            return place.categories?.event;
                          }
                          return true;
                        });
                        
                        return (
                          <>
                            {(showAllPlaces ? filteredPlaces : filteredPlaces.slice(0, 5)).map((place) => {
                      const classes = getMarkerVisualClasses({ isFavorite: true, isUserModified: false, usedInBlogs: false });
                      return (
                        <div key={place.id} className={`flex items-center justify-between p-3 rounded-lg border ${classes}`}>
                    <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                              <FaStar className="text-white text-xs" />
                      </div>
                      <div>
                              <div className="font-medium text-gray-800">{place.name}</div>
                              <div className="text-sm text-gray-600">{place.location}</div>
                      </div>
                    </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className="flex items-center space-x-2">
                              {/* Новые строгие кнопки категорий */}
                              <div className="flex items-center space-x-1">
                                <CategoryButton
                                  category="post"
                                  isActive={place.categories?.post || false}
                                  onToggle={(category) => {
                                    // Переключаем категорию через контекст
                                    const updatedPlace = {
                                      ...place,
                                      categories: {
                                        ...place.categories,
                                        [category]: !place.categories?.[category]
                                      }
                                    };
                                    favorites.updateFavoritePlace(place.id, updatedPlace);
                                  }}
                                  label="Посты"
                                />
                                <CategoryButton
                                  category="event"
                                  isActive={place.categories?.event || false}
                                  onToggle={(category) => {
                                    // Переключаем категорию через контекст
                                    const updatedPlace = {
                                      ...place,
                                      categories: {
                                        ...place.categories,
                                        [category]: !place.categories?.[category]
                                      }
                                    };
                                    favorites.updateFavoritePlace(place.id, updatedPlace);
                                  }}
                                  label="События"
                                />
                              </div>
                              <button
                                className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
                                onClick={() => {
                                  if (confirm('Удалить метку из избранного?')) {
                                    favorites.removeFavoritePlace(place.id);
                                  }
                                }}
                                title="Удалить из избранного"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="text-right text-xs text-gray-500">
                              {place.addedAt.toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                        </div>
                      );
                    })}

                            {filteredPlaces.length === 0 && (
                              <div className="text-sm text-gray-500 text-center py-8">
                                Пока нет меток для {activePlaceCategory === 'posts' ? 'постов' : activePlaceCategory === 'events' ? 'событий' : 'личного использования'}
                              </div>
                            )}

                            {filteredPlaces.length > 5 && (
                      <div className="text-center py-2">
                        <button
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                          onClick={() => setShowAllPlaces((prev) => !prev)}
                        >
                          {showAllPlaces ? 'Свернуть список ←' : 'Показать все места →'}
                        </button>
                      </div>
                    )}
                          </>
                        );
                      })()}
                      </div>
                    </div>

                </>
              )}

              {activeFavCategory === 'events' && (
                <>
                  {/* Хлебный след */}
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                    <span>Избранное</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className="text-purple-600 font-medium">События</span>
                    <FaChevronDown className="text-xs transform rotate-90" />
                    <span className={`font-medium ${
                      activeEventCategory === 'posts' ? 'text-orange-600' :
                      activeEventCategory === 'events' ? 'text-pink-600' :
                      'text-indigo-600'
                    }`}>
                      {activeEventCategory === 'posts' ? 'Посты' :
                       activeEventCategory === 'events' ? 'События' :
                       'Избранное'}
                    </span>
                  </div>

                  {/* Заголовок подкатегорий */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <h5 className="text-sm font-semibold text-gray-700">Категории событий</h5>
                    </div>
                    <div className="text-xs text-gray-500">
                      Выберите категорию для просмотра
                    </div>
                  </div>

                  {/* Визуальная связь */}
                  <div className="flex justify-center mb-2">
                    <div className="flex items-center space-x-2 text-purple-500">
                      <div className="w-4 h-0.5 bg-purple-300"></div>
                      <FaChevronDown className="text-xs" />
                      <div className="w-4 h-0.5 bg-purple-300"></div>
                    </div>
                  </div>

                  {/* Подкатегории событий */}
                  <div className="grid grid-cols-3 gap-2 mb-4 -ml-1">
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.posts} ${activeEventCategory === 'posts' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveEventCategory('posts')}
                      aria-label="События для постов"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteEvents.filter(event => event.purpose === 'post').length}
                      </div>
                      <div className="text-xs opacity-90">Посты</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.events} ${activeEventCategory === 'events' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveEventCategory('events')}
                      aria-label="События для событий"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteEvents.filter(event => event.purpose === 'event').length}
                      </div>
                      <div className="text-xs opacity-90">События</div>
                    </div>
                    <div
                      className={`${subcategoryBaseClasses} ${subcategoryGradient.personal} ${activeEventCategory === 'personal' ? subcategoryActiveRing : subcategoryMuted}`}
                      onClick={() => setActiveEventCategory('personal')}
                      aria-label="Избранные события"
                    >
                      <div className="text-lg font-bold">
                        {favorites.favoriteEvents.filter(event => event.purpose === 'personal').length}
                      </div>
                      <div className="text-xs opacity-90">Избранное</div>
                    </div>
                  </div>

                  {/* Список событий по подкатегориям */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-purple-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FaTrophy className="text-purple-600" />
                          <span className="font-semibold text-purple-800">
                            {activeEventCategory === 'posts' && 'События для постов'}
                            {activeEventCategory === 'events' && 'События для событий'}
                            {activeEventCategory === 'personal' && 'Избранные события'}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            activeEventCategory === 'posts' ? 'bg-orange-500' :
                            activeEventCategory === 'events' ? 'bg-pink-500' :
                            'bg-indigo-500'
                          }`}></div>
                    </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-purple-600 font-medium">
                            {(() => {
                              const filteredEvents = favorites.favoriteEvents.filter(event => {
                                if (activeEventCategory === 'personal') {
                                  return event.purpose === 'personal';
                                } else if (activeEventCategory === 'posts') {
                                  return event.purpose === 'post';
                                } else if (activeEventCategory === 'events') {
                                  return event.purpose === 'event';
                                }
                                return true;
                              });
                              return filteredEvents.length;
                            })()} сохранено
                          </span>
                        </div>
                  </div>
                  </div>
                  <div className="p-4 space-y-3">
                      {(() => {
                        // Фильтруем события по выбранной категории
                        const filteredEvents = favorites.favoriteEvents.filter(event => {
                          if (activeEventCategory === 'personal') {
                            return event.purpose === 'personal';
                          } else if (activeEventCategory === 'posts') {
                            return event.purpose === 'post';
                          } else if (activeEventCategory === 'events') {
                            return event.purpose === 'event';
                          }
                          return true;
                        });
                        
                        return (
                          <>
                            {filteredEvents.length === 0 ? (
                              <div className="text-sm text-gray-500 text-center py-8">
                                Пока нет событий для {activeEventCategory === 'posts' ? 'постов' : activeEventCategory === 'events' ? 'событий' : 'личного использования'}
                              </div>
                            ) : (
                              filteredEvents.slice(0, 5).map((ev) => {
                        const classes = getEventVisualClasses({ isFavorite: true, isUserModified: false, usedInBlogs: false });
                        return (
                          <div key={ev.id} className={`flex items-center justify-between p-3 rounded-lg border ${classes}`}>
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-800">{ev.title}</div>
                              <div className="text-sm text-gray-600">{ev.location}</div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right text-xs text-gray-500">
                                {new Date(ev.date).toLocaleDateString('ru-RU')}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
                                  onClick={() => {
                                    if (confirm('Удалить событие из избранного?')) {
                                      favorites.removeFavoriteEvent(ev.id);
                                    }
                                  }}
                                  title="Удалить из избранного"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                            {filteredEvents.length > 5 && (
                  <div className="text-center py-2">
                        <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                          Показать все события →
                    </button>
                  </div>
                    )}
                          </>
                        );
                      })()}
                </div>
              </div>

                </>
              )}

              {/* Мотивационное сообщение */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-4 text-white text-center">
                <div className="text-lg font-semibold mb-2">🎯 Продолжайте исследовать!</div>
                <div className="text-sm opacity-90 mb-3">
                  Сохраняйте интересные места и маршруты, чтобы не потерять их
                </div>
                <button className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Найти новые места
                </button>
              </div>
            </div>
          </div>
        )}


                 {activeTab === 'posts' && (
           <div className="space-y-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800 text-lg">Мои посты</h4>
              <span className="text-sm text-gray-600">{userPosts.length} публикаций</span>
            </div>

            {/* Кнопка черновиков */}
            {draftsCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaCloud className="text-blue-600 text-xl" />
                    <div>
                      <div className="font-semibold text-gray-800">Черновики</div>
                      <div className="text-sm text-gray-600">
                        У вас {draftsCount} {draftsCount === 1 ? 'черновик' : draftsCount < 5 ? 'черновика' : 'черновиков'} для отправки
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDraftsPanel(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Открыть
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6">
                {postsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-500">Загрузка постов...</p>
                  </div>
                ) : userPosts.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-newspaper text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500 mb-2">Здесь будут отображаться ваши посты</p>
                    <p className="text-sm text-gray-400">Создайте первый пост на странице "Посты"</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userPosts.map((post) => (
                      <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-2">{post.title || 'Без названия'}</h5>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3">{post.body}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-400">
                              <span className="flex items-center">
                                <i className="far fa-calendar mr-1"></i>
                                {new Date(post.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center">
                                <i className="far fa-heart mr-1"></i>
                                {post.likes_count}
                              </span>
                              <span className="flex items-center">
                                <i className="far fa-comment mr-1"></i>
                                {post.comments_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

                 {activeTab === 'settings' && (
           <div className="space-y-4 h-full flex flex-col justify-center">
            <h4 className="font-semibold text-gray-800 mb-4">Настройки</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Имя пользователя
                </label>
                <input
                  type="text"
                  value={user.username}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              
              {/* Настройки уведомлений */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                  <FaBell className="mr-2" />
                  Уведомления
                </h5>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700">
                        Получать уведомления о модерации
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Уведомления о статусе вашего контента (одобрено/отклонено)
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setNotificationsEnabled(enabled);
                        moderationNotificationsService.setEnabled(enabled);
                      }}
                      className="ml-4 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* Конфиденциальность и аналитика */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                  <FaChartBar className="mr-2" />
                  Конфиденциальность и аналитика
                </h5>
                <div className="space-y-3">
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="flex-1 pr-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        Помогать улучшать ГеоБлог
                      </div>
                      <div className="text-xs text-gray-500">
                        Мы собираем анонимные данные об использовании: как вы работаете с картой, создаете посты, используете офлайн-режим. Это помогает нам делать сервис удобнее.
                      </div>
                      <div className="text-xs text-gray-400 mt-2 italic">
                        Можно изменить в любой момент
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isTrackingEnabled}
                        disabled={isAnalyticsLoading}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          try {
                            await setAnalyticsOptOut(!enabled);
                            // Обновляем профиль пользователя в контексте
                            // AuthContext автоматически обновит профиль при следующей загрузке
                          } catch (error) {
                            console.error('Ошибка обновления настройки аналитики:', error);
                            alert('Не удалось обновить настройку. Попробуйте позже.');
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <FaSignOutAlt />
                <span>Выйти из системы</span>
              </button>
            </div>
          </div>
                 )}
       </div>
         </div>
       </div>

       {/* Профиль друга */}
       {selectedFriend && (
         <FriendProfile
           friend={selectedFriend}
           onClose={() => setSelectedFriend(null)}
         />
       )}

       {/* Панель черновиков */}
       <OfflineDraftsPanel
         isOpen={showDraftsPanel}
         onClose={() => {
           setShowDraftsPanel(false);
           // Обновляем счётчик после закрытия
           offlineContentStorage.getDraftsCount().then(setDraftsCount);
         }}
       />
     </>
   );
 };

export default ProfilePanel;
