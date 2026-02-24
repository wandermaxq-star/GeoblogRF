/**
 * Сервис модерации для backend (адаптированная версия frontend ModerationService)
 */

export class ModerationService {
  constructor() {
    // НЕ включаем тревел-слова (тур, отель, гид, экскурсии и т.д.) — они нормальны для геоблога
    this.spamWords = new Set([
      // Явно рекламные фразы
      'специальное предложение', 'ограниченное время', 'только сегодня',
      'бесплатно', 'кэшбэк', 'распродажа',
      // Укороченные ссылки (обычно спам)
      'bit.ly', 'tinyurl', 'goo.gl',
      // Призывы к контакту в обход платформы
      'звоните', 'свяжитесь', 'номер телефона',
    ]);

    this.inappropriateWords = new Set([
      'спам', 'реклама', 'мошенничество', 'обман', 'фейк', 'подделка',
      'накрутка', 'бот', 'автомат', 'массовая рассылка',
      'политика', 'религия', 'экстремизм', 'наркотики', 'алкоголь'
    ]);

    this.fakeReviewPatterns = [
      /отличный отель|прекрасный сервис|всем рекомендую/gi,
      /лучший в городе|невероятно|потрясающе/gi,
      /\d+ звезд|рейтинг \d+|\d+ из \d+/gi
    ];
  }

  async moderateContent(content) {
    try {
      const basicChecks = this.performBasicChecks(content);
      
      if (basicChecks.hasIssues) {
        // Формируем развёрнутую рекомендацию
        const detailedReason = this.generateDetailedReason(basicChecks, 'reject');
        
        return {
          isAppropriate: false,
          confidence: 0.9,
          issues: basicChecks.issues,
          suggestions: basicChecks.suggestions,
          category: basicChecks.category,
          action: 'hide',
          detailedReason: detailedReason
        };
      }

      if (content.type === 'review') {
        const fakeCheck = this.checkFakeReview(content.text);
        if (fakeCheck.isFake) {
          const detailedReason = `Обнаружены признаки фейкового отзыва: ${fakeCheck.reasons.join(', ')}. ` +
            `Рекомендуется отклонить или запросить дополнительную проверку.`;
          
          return {
            isAppropriate: false,
            confidence: 0.8,
            issues: ['Подозрение на фейковый отзыв', ...fakeCheck.reasons],
            suggestions: ['Проверьте подлинность отзыва', 'Запросите дополнительные детали у автора'],
            category: 'fake',
            action: 'review',
            detailedReason: detailedReason
          };
        }
      }

      // Контент безопасен - формируем развёрнутую рекомендацию об одобрении
      const qualityAnalysis = this.analyzeContentQuality(content);
      const detailedReason = this.generateDetailedReason(qualityAnalysis, 'approve');

      return {
        isAppropriate: true,
        confidence: 0.95,
        issues: [],
        suggestions: [],
        category: 'safe',
        action: 'approve',
        detailedReason: detailedReason
      };
    } catch (error) {
      return {
        isAppropriate: true,
        confidence: 0.5,
        issues: ['Ошибка проверки'],
        suggestions: ['Требуется ручная проверка'],
        category: 'safe',
        action: 'review',
        detailedReason: 'Произошла ошибка при автоматическом анализе. Требуется ручная проверка контента.'
      };
    }
  }

  /**
   * Генерирует развёрнутую рекомендацию для админа
   */
  generateDetailedReason(analysis, action) {
    if (action === 'approve') {
      const qualityPoints = [];
      if (analysis.hasPhoto) qualityPoints.push('наличие фотографий');
      if (analysis.hasDescription) qualityPoints.push('подробное описание');
      if (analysis.hasLocation) qualityPoints.push('указана локация');
      if (analysis.hasTags) qualityPoints.push('добавлены теги');
      
      let reason = 'Контент соответствует правилам платформы. ';
      if (qualityPoints.length > 0) {
        reason += `Качественный контент: ${qualityPoints.join(', ')}. `;
      }
      reason += 'Рекомендуется одобрить и опубликовать.';
      return reason;
    } else {
      // Для отклонения
      let reason = 'Обнаружены проблемы: ';
      if (analysis.issues && analysis.issues.length > 0) {
        reason += analysis.issues.join('; ') + '. ';
      }
      if (analysis.suggestions && analysis.suggestions.length > 0) {
        reason += 'Рекомендации: ' + analysis.suggestions.join('; ') + '. ';
      }
      reason += 'Рекомендуется отклонить или запросить доработку.';
      return reason;
    }
  }

