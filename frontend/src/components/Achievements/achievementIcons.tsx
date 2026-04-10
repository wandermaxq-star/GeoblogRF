import React from 'react';
import * as FaIcons from 'react-icons/fa';

// shared icon mapping used by several components
const safeIcon = (Icon: any, fallback: React.ReactNode = null) => {
  if (Icon && typeof Icon === 'function') {
    return <Icon className="w-6 h-6" />;
  }
  return fallback;
};

export const achievementIconMap: Record<string, React.ReactNode> = {
  'trophy': safeIcon(FaIcons.FaTrophy),
  'star': safeIcon(FaIcons.FaStar),
  'crown': safeIcon(FaIcons.FaCrown),
  'gem': safeIcon(FaIcons.FaGem),
  'medal': safeIcon(FaIcons.FaMedal),
  'award': safeIcon(FaIcons.FaAward),
  'rocket': safeIcon(FaIcons.FaRocket),
  'fire': safeIcon(FaIcons.FaFire),
  'map': safeIcon(FaIcons.FaMapMarkerAlt),
  'camera': safeIcon(FaIcons.FaCamera),
  // additional names used in hook
  'map-marker': safeIcon(FaIcons.FaMap),
  'cloud': safeIcon(FaIcons.FaCloud),
  'cloud-upload': safeIcon(FaIcons.FaCloudUploadAlt, safeIcon(FaIcons.FaCloud)),
  'cloud-download': safeIcon(FaIcons.FaCloud),
  'cloud-check': safeIcon(FaIcons.FaCloud),
  'zap': safeIcon(FaIcons.FaBolt),
};

export function getAchievementIcon(iconName: string): React.ReactNode {
  // iconName may come as emoji or string identifier; try lookup then fallback to trophy emoji
  if (achievementIconMap[iconName]) {
    return achievementIconMap[iconName];
  }

  // some legacy data may supply emoji; map those too
  switch (iconName) {
    case '🗺️': return achievementIconMap['map'];
    case '📸': return achievementIconMap['camera'];
    case '✍️': return achievementIconMap['award'];
    case '💬': return achievementIconMap['medal'];
    case '🔥': return achievementIconMap['fire'];
    case '⚡': return achievementIconMap['zap'];
    case '⭐': return achievementIconMap['star'];
    case '👑': return achievementIconMap['crown'];
    default:
      return <FaIcons.FaTrophy className="w-6 h-6" />;
  }
}
