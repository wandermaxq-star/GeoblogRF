/**
 * Lazy-обёртки для тяжёлых Mini-компонентов (MiniMapMarker, MiniMapRoute, MiniEventCard).
 * 
 * Эти компоненты тянут leaflet (~140 KB) и MapContextFacade через PostMap.
 * Lazy-загрузка позволяет вынести их из основного бандла в отдельные чанки,
 * которые загружаются только когда пост содержит маркер/маршрут/событие.
 */

import React, { lazy, Suspense } from 'react';

const MiniMapMarkerLazy = lazy(() => import('./MiniMapMarker'));
const MiniMapRouteLazy = lazy(() => import('./MiniMapRoute'));
const MiniEventCardLazy = lazy(() => import('./MiniEventCard'));

const MapPlaceholder = ({ height = '128px' }: { height?: string }) => (
  <div
    className="flex items-center justify-center rounded-xl"
    style={{ height, background: 'rgba(0,0,0,0.04)' }}
  >
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
  </div>
);

export const MiniMapMarker = (props: any) => (
  <Suspense fallback={<MapPlaceholder height={props.height} />}>
    <MiniMapMarkerLazy {...props} />
  </Suspense>
);

export const MiniMapRoute = (props: any) => (
  <Suspense fallback={<MapPlaceholder height={props.height} />}>
    <MiniMapRouteLazy {...props} />
  </Suspense>
);

export const MiniEventCard = (props: any) => (
  <Suspense fallback={<MapPlaceholder height={props.height} />}>
    <MiniEventCardLazy {...props} />
  </Suspense>
);