  /**
   * Анализирует качество контента для одобрения
   */
  analyzeContentQuality(content) {
    return {
      hasPhoto: !!(content.photo_urls || content.cover_image_url || content.image_url),
      hasDescription: !!(content.description || content.body || content.content) && 
                      (content.description || content.body || content.content || '').length > 50,
      hasLocation: !!(content.location || content.address || (content.latitude && content.longitude)),
      hasTags: !!(content.hashtags || content.tags),
      textLength: (content.text || '').length
    };
  }

  performBasicChecks(content) {
    const issues = [];
    const suggestions = [];
    let category = 'safe';

    const text = content.text.toLowerCase();

    const spamWordsFound = Array.from(this.spamWords).filter(word => 
      text.includes(word)
    );

    const spamPhrases = [
      /специальное предложение/gi,
      /ограниченное время/gi,
      /только сегодня/gi,
      /звоните прямо сейчас/gi,
      /не упустите возможность/gi
    ];

    const spamPhrasesFound = spamPhrases.filter(phrase => phrase.test(text));
    const exclamationCount = (text.match(/!/g) || []).length;
    const isExcessiveExclamation = exclamationCount > 3;
    const capsRatio = (text.match(/[А-ЯЁ]/g) || []).length / (text.length || 1);
    const isExcessiveCaps = capsRatio > 0.3;

    let spamScore = 0;
    spamScore += spamWordsFound.length * 2;
    spamScore += spamPhrasesFound.length * 5;
    spamScore += isExcessiveExclamation ? 3 : 0;
    spamScore += isExcessiveCaps ? 4 : 0;

    if (spamScore >= 5) {
      const reasons = [];
      if (spamWordsFound.length > 0) reasons.push(`спам-слова: ${spamWordsFound.slice(0, 3).join(', ')}`);
      if (spamPhrasesFound.length > 0) reasons.push('рекламные фразы');
      if (isExcessiveExclamation) reasons.push('избыточные восклицательные знаки');
      if (isExcessiveCaps) reasons.push('избыточное использование заглавных букв');
      
      issues.push(`Обнаружен спам: ${reasons.join(', ')}`);
      suggestions.push('Уберите рекламные элементы и используйте нормальное форматирование');
      category = 'spam';
    }

    const inappropriateWordsFound = Array.from(this.inappropriateWords).filter(word => 
      text.includes(word)
    );

    if (inappropriateWordsFound.length > 0) {
      issues.push(`Неподходящий контент: ${inappropriateWordsFound.slice(0, 3).join(', ')}`);
      suggestions.push('Используйте более подходящие формулировки');
      category = 'inappropriate';
    }

    if (content.text.length < 10) {
      issues.push('Слишком короткий текст');
      suggestions.push('Добавьте больше деталей к вашему сообщению');
    }

    if (content.text.length > 2000) {
      issues.push('Слишком длинный текст');
      suggestions.push('Сократите текст до 2000 символов');
    }

    if (/(.)\1{5,}/.test(content.text)) {
      issues.push('Обнаружены повторяющиеся символы');
      suggestions.push('Исправьте форматирование текста');
      category = 'spam';
    }

    return {
      hasIssues: issues.length > 0,
      issues,
      suggestions,
      category
    };
  }

  checkFakeReview(text) {
    const reasons = [];
    let isFake = false;

    for (const pattern of this.fakeReviewPatterns) {
      if (pattern.test(text)) {
        reasons.push('Подозрительные формулировки');
        isFake = true;
      }
    }

    const enthusiasmWords = ['отлично', 'прекрасно', 'великолепно', 'потрясающе', 'невероятно'];
    const enthusiasmCount = enthusiasmWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;

    if (enthusiasmCount > 3) {
      reasons.push('Избыточная восторженность');
      isFake = true;
    }

    const specificWords = ['цены', 'время', 'место', 'персонал', 'чистота', 'еда'];
    const hasSpecificDetails = specificWords.some(word => 
      text.toLowerCase().includes(word)
    );

    if (!hasSpecificDetails && text.length > 100) {
      reasons.push('Отсутствие конкретных деталей');
      isFake = true;
    }

    return { isFake, reasons };
  }
}

export default new ModerationService();

