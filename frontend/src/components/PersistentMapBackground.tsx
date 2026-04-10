// Импортируем leafletInit чтобы window.L (и CSS) были доступны
import '../utils/leafletInit';
import React, { useEffect, useRef, useState } from 'react';
import { useContentStore } from '../stores/contentStore';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MSK: [number, number] = [55.7558, 37.6176];

const PersistentMapBackground: React.FC = () => {
  // Используем отдельный div монтируемый прямо в body через ref — так глобальный
  // CSS @media min-width:768px (.leaflet-container { position: fixed }) не конфликтует
  // с родительским stacking context.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leftContent = useContentStore((s) => s.leftContent);
  // Скрываем когда pages/Map.tsx активен — он сам рисует карту
  const isMapPageActive = leftContent === 'map' || leftContent === 'planner';

  useEffect(() => {
    // Создаём контейнер прямо в body чтобы избежать конфликтов стека z-index
    if (mapRef.current) return; // уже инициализирован
    const el = document.createElement('div');
    el.id = 'bg-map-container';
    el.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    document.body.appendChild(el);
    containerRef.current = el;

    let cancelled = false;

    // Ждём пока контейнер будет виден в DOM (нужен размер для Leaflet)
    const tryInit = () => {
      if (cancelled) return;
      const L = (window as any).L;
      if (!L) return; // leafletInit ещё не загрузился (маловероятно)

      try {
        const map = L.map(el, {
          center: MSK,
          zoom: 10,
          zoomControl: false,
          attributionControl: true,
          dragging: false,       // статичный фон — не тащим
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
          keyboard: false,
          boxZoom: false,
        });
        L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;
      } catch (err) {
        console.warn('[PersistentMapBackground] Leaflet init failed:', err);
      }
    };

    // Небольшая задержка чтобы DOM успел примонтироваться и получить размеры
    const t = setTimeout(tryInit, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
      // Убираем контейнер при размонтировании
      if (containerRef.current) {
        try {
          if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
          containerRef.current.remove();
        } catch (e) {}
        containerRef.current = null;
      }
    };
  }, []);

  // Управляем видимостью через style на DOM-элементе напрямую
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.opacity = isMapPageActive ? '0' : '1';
    el.style.transition = 'opacity 300ms ease';
  }, [isMapPageActive]);

  // Компонент не рендерит ничего в дерево React — карта монтируется в body напрямую
  return null;
};

export default PersistentMapBackground;
