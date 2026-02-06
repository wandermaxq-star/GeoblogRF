import React, { useState } from 'react';
import { useGuest } from '../contexts/GuestContext';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, X } from 'lucide-react';
import { Button } from './ui/button';

export default function GuestIndicator() {
  const guest = useGuest();
  const auth = useAuth();
  const isGuest = !auth?.user;
  const [isVisible, setIsVisible] = useState(true);
  const guestCounts = guest?.getGuestContentCount() || {
    markers: 0,
    routes: 0,
    events: 0,
    posts: 0,
    blogs: 0
  };

  const totalContent = guestCounts.markers + guestCounts.routes + guestCounts.events + guestCounts.posts + guestCounts.blogs;

  // Не показываем на страницах posts-mode (временно скрываем)
  if (typeof document !== 'undefined' && document.querySelector('.page-container.posts-mode')) return null;
  if (!isGuest || !isVisible) return null;

  return (
    <div className="guest-indicator fixed top-20 right-4 z-40 bg-white/95 backdrop-blur-sm border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm mb-1 text-gray-800">Гостевой режим</h3>
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            Вы можете просматривать весь контент, но для создания своих маркеров, маршрутов и событий 
            необходимо зарегистрироваться.
          </p>
          {totalContent > 0 && (
            <div className="text-xs text-blue-600 mb-3 bg-blue-50 p-2 rounded">
              У вас есть {totalContent} незавершённых {totalContent === 1 ? 'элемента' : 'элементов'} контента.
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                // Показать окно регистрации
                const event = new CustomEvent('showAuthGate');
                window.dispatchEvent(event);
              }}
            >
              Зарегистрироваться
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


