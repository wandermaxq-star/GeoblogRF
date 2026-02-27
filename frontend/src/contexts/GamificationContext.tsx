/**
 * React Context для системы геймификации
 * 
 * Предоставляет:
 * - Текущий уровень пользователя
 * - Функции для добавления XP
 * - Ежедневные цели
 * - Достижения
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { UserLevel, DailyGoal, Achievement, GamificationStats, XPParams, XPResult } from '../types/gamification';
import { gamificationFacade } from '../services/gamificationFacade';
import apiClient from '../api/apiClient';
import { createUserLevelFromTotalXP } from '../utils/xpCalculator';
import { getActiveFeatures, GamificationFeatures } from '../config/gamificationFeatures';

interface GamificationContextType {
  // Уровень
  userLevel: UserLevel | null;
  loading: boolean;
  
  // Feature Flags
  features: GamificationFeatures;
  
  // Функции
  addXP: (params: XPParams) => Promise<XPResult>;
  refreshLevel: () => Promise<void>;
  
  // Ежедневные цели
  dailyGoals: DailyGoal[];
  completeGoal: (goalId: string) => Promise<void>;
  claimDailyReward: () => Promise<void>;
  
  // Достижения
  achievements: Achievement[];
  unlockedAchievements: Achievement[];
  
  // Статистика
  stats: GamificationStats | null;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

interface GamificationProviderProps {
  children: ReactNode;
}

export const GamificationProvider: React.FC<GamificationProviderProps> = ({ children }) => {
  const auth = useAuth();
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  // Начинаем с loading = false, чтобы не блокировать рендеринг приложения
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState<GamificationFeatures>(getActiveFeatures(1)); // По умолчанию этап 1

  // Загрузка feature flags и данных при монтировании
  useEffect(() => {
    setLoading(false);
    
    // Загружаем features ПЕРВЫМИ, потом данные — чтобы не было race condition
    const init = async () => {
      // 1. Features
      let loadedFeatures = getActiveFeatures(1);
      try {
        const response = await apiClient.get('/gamification/features');
        loadedFeatures = response.data?.features || loadedFeatures;
      } catch (error: any) {
        // Fallback — defaults уже dailyGoals: true, streak: true
      }
      setFeatures(loadedFeatures);
      
      // 2. Данные геймификации (features уже актуальны)
      if (auth?.user?.id) {
        await loadGamificationData();
      }
    };
    
    init();
  }, [auth?.user?.id]);

  // Загрузка всех данных геймификации (не блокирует рендеринг)
  const loadGamificationData = async () => {
    if (!auth?.user?.id) return;
    
    // НЕ устанавливаем loading = true, чтобы не блокировать приложение
    // Данные загрузятся в фоне
    try {
      const [levelData, goalsData, achievementsData, statsData] = await Promise.all([
        loadUserLevel(),
        loadDailyGoals(),
        loadAchievements(),
        loadStats(),
      ]);
      
      if (levelData) setUserLevel(levelData);
      if (goalsData) setDailyGoals(goalsData);
      if (achievementsData) setAchievements(achievementsData);
      if (statsData) setStats(statsData);
    } catch (error) {
      // Не блокируем приложение при ошибках загрузки данных геймификации
    }
  };


  // Загрузка уровня пользователя
  const loadUserLevel = async (): Promise<UserLevel | null> => {
    if (!auth?.user?.id) return null;
    
    try {
      const response = await apiClient.get(`/gamification/level/${auth.user.id}`);
      const data = response.data;
      
      // Если API вернул полные данные уровня, используем их
      if (data.level !== undefined) {
        return {
          level: data.level,
          currentXP: data.currentXP || 0,
          requiredXP: data.requiredXP || 100,
          totalXP: data.totalXP || 0,
          rank: data.rank || 'novice',
          progress: data.progress || 0,
        };
      }
      
      // Иначе рассчитываем из totalXP
      const totalXP = data?.totalXP || 0;
      return createUserLevelFromTotalXP(totalXP);
    } catch (error) {
      return createUserLevelFromTotalXP(0);
    }
  };

  // Загрузка ежедневных целей
  const loadDailyGoals = async (): Promise<DailyGoal[]> => {
    if (!auth?.user?.id) return [];
    
    // Проверяем, включены ли ежедневные цели
    if (!features.dailyGoals) {
      return []; // Функция отключена
    }
    
    try {
      const response = await apiClient.get(`/gamification/daily-goals`);
      return response.data?.goals || [];
    } catch (error) {
      return [];
    }
  };

  // Загрузка достижений
  const loadAchievements = async (): Promise<Achievement[]> => {
    if (!auth?.user?.id) return [];
    
    try {
      const response = await apiClient.get(`/gamification/achievements`);
      return response.data?.achievements || [];
    } catch (error) {
      return [];
    }
  };

  // Загрузка статистики
  const loadStats = async (): Promise<GamificationStats | null> => {
    if (!auth?.user?.id) return null;
    
    try {
      const response = await apiClient.get(`/gamification/stats`);
      return response.data;
    } catch (error) {
      return null;
    }
  };

  // Добавить XP
  const addXP = async (params: XPParams): Promise<XPResult> => {
    if (!auth?.user?.id) {
      return { success: false, reason: 'invalid' };
    }
    
    // Добавляем userId если не указан
    const fullParams = {
      ...params,
      userId: params.userId || auth.user.id,
    };
    
    const result = await gamificationFacade.addXP(fullParams);
    
    // Обновляем уровень если успешно
    if (result.success) {
      await refreshLevel();
      
      // Если повысился уровень, обновляем достижения
      if (result.levelUp) {
        await loadAchievements();
      }
    }
    
    return result;
  };

  // Обновить уровень
  const refreshLevel = useCallback(async (): Promise<void> => {
    const newLevel = await loadUserLevel();
    if (newLevel) {
      setUserLevel(newLevel);
    }
  }, [auth?.user?.id]); // Зависимость от user.id, так как loadUserLevel использует auth

  // Слушаем событие одобрения контента для обновления уровня и достижений
  useEffect(() => {
    const handleContentApproved = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { contentType, contentId, authorId } = customEvent.detail;
      
      // Если это наш контент, обновляем уровень и достижения
      if (authorId === auth?.user?.id) {
        console.log('💰 Обновляем уровень и достижения после одобрения контента:', contentId);
        
        // Небольшая задержка, чтобы БД успела обновиться
        setTimeout(async () => {
          try {
            // Обновляем уровень
            await refreshLevel();
            
            // Обновляем достижения
            const updatedAchievements = await loadAchievements();
            setAchievements(updatedAchievements);
            
            // Обновляем статистику
            const updatedStats = await loadStats();
            if (updatedStats) setStats(updatedStats);
            
            console.log('✅ Уровень и достижения обновлены после одобрения контента');
          } catch (error) {
            console.error('❌ Ошибка обновления уровня и достижений:', error);
          }
        }, 1500);
      }
    };

    window.addEventListener('content-approved', handleContentApproved);
    return () => {
      window.removeEventListener('content-approved', handleContentApproved);
    };
  }, [auth?.user?.id, refreshLevel]);

  // Выполнить цель
  const completeGoal = async (goalId: string): Promise<void> => {
    if (!auth?.user?.id) return;
    
    try {
      await apiClient.post(`/gamification/goals/${goalId}/complete`);
      
      // Обновляем цели
      const updatedGoals = await loadDailyGoals();
      setDailyGoals(updatedGoals);
      
      // Обновляем уровень
      await refreshLevel();
    } catch (error) {
    }
  };

  // Получить награду за день
  const claimDailyReward = async (): Promise<void> => {
    if (!auth?.user?.id) return;
    
    try {
      await apiClient.post(`/gamification/daily-reward/claim`);
      
      // Обновляем цели и уровень
      await Promise.all([
        loadDailyGoals().then(setDailyGoals),
        refreshLevel(),
      ]);
    } catch (error) {
    }
  };

  // Разблокированные достижения
  const unlockedAchievements = achievements.filter(a => a.unlocked);

  const value: GamificationContextType = {
    userLevel,
    loading,
    features,
    addXP,
    refreshLevel,
    dailyGoals,
    completeGoal,
    claimDailyReward,
    achievements,
    unlockedAchievements,
    stats,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};

// Хук для использования контекста
export const useGamification = (): GamificationContextType => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
};

