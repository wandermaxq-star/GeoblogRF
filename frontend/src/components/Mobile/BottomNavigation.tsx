import { useState, useCallback, useEffect, useRef } from "react";
import { NavLink } from "./NavLink";
import { Map, FileText, Navigation, Calendar, Activity, Users, Crown, HelpingHand, Plus, Globe } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Левая пара кнопок (до «+») */
const leftNavItems = [
  { to: "/map", icon: Map, label: "Карта" },
  { to: "/posts", icon: FileText, label: "Посты" },
];

/** Правая пара кнопок (после «+»): маршруты без отдельного /calendar */
const rightNavItems = [
  { to: "/planner", icon: Navigation, label: "Маршруты" },
];

/** Дополнительные кнопки (раскрываются полукругом по «+») */
const extraNavItems = [
  { to: "/activity", icon: Activity, label: "Активность" },
  { to: "/centre", icon: Users, label: "Влияние" },
  { to: "/hub", icon: Globe, label: "Хаб" },
  { to: "/pro", icon: Crown, label: "Pro" },
  { to: "/partners", icon: HelpingHand, label: "Партнёры" },
];

interface BottomNavigationProps {
  onEventsClick?: () => void;
}

const BottomNavigation = ({ onEventsClick }: BottomNavigationProps) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === "/posts" && (location.pathname === "/" || location.pathname === "/home")) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  const isExtraActive = extraNavItems.some(item => isActive(item.to));

  const toggleMenu = useCallback(() => setMenuOpen(prev => !prev), []);

  // Закрытие при клике вне
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Закрытие при навигации
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const renderNavBtn = (item: typeof leftNavItems[0]) => {
    const active = isActive(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "mobile-floating-btn",
          "flex flex-col items-center justify-center",
          active && "mobile-floating-btn--active",
        )}
        style={{ pointerEvents: "auto" }}
      >
        <item.icon className="w-5 h-5 text-current" />
        <span className="mobile-nav-label">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Overlay при открытом меню */}
      {menuOpen && (
        <div
          className="speed-dial-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav className="mobile-floating-nav" style={{ pointerEvents: "none", zIndex: 2000 }} ref={navRef}>
        <div className="mobile-floating-nav-inner">
          {/* Левая пара */}
          {leftNavItems.map(renderNavBtn)}

          {/* Центральный FAB-контейнер */}
          <div className="mobile-fab-wrapper" style={{ pointerEvents: "auto" }}>
            {/* Speed-dial кнопки — полукруг над FAB */}
            {extraNavItems.map((item, idx) => {
              const active = isActive(item.to);
              // Полукруг: 4 кнопки равномерно от 180° до 0° (т.е. веер снизу вверх)
              const totalItems = extraNavItems.length;
              const startAngle = 200; // чуть шире влево
              const endAngle = -20;   // чуть шире вправо
              const step = (startAngle - endAngle) / (totalItems + 1);
              const angleDeg = startAngle - step * (idx + 1);
              const angleRad = angleDeg * (Math.PI / 180);
              const radius = 130;
              const x = Math.cos(angleRad) * radius;
              const y = -Math.sin(angleRad) * radius;

              return (
                <div
                  key={item.to}
                  className={cn("speed-dial-item", menuOpen && "speed-dial-item--open")}
                  style={{
                    transitionDelay: menuOpen ? `${idx * 50}ms` : "0ms",
                    "--sd-x": `${x}px`,
                    "--sd-y": `${y}px`,
                  } as React.CSSProperties}
                >
                  <NavLink
                    to={item.to}
                    className={cn(
                      "mobile-floating-btn speed-dial-btn",
                      "flex flex-col items-center justify-center",
                      active && "mobile-floating-btn--active",
                    )}
                    style={{ pointerEvents: menuOpen ? "auto" : "none" }}
                  >
                    <item.icon className="w-5 h-5 text-current" />
                  </NavLink>
                  <span className="speed-dial-label">{item.label}</span>
                </div>
              );
            })}

            {/* Кнопка «+» */}
            <button
              onClick={toggleMenu}
              className={cn(
                "mobile-fab-btn",
                menuOpen && "mobile-fab-btn--open",
                isExtraActive && !menuOpen && "mobile-fab-btn--extra-active",
              )}
              aria-label="Ещё"
            >
              <Plus className="w-7 h-7 text-white mobile-fab-icon" />
            </button>
          </div>

          {/* Правая пара */}
          {rightNavItems.map(renderNavBtn)}

          {/* Кнопка «События» — открывает EventBottomSheet */}
          <button
            className={cn(
              "mobile-floating-btn",
              "flex flex-col items-center justify-center",
            )}
            style={{ pointerEvents: "auto" }}
            onClick={onEventsClick}
            aria-label="События на карте"
          >
            <Calendar className="w-5 h-5 text-current" />
            <span className="mobile-nav-label">События</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNavigation;

