import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, MessageCircle, Star, Heart, ArrowRight, Play } from 'lucide-react';

interface Marker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  description: string;
  image?: string;
  comments?: Comment[];
  delay: number;
}

interface Comment {
  id: string;
  text: string;
  author: string;
  timeAgo: string;
  position: { x: number; y: number };
}

interface RoutePoint {
  lat: number;
  lng: number;
  delay: number;
}

const InteractiveMapDemo: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [routeProgress, setRouteProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // NOTE: mapRef is a DOM container ref used for measurements — avoid using it for map API calls.
  // Use `mapFacade()` for map interactions.
  const mapRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  const markers: Marker[] = [
    {
      id: 'moscow',
      position: { lat: 55.7558, lng: 37.6176 },
      title: 'Москва',
      description: 'Столица России. Здесь начинается ваше путешествие по необъятной стране.',
      delay: 3000,
      comments: [
        { id: '1', text: 'Красивый город! Обязательно посетите Красную площадь', author: 'Анна', timeAgo: '2 дня назад', position: { x: 20, y: -30 } },
        { id: '2', text: 'Отличные музеи и парки', author: 'Игорь', timeAgo: '1 неделю назад', position: { x: 40, y: -50 } }
      ]
    },
    {
      id: 'baikal',
      position: { lat: 53.0, lng: 108.0 },
      title: 'Озеро Байкал',
      description: 'Самое глубокое озеро в мире. Здесь природа показывает свою мощь.',
      delay: 8000,
      comments: [
        { id: '3', text: 'Невероятная красота! Лучшее место для медитации', author: 'Мария', timeAgo: '3 дня назад', position: { x: 30, y: -40 } },
        { id: '4', text: 'Вода кристально чистая', author: 'Дмитрий', timeAgo: '5 дней назад', position: { x: 50, y: -20 } }
      ]
    },
    {
      id: 'sochi',
      position: { lat: 43.5855, lng: 39.7231 },
      title: 'Сочи',
      description: 'Черноморское побережье. Здесь море встречается с горами.',
      delay: 13000,
      comments: [
        { id: '5', text: 'Отличный климат круглый год', author: 'Елена', timeAgo: '1 день назад', position: { x: 25, y: -35 } },
        { id: '6', text: 'Прекрасные пляжи и горы рядом', author: 'Алексей', timeAgo: '4 дня назад', position: { x: 45, y: -25 } }
      ]
    }
  ];

  const routePoints: RoutePoint[] = [
    { lat: 55.7558, lng: 37.6176, delay: 0 },
    { lat: 56.0, lng: 60.0, delay: 2000 },
    { lat: 58.0, lng: 80.0, delay: 4000 },
    { lat: 60.0, lng: 100.0, delay: 6000 },
    { lat: 53.0, lng: 108.0, delay: 8000 },
    { lat: 50.0, lng: 90.0, delay: 10000 },
    { lat: 45.0, lng: 70.0, delay: 12000 },
    { lat: 43.5855, lng: 39.7231, delay: 14000 }
  ];

  const steps = [
    { action: 'start', delay: 0 },
    { action: 'marker', markerId: 'moscow', delay: 3000 },
    { action: 'route', delay: 5000 },
    { action: 'marker', markerId: 'baikal', delay: 8000 },
    { action: 'comments', delay: 10000 },
    { action: 'marker', markerId: 'sochi', delay: 13000 },
    { action: 'complete', delay: 15000 }
  ];

  useEffect(() => {
    if (isPlaying) {
      startAnimation();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const startAnimation = () => {
    let stepIndex = 0;
    const executeStep = () => {
      if (stepIndex < steps.length) {
        const step = steps[stepIndex];
        setTimeout(() => {
          setCurrentStep(stepIndex);
          
          switch (step.action) {
            case 'start':
              setActiveMarker(null);
              setRouteProgress(0);
              setShowComments(false);
              break;
            case 'marker':
              setActiveMarker(step.markerId as string);
              break;
            case 'route':
              animateRoute();
              break;
            case 'comments':
              setShowComments(true);
              break;
            case 'complete':
              setIsPlaying(false);
              break;
          }
          
          stepIndex++;
          executeStep();
        }, step.delay);
      }
    };
    executeStep();
  };

  const animateRoute = () => {
    let progress = 0;
    const animate = () => {
      progress += 2;
      setRouteProgress(progress);
      
      if (progress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  };

  const getMarkerPosition = (marker: Marker) => {
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (!mapRect) return { x: 0, y: 0 };
    
    // Упрощенное преобразование координат в пиксели
    const x = ((marker.position.lng + 180) / 360) * mapRect.width;
    const y = ((90 - marker.position.lat) / 180) * mapRect.height;
    
    return { x, y };
  };

  const getRoutePath = () => {
    if (!mapRef.current) return '';
    
    const mapRect = mapRef.current.getBoundingClientRect();
    const progress = routeProgress / 100;
    const visiblePoints = Math.floor(progress * routePoints.length);
    
    return routePoints.slice(0, visiblePoints + 1).map((point, index) => {
      const x = ((point.lng + 180) / 360) * mapRect.width;
      const y = ((90 - point.lat) / 180) * mapRect.height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const handleStartDemo = () => {
    setIsPlaying(true);
    setCurrentStep(0);
    setActiveMarker(null);
    setRouteProgress(0);
    setShowComments(false);
  };

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl overflow-hidden border border-gray-200">
      {/* Карта России (упрощенная) */}
      <div 
        ref={mapRef}
        className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-50 to-yellow-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23e5e7eb' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23grid)'/%3E%3C/svg%3E")`
        }}
      >
        {/* Контур России (упрощенный) */}
        <svg className="absolute inset-0 w-full h-full">
          <path
            d="M 100 200 Q 150 150 200 180 Q 250 200 300 190 Q 350 180 400 200 Q 450 220 500 210 Q 550 200 600 220 Q 650 240 700 230 Q 750 220 800 240 Q 850 260 900 250 L 900 300 Q 850 320 800 310 Q 750 300 700 320 Q 650 340 600 330 Q 550 320 500 340 Q 450 360 400 350 Q 350 340 300 360 Q 250 380 200 370 Q 150 360 100 380 Z"
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth="2"
          />
        </svg>

        {/* Анимированный маршрут */}
        {currentStep >= 2 && (
          <svg className="absolute inset-0 w-full h-full">
            <path
              d={getRoutePath()}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
            <circle
              r="4"
              fill="#3b82f6"
              className="animate-ping"
            >
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={getRoutePath()}
              />
            </circle>
          </svg>
        )}

        {/* Метки */}
        {markers.map((marker) => {
          const position = getMarkerPosition(marker);
          const isActive = activeMarker === marker.id;
          const shouldShow = currentStep >= markers.indexOf(marker) + 1;
          
          if (!shouldShow) return null;

          return (
            <div key={marker.id}>
              {/* Маркер */}
              <div
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ${
                  isActive ? 'scale-125 z-20' : 'scale-100 z-10'
                }`}
                style={{ left: position.x, top: position.y }}
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg animate-pulse">
                    <MapPin className="w-4 h-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  
                  {/* Попап */}
                  {isActive && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 animate-fadeIn">
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <Star className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-sm">{marker.title}</h3>
                          <p className="text-gray-600 text-xs mt-1">{marker.description}</p>
                          <div className="flex items-center mt-2 space-x-2">
                            <button className="px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors">
                              <Navigation className="w-3 h-3 inline mr-1" />
                              Маршрут
                            </button>
                            <button className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors">
                              <Heart className="w-3 h-3 inline mr-1" />
                              Сохранить
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Комментарии */}
              {showComments && marker.comments && marker.id === 'baikal' && (
                <div className="absolute" style={{ left: position.x, top: position.y }}>
                  {marker.comments.map((comment, index) => (
                    <div
                      key={comment.id}
                      className="absolute bg-white rounded-lg shadow-lg p-3 border border-gray-200 animate-fadeIn"
                      style={{
                        left: comment.position.x,
                        top: comment.position.y,
                        animationDelay: `${index * 0.5}s`
                      }}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <MessageCircle className="w-3 h-3 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-800">{comment.text}</p>
                          <div className="flex items-center mt-1 space-x-2 text-xs text-gray-500">
                            <span className="font-medium">{comment.author}</span>
                            <span>•</span>
                            <span>{comment.timeAgo}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Панель управления */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleStartDemo}
                disabled={isPlaying}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>{isPlaying ? 'Демо запущено...' : 'Запустить демо'}</span>
              </button>
              
              <div className="text-sm text-gray-600">
                Шаг {currentStep + 1} из {steps.length}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>Интерактивная карта России</span>
            </div>
          </div>
        </div>
      </div>

      {/* Информационная панель */}
      <div className="absolute top-4 left-4 right-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2">ГеоБлог.РФ</h3>
          <p className="text-sm text-gray-600">
            Посмотрите, как работает наша платформа: создание маршрутов, метки с информацией, 
            комментарии прямо на карте — всё это ждёт вас в полной версии.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMapDemo;
