import React from 'react';
import { Star, Award, Zap, Flame } from 'lucide-react';

/**
 * Небольшой превью-блок для гостей, демонстрирующий, какие
 * элементы геймификации будут доступны после регистрации.
 *
 * Содержит:
 *  - Список вымышленных пользователей/рангов
 *  - Выборка достижений
 */

const sampleUsers = [
  { username: '@ivan', level: 8, xp: 1230 },
  { username: '@anna', level: 12, xp: 2870 },
  { username: '@oleg', level: 5, xp: 540 },
];

const sampleAchievements = [
  { title: 'Первый пост', icon: '✍️' },
  { title: '100 меток', icon: '📍' },
  { title: 'Фотограф', icon: '📸' },
];

export default function GuestPreview() {
  return (
    <div className="centre-glass-card mb-5">
      <h3 className="text-base font-bold cg-text mb-3">Что вас ждёт</h3>

      {/* Топ‑пользователи */}
      <div className="mb-4">
        <p className="text-sm font-medium cg-text-muted mb-2">Топ‑исследователи</p>
        <ul className="space-y-1">
          {sampleUsers.map((u) => (
            <li key={u.username} className="flex items-center justify-between text-sm cg-text">
              <span className="truncate">{u.username}</span>
              <span className="font-semibold">{u.level} lvl</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Достижения */}
      <div>
        <p className="text-sm font-medium cg-text-muted mb-2">Примеры достижений</p>
        <div className="flex gap-3">
          {sampleAchievements.map((ach) => (
            <div key={ach.title} className="flex flex-col items-center gap-1 text-xs">
              <span className="text-2xl">{ach.icon}</span>
              <span className="cg-text-muted">{ach.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
