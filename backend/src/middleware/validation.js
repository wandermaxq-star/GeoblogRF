import Joi from 'joi';

// Валидация регистрации пользователя
export const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Некорректный email',
      'any.required': 'Email обязателен'
    }),
    username: Joi.string().min(3).max(30).required().messages({
      'string.min': 'Имя пользователя должно содержать минимум 3 символа',
      'string.max': 'Имя пользователя не должно превышать 30 символов',
      'any.required': 'Имя пользователя обязательно'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
      'any.required': 'Пароль обязателен'
    }),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required().messages({
      'string.pattern.base': 'Некорректный номер телефона',
      'any.required': 'Номер телефона обязателен'
    }),
    referral_code: Joi.string().max(8).optional(),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    avatar_url: Joi.string().uri().optional(),
    bio: Joi.string().max(500).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации', 
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Валидация входа пользователя
export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Некорректный email',
      'any.required': 'Email обязателен'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Пароль обязателен'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации', 
      details: error.details.map(detail => detail.message)
    });
  }
  
  next();
};

// Валидация создания события
export const validateEvent = (req, res, next) => {
  const schema = Joi.object({
    title: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Название события не может быть пустым',
      'string.max': 'Название события не должно превышать 100 символов',
      'any.required': 'Название события обязательно'
    }),
    description: Joi.string().max(1000).optional().messages({
      'string.max': 'Описание не должно превышать 1000 символов'
    }),
    dateRange: Joi.object({
      start: Joi.date().required().messages({
        'any.required': 'Дата начала обязательна'
      }),
      end: Joi.date().min(Joi.ref('start')).required().messages({
        'date.min': 'Дата окончания должна быть после даты начала',
        'any.required': 'Дата окончания обязательна'
      })
    }).required(),
    location: Joi.object({
      address: Joi.string().required().messages({
        'any.required': 'Адрес обязателен'
      }),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90).required().messages({
          'number.min': 'Широта должна быть от -90 до 90',
          'number.max': 'Широта должна быть от -90 до 90',
          'any.required': 'Координаты обязательны'
        }),
        lng: Joi.number().min(-180).max(180).required().messages({
          'number.min': 'Долгота должна быть от -180 до 180',
          'number.max': 'Долгота должна быть от -180 до 180',
          'any.required': 'Координаты обязательны'
        })
      }).required()
    }).required(),
    participants: Joi.object({
      maxCapacity: Joi.number().min(1).max(1000).required().messages({
        'number.min': 'Максимальное количество участников должно быть не менее 1',
        'number.max': 'Максимальное количество участников не должно превышать 1000',
        'any.required': 'Максимальное количество участников обязательно'
      })
    }).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации события', 
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Обновляем валидацию маркеров
export const validateMarker = (req, res, next) => {
  const schema = Joi.object({
    title: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Название маркера не может быть пустым',
      'string.max': 'Название маркера не должно превышать 100 символов',
      'any.required': 'Название маркера обязательно'
    }),
    description: Joi.string().max(1000).optional().messages({
      'string.max': 'Описание не должно превышать 1000 символов'
    }),
    latitude: Joi.number().min(-90).max(90).required().messages({
      'number.min': 'Широта должна быть от -90 до 90',
      'number.max': 'Широта должна быть от -90 до 90',
      'any.required': 'Широта обязательна'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      'number.min': 'Долгота должна быть от -180 до 180',
      'number.max': 'Долгота должна быть от -180 до 180',
      'any.required': 'Долгота обязательна'
    }),
    category: Joi.string().required().messages({
      'any.required': 'Категория обязательна'
    }),
    hashtags: Joi.array().items(Joi.string()).optional(),
    photoUrls: Joi.alternatives().try(
      Joi.array().items(Joi.string().allow('')),
      Joi.string().allow('')
    ).optional().empty('').default([]).custom((value, helpers) => {
      // Если значение отсутствует или пустое, возвращаем пустой массив
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return [];
      }
      // Если это строка, преобразуем в массив
      if (typeof value === 'string') {
        const urls = value.split(',').map(url => url.trim()).filter(url => url.length > 0);
        return urls.length > 0 ? urls : [];
      }
      // Если это массив, фильтруем пустые строки
      if (Array.isArray(value)) {
        const filtered = value.filter(url => url && typeof url === 'string' && url.trim().length > 0);
        return filtered.length > 0 ? filtered : [];
      }
      return [];
    }),
    // ДОБАВЛЯЕМ ВАЛИДАЦИЮ НОВЫХ ПОЛЕЙ:
    metadata: Joi.object().optional(),
    marker_type: Joi.string().valid('standard', 'commercial', 'promoted').optional(),
    visibility: Joi.string().valid('public', 'private', 'friends').optional(),
    address: Joi.string().allow('').optional(),
    subcategory: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body, { 
    stripUnknown: true,
    abortEarly: false 
  });
  
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации маркера', 
      details: error.details.map(detail => detail.message)
    });
  }
  
  // Заменяем req.body на валидированные и преобразованные данные
  req.body = value;
  next();
};

// Обновляем валидацию пользователей
export const validateUser = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Некорректный email',
      'any.required': 'Email обязателен'
    }),
    username: Joi.string().min(3).max(50).required().messages({
      'string.min': 'Имя пользователя должно содержать минимум 3 символа',
      'string.max': 'Имя пользователя не должно превышать 50 символов',
      'any.required': 'Имя пользователя обязательно'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
      'any.required': 'Пароль обязателен'
    }),
    // ДОБАВЛЯЕМ ВАЛИДАЦИЮ НОВЫХ ПОЛЕЙ:
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    avatar_url: Joi.string().uri().optional(),
    bio: Joi.string().max(500).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации пользователя', 
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Валидация обновления профиля
export const validateProfileUpdate = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).optional().messages({
      'string.min': 'Имя пользователя должно содержать минимум 3 символа',
      'string.max': 'Имя пользователя не должно превышать 30 символов'
    }),
    email: Joi.string().email().optional().messages({
      'string.email': 'Некорректный email'
    }),
    currentPassword: Joi.string().optional(),
    newPassword: Joi.string().min(6).optional().messages({
      'string.min': 'Новый пароль должен содержать минимум 6 символов'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: 'Ошибка валидации профиля', 
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};
