import React from 'react';
import { Trophy, Star, Target, Zap, Crown, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { useAchievements } from '../../hooks/useAchievements';
import { useAuth } from '../../contexts/AuthContext';
import LevelCard from '../Gamification/LevelCard';
import DailyGoalsWidget from '../Gamification/DailyGoalsWidget';
import { getAchievementIcon } from '../Achievements/achievementIcons';

interface ProgressRatingProps {
  className?: string;
}

const ProgressRating: React.FC<ProgressRatingProps> = ({ className = '' }) => {
  const { achievements: allAchievements, getUnlockedAchievements } = useAchievements();
  const unlockedAchievements = getUnlockedAchievements();
  

  // Берем первые 8 достижений (разблокированные + заблокированные для заполнения)
  const displayAchievements = unlockedAchievements.slice(0, 8);
  // Если разблокированных меньше 8, добавляем заблокированные
  if (displayAchievements.length < 8) {
    const lockedAchievements = allAchievements
      .filter(a => !a.unlocked)
      .slice(0, 8 - displayAchievements.length);
    displayAchievements.push(...lockedAchievements);
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Основная карточка прогресса - используем LevelCard */}
      <LevelCard />

      {/* Достижения */}
      <Card className="bg-gradient-to-br from-white to-green-50/50 border-green-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Достижения
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {displayAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`relative p-3 rounded-lg border-2 transition-all duration-200 ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300 hover:border-yellow-400 shadow-md'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
                title={achievement.description}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-2 text-yellow-600">
                    {getAchievementIcon(achievement.icon)}
                  </div>
                  <div className={`text-xs font-medium text-center leading-tight ${
                    achievement.unlocked ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {achievement.title}
                  </div>
                  {achievement.unlocked && (
                    <div className="text-xs text-green-600 mt-1 font-semibold">
                      ✓ Разблокировано
                    </div>
                  )}
                </div>
                {achievement.unlocked && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                    <Zap className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ежедневные цели - используем DailyGoalsWidget */}
      <DailyGoalsWidget />
    </div>
  );
};

export { ProgressRating };
