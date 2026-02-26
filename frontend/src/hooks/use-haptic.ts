export function useHaptic() {
  const canVibrate = typeof navigator !== 'undefined' && !!navigator.vibrate;

  const vibrate = (pattern: number | number[]) => {
    if (canVibrate) {
      navigator.vibrate(pattern as any);
    }
  };

  const success = () => vibrate(50);
  const error = () => vibrate([100, 50, 100]);
  const swipeThreshold = () => vibrate(30);

  return { success, error, swipeThreshold, canVibrate };
}
