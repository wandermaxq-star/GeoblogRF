import React from 'react';
import { motion } from 'framer-motion';

interface BookCardProps {
  title: string;
  coverImage?: string;
  rating: number;
  className?: string;
  isHovered?: boolean;
  onClick?: () => void;
  customCover?: string; // Пользовательская обложка книги
}

const BookCard: React.FC<BookCardProps> = ({ 
  title, 
  coverImage, 
  rating, 
  className = '', 
  isHovered = false,
  onClick,
  customCover
}) => {
  // Цветовая индикация рейтинга
  const getRatingColor = (rating: number) => {
    if (rating >= 5) return '#FFD700'; // Золотой
    if (rating >= 4.5) return '#10B981'; // Зеленый
    if (rating >= 4) return '#3B82F6'; // Синий
    if (rating >= 3.5) return '#8B5CF6'; // Фиолетовый
    if (rating >= 3) return '#6B7280'; // Серый
    return '#E5E7EB'; // Светло-серый
  };

  const ratingColor = getRatingColor(rating);

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      onClick={onClick}
      whileHover={{ 
        scale: 1.05,
        rotateY: isHovered ? 5 : 0,
        z: 20
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.3 }}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Объемная карточка книги */}
      <div 
        className="relative w-32 h-48"
        style={{
          transform: isHovered ? 'rotateY(5deg) rotateX(2deg)' : 'rotateY(0deg) rotateX(0deg)',
          transformStyle: 'preserve-3d',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Обложка книги */}
        <div 
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{
            background: customCover || coverImage ? `url(${customCover || coverImage})` : 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'translateZ(8px)',
            boxShadow: isHovered 
              ? '0 15px 35px rgba(0, 0, 0, 0.3), 0 5px 15px rgba(0, 0, 0, 0.2)' 
              : '0 8px 25px rgba(0, 0, 0, 0.2), 0 3px 10px rgba(0, 0, 0, 0.1)',
            border: '2px solid #E5E7EB'
          }}
        >
          {/* Если нет пользовательской обложки, показываем стандартную */}
          {!customCover && !coverImage && (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <h3 className="text-sm font-bold text-center leading-tight mb-2 text-white">
                {title.length > 15 ? title.substring(0, 15) + '...' : title}
              </h3>
              <p className="text-xs text-center opacity-80 text-white">
                Описание книги
              </p>
            </div>
          )}
        </div>

        {/* Переплет книги (корешок) */}
        <div 
          className="absolute left-0 top-0 w-2 h-full rounded-l-lg"
          style={{
            background: 'linear-gradient(90deg, #4B5563, #6B7280, #4B5563)',
            transform: 'translateZ(4px)',
            boxShadow: 'inset -2px 0 4px rgba(0, 0, 0, 0.3)'
          }}
        />

        {/* Страницы книги */}
        <div 
          className="absolute right-0 top-0 w-1 h-full"
          style={{
            background: 'linear-gradient(90deg, #F9FAFB, #F3F4F6, #E5E7EB)',
            transform: 'translateZ(2px)',
            boxShadow: '2px 0 4px rgba(0, 0, 0, 0.1)'
          }}
        />

        {/* Дополнительные страницы для объема */}
        <div 
          className="absolute right-1 top-0 w-1 h-full"
          style={{
            background: 'linear-gradient(90deg, #F3F4F6, #E5E7EB)',
            transform: 'translateZ(1px)',
            boxShadow: '1px 0 2px rgba(0, 0, 0, 0.1)'
          }}
        />

        {/* Рейтинг с цветовой индикацией */}
        <div 
          className="absolute top-2 right-2"
          style={{
            transform: 'translateZ(10px)'
          }}
        >
          <span 
            className="text-xs font-bold px-2 py-1 rounded-full text-white shadow-lg"
            style={{ 
              background: ratingColor,
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            {rating > 0 ? rating.toFixed(1) : '—'}
          </span>
        </div>

        {/* Тень от книги */}
        <div 
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.1) 0%, transparent 50%)',
            transform: 'translateZ(-2px)',
            filter: 'blur(2px)'
          }}
        />
      </div>
    </motion.div>
  );
};

export default BookCard;