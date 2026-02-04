import React from 'react';

export interface GlassButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const GlassButton: React.FC<GlassButtonProps> = ({
  onClick,
  variant = 'secondary',
  icon,
  children,
  disabled = false,
  active = false,
  type = 'button',
  className = '',
  fullWidth = false,
  size = 'medium',
  ...rest
}) => {
  const variantMap: Record<string, string> = {
    primary: 'btn-primary',
    secondary: '',
    danger: 'btn-danger',
    success: 'btn-success',
  };

  const sizeMap: Record<string, string> = {
    small: 'btn-sm',
    medium: 'btn-md',
    large: 'btn-lg',
  };

  const classes = [
    'btn',
    'btn-glass',
    'btn-rect',
    variantMap[variant] || '',
    sizeMap[size] || '',
    active ? 'btn-active' : '',
    fullWidth ? 'btn-full-width' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      {...rest}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-text">{children}</span>}
    </button>
  );
};

export default GlassButton;

