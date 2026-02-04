import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGuest } from '../contexts/GuestContext';
import { FaMapMarkerAlt, FaRoute, FaCalendarAlt, FaBlog, FaBook, FaTimes, FaUserPlus, FaSignInAlt } from 'react-icons/fa';
import SMSVerification from './SMSVerification';
import PasswordReset from './PasswordReset';

interface AuthGateProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'marker' | 'route' | 'event' | 'post';
  contentPreview?: any;
}

const AuthGate: React.FC<AuthGateProps> = ({ isOpen, onClose, contentType, contentPreview }) => {
  const { login, register } = useAuth();
  const { getGuestContentCount } = useGuest();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  // Очищаем форму при открытии/закрытии модального окна
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    phone: '',
    first_name: '',
    last_name: '',
    confirmPassword: ''
  });

  // Очищаем форму при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: '',
        password: '',
        username: '',
        phone: '',
        first_name: '',
        last_name: '',
        confirmPassword: ''
      });
      setError('');
      setIsLoginMode(true);
    }
  }, [isOpen]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const guestCounts = getGuestContentCount();

  const contentTypeConfig = {
    marker: {
      icon: FaMapMarkerAlt,
      title: 'Метка',
      description: 'Ваша метка готова к публикации!',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    route: {
      icon: FaRoute,
      title: 'Маршрут',
      description: 'Ваш маршрут готов к публикации!',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    event: {
      icon: FaCalendarAlt,
      title: 'Событие',
      description: 'Ваше событие готово к публикации!',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    post: {
      icon: FaBlog,
      title: 'Пост',
      description: 'Ваш пост готов к публикации!',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },

  };

  const config = contentTypeConfig[contentType];
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLoginMode) {
        // Для входа используем API напрямую
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Неверный email или пароль' }));
          throw new Error(errorData.message || 'Неверный email или пароль');
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
          confirmPassword: ''
        });
        onClose();
      } else {
        if (formData.password !== formData.confirmPassword) {
          setError('Пароли не совпадают');
          return;
        }
        
        const response = await register(
          formData.email, 
          formData.username, 
          formData.password, 
          formData.phone,
          formData.first_name,
          formData.last_name
        );
        
        // Если требуется верификация SMS
        if (response.requiresVerification) {
          setPendingUser(response.user);
          setShowSMSVerification(true);
        } else {
          // Очищаем форму после успешной регистрации
          setFormData({
            email: '',
            password: '',
            username: '',
            phone: '',
            first_name: '',
            last_name: '',
            confirmPassword: ''
          });
          onClose();
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
    onClose();
  };

  const handlePasswordResetSuccess = async (user: any, token: string) => {
    await login(token);
    setShowPasswordReset(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  // Показываем SMS-верификацию
  if (showSMSVerification && pendingUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <SMSVerification
          phone={pendingUser.phone}
          onSuccess={handleSMSVerificationSuccess}
          onCancel={() => {
            setShowSMSVerification(false);
            setPendingUser(null);
          }}
        />
      </div>
    );
  }

  // Показываем восстановление пароля
  if (showPasswordReset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <PasswordReset
          onSuccess={handlePasswordResetSuccess}
          onCancel={() => setShowPasswordReset(false)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className={`p-6 ${config.bgColor} ${config.borderColor} border-b rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${config.bgColor}`}>
                <IconComponent className={`w-6 h-6 ${config.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{config.title}</h2>
                <p className="text-sm text-gray-600">{config.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Статистика гостевого контента */}
        <div className="p-6 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ваш вклад в проект:</h3>
          <div className="grid grid-cols-2 gap-3">
            {guestCounts.markers > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <FaMapMarkerAlt className="text-green-600" />
                <span>{guestCounts.markers} меток</span>
              </div>
            )}
            {guestCounts.routes > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <FaRoute className="text-blue-600" />
                <span>{guestCounts.routes} маршрутов</span>
              </div>
            )}
            {guestCounts.events > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <FaCalendarAlt className="text-purple-600" />
                <span>{guestCounts.events} событий</span>
              </div>
            )}
            {guestCounts.posts > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <FaBlog className="text-orange-600" />
                <span>{guestCounts.posts} постов</span>
              </div>
            )}
            {guestCounts.blogs > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <FaBook className="text-indigo-600" />
                <span>{guestCounts.blogs} блогов</span>
              </div>
            )}
          </div>
        </div>

        {/* Форма авторизации */}
        <div className="p-6">
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setIsLoginMode(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLoginMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaSignInAlt className="inline w-4 h-4 mr-2" />
              Войти
            </button>
            <button
              onClick={() => setIsLoginMode(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLoginMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaUserPlus className="inline w-4 h-4 mr-2" />
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {!isLoginMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Имя пользователя
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Имя
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Имя"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Фамилия
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Фамилия"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Подтвердите пароль
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {isLoading ? 'Загрузка...' : (isLoginMode ? 'Войти' : 'Зарегистрироваться')}
            </button>

            {isLoginMode && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Забыли пароль?
                </button>
              </div>
            )}
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              После авторизации ваш контент будет отправлен на модерацию и опубликован
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
