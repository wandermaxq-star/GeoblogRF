import { useEffect, useRef, useCallback } from 'react';

interface AutoSaveOptions<T> {
  /** Уникальный ключ для хранения черновика */
  key: string;
  /** Данные для авто-сохранения */
  data: T;
  /** Интервал авто-сохранения в мс (по умолчанию 30 сек) */
  interval?: number;
}

/**
 * Хук автосохранения черновика в localStorage.
 *
 * Сохраняет `data` в localStorage каждые `interval` мс
 * и при изменении данных.
 *
 * `load` — стабильная функция (не меняется между рендерами),
 * безопасна для использования в зависимостях useEffect.
 */
export function useAutoSave<T>({ key, data, interval = 30_000 }: AutoSaveOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const keyRef = useRef(key);
  keyRef.current = key;

  const save = useCallback((value: T) => {
    try {
      localStorage.setItem(`autosave:${keyRef.current}`, JSON.stringify(value));
    } catch {
      // quota exceeded — молча игнорируем
    }
  }, []);

  /**
   * Загрузить сохранённый черновик.
   * Стабильная ссылка — не вызывает пересоздания useEffect.
   */
  const load = useCallback((): T | undefined => {
    try {
      const raw = localStorage.getItem(`autosave:${keyRef.current}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  /** Очистить сохранённый черновик. */
  const clear = useCallback(() => {
    localStorage.removeItem(`autosave:${keyRef.current}`);
  }, []);

  // Сохранение при изменении данных + по интервалу
  useEffect(() => {
    save(data);
    timerRef.current = setTimeout(() => save(data), interval);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, interval, save]);

  return { load, save, clear };
}
