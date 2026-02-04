import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthGate from './AuthGate';
import { UserPlus } from 'lucide-react';

interface AuthGateButtonProps {
  type: 'marker' | 'route' | 'event' | 'post';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const contentTypes = {
  marker: 'маркер',
  route: 'маршрут',
  event: 'событие',
  post: 'пост'
};

export default function AuthGateButton({ type, children, className, onClick }: AuthGateButtonProps) {
  const auth = useAuth();
  const [showAuthGate, setShowAuthGate] = React.useState(false);
  
  const isGuest = !auth?.user;

  const handleClick = () => {
    if (isGuest) {
      setShowAuthGate(true);
    } else {
      onClick?.();
    }
  };

  return (
    <>
      {React.cloneElement(children as React.ReactElement, {
        onClick: handleClick,
        className: `${className || ''} ${isGuest ? 'opacity-75 cursor-not-allowed' : ''}`.trim()
      })}
      {showAuthGate && (
        <AuthGate
          isOpen={showAuthGate}
          onClose={() => {
            setShowAuthGate(false);
            // После закрытия окна авторизации и успешного входа, вызываем onClick
            setTimeout(() => {
              if (auth?.user) {
                onClick?.();
              }
            }, 100);
          }}
          contentType={type}
        />
      )}
    </>
  );
}

