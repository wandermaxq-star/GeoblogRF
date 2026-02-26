import React from 'react';
import { Skeleton } from './skeleton';

/**
 * Скелетон одного поста в ленте — ~300px высоты.
 */
export const PostSkeleton: React.FC = () => (
  <div className="rounded-lg border border-border p-4 space-y-3">
    {/* Аватар + имя */}
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    {/* Изображение */}
    <Skeleton className="h-44 w-full rounded-md" />
    {/* Текст */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    {/* Кнопки */}
    <div className="flex gap-4 pt-2">
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-8 w-16 rounded" />
    </div>
  </div>
);

/**
 * Скелетон ленты — 3 карточки.
 */
export const PostFeedSkeleton: React.FC = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <PostSkeleton key={i} />
    ))}
  </div>
);

/**
 * Скелетон профиля пользователя.
 */
export const ProfileSkeleton: React.FC = () => (
  <div className="p-4 space-y-6">
    {/* Аватар + имя */}
    <div className="flex flex-col items-center gap-3">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-28" />
    </div>
    {/* Статистика */}
    <div className="flex justify-around">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
    {/* Био */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
    {/* Посты */}
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="aspect-square rounded-md" />
      ))}
    </div>
  </div>
);

/**
 * Скелетон таблицы лидеров.
 */
export const LeaderboardSkeleton: React.FC = () => (
  <div className="p-4 space-y-3">
    {/* Заголовок */}
    <Skeleton className="h-6 w-48 mx-auto" />
    {/* Строки */}
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center gap-3 py-2">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-16" />
      </div>
    ))}
  </div>
);
