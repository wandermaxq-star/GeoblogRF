import { useState, useEffect } from 'react';

/**
 * Хук для glassmorphism стилей на странице Planner (мобильная версия).
 * Возвращает inline-стили в зависимости от текущей темы (light/dark).
 * 
 * Используется ТОЛЬКО на PlannerPage — solo-страницы имеют другую стилистику.
 */
export const usePlannerGlassStyles = () => {
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  // Следим за изменением темы
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // === ПАНЕЛЬ (основной контейнер) ===
  const panel = {
    background: isDark 
      ? 'linear-gradient(160deg, rgba(25, 30, 50, 0.88) 0%, rgba(20, 25, 40, 0.82) 100%)'
      : 'linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.6) 100%)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : '1px solid rgba(255, 255, 255, 0.35)',
    boxShadow: isDark 
      ? '0 8px 40px rgba(0, 0, 0, 0.35)'
      : '0 8px 40px rgba(0, 0, 0, 0.12)',
  };

  // === ЗАГОЛОВОК ПАНЕЛИ ===
  const panelHeader = {
    background: isDark 
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.3) 100%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: isDark 
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(255, 255, 255, 0.25)',
  };

  // === ФУТЕР ПАНЕЛИ ===
  const panelFooter = {
    background: isDark 
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.3) 100%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: isDark 
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(255, 255, 255, 0.25)',
  };

  // === КНОПКА (Layer 2) ===
  const button = {
    background: isDark
      ? 'rgba(30, 35, 55, 0.85)'
      : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.15)'
      : '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: isDark
      ? '0 4px 16px rgba(0, 0, 0, 0.25)'
      : '0 4px 16px rgba(0, 0, 0, 0.12)',
  };

  // === КНОПКА АКТИВНАЯ ===
  const buttonActive = {
    ...button,
    background: isDark 
      ? 'rgba(255, 255, 255, 0.14)'
      : 'rgba(255, 255, 255, 0.2)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.2)'
      : '1px solid rgba(255, 255, 255, 0.4)',
  };

  // === КАРТОЧКА ===
  const card = {
    background: isDark 
      ? 'rgba(0, 0, 0, 0.06)' 
      : 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px) saturate(180%)',
    WebkitBackdropFilter: 'blur(10px) saturate(180%)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.12)'
      : '1px solid rgba(255, 255, 255, 0.2)',
  };

  // === ИНПУТ ===
  const input = {
    background: isDark 
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 100%)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : '1px solid rgba(255, 255, 255, 0.3)',
  };

  // === ТЕКСТ ===
  const text = {
    color: isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.8)',
  };

  const textSecondary = {
    color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.5)',
  };

  const textMuted = {
    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.35)',
  };

  // === АККОРДЕОН ХЕДЕР ===
  const accordionHeader = {
    ...button,
    borderRadius: '8px',
    padding: '10px 12px',
  };

  const accordionHeaderOpen = {
    ...accordionHeader,
    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.85) 0%, rgba(22, 163, 74, 0.9) 100%)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    color: '#ffffff',
  };

  // === РАЗДЕЛИТЕЛЬ ===
  const divider = {
    borderBottom: isDark 
      ? '1px solid rgba(255, 255, 255, 0.06)'
      : '1px solid rgba(255, 255, 255, 0.15)',
  };

  // === OVERLAY ===
  const overlay = {
    background: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
  };

  // === CHIP ===
  const chip = {
    background: isDark 
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.3) 100%)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(255, 255, 255, 0.25)',
  };

  const chipSelected = {
    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.85) 0%, rgba(22, 163, 74, 0.9) 100%)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    color: '#ffffff',
  };

  return {
    isDark,
    panel,
    panelHeader,
    panelFooter,
    button,
    buttonActive,
    card,
    input,
    text,
    textSecondary,
    textMuted,
    accordionHeader,
    accordionHeaderOpen,
    divider,
    overlay,
    chip,
    chipSelected,
  };
};
