/**
 * ЕДИНЫЙ сервис уведомлений о модерации.
 *
 * Объединяет:
 * - Browser Notification API
 * - localStorage-персистенцию (60 дней)
 * - Read/unread трекинг
 * - Слушатели window-событий
 */

import { storageService } from './storageService';

export type ContentType = 'post' | 'marker' | 'event' | 'route';
export type ModerationStatus = 'approved' | 'rejected' | 'revision' | 'pending';

export interface ModerationNotification {
  id: string;
  contentType: ContentType;
  contentId: string;
  contentTitle?: string;
  status: ModerationStatus;
  reason?: string;
  message?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'moderationNotificationsHistory';
const ENABLED_KEY = 'moderationNotificationsEnabled';
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

class ModerationNotificationsService {
  private listeners: Set<(notification: ModerationNotification) => void> = new Set();
  private notificationHistory: ModerationNotification[] = [];
  private enabled = true;

  // ── Подписка ──────────────────────────────────────────────────────

  onNotification(callback: (notification: ModerationNotification) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  // ── Отправка ──────────────────────────────────────────────────────

  notify(data: Omit<ModerationNotification, 'id' | 'timestamp' | 'read'>) {
    if (!this.enabled) return;

    const notification: ModerationNotification = {
      ...data,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      read: false,
    };

    this.notificationHistory.unshift(notification);
    this.notificationHistory = this.notificationHistory.filter(
      n => n.timestamp > Date.now() - SIXTY_DAYS,
    );
    this.save();

    this.listeners.forEach(cb => cb(notification));
    this.showBrowserNotification(notification);
  }

  // ── Browser Notification API ──────────────────────────────────────

  private async showBrowserNotification(notification: ModerationNotification) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;

    const statusText: Record<ModerationStatus, string> = {
      approved: 'одобрен',
      rejected: 'отклонён',
      revision: 'отправлен на доработку',
      pending: 'на модерации',
    };
    const typeText: Record<ContentType, string> = {
      post: 'Пост', marker: 'Метка', event: 'Событие', route: 'Маршрут',
    };

    new Notification(
      `${typeText[notification.contentType]} ${statusText[notification.status]}`,
      {
        body: notification.message || `Ваш контент был ${statusText[notification.status]}`,
        icon: '/favicon.ico',
        tag: `moderation-${notification.contentId}`,
        requireInteraction: notification.status === 'rejected' || notification.status === 'revision',
      },
    );
  }

  // ── Read / Unread ─────────────────────────────────────────────────

  getUnreadCount(): number {
    return this.notificationHistory.filter(n => !n.read).length;
  }

  markAsRead(notificationId: string) {
    const n = this.notificationHistory.find(x => x.id === notificationId);
    if (n) { n.read = true; this.save(); }
  }

  markAllAsRead() {
    this.notificationHistory.forEach(n => n.read = true);
    this.save();
  }

  // ── История ───────────────────────────────────────────────────────

  getHistory(): ModerationNotification[] {
    return [...this.notificationHistory];
  }

  clearHistory() {
    this.notificationHistory = [];
    this.save();
  }

  // ── Enable / Disable ─────────────────────────────────────────────

  setEnabled(value: boolean) {
    this.enabled = value;
    try { storageService.setItem(ENABLED_KEY, String(value)); } catch { /* ignore */ }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Persistence ───────────────────────────────────────────────────

  private save() {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(this.notificationHistory)); } catch { /* ignore */ }
  }

  private load() {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) this.notificationHistory = JSON.parse(raw);
      const en = storageService.getItem(ENABLED_KEY);
      if (en !== null) this.enabled = en === 'true';
    } catch (e) { console.error('Ошибка загрузки уведомлений:', e); }
  }

  // ── Инициализация ─────────────────────────────────────────────────

  init() {
    this.load();

    if (typeof window === 'undefined') return;

    window.addEventListener('content-approved', ((e: CustomEvent) => {
      this.notify({
        contentType: e.detail.contentType || 'post',
        contentId: e.detail.contentId || e.detail.id,
        contentTitle: e.detail.title || e.detail.contentTitle,
        status: 'approved',
        message: 'Ваш контент был одобрен и опубликован!',
      });
    }) as EventListener);

    window.addEventListener('content-rejected', ((e: CustomEvent) => {
      this.notify({
        contentType: e.detail.contentType || 'post',
        contentId: e.detail.contentId || e.detail.id,
        contentTitle: e.detail.title || e.detail.contentTitle,
        status: 'rejected',
        reason: e.detail.reason || e.detail.message,
        message: e.detail.reason || 'Ваш контент был отклонён модератором',
      });
    }) as EventListener);

    window.addEventListener('content-revision', ((e: CustomEvent) => {
      this.notify({
        contentType: e.detail.contentType || 'post',
        contentId: e.detail.contentId || e.detail.id,
        contentTitle: e.detail.title || e.detail.contentTitle,
        status: 'revision',
        message: e.detail.comment || 'Ваш контент отправлен на доработку',
      });
    }) as EventListener);

    window.addEventListener('content-pending', ((e: CustomEvent) => {
      if (!e.detail.showOnce) return;
      this.notify({
        contentType: e.detail.contentType || 'post',
        contentId: e.detail.contentId || e.detail.id,
        contentTitle: e.detail.title || e.detail.contentTitle,
        status: 'pending',
        message: 'Ваш контент отправлен на модерацию',
      });
    }) as EventListener);
  }
}

// ── Singleton ───────────────────────────────────────────────────────
export const moderationNotifications = new ModerationNotificationsService();
/** @deprecated Используй moderationNotifications */
export const moderationNotificationsService = moderationNotifications;

if (typeof window !== 'undefined') {
  moderationNotifications.init();
}

