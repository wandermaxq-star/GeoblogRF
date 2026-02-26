import React from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/Mobile/TopBar';
import { Card } from '../../components/ui/card';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Settings, MapPin, FileText, Award, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import LevelCard from '../../components/Gamification/LevelCard';
import { getRankByLevel, getRankInfo } from '../../utils/xpCalculator';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const gamification = useGamification();
  
  const user = auth?.user;
  const userLevel = gamification?.userLevel;
  const stats = gamification?.stats;
  const achievements = gamification?.unlockedAchievements || [];

  if (!user) {
    return (
      <div className="flex flex-col h-screen">
        <TopBar title="Профиль" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  const userName = user.username || user.email?.split('@')[0] || 'Пользователь';
  const userInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const rank = userLevel ? getRankByLevel(userLevel.level) : 'novice';
  const rankInfo = getRankInfo(rank);
  const rankName = rankInfo.name;
  const level = userLevel?.level || 1;
  const totalXP = userLevel?.totalXP || 0;

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Профиль" />
      
      <div className="flex-1 overflow-y-auto pb-bottom-nav m-glass-page">
        {/* Profile Header */}
        <div className="relative">
          <div className="h-32 bg-gradient-hero"></div>
          <div className="px-4 pb-4">
            <div className="relative -mt-16 mb-4">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{userName}</h2>
                <p className="text-muted-foreground">@{user.username || user.email?.split('@')[0] || 'user'}</p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-2"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-4 h-4" />
                Настройки
              </Button>
            </div>

            {/* Level Badge */}
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-gradient-primary text-primary-foreground px-3 py-1">
                👑 {rankName}
              </Badge>
              <Badge variant="outline">Уровень {level}</Badge>
            </div>

            {user.email && (
              <p className="text-sm text-foreground mb-4">
                {user.email}
              </p>
            )}
          </div>
        </div>

        {/* Level Card */}
        <div className="px-4 pb-4">
          <LevelCard />
        </div>

        {/* Stats Grid */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="m-glass-card p-4 text-center">
              <div className="text-3xl font-bold text-primary mb-1">{totalXP.toLocaleString()}</div>
              <div className="text-sm m-glass-text-secondary">XP очков</div>
            </Card>
            <Card className="m-glass-card p-4 text-center">
              <div className="text-3xl font-bold text-secondary mb-1">
                {stats?.dailyGoals?.streak || 0}
              </div>
              <div className="text-sm m-glass-text-secondary">дней стрик</div>
            </Card>
          </div>

          {/* Activity Stats */}
          <Card className="m-glass-card p-4 mb-4">
            <h3 className="font-bold m-glass-text mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Статистика
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">Достижения</span>
                </div>
                <span className="font-bold text-foreground">{stats?.achievements?.unlocked || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="text-sm text-foreground">Всего достижений</span>
                </div>
                <span className="font-bold text-foreground">{stats?.achievements?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-sm text-foreground">Прогресс сегодня</span>
                </div>
                <span className="font-bold text-foreground">{Math.round(stats?.dailyGoals?.todayProgress || 0)}%</span>
              </div>
            </div>
          </Card>

          {/* Achievements */}
          <Card className="m-glass-card p-4">
            <h3 className="font-bold m-glass-text mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Достижения
            </h3>
            {achievements.length === 0 ? (
              <div className="text-center py-8 m-glass-text-muted">
                <p className="text-sm">Пока нет достижений</p>
                <p className="text-xs mt-2">Создавайте контент, чтобы получить достижения!</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {achievements.slice(0, 8).map((achievement, i) => (
                  <div
                    key={achievement.id || i}
                    className="aspect-square rounded-lg bg-gradient-primary flex items-center justify-center text-2xl shadow-md"
                    title={achievement.title || 'Достижение'}
                  >
                    {achievement.icon || '🏆'}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

