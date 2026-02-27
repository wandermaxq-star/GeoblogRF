/**
 * CentreBackground — анимированный фон для Центра Влияния
 * Замена Leaflet-карты: плавающие градиентные сферы (orbs)
 * CSS-only анимация, zero JS. Поддержка dark/light темы.
 */

import React from 'react';
import './CentreBackground.css';

const CentreBackground: React.FC = () => {
  return (
    <div className="centre-bg" aria-hidden="true">
      <div className="centre-bg__orb centre-bg__orb--1" />
      <div className="centre-bg__orb centre-bg__orb--2" />
      <div className="centre-bg__orb centre-bg__orb--3" />
      <div className="centre-bg__orb centre-bg__orb--4" />
      {/* Тонкий нойз-оверлей для текстуры */}
      <div className="centre-bg__noise" />
    </div>
  );
};

export default CentreBackground;
