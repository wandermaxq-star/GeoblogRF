/**
 * Ежедневные задания для Центра Влияния
 * 3 задания с чекбоксами и прогресс-барами + бонус за выполнение всех
 */

import React from 'react';
import { Check, Gift, Zap, PenLine, MapPin, Camera, Sparkles, BadgeCheck, Target, ClipboardList } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';

const GOAL_ICONS: Record<string, React.ReactNode> = {
  create_posts: <PenLine className="w-4 h-4 text-blue-400" />,
  create_markers: <MapPin className="w-4 h-4 text-emerald-400" />,
  add_photos: <Camera className="w-4 h-4 text-pink-400" />,
  improve_quality: <Sparkles className="w-4 h-4 text-amber-400" />,
  get_approval: <BadgeCheck className="w-4 h-4 text-green-400" />,
};

const DEFAULT_GOAL_ICON = <Target className="w-4 h-4 text-slate-400" />;

const CentreDailyGoals: React.FC = () => {
  const { dailyGoals, completeGoal, claimDailyReward } = useGamification();
  const allCompleted = dailyGoals.length > 0 && dailyGoals.every(g => g.completed);
  const completedCount = dailyGoals.filter(g => g.completed).length;

  if (dailyGoals.length === 0) {
    return (
      <div className="centre-glass-card">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold cg-text">Ежедневные задания</h3>
        </div>
        <p className="text-sm font-medium cg-text-muted mt-2">Задания на сегодня ещё не сформированы</p>
      </div>
    );
  }

  return (
    <div className="centre-glass-card">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold cg-text">Ежедневные задания</h3>
        </div>
        <span className="text-sm font-medium cg-text-muted">{completedCount}/{dailyGoals.length}</span>
      </div>

      {/* Список заданий */}
      <div className="space-y-2.5">
        {dailyGoals.map((goal) => (
          <GoalItem key={goal.id} goal={goal} onComplete={completeGoal} />
        ))}
      </div>

      {/* Бонус за все задания */}
      <div className={`mt-3 pt-3 flex items-center justify-between ${allCompleted ? 'opacity-100' : 'opacity-50'}`}
           style={{ borderTop: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium cg-text-dim">Бонус за все задания</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-yellow-500">+50 XP</span>
          {allCompleted && (
            <button
              onClick={() => claimDailyReward()}
              className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:opacity-90 transition-opacity"
            >
              Забрать
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface GoalItemProps {
  goal: DailyGoal;
  onComplete: (id: string) => Promise<void>;
}

const GoalItem: React.FC<GoalItemProps> = ({ goal, onComplete }) => {
  const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
  const icon = GOAL_ICONS[goal.type] || DEFAULT_GOAL_ICON;

  return (
    <div className="flex items-center gap-3">
      {/* Чекбокс */}
      <button
        onClick={() => !goal.completed && onComplete(goal.id)}
        disabled={goal.completed}
        className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
          goal.completed
            ? 'bg-green-500/80 border-green-400/50'
            : 'border-white/20 hover:border-white/40'
        }`}
      >
        {goal.completed && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Содержимое */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="flex-shrink-0">{icon}</span>
          <span className={`text-sm font-medium ${goal.completed ? 'cg-text-muted line-through' : 'cg-text'}`}>
            {goal.title}
          </span>
        </div>
        {/* Прогресс-бар */}
        {!goal.completed && goal.target > 1 && (
          <div className="mt-1 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-bg-subtle)' }}>
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* XP награда */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Zap className="w-3 h-3 text-yellow-400" />
        <span className="text-xs font-medium text-yellow-400/80">+{goal.xpReward}</span>
      </div>
    </div>
  );
};

export default CentreDailyGoals;
