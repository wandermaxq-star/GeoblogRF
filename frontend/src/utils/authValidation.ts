// frontend/src/utils/authValidation.ts

export interface AuthFormData {
  email: string;
  password: string;
  username: string;   // always present (can be empty string)
  phone: string;      // always present
  confirmPassword: string; // always present (used in register mode)
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
}

const emailRegex = /\S+@\S+\.\S+/;
const phoneRegex = /^[\+]?[^0\D][\d]{0,15}$/; // matches backend pattern ^[\+]?[1-9][\d]{0,15}$

export function validateAuthForm(
  mode: 'login' | 'register',
  data: AuthFormData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email) {
    errors.push('Email обязателен');
  } else if (!emailRegex.test(data.email)) {
    errors.push('Некорректный email');
  }

  if (!data.password) {
    errors.push('Пароль обязателен');
  } else if (mode === 'register' && data.password.length < 6) {
    errors.push('Пароль должен содержать минимум 6 символов');
  }

  if (mode === 'register') {
    if (!data.username) {
      errors.push('Имя пользователя обязательно');
    } else {
      if (data.username.length < 3) {
        errors.push('Имя пользователя должно содержать минимум 3 символа');
      }
      if (data.username.length > 30) {
        errors.push('Имя пользователя не должно превышать 30 символов');
      }
    }

    if (data.password !== data.confirmPassword) {
      errors.push('Пароли не совпадают');
    }

    if (!data.phone) {
      errors.push('Телефон обязателен');
    } else if (!phoneRegex.test(data.phone)) {
      errors.push('Некорректный номер телефона');
    }

    if (data.avatar_url && !/^https?:\/\//.test(data.avatar_url)) {
      errors.push('URL аватара должен начинаться с http:// или https://');
    }
    if (data.bio && data.bio.length > 500) {
      errors.push('Биография не должна превышать 500 символов');
    }
  }

  return { valid: errors.length === 0, errors };
}