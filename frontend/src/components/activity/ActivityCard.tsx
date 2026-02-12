import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { ActivityItem, activityService } from '../../services/activityService';
import { 
  FaUserPlus, FaEdit, FaBook, FaMapMarkerAlt, FaRoute, FaShare,
  FaCalendarPlus, FaCheckCircle, FaTrophy, FaArrowUp, FaBullseye, 
  FaUserEdit, FaUserFriends, FaCog, FaBullhorn, FaBell, FaComments,
  FaUserMinus, FaPaperPlane, FaArchive, FaUndo, FaTimesCircle, FaCheckDouble,
  FaTrash, FaHeart, FaHeartBroken, FaStar, FaComment, FaThumbsUp, FaThumbsDown,
  FaBan, FaTimes, FaChartLine, FaPlay, FaMedal, FaFire, FaSnowflake,
  FaTools, FaDownload, FaPlus, FaMinus, FaShieldAlt, FaRocket, FaFlag,
  FaExclamationTriangle, FaLink, FaUnlink, FaKey, FaUpload
} from 'react-icons/fa';
import { GeoBadgeList, GeoRef, GeoRefType } from '../Geo/GeoBadge';
import { useGeoFocusStore } from '../../stores/geoFocusStore';
import { useContentStore } from '../../stores/contentStore';

const CardContainer = styled.div<{ isRead: boolean }>`
  /* Transparent glass card similar to Favorites/Posts */
  background: rgba(255,255,255,0.06);
  background-image: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 4px solid ${props => props.isRead ? 'rgba(255,255,255,0.08)' : 'rgba(52,152,219,0.9)'};
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(0,0,0,0.16);
    background: rgba(255,255,255,0.09);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const UserAvatar = styled.div<{ avatarUrl?: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.avatarUrl 
    ? `url(${props.avatarUrl}) center/cover` 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
`;

const ActivityIcon = styled.div<{ color: string }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${props => props.color}20;
  color: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.span`
  font-weight: 600;
  color: #2c3e50;
  margin-right: 4px;
`;

const ActivityText = styled.span`
  color: #7f8c8d;
`;

const ActivityTime = styled.div`
  font-size: 12px;
  color: #95a5a6;
  margin-top: 4px;
`;

const ActivityMetadata = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  border-radius: 8px;
  font-size: 14px;
  color: #495057;
  border: 1px solid rgba(255,255,255,0.04);
`;

const UnreadIndicator = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  background: #e74c3c;
  border-radius: 50%;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.variant === 'primary' ? `
    background: #3498db;
    color: white;
    &:hover {
      background: #2980b9;
    }
  ` : `
    background: #ecf0f1;
    color: #7f8c8d;
    &:hover {
      background: #d5dbdb;
    }
  `}
`;

