import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  username?: string;
  avatarUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Цвет рамки вокруг аватара (например, для партнёрских уровней).
   * Если не указан, рамка не отрисовывается.
   */
  borderColor?: string;
}

export function UserAvatar({ username, avatarUrl, className, style, borderColor }: UserAvatarProps) {
  const initials = (username || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatarStyle = borderColor
    ? { border: `2px solid ${borderColor}`, ...style }
    : style;

  return (
    <Avatar className={cn('overflow-hidden', className)} style={avatarStyle}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={username} />
      ) : (
        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
          {initials}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
