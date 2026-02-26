import { NavLink } from "./NavLink";
import { Map, FileText, Navigation, Activity, Calendar, Users } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const BottomNavigation = () => {
  const location = useLocation();

  const navItems = [
    { to: "/posts", icon: FileText, label: "Посты" },
    { to: "/map", icon: Map, label: "Карта" },
    { to: "/planner", icon: Navigation, label: "Маршруты" },
    { to: "/calendar", icon: Calendar, label: "Календарь" },
    { to: "/activity", icon: Activity, label: "Активность" },
    { to: "/centre", icon: Users, label: "Влияние" },
  ];

  const isActive = (path: string) => {
    // Для главной страницы (/) показываем активным "Посты"
    if (path === '/posts' && (location.pathname === '/' || location.pathname === '/home')) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 m-glass-nav z-50 safe-area-bottom" style={{ pointerEvents: 'auto' }}>
      <div className="flex justify-around items-center h-16 px-1 gap-1">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "m-glass-btn",
                "transition-all duration-300 rounded-xl p-2 flex flex-col items-center justify-center gap-1",
                "flex-1 max-w-[60px] min-h-[60px]",
                active && "active"
              )}
            >
              <item.icon className={cn("w-5 h-5 m-glass-icon transition-transform", active && "scale-110")} />
              <span className="text-[9px] font-medium leading-tight m-glass-text text-center">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;

