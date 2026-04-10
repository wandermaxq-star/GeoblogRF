// frontend/src/components/AuthModal.tsx
import { useState } from 'react';
import { login as apiLogin } from '../api/auth';
import { register as apiRegister } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from './MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import { LogIn, UserPlus, Mail, Lock, User, Phone, Sparkles, X } from 'lucide-react';
import CentreBackground from './Centre/CentreBackground';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const isMobile = useIsMobile();
  usePanelRegistration();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const data = await apiLogin(email, password);
        if (!data.token) {
          throw new Error('Токен не получен от сервера');
        }
        await login(data.token);
        onClose();
      } else {
        await apiRegister(email, username, password, phone);
        // После регистрации предлагаем войти
        setMode('login');
        setError('Регистрация успешна! Теперь войдите в аккаунт.');
      }
    } catch (err: any) {
      console.error('Ошибка:', err);
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          (err.code === 'ECONNREFUSED' ? 'Сервер недоступен. Убедитесь, что бэкенд запущен на порту 3002.' : 'Ошибка');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = mode === 'login' 
    ? email.length > 0 && password.length > 0
    : email.length > 0 && username.length > 0 && password.length > 0;

  const title = mode === 'login' ? 'Вход — ГеоБлог.РФ' : 'Регистрация — ГеоБлог.РФ';
  const icon = mode === 'login' ? LogIn : UserPlus;
  const Icon = icon;

  return (
    <>
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        <CentreBackground />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <MirrorGradientContainer className="centre-mode max-w-md w-full mx-auto">
            {/* Заголовок с кнопкой закрытия */}
            <div className="centre-static-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  mode === 'login' 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600'
                }`}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2>{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Скролльный контент */}
            <div className="centre-scroll-area">
              <div className="centre-content space-y-5">
                <div className="centre-glass-card">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl border border-white/10 flex items-center justify-center ${
                      mode === 'login'
                        ? 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30'
                        : 'bg-gradient-to-br from-green-500/30 to-emerald-600/30'
                    }`}>
                      <Icon className="w-8 h-8 text-white" />
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

                  {/* Переключатель режимов */}
                  <div className="flex mb-6 rounded-lg p-1 bg-white/5">
                    <button
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        mode === 'login'
                          ? 'bg-white/20 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => setMode('login')}
                    >
                      Вход
                    </button>
                    <button
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        mode === 'register'
                          ? 'bg-white/20 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => setMode('register')}
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
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Поле имени пользователя (только для регистрации) */}
                    {mode === 'register' && (
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
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                          />
                        </div>
                      </div>
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
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Поле телефона (необязательное, только для регистрации) */}
                    {mode === 'register' && (
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium cg-text mb-1">
                          Телефон (необязательно)
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
                            className="glass-l2 w-full pl-10 pr-3 py-2.5 rounded-lg"
                            placeholder="+7 (XXX) XXX-XX-XX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ошибка */}
                    {error && (
                      <div className={`p-3 rounded-lg border ${
                        error.includes('успешна') 
                          ? 'bg-green-500/10 border-green-500/20 text-green-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-300'
                      }`}>
                        <p className="text-sm text-center">{error}</p>
                      </div>
                    )}

                    {/* Кнопка отправки */}
                    <button
                      type="submit"
                      disabled={!isFormValid || isLoading}
                      className={`w-full py-3 px-4 rounded text-white transition-all flex items-center justify-center gap-2 ${
                        isFormValid && !isLoading
                          ? mode === 'login'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                          : 'bg-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {mode === 'login' ? 'Вход...' : 'Регистрация...'}
                        </>
                      ) : (
                        <>
                          <Icon className="w-4 h-4" />
                          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                        </>
                      )}
                    </button>

                    {/* Ссылка на переключение */}
                    <div className="text-center pt-4 border-t border-white/10">
                      <p className="text-sm cg-text-muted">
                        {mode === 'login' ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
                        <button
                          type="button"
                          className="text-indigo-300 hover:text-indigo-200 font-medium"
                          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        >
                          {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
                        </button>
                      </p>
                    </div>
                  </form>
                </div>

                {/* Информационный блок */}
                <div className="centre-glass-card">
                  <h4 className="text-lg font-bold cg-text mb-3">
                    {mode === 'login' ? 'Офлайн‑режим ГеоБлог.РФ' : 'Преимущества аккаунта'}
                  </h4>
                  {mode === 'login' ? (
                    <>
                      <p className="text-sm cg-text-muted mb-2">
                        Сохраняйте черновики, карты и избранные места на устройстве — вы можете просматривать ранее загруженные данные без интернета и публиковать записи, когда сеть восстановится.
                      </p>
                      <p className="text-sm cg-text-muted">
                        Это удобно для путешествий в отдалённых местах и при медленном соединении.
                      </p>
                    </>
                  ) : (
                    <ul className="space-y-2 text-sm cg-text-muted">
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                        <span>Создание меток, постов и маршрутов</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                        <span>Доступ к офлайн-картам регионов</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                        <span>Синхронизация данных между устройствами</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                        <span>Участие в рейтингах и достижениях</span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </MirrorGradientContainer>
        </div>
      </div>
    </>
  );
}