
// frontend/src/pages/LoginPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import { LogIn, Mail, Lock, Sparkles, UserPlus, User, Phone } from 'lucide-react';
import CentreBackground from '../components/Centre/CentreBackground';
import SMSVerification from '../components/SMSVerification';
import PasswordReset from '../components/PasswordReset';
import { validateAuthForm, AuthFormData } from '../utils/authValidation';

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  usePanelRegistration();

  // Определяем начальный режим из пути
  const initialMode = location.pathname === '/register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
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

  const { login, register } = useAuth();

  // Синхронизируем режим с URL
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else {
      setMode('login');
    }
  }, [location.pathname]);

  // Перепроверяем клиентскую валидацию при изменениях
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
    // клиентская проверка
    const { valid, errors } = validateAuthForm(mode, formData);
    if (!valid) {
      setError(errors.join('; '));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        // Логин
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
        // Очищаем форму после успешного входа
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
        // Регистрация
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
      <>
        <CentreBackground />
        <MirrorGradientContainer className="centre-mode">
          <div className="centre-static-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2>Подтверждение телефона — ГеоБлог.РФ</h2>
              </div>
              <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>Введите код из SMS</p>
            </div>
          </div>
          <div className="centre-scroll-area">
            <div className="centre-content">
              <div className="centre-glass-card">
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
        </MirrorGradientContainer>
      </>
    );
  }

  // Если показываем восстановление пароля
  if (showPasswordReset) {
    return (
      <>
        <CentreBackground />
        <MirrorGradientContainer className="centre-mode">
          <div className="centre-static-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2>Восстановление пароля — ГеоБлог.РФ</h2>
              </div>
              <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>Введите телефон для получения кода</p>
            </div>
          </div>
          <div className="centre-scroll-area">
            <div className="centre-content">
              <div className="centre-glass-card">
                <PasswordReset
                  onSuccess={handlePasswordResetSuccess}
                  onCancel={() => setShowPasswordReset(false)}
                />
              </div>
            </div>
          </div>
        </MirrorGradientContainer>
      </>
    );
  }

  const isFormValid = validationErrors.length === 0; // обновляем из useEffect выше

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        {/* Заголовок */}
        <div className="centre-static-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h2>{mode === 'login' ? 'Вход — ГеоБлог.РФ' : 'Регистрация — ГеоБлог.РФ'}</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>
              {mode === 'login' ? 'Карта ваших путешествий и мест' : 'Создайте аккаунт для путешествий'}
            </p>
          </div>
        </div>

        {/* Скролльный контент */}
        <div className="centre-scroll-area">
          <div className="centre-content space-y-5">
            <div className="centre-glass-card">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border border-white/10 ${
                  mode === 'login' 
                    ? 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30' 
                    : 'bg-gradient-to-br from-green-500/30 to-emerald-600/30'
                }`}>
                  {mode === 'login' ? (
                    <LogIn className="w-8 h-8 text-purple-300" />
                  ) : (
                    <UserPlus className="w-8 h-8 text-emerald-300" />
                  )}
                </div>
                <h3 className="text-xl font-bold cg-text mb-2">
                  {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте аккаунт'}
                </h3>
                <p className="text-sm cg-text-muted">
                  {mode === 'login' 
                    ? 'Введите email и пароль, чтобы продолжить исследование' 
                    : 'Заполните форму, чтобы начать исследовать мир с ГеоБлог.РФ'}
                </p>
              </div>

              {/* Переключение режимов */}
              <div className="flex space-x-1 mb-6 bg-glass-l2 p-1 rounded-lg">
                <button
                  onClick={() => {
                    setMode('login');
                    navigate('/login');
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    mode === 'login'
                      ? 'bg-glass-l1 text-white shadow-sm'
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
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    mode === 'register'
                      ? 'bg-glass-l1 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Регистрация
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Поле email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium cg-text mb-1">
                    Email адрес
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
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
                      <label htmlFor="username" className="block text-sm font-medium cg-text mb-1">
                        Имя пользователя
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="username"
                          name="username"
                          type="text"
                          autoComplete="username"
                          required
                          className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
                          placeholder="Ваше имя"
                          value={formData.username}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {/* Поле телефона (необязательное) */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium cg-text mb-1">
                        Телефон
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          required={mode === 'register'}
                          pattern="\+?[1-9][0-9]{0,15}"
                          className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
                          placeholder="+7 (XXX) XXX-XX-XX"
                          value={formData.phone}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {/* Имя и фамилия */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="first_name" className="block text-sm font-medium cg-text mb-1">
                          Имя
                        </label>
                        <input
                          id="first_name"
                          name="first_name"
                          type="text"
                          className="glass-l2 w-full px-3 py-2.5 rounded-lg"
                          placeholder="Имя"
                          value={formData.first_name}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="last_name" className="block text-sm font-medium cg-text mb-1">
                          Фамилия
                        </label>
                        <input
                          id="last_name"
                          name="last_name"
                          type="text"
                          className="glass-l2 w-full px-3 py-2.5 rounded-lg"
                          placeholder="Фамилия"
                          value={formData.last_name}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {/* Опциональные поля аватара/био */}
                    <div>
                      <label htmlFor="avatar_url" className="block text-sm font-medium cg-text mb-1">
                        Ссылка на аватар (опционально)
                      </label>
                      <input
                        id="avatar_url"
                        name="avatar_url"
                        type="url"
                        className="glass-l2 w-full px-3 py-2.5 rounded-lg"
                        placeholder="https://example.com/avatar.jpg"
                        value={formData.avatar_url || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="bio" className="block text-sm font-medium cg-text mb-1">
                        Биография (до 500 символов)
                      </label>
                      <textarea
                        id="bio"
                        name="bio"
                        maxLength={500}
                        className="glass-l2 w-full px-3 py-2.5 rounded-lg"
                        placeholder="Немного о себе"
                        value={formData.bio || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                  </>
                )}

                {/* Поле пароля */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium cg-text mb-1">
                    Пароль
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
                      placeholder={mode === 'login' ? 'Ваш пароль' : 'Придумайте пароль'}
                      value={formData.password}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium cg-text mb-1">
                      Подтвердите пароль
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
                        placeholder="Повторите пароль"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                )}

                {/* Ошибка */}
                {(validationErrors.length > 0 || error) && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                    {validationErrors.map((e, i) => (
                      <p key={i} className="text-sm text-red-300">{e}</p>
                    ))}
                    {error && <p className="text-sm text-red-300 text-center">{error}</p>}
                  </div>
                )}

                {/* Кнопка отправки */}
                <button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className={`w-full py-3 px-4 rounded text-white transition-all flex items-center justify-center gap-2 ${
                    isLoading
                      ? 'bg-gray-500 cursor-not-allowed'
                      : mode === 'login'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {mode === 'login' ? 'Вход...' : 'Регистрация...'}
                    </>
                  ) : (
                    mode === 'login' ? 'Войти' : 'Зарегистрироваться'
                  )}
                 
                </button>

                {/* Ссылка "Забыли пароль?" */}
                {mode === 'login' && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      Забыли пароль?
                    </button>
                  </div>
                )}

                {/* Гостевой вход */}
                <div className="text-center pt-4 border-t border-white/10">
                  <p className="text-sm cg-text-muted mb-2">Или продолжите как гость</p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-sm glass-l2 px-4 py-2 rounded-lg hover:bg-glass-l1 transition-colors"
                  >
                    Продолжить без входа
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </MirrorGradientContainer>
    </>
  );
}