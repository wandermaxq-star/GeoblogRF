// Centralized feature flags to enable/disable optional app areas
// Для РФ отключены чаты и реальное время в соответствии с требованиями
export const FEATURES = {
  CHAT_ENABLED: false, // Отключено для РФ
  REALTIME_ENABLED: false, // Отключено для РФ
  USER_INTERACTION_ENABLED: false, // Отключено для РФ
  GEOGRAPHIC_RESTRICTIONS_ENABLED: true, // Обязательная проверка запретных зон
  RUSSIA_COMPLIANCE_MODE: true, // Режим соответствия РФ
};

export type FeatureKeys = keyof typeof FEATURES;


