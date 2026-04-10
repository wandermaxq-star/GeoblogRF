import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { offlineContentStorage } from '../services/offlineContentStorage';

// Типы для системы достижений
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'places' | 'posts' | 'quality' | 'activity' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: { current: number; target: number };
  unlocked: boolean;
  xpReward: number;
  isDynamic?: boolean; // Динамичное достижение (без прогресса)
  isLastSignificant?: boolean; // Последнее значимое достижение в категории (для золотого отображения)
}

// Определения всех возможных достижений (унифицированная система)
const ALL_ACHIEVEMENTS: Achievement[] = [
  // === ПРОГРЕССИВНЫЕ ДОСТИЖЕНИЯ ПО МЕСТАМ ===
  {
    id: 'places_novice',
    title: 'Новичок мест',
    description: 'Создана первая метка места',
    icon: 'map',
    category: 'places',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 50,
  },
  {
    id: 'places_explorer',
    title: 'Исследователь мест',
    description: '5 мест с полнотой >80%',
    icon: 'gem',
    category: 'places',
    rarity: 'rare',
    progress: { current: 0, target: 5 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'places_expert',
    title: 'Эксперт мест',
    description: '15 мест с полнотой >90% и рейтингом >4.5',
    icon: 'crown',
    category: 'places',
    rarity: 'epic',
    progress: { current: 0, target: 15 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'places_legend',
    title: 'Легенда мест',
    description: '30 мест с полнотой >95% и рейтингом >4.8',
    icon: 'trophy',
    category: 'places',
    rarity: 'legendary',
    progress: { current: 0, target: 30 },
    unlocked: false,
    xpReward: 500,
  },

  // === ПРОГРЕССИВНЫЕ ДОСТИЖЕНИЯ ПО ПОСТАМ ===
  {
    id: 'posts_beginner',
    title: 'Начинающий автор',
    description: 'Создан первый пост с фотографией',
    icon: 'camera',
    category: 'posts',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 50,
  },
  {
    id: 'posts_creator',
    title: 'Создатель контента',
    description: '10 постов с рейтингом >4.0',
    icon: 'award',
    category: 'posts',
    rarity: 'rare',
    progress: { current: 0, target: 10 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'posts_influencer',
    title: 'Влиятельный автор',
    description: '25 постов с рейтингом >4.5 и >50 лайков',
    icon: 'fire',
    category: 'posts',
    rarity: 'epic',
    progress: { current: 0, target: 25 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'posts_legend',
    title: 'Легенда постов',
    description: '50 постов с рейтингом >4.8 и >100 лайков',
    icon: 'star',
    category: 'posts',
    rarity: 'legendary',
    progress: { current: 0, target: 50 },
    unlocked: false,
    xpReward: 500,
  },

  // Блоги удалены из системы

  // Социальные достижения удалены (нет прямого общения между пользователями)

  // === ПРОГРЕССИВНЫЕ ДОСТИЖЕНИЯ ЗА КАЧЕСТВО ===
  {
    id: 'quality_photographer',
    title: 'Фотограф',
    description: 'Загружено 25 качественных фотографий',
    icon: 'camera',
    category: 'quality',
    rarity: 'rare',
    progress: { current: 0, target: 25 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'quality_master',
    title: 'Мастер качества',
    description: '20 мест с полными описаниями и фотографиями',
    icon: 'award',
    category: 'quality',
    rarity: 'epic',
    progress: { current: 0, target: 20 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'quality_perfectionist',
    title: 'Перфекционист',
    description: '10 мест с полнотой 100% и рейтингом >4.9',
    icon: 'crown',
    category: 'quality',
    rarity: 'legendary',
    progress: { current: 0, target: 10 },
    unlocked: false,
    xpReward: 500,
  },

  // === СПЕЦИАЛЬНЫЕ ДОСТИЖЕНИЯ ===
  {
    id: 'special_early_bird',
    title: 'Ранняя пташка',
    description: 'Зарегистрирован в первые 1000 пользователей',
    icon: 'rocket',
    category: 'special',
    rarity: 'legendary',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 500,
  },
  {
    id: 'special_mentor',
    title: 'Наставник',
    description: 'Помог 10 новым пользователям',
    icon: 'medal',
    category: 'special',
    rarity: 'epic',
    progress: { current: 0, target: 10 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'special_explorer',
    title: 'Глобальный исследователь',
    description: 'Создал контент в 10 разных городах',
    icon: 'map',
    category: 'special',
    rarity: 'rare',
    progress: { current: 0, target: 10 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'special_supporter',
    title: 'Двигатель проекта',
    description: 'Поддержал развитие WayAtom',
    icon: 'rocket',
    category: 'special',
    rarity: 'legendary',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 1000,
  },

  // === ДОСТИЖЕНИЯ АКТИВНОСТИ (вместо социальных) ===
  {
    id: 'activity_week',
    title: 'Неделя активности',
    description: '7 дней подряд с выполненными ежедневными целями',
    icon: 'fire',
    category: 'activity',
    rarity: 'rare',
    progress: { current: 0, target: 7 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'activity_month',
    title: 'Месяц активности',
    description: '30 дней подряд с выполненными ежедневными целями',
    icon: 'rocket',
    category: 'activity',
    rarity: 'epic',
    progress: { current: 0, target: 30 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'activity_year',
    title: 'Год активности',
    description: '365 дней подряд с выполненными ежедневными целями',
    icon: 'crown',
    category: 'activity',
    rarity: 'legendary',
    progress: { current: 0, target: 365 },
    unlocked: false,
    xpReward: 500,
  },
  {
    id: 'activity_daily_master',
    title: 'Мастер ежедневных целей',
    description: 'Выполнил 100 ежедневных целей',
    icon: 'award',
    category: 'activity',
    rarity: 'epic',
    progress: { current: 0, target: 100 },
    unlocked: false,
    xpReward: 300,
  },

  // === ДОСТИЖЕНИЯ ЗА ОФЛАЙН-КОНТЕНТ ===
  {
    id: 'offline_first',
    title: 'Офлайн-пионер',
    description: 'Создан первый черновик офлайн',
    icon: 'cloud',
    category: 'special',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 50,
  },
  {
    id: 'offline_creator',
    title: 'Офлайн-создатель',
    description: 'Создано 10 черновиков офлайн',
    icon: 'cloud-upload',
    category: 'special',
    rarity: 'rare',
    progress: { current: 0, target: 10 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'offline_master',
    title: 'Мастер офлайн-режима',
    description: 'Создано 50 черновиков офлайн',
    icon: 'cloud-download',
    category: 'special',
    rarity: 'epic',
    progress: { current: 0, target: 50 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'offline_legend',
    title: 'Легенда офлайна',
    description: 'Создано 100 черновиков офлайн',
    icon: 'cloud-check',
    category: 'special',
    rarity: 'legendary',
    progress: { current: 0, target: 100 },
    unlocked: false,
    xpReward: 500,
  },
  {
    id: 'offline_all_types',
    title: 'Универсальный офлайн-автор',
    description: 'Созданы черновики всех типов: пост, метка, маршрут, событие',
    icon: 'star',
    category: 'special',
    rarity: 'epic',
    progress: { current: 0, target: 4 },
    unlocked: false,
    xpReward: 250,
  },
  // === ДОСТИЖЕНИЯ ПРО ПОДПИСКИ И ПАКИ ===
  {
    id: 'special_premium',
    title: 'Premium-пользователь',
    description: 'Оформлена платная подписка PRO',
    icon: 'star',
    category: 'special',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 100,
  },
  {
    id: 'special_pack_first',
    title: 'Первый пакет',
    description: 'Приобретён первый платный пакет',
    icon: 'cloud-upload',
    category: 'special',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 75,
  },
  {
    id: 'special_pack_bronze',
    title: 'Коллекционер пакетов',
    description: 'Приобретено 5 пакетов',
    icon: 'cloud-upload',
    category: 'special',
    rarity: 'rare',
    progress: { current: 0, target: 5 },
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'special_pack_silver',
    title: 'Любитель пакетов',
    description: 'Приобретено 20 пакетов',
    icon: 'cloud-upload',
    category: 'special',
    rarity: 'epic',
    progress: { current: 0, target: 20 },
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'special_pack_gold',
    title: 'Мастера пакетов',
    description: 'Приобретено 100 пакетов',
    icon: 'cloud-upload',
    category: 'special',
    rarity: 'legendary',
    progress: { current: 0, target: 100 },
    unlocked: false,
    xpReward: 600,
  },
  // === ДОСТИЖЕНИЯ ПАРТНЁРА ===
  {
    id: 'special_partner_newbie',
    title: 'Партнёр-новичок',
    description: 'Заявка партнёра одобрена',
    icon: 'crown',
    category: 'special',
    rarity: 'common',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 100,
  },
  {
    id: 'special_partner_expert',
    title: 'Гид-эксперт',
    description: 'Достигнут уровень «Гид/Эксперт» в партнёрке',
    icon: 'crown',
    category: 'special',
    rarity: 'rare',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 200,
  },
  {
    id: 'special_partner_top',
    title: 'Топ-партнёр',
    description: 'Достигнут уровень «Топ-партнёр» в партнёрке',
    icon: 'crown',
    category: 'special',
    rarity: 'epic',
    progress: { current: 0, target: 1 },
    unlocked: false,
    xpReward: 400,
  },
];

// Моковые данные пользователя для тестирования
const mockUserStats = {
  places: {
    total: 12,
    highQuality: 8, // полнота >80%
    excellent: 3,   // полнота >90% и рейтинг >4.5
    perfect: 1,     // полнота >95% и рейтинг >4.8
  },
  posts: {
    total: 15,
    goodRating: 12, // рейтинг >4.0
    highRating: 8,  // рейтинг >4.5 и >50 лайков
    legendary: 3,   // рейтинг >4.8 и >100 лайков
  },
  blogs: {
    total: 3,
    goodRating: 2,  // рейтинг >4.0 и >20 лайков
    highRating: 1,  // рейтинг >4.5 и >50 лайков
    legendary: 0,   // рейтинг >4.8 и >100 лайков
  },
  social: {
    likes: 127,
    comments: 23,
  },
  quality: {
    photos: 18,
    detailedPlaces: 5,
    perfectPlaces: 1,
  },
  special: {
    isEarlyBird: true,
    helpedUsers: 3,
    cities: 4,
    isSupporter: false,
    // extra fields for pro achievements
    packsPurchased: 0,
    isPremium: false,
    partnerTier: '',
  },
  dynamic: {
    isLeaderWeek: false,
    isLeaderMonth: false,
    isBestBlogger: true,
    isMostHelpful: false,
    isPhotoMaster: false,
    isPlaceExpert: false,
    isCommunityHero: false,
    isRisingStar: false,
  }
};

export const useAchievements = () => {
  const { user } = useAuth();
  const favorites = useFavorites();
  const [achievements, setAchievements] = useState<Achievement[]>(ALL_ACHIEVEMENTS);
  const prevStatsRef = useRef<string>('');

  // helper to read pack count / premium from user or mock
  const packsPurchased = user?.packsPurchased ?? mockUserStats.special.packsPurchased;
  const isPremium = user?.subscription_expires_at
    ? new Date(user.subscription_expires_at).getTime() > Date.now()
    : mockUserStats.special.isPremium;
  const partnerTier = user?.partnerTier ?? mockUserStats.special.partnerTier;

  // Функция для получения статистики избранного (мемоизированная)
  const favoritesStats = useMemo(() => {
    if (!favorites?.getFavoritesStats) {
      return { places: 0, events: 0 };
    }
    const stats = favorites.getFavoritesStats();
    return {
      places: (stats as any).places || 0,
      events: (stats as any).events || 0,
      // routes и blogs удалены из системы
    };
  }, [favorites?.getFavoritesStats]);

  // Функция для получения прогресса достижения
  const getAchievementProgress = (achievementId: string) => {
    const achievement = achievements.find(a => a.id === achievementId);
    return achievement ? achievement.progress : { current: 0, target: 1 };
  };

  // Функция для получения разблокированных достижений
  const getUnlockedAchievements = () => {
    return achievements.filter(a => a.unlocked);
  };

  // Функция для получения достижений по категории
  const getAchievementsByCategory = (category: string) => {
    return achievements.filter(a => a.category === category);
  };

  // Функция для получения достижений для отображения другим пользователям (только последние значимые)
  const getPublicAchievements = () => {
    const categories = ['places', 'posts', 'quality', 'activity', 'special'];
    const publicAchievements: Achievement[] = [];

    categories.forEach(category => {
      const categoryAchievements = achievements.filter(a => a.category === category);
      
      // Находим последнее достигнутое достижение в категории
      const earnedAchievements = categoryAchievements.filter(a => a.unlocked);
      
      if (earnedAchievements.length > 0) {
        // Берем последнее (самое высокое) достижение и делаем его золотым
        const lastEarned = earnedAchievements[earnedAchievements.length - 1];
        
        // Создаем копию с пометкой, что это последнее значимое достижение
        const publicAchievement = {
          ...lastEarned,
          isLastSignificant: true // Флаг для золотого отображения
        };
        
        publicAchievements.push(publicAchievement);
      } else {
        // Если ничего не достигнуто, показываем первое (самое простое) достижение
        const firstAchievement = categoryAchievements[0];
        if (firstAchievement) {
          publicAchievements.push(firstAchievement);
        }
      }
    });

    return publicAchievements;
  };

  // Функция для получения динамичных достижений (без прогресса)
  const getDynamicAchievements = () => {
    return achievements.filter(a => a.isDynamic && a.unlocked);
  };

  // Функция для получения всех достижений активности
  const getActivityAchievements = () => {
    return achievements.filter(a => a.category === 'activity');
  };

  // Функция для получения общего XP
  const getTotalXP = () => {
    return achievements
      .filter(a => a.unlocked)
      .reduce((total, a) => total + a.xpReward, 0);
  };

  // Функция для получения уровня пользователя
  const getUserLevel = () => {
    const totalXP = getTotalXP();
    return Math.floor(totalXP / 200) + 1; // Каждый уровень = 200 XP
  };

  // Функция для получения XP до следующего уровня
  const getXPToNextLevel = () => {
    const currentLevel = getUserLevel();
    const currentLevelXP = getTotalXP() % 200;
    return 200 - currentLevelXP;
  };

  // Обновление достижений на основе статистики
  useEffect(() => {
    // Создаем строку для сравнения статистики
    const statsKey = JSON.stringify(favoritesStats);
    
    // Если статистика не изменилась, не обновляем
    if (prevStatsRef.current === statsKey) {
      return;
    }
    
    prevStatsRef.current = statsKey;
    
    const updatedAchievements = ALL_ACHIEVEMENTS.map(achievement => {
      let currentProgress = 0;
      let unlocked = false;

      // Расчет прогресса для каждого достижения
      switch (achievement.id) {
        // Места
        case 'places_novice':
          currentProgress = Math.min(mockUserStats.places.total, 1);
          unlocked = currentProgress >= 1;
          break;
        case 'places_explorer':
          currentProgress = mockUserStats.places.highQuality;
          unlocked = currentProgress >= 5;
          break;
        case 'places_expert':
          currentProgress = mockUserStats.places.excellent;
          unlocked = currentProgress >= 15;
          break;
        case 'places_legend':
          currentProgress = mockUserStats.places.perfect;
          unlocked = currentProgress >= 30;
          break;

        // Посты
        case 'posts_beginner':
          currentProgress = Math.min(mockUserStats.posts.total, 1);
          unlocked = currentProgress >= 1;
          break;
        case 'posts_creator':
          currentProgress = mockUserStats.posts.goodRating;
          unlocked = currentProgress >= 10;
          break;
        case 'posts_influencer':
          currentProgress = mockUserStats.posts.highRating;
          unlocked = currentProgress >= 25;
          break;
        case 'posts_legend':
          currentProgress = mockUserStats.posts.legendary;
          unlocked = currentProgress >= 50;
          break;

        // Блоги
        case 'blogs_storyteller':
          currentProgress = Math.min(mockUserStats.blogs.total, 1);
          unlocked = currentProgress >= 1;
          break;
        case 'blogs_author':
          currentProgress = mockUserStats.blogs.goodRating;
          unlocked = currentProgress >= 5;
          break;
        case 'blogs_master':
          currentProgress = mockUserStats.blogs.highRating;
          unlocked = currentProgress >= 10;
          break;
        case 'blogs_legend':
          currentProgress = mockUserStats.blogs.legendary;
          unlocked = currentProgress >= 20;
          break;

        // Социальные
        case 'social_helper':
          currentProgress = mockUserStats.social.likes;
          unlocked = currentProgress >= 50;
          break;
        case 'social_leader':
          currentProgress = mockUserStats.social.likes;
          unlocked = currentProgress >= 200;
          break;
        case 'social_legend':
          currentProgress = Math.min(mockUserStats.social.likes, 500);
          unlocked = currentProgress >= 500;
          break;

        // Качество
        case 'quality_photographer':
          currentProgress = mockUserStats.quality.photos;
          unlocked = currentProgress >= 25;
          break;
        case 'quality_master':
          currentProgress = mockUserStats.quality.detailedPlaces;
          unlocked = currentProgress >= 20;
          break;
        case 'quality_perfectionist':
          currentProgress = mockUserStats.quality.perfectPlaces;
          unlocked = currentProgress >= 10;
          break;

        // Специальные
        case 'special_early_bird':
          currentProgress = mockUserStats.special.isEarlyBird ? 1 : 0;
          unlocked = mockUserStats.special.isEarlyBird;
          break;
        case 'special_mentor':
          currentProgress = mockUserStats.special.helpedUsers;
          unlocked = currentProgress >= 10;
          break;
        case 'special_explorer':
          currentProgress = mockUserStats.special.cities;
          unlocked = currentProgress >= 10;
          break;
        case 'special_supporter':
          currentProgress = mockUserStats.special.isSupporter ? 1 : 0;
          unlocked = mockUserStats.special.isSupporter;
          break;

        // === ДОСТИЖЕНИЯ ПРО ПОДПИСКИ И ПАКИ ===
        case 'special_premium':
          currentProgress = isPremium ? 1 : 0;
          unlocked = isPremium;
          break;
        case 'special_pack_first':
          currentProgress = packsPurchased;
          unlocked = packsPurchased >= 1;
          break;
        case 'special_pack_bronze':
          currentProgress = packsPurchased;
          unlocked = packsPurchased >= 5;
          break;
        case 'special_pack_silver':
          currentProgress = packsPurchased;
          unlocked = packsPurchased >= 20;
          break;
        case 'special_pack_gold':
          currentProgress = packsPurchased;
          unlocked = packsPurchased >= 100;
          break;

        // === ДОСТИЖЕНИЯ ПАРТНЁРА ===
        case 'special_partner_newbie':
          currentProgress = partnerTier === 'newbie' ? 1 : 0;
          unlocked = partnerTier === 'newbie';
          break;
        case 'special_partner_expert':
          currentProgress = partnerTier === 'expert' ? 1 : 0;
          unlocked = partnerTier === 'expert';
          break;
        case 'special_partner_top':
          currentProgress = partnerTier === 'top' ? 1 : 0;
          unlocked = partnerTier === 'top';
          break;

        // Динамичные достижения
        case 'social_leader_week':
          unlocked = mockUserStats.dynamic.isLeaderWeek;
          break;
        case 'social_leader_month':
          unlocked = mockUserStats.dynamic.isLeaderMonth;
          break;
        case 'social_best_blogger':
          unlocked = mockUserStats.dynamic.isBestBlogger;
          break;
        case 'social_most_helpful':
          unlocked = mockUserStats.dynamic.isMostHelpful;
          break;
        case 'social_photo_master':
          unlocked = mockUserStats.dynamic.isPhotoMaster;
          break;
        case 'social_place_expert':
          unlocked = mockUserStats.dynamic.isPlaceExpert;
          break;
        case 'social_community_hero':
          unlocked = mockUserStats.dynamic.isCommunityHero;
          break;
        case 'social_rising_star':
          unlocked = mockUserStats.dynamic.isRisingStar;
          break;

        default:
          currentProgress = 0;
          unlocked = false;
      }

      return {
        ...achievement,
        progress: { current: currentProgress, target: achievement.progress.target },
        unlocked
      };
    });

    // Обновляем только если достижения действительно изменились
    setAchievements(prevAchievements => {
      // Проверяем, изменились ли достижения
      const hasChanges = updatedAchievements.some((newAch, index) => {
        const oldAch = prevAchievements[index];
        return !oldAch || 
               oldAch.unlocked !== newAch.unlocked || 
               oldAch.progress.current !== newAch.progress.current;
      });
      
      // Возвращаем новые только если есть изменения
      return hasChanges ? updatedAchievements : prevAchievements;
    });
  }, [favoritesStats, packsPurchased, isPremium, partnerTier]); // Зависим от актуальной статистики и состояния пользователя

  // Обновление достижений за офлайн-контент
  useEffect(() => {
    if (!user) return;

    const loadOfflineStats = async () => {
      try {
        await offlineContentStorage.init();
        const allDrafts = await offlineContentStorage.getAllDrafts();
        
        const totalDrafts = allDrafts.length;
        const contentTypeSet = new Set(allDrafts.map(d => d.contentType));
        const uniqueTypes = contentTypeSet.size;

        setAchievements(prevAchievements => {
          return prevAchievements.map(achievement => {
            let currentProgress = achievement.progress.current;
            let unlocked = achievement.unlocked;

            switch (achievement.id) {
              case 'offline_first':
                currentProgress = Math.min(totalDrafts, 1);
                unlocked = totalDrafts >= 1;
                break;
              case 'offline_creator':
                currentProgress = totalDrafts;
                unlocked = totalDrafts >= 10;
                break;
              case 'offline_master':
                currentProgress = totalDrafts;
                unlocked = totalDrafts >= 50;
                break;
              case 'offline_legend':
                currentProgress = totalDrafts;
                unlocked = totalDrafts >= 100;
                break;
              case 'offline_all_types':
                currentProgress = uniqueTypes;
                unlocked = uniqueTypes >= 4; // post, marker, route, event
                break;
              default:
                // Сохраняем текущие значения для других достижений
                const existing = prevAchievements.find(a => a.id === achievement.id);
                if (existing) {
                  currentProgress = existing.progress.current;
                  unlocked = existing.unlocked;
                }
                break;
            }

            // Обновляем только если изменилось
            if (achievement.progress.current !== currentProgress || achievement.unlocked !== unlocked) {
              return {
                ...achievement,
                progress: { ...achievement.progress, current: currentProgress },
                unlocked
              };
            }

            return achievement;
          });
        });
      } catch (error) {
        console.error('Ошибка загрузки статистики офлайн-черновиков:', error);
      }
    };

    loadOfflineStats();
    
    // Обновляем при изменении пользователя
  }, [user]);

  return {
    achievements,
    getAchievementProgress,
    getUnlockedAchievements,
    getAchievementsByCategory,
    getPublicAchievements,
    getDynamicAchievements,
    getActivityAchievements,
    getTotalXP,
    getUserLevel,
    getXPToNextLevel,
  };
};