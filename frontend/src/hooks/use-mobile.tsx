import { useEffect } from "react";
import { useContentStore } from "../stores/contentStore";

export function useIsMobile() {
  // Источник правды: store
  const isMobile = useContentStore((state) => state.isMobile);
  const setIsMobile = useContentStore((state) => state.setIsMobile);

  useEffect(() => {
    const checkIsMobile = () => {
      const newValue = window.innerWidth < 768;
      setIsMobile(newValue);
    };

    // Сразу проверяем при монтировании
    checkIsMobile();

    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, [setIsMobile]);

  return isMobile;
}

