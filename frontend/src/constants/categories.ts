// frontend/src/constants/categories.ts
import {
  FaLeaf, FaGem, FaCameraRetro, FaRoute, FaUtensils, FaLandmark, FaBus, FaHotel, FaQuestion, FaUsers, FaHeart, FaWallet, FaHiking, FaMapPin, FaBlog, FaCalendarCheck, FaGift, FaSun, FaSnowflake, FaStar, FaBuilding
} from 'react-icons/fa';

export interface Category {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string; // Можно добавить цвет для мини-попапа
}

export const CATEGORIES: Category[] = [
  { key: "attraction", label: "Достопримечательность", icon: FaStar, color: "#3498db" },
  { key: "restaurant", label: "Ресторан", icon: FaUtensils, color: "#e74c3c" },
  { key: "hotel", label: "Отель", icon: FaHotel, color: "#8e44ad" },
  { key: "nature", label: "Природа", icon: FaLeaf, color: "#27ae60" },
  { key: "culture", label: "Культура", icon: FaLandmark, color: "#f1c40f" },
  { key: "entertainment", label: "Развлечения", icon: FaGem, color: "#f39c12" },
  { key: "transport", label: "Транспорт", icon: FaBus, color: "#16a085" },
  { key: "service", label: "Сервис", icon: FaBuilding, color: "#34495e" },
  { key: "shopping", label: "Торговля", icon: FaWallet, color: "#e67e22" },
  { key: "healthcare", label: "Здравоохранение", icon: FaHeart, color: "#e74c3c" },
  { key: "education", label: "Образование", icon: FaUsers, color: "#3498db" },
  { key: "services", label: "Услуги", icon: FaQuestion, color: "#34495e" },
  { key: "other", label: "Другое", icon: FaQuestion, color: "#7f8c8d" },
  // Дополнительные категории из фильтров:
  { key: "hidden_gems", label: "Скрытые жемчужины", icon: FaGem, color: "#9b59b6" },
  { key: "instagram", label: "Инстаграмные места", icon: FaCameraRetro, color: "#e84393" },
  { key: "non_tourist", label: "Нетуристические маршруты", icon: FaRoute, color: "#636e72" },
  { key: "summer2024", label: "#лето2024", icon: FaSun, color: "#f9ca24" },
  { key: "winter2024", label: "#зима2024", icon: FaSnowflake, color: "#74b9ff" },
  { key: "newyear", label: "#новыйгод", icon: FaGift, color: "#00b894" },
  { key: "family", label: "#длясемьи", icon: FaUsers, color: "#00b894" },
  { key: "romantic", label: "#романтическийотпуск", icon: FaHeart, color: "#e17055" },
  { key: "budget", label: "#бюджетноепутешествие", icon: FaWallet, color: "#fdcb6e" },
  { key: "trekking", label: "#трекинг", icon: FaHiking, color: "#00b894" },
  { key: "gastrotour", label: "#гастротур", icon: FaUtensils, color: "#e67e22" },
  { key: "ecotourism", label: "#экотуризм", icon: FaLeaf, color: "#00b894" },
  { key: "excursions", label: "#экскурсии", icon: FaLandmark, color: "#0984e3" },
  { key: "user_poi", label: "Пользовательские метки", icon: FaMapPin, color: "#e67e22" },

  { key: "event", label: "Событие", icon: FaCalendarCheck, color: "#9b59b6" },
];
