// frontend/src/pages/AuthPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/use-mobile';
import { Mail, Lock, User, Phone, Sparkles, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import SMSVerification from '../components/SMSVerification';
import PasswordReset from '../components/PasswordReset';
import { validateAuthForm, AuthFormData } from '../utils/authValidation';

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Определяем начальный режим из пути
  const initialMode = location.pathname === '/register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    username: '',
    phone: '',
    first_name: '',
    last_name: '',
    confirmPassword: '',
    avatar_url: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isFormValid = validationErrors.length === 0;

  const { login, register } = useAuth();

  // Синхронизируем режим с URL
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else {
      setMode('login');
    }
  }, [location.pathname]);

  // клиентская валидация при изменении
  useEffect(() => {
    const { errors } = validateAuthForm(mode, formData);
    setValidationErrors(errors);
  }, [mode, formData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { valid, errors } = validateAuthForm(mode, formData);
    if (!valid) {
      setError(errors.join('; '));
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.message || 'Неверный email или пароль';
          const details = Array.isArray(errData.details) ? errData.details.join('; ') : '';
          throw new Error(details ? `${msg}: ${details}` : msg);
        }

        const data = await response.json();
        if (!data.token) {
          throw new Error('Токен не получен от сервера');
        }
        await login(data.token);
        setFormData({
          email: '',
          password: '',
          username: '',
          phone: '',
          first_name: '',
          last_name: '',
          confirmPassword: '',
          avatar_url: '',
          bio: ''
        });
        navigate('/');
      } else {
        const response = await register(
          formData.email,
          formData.username,
          formData.password,
          formData.phone,
          formData.first_name,
          formData.last_name,
          formData.avatar_url,
          formData.bio
        );
        if (response.requiresVerification) {
          setPendingUser(response.user);
          setShowSMSVerification(true);
        } else {
          setFormData({
            email: '',
            password: '',
            username: '',
            phone: '',
            first_name: '',
            last_name: '',
            confirmPassword: '',
            avatar_url: '',
            bio: ''
          });
          navigate('/');
        }
      }
    } catch (err: any) {
      console.error('Ошибка авторизации:', err);
      const errorMessage = err.message ||
        (err.code === 'ECONNREFUSED' || err.message?.includes('Failed to fetch')
          ? 'Сервер недоступен. Убедитесь, что бэкенд запущен на порту 3002.'
          : 'Произошла ошибка');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSMSVerificationSuccess = async (user: any, token: string) => {
    await login(token);
    setShowSMSVerification(false);
    navigate('/');
  };

  const handlePasswordResetSuccess = async (user: any, token: string) => {
    await login(token);
    setShowPasswordReset(false);
    navigate('/');
  };

  // Если показываем верификацию SMS
  if (showSMSVerification && pendingUser) {
    return (
      <div className="h-full overflow-y-auto p-3">
        <div className="max-w-72 mx-auto">
          <div className="glass-card p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold">Подтверждение</h2>
            </div>
            <SMSVerification
              phone={pendingUser.phone}
              onSuccess={handleSMSVerificationSuccess}
              onCancel={() => {
                setShowSMSVerification(false);
                setPendingUser(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Если показываем восстановление пароля
  if (showPasswordReset) {
    return (
      <div className="h-full overflow-y-auto p-3">
        <div className="max-w-72 mx-auto">
          <div className="glass-card p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold">Восстановление</h2>
            </div>
            <PasswordReset
              onSuccess={handlePasswordResetSuccess}
              onCancel={() => setShowPasswordReset(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="max-w-72 mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-3">
          <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center border border-white/10 ${
            mode === 'login' 
              ? 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30' 
              : 'bg-gradient-to-br from-green-500/30 to-emerald-600/30'
          }`}>
            {mode === 'login' ? (
              <LogIn className="w-5 h-5 text-purple-300" />
            ) : (
              <UserPlus className="w-5 h-5 text-emerald-300" />
            )}
          </div>
          <h2 className="text-sm font-bold">
            {mode === 'login' ? 'Войти' : 'Регистрация'}
          </h2>
        </div>

        {/* Переключение режимов */}
        <div className="flex mb-3 bg-white/5 rounded-md p-0.5">
          <button
            onClick={() => {
              setMode('login');
              navigate('/login');
            }}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
              mode === 'login'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Войти
          </button>
          <button
            onClick={() => {
              setMode('register');
              navigate('/register');
            }}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
              mode === 'register'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form className="space-y-2" onSubmit={handleSubmit}>
          {(validationErrors.length > 0 || error) && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
              {validationErrors.map((e,i) => (
                <p key={i} className="text-xs text-red-300">{e}</p>
              ))}
              {error && <p className="text-xs text-red-300 text-center">{error}</p>}
            </div>
          )}
          {/* Поле email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium mb-0.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full pl-8 pr-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {mode === 'register' && (
            <>
              {/* Поле имени пользователя */}
              <div>
                <label htmlFor="username" className="block text-xs font-medium mb-0.5">
                  Имя пользователя
                </label>
                <div className="relative">
                  <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    className="w-full pl-8 pr-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                    placeholder="Ваше имя"
                    value={formData.username}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Поле телефона */}
              <div>
                <label htmlFor="phone" className="block text-xs font-medium mb-0.5">
                  Телефон
                </label>
                <div className="relative">
                  <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required={mode === 'register'}
                    pattern="\+?[1-9][0-9]{0,15}"
                    className="w-full pl-8 pr-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                    placeholder="+7 (XXX) XXX-XX-XX"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Имя и фамилия */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-medium mb-0.5">
                    Имя
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                    placeholder="Имя"
                    value={formData.first_name}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-xs font-medium mb-0.5">
                    Фамилия
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                    placeholder="Фамилия"
                    value={formData.last_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Дополнительные поля аватар/био */}
              <div>
                <label htmlFor="avatar_url" className="block text-xs font-medium mb-0.5">
                  Ссылка на аватар (опционально)
                </label>
                <input
                  id="avatar_url"
                  name="avatar_url"
                  type="url"
                  className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                  placeholder="https://example.com/avatar.jpg"
                  value={formData.avatar_url || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-xs font-medium mb-0.5">
                  Биография (до 500 символов)
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  maxLength={500}
                  className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                  placeholder="Немного о себе"
                  value={formData.bio || ''}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}

          {/* Поле пароля */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium mb-0.5">
              Пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className="w-full pl-8 pr-7 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                placeholder={mode === 'login' ? 'пароль' : 'придумайте пароль'}
                value={formData.password}
                onChange={handleInputChange}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-3 h-3 text-gray-400" />
                ) : (
                  <Eye className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium mb-0.5">
                Подтвердите пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full pl-8 pr-7 py-1.5 rounded-md bg-white/5 border border-white/10 focus:border-white/20 text-xs"
                  placeholder="повторите"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-3 h-3 text-gray-400" />
                  ) : (
                    <Eye className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="w-full py-1.5 px-2 rounded-md font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === 'login' ? 'Вход...' : 'Регистрация...'}
              </span>
            ) : (
              mode === 'login' ? 'Войти' : 'Создать аккаунт'
            )}
          </button>

          {/* Забыли пароль */}
          {mode === 'login' && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-xs text-blue-300 hover:text-blue-200"
              >
                Забыли пароль?
              </button>
            </div>
          )}

          {/* Гость */}
          <div className="text-center pt-1.5 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-gray-400 hover:text-white"
            >
              Продолжить как гость
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
