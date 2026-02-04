import React from 'react';

interface ScrollTemplateProps {
  title: string;
  rating: number;
  className?: string;
}

const ScrollTemplate: React.FC<ScrollTemplateProps> = ({ title, rating, className = '' }) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 5) return '#FFD700'; // Золотой
    if (rating >= 4.5) return '#32CD32'; // Зеленый насыщенный
    if (rating >= 4) return '#228B22'; // Зеленый
    if (rating >= 3.5) return '#4169E1'; // Синий насыщенный
    if (rating >= 3) return '#1E90FF'; // Синий
    return '#808080'; // Серый
  };

  const getRatingIntensity = (rating: number) => {
    if (rating >= 4.5 || rating >= 3.5) return '0.8';
    return '1';
  };

  const borderColor = getRatingColor(rating);
  const intensity = getRatingIntensity(rating);

  return (
    <div className={`relative ${className}`}>
      <svg
        width="200"
        height="120"
        viewBox="0 0 200 120"
        className="drop-shadow-lg"
      >
        {/* Тень свитка */}
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="rgba(0,0,0,0.3)"/>
          </filter>
          <linearGradient id="scrollGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEFEFE" />
            <stop offset="100%" stopColor="#F5F5F5" />
          </linearGradient>
        </defs>

        {/* Основной свиток */}
        <path
          d="M20 20 Q20 10 30 10 L170 10 Q180 10 180 20 L180 100 Q180 110 170 110 L30 110 Q20 110 20 100 Z"
          fill="url(#scrollGradient)"
          stroke={borderColor}
          strokeWidth="3"
          filter="url(#shadow)"
        />

        {/* Волнистые края */}
        <path
          d="M20 20 Q15 15 20 10 Q25 15 20 20"
          fill="none"
          stroke={borderColor}
          strokeWidth="2"
        />
        <path
          d="M180 20 Q185 15 180 10 Q175 15 180 20"
          fill="none"
          stroke={borderColor}
          strokeWidth="2"
        />
        <path
          d="M20 100 Q15 105 20 110 Q25 105 20 100"
          fill="none"
          stroke={borderColor}
          strokeWidth="2"
        />
        <path
          d="M180 100 Q185 105 180 110 Q175 105 180 100"
          fill="none"
          stroke={borderColor}
          strokeWidth="2"
        />

        {/* Заголовок блога */}
        <text
          x="100"
          y="45"
          textAnchor="middle"
          className="text-sm font-bold fill-gray-800"
          style={{ fontSize: '14px' }}
        >
          {title.length > 20 ? title.substring(0, 20) + '...' : title}
        </text>

        {/* Рейтинг звездочки */}
        <g transform="translate(100, 65)">
          {[1, 2, 3, 4, 5].map((star) => (
            <text
              key={star}
              x={(star - 3) * 12}
              y="0"
              className="text-xs"
              fill={star <= Math.floor(rating) ? borderColor : '#E0E0E0'}
              style={{ fontSize: '12px' }}
            >
              ★
            </text>
          ))}
        </g>

        {/* Значение рейтинга */}
        <text
          x="100"
          y="85"
          textAnchor="middle"
          className="text-xs font-semibold"
          fill={borderColor}
          style={{ fontSize: '10px' }}
        >
          {rating > 0 ? rating.toFixed(1) : '—'}
        </text>
      </svg>
    </div>
  );
};

export default ScrollTemplate;

