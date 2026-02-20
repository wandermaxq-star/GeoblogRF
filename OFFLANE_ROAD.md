# OFFLANE_ROAD — план для офлайн‑показа маршрутов и меток

Кратко: проект должен корректно показывать и сохранять маршруты/метки в офлайне (просмотр, экспорт, сохранение черновиков). Ничего не делаем с «фоновой» записью GPS — это не цель и не надежно на многих устройствах (особенно iOS).

## Цель
- Надёжное локальное хранение треков/маршрутов и меток (IndexedDB) + корректный показ в офлайн‑режиме.
- UX: пользователю — опция «записать трек» (в момент записи в приложении), затем трек сохраняется и доступен офлайн.

## Не‑цель
- Фоновая/системная навигация и постоянный background GPS (не реализуемо для большинства устройств).

---

## Высокий приоритет (что должно быть сделано первым) ✅
1. Persist recorded tracks (core)
   - Исправить `stopTracking()` чтобы он сохранял реальные `points`, `startTime`, `endTime`, `distance`, `bbox`, `metadata`.
   - Сохранение: `offlineContentQueue.saveDraft('route', ...)` или fallback `storageService.saveRoute(track)`.
   - Файлы: `src/services/map_facade/MapContextFacade.ts`, `src/services/offlineContentQueue.ts`, `src/services/offlineContentStorage.ts`, `src/services/storageService.ts`.
   - Acceptance: после `stopTracking()` трек виден в `offlineContentStorage.getAllDrafts('route')` и/или в `storageService.getRoutes()`.

2. Реализовать persistent routes API
   - Добавить/реализовать `indexedDBService.saveRoute/getRoutes/deleteRoute` (objectStore `routes`) или расширить `offlineContentStorage` для долгосрочного сохранения сохранённых маршрутов.
   - UI использует `storageService.getRoutes()` (см. `routesService.getMyRoutes`).

3. UI + отображение
   - Убедиться, что `ProfileRoutes`, `Planner`, `OfflineDraftsPanel` читают данные из `offlineContentQueue.getDrafts('route')` и `storageService.getRoutes()`.
   - Добавить тесты/смоки для офлайн‑режима (happy path: видеть маршрут без сети).

4. Тесты (обязательные)
   - Unit: `MapContextFacade.stopTracking()` → корректный `TrackedRoute` (points/distance/duration/bbox).
   - Integration: запись трека → сохранение в IndexedDB → отображение в `getMyRoutes()`.
   - Queue test: ручная отправка и удаление draft при успешном upload.

5. Документация / UX
   - Пояснить пользователю ограничения (iOS background tracking). Обновить `README`/docs.

---

## Средний приоритет (улучшения) ⚙️
- Очистка старых черновиков (`cleanupOldDrafts`) и лимит хранения (warning пользователю при переполнении).
- Улучшить retry/backoff для очереди (экспоненциальный + jitter).
- Ограничить количество точек трека (downsample) при сохранении для экономии места.

---

## Технические заметки / рекомендации
- `MapContextFacade.stopTracking()` должен *не полагаться* на background сервисы — операция синхронно формирует объект и сохраняет его.
- Не использовать `optional chaining` для критичных методов сохранения (если `saveDraft` отсутствует — иметь fallback к `offlineContentStorage.addDraft`).
- `storageService.indexedDBService` — добавить `routes` store или делегировать хранение маршрутов в `offlineContentStorage` с флагом `isSavedRoute`.

### Пример (псевдокод правки `stopTracking()`)
```ts
const track: TrackedRoute = {
  id: `${Date.now()}-${rand}`,
  points: this.trackingPoints.slice(),
  startTime: this.trackingStartTime ?? now,
  endTime: now,
  distance,
  duration,
  bbox,
  metadata: { avgAccuracy: this.estimateAccuracy(this.trackingPoints) },
  waypoints: []
};
// persist: prefer queue (will survive reloads), fallback to storage
await this.deps.offlineContentQueue.saveDraft?.('route', { id: track.id, track, isTracked: true })
  ?? await this.deps.storageService.saveRoute?.(track);
```

---

## Тесты, которые нужно добавить (имена/цели)
- `mapFacade.stopTracking.spec.ts` — unit: points + metrics preserved.
- `offlineRoutes.persistence.integration.test.ts` — stopTracking → persisted in IndexedDB → returned by `storageService.getRoutes()` and `offlineContentQueue.getDrafts('route')`.
- `profileRoutes.ui.test.tsx` — отображение сохранённого маршрута офлайн.

---

## PR / коммиты (предложение по ветке)
1. chore: tests for stopTracking (failing)
2. fix: MapContextFacade.stopTracking — persist points
3. feat: offlineContentQueue.saveDraft fallback and storageService.saveRoute implementation
4. test: integration test for persisted route display
5. docs: update README (offline tracking UX note)

---

## Критерии приёмки (How to verify) ✅
- Пользователь записал трек (в приложении) → после Stop трек появился в списке маршрутов без сети.
- Экспорт (GPX/KML/GeoJSON) работает для сохранённого трека.
- При перезапуске приложения трек остаётся (IndexedDB).
- Нет попыток фоновой записи или использования background‑geolocation.

---

## Оценка объёма работ
- Быстрый исправляемый MVP (fix + tests): ~1–2 рабочих дня.  
- Доп. улучшения (cleanup, backoff, UI warnings): +1–2 дня.

---

Если подтверждаете — приступаю к правкам по приоритету *Persist recorded tracks → API сохранения → UI + тесты*. Если хотите сначала только PR/план — укажете в ответе. 

*Файл создан автоматически: OFFLANE_ROAD.md*