interface ActivityCardProps {
  activity: ActivityItem;
  onMarkAsRead?: (activityId: string) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onMarkAsRead }) => {
  // Собираем гео-ссылки из activity_type и target_id
  const geoRefs = useMemo<GeoRef[]>(() => {
    const refs: GeoRef[] = [];
    if (!activity.target_id) return refs;

    // Определяем тип гео-объекта по activity_type или target_type
    const at = activity.activity_type;
    const tt = activity.target_type;
    let geoType: GeoRefType | null = null;

    if (at.startsWith('marker_') || tt === 'marker') geoType = 'marker';
    else if (at.startsWith('route_') || tt === 'route') geoType = 'route';
    else if (at.startsWith('event_') || tt === 'event') geoType = 'event';

    if (geoType) {
      refs.push({
        type: geoType,
        id: activity.target_id,
        title: activity.metadata?.title || activity.metadata?.name || undefined,
      });
    }
    return refs;
  }, [activity.activity_type, activity.target_type, activity.target_id, activity.metadata]);

  // Клик по гео-иконке → открываем карту слева, ленту активности справа
  const handleGeoOpen = useCallback((ref: GeoRef) => {
    useGeoFocusStore.getState().setFocus({ type: ref.type, id: ref.id, title: ref.title });
    useContentStore.getState().setLeftContent('map');
    useContentStore.getState().setRightContent('feed');
  }, []);

  const handleCardClick = () => {
    if (!activity.is_read && onMarkAsRead) {
      onMarkAsRead(activity.id);
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    
    switch (action) {
      case 'view':
        // Переход к связанному объекту
        if (activity.target_id) {
          // Здесь можно добавить логику перехода
          }
        break;
      case 'share':
        // Поделиться активностью
        break;
      default:
        break;
    }
  };

  const getActivityIcon = () => {
    const iconName = activityService.getActivityIcon(activity.activity_type);
    const iconMap: Record<string, React.ReactElement> = {
      // Чаты
      'FaComments': <FaComments />,
      'FaUserPlus': <FaUserPlus />,
      'FaUserMinus': <FaUserMinus />,
      'FaPaperPlane': <FaPaperPlane />,
      'FaArchive': <FaArchive />,
      'FaUndo': <FaUndo />,
      
      // События
      'FaCalendarPlus': <FaCalendarPlus />,
      'FaCheckCircle': <FaCheckCircle />,
      'FaEdit': <FaEdit />,
      'FaTimesCircle': <FaTimesCircle />,
      'FaCheckDouble': <FaCheckDouble />,
      
      // Маршруты
      'FaRoute': <FaRoute />,
      'FaShare': <FaShare />,
      'FaTrash': <FaTrash />,
      'FaHeart': <FaHeart />,
      'FaHeartBroken': <FaHeartBroken />,
      'FaStar': <FaStar />,
      'FaComment': <FaComment />,
      
      // Метки
      'FaMapMarkerAlt': <FaMapMarkerAlt />,
      
      // Блоги
      'FaBook': <FaBook />,
      'FaThumbsUp': <FaThumbsUp />,
      'FaThumbsDown': <FaThumbsDown />,
      
      // Пользователи и социальные взаимодействия
      'FaUserFriends': <FaUserFriends />,
      'FaBan': <FaBan />,
      'FaTimes': <FaTimes />,
      
      // Достижения и геймификация
      'FaBell': <FaBell />,
      'FaChartLine': <FaChartLine />,
      'FaArrowUp': <FaArrowUp />,
      'FaTrophy': <FaTrophy />,
      'FaPlay': <FaPlay />,
      'FaBullseye': <FaBullseye />,
      'FaMedal': <FaMedal />,
      'FaFire': <FaFire />,
      'FaSnowflake': <FaSnowflake />,
      
      // Системные уведомления
      'FaCog': <FaCog />,
      'FaBullhorn': <FaBullhorn />,
      'FaTools': <FaTools />,
      'FaDownload': <FaDownload />,
      'FaPlus': <FaPlus />,
      'FaMinus': <FaMinus />,
      'FaShieldAlt': <FaShieldAlt />,
      'FaRocket': <FaRocket />,
      
      // Модерация и безопасность
      'FaFlag': <FaFlag />,
      'FaExclamationTriangle': <FaExclamationTriangle />,
      
      // Интеграции и внешние сервисы
      'FaLink': <FaLink />,
      'FaUnlink': <FaUnlink />,
      'FaKey': <FaKey />,
      'FaUpload': <FaUpload />,
      
      // Профиль
      'FaUserEdit': <FaUserEdit />
    };
    return iconMap[iconName] || <FaBell />;
  };
  const getActivityColor = () => activityService.getActivityColor(activity.activity_type);
  const getActivityText = () => activityService.getActivityText(activity.activity_type, activity.metadata);
  const getFormattedTime = () => activityService.formatTime(activity.created_at);

  const getUserInitials = () => {
    if (activity.username) {
      return activity.username.charAt(0).toUpperCase();
    }
    return '?';
  };

  const getMetadataText = () => {
    if (!activity.metadata || Object.keys(activity.metadata).length === 0) {
      return null;
    }

    // Показываем релевантную информацию из метаданных
    if (activity.metadata.title) {
      return `"${activity.metadata.title}"`;
    }
    
    if (activity.metadata.name) {
      return `"${activity.metadata.name}"`;
    }

    if (activity.metadata.description) {
      return activity.metadata.description.length > 100 
        ? `${activity.metadata.description.substring(0, 100)}...`
        : activity.metadata.description;
    }

    return null;
  };

  return (
    <CardContainer 
      isRead={activity.is_read} 
      onClick={handleCardClick}
    >
      {!activity.is_read && <UnreadIndicator />}
      
      <CardHeader>
        <UserAvatar avatarUrl={activity.avatar_url}>
          {!activity.avatar_url && getUserInitials()}
        </UserAvatar>
        
        <ActivityIcon color={getActivityColor()}>
          {getActivityIcon()}
        </ActivityIcon>
        
        <ActivityContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div>
              <UserName>{activity.username}</UserName>
              <ActivityText>{getActivityText()}</ActivityText>
            </div>
            <GeoBadgeList geoRefs={geoRefs} onOpen={handleGeoOpen} />
          </div>
          <ActivityTime>{getFormattedTime()}</ActivityTime>
        </ActivityContent>
      </CardHeader>

      {getMetadataText() && (
        <ActivityMetadata>
          {getMetadataText()}
        </ActivityMetadata>
      )}

      <ActionButtons>
        {activity.target_id && (
          <ActionButton 
            variant="primary"
            onClick={(e) => handleActionClick(e, 'view')}
          >
            Посмотреть
          </ActionButton>
        )}
        
        <ActionButton 
          onClick={(e) => handleActionClick(e, 'share')}
        >
          Поделиться
        </ActionButton>
      </ActionButtons>

    </CardContainer>
  );
};

export default ActivityCard;
