// import { Stagehand } from '@browserbase/stagehand';

export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  category: 'spam' | 'inappropriate' | 'fake' | 'safe';
  action: 'approve' | 'hide' | 'review' | 'block';
}

export interface ContentData {
  text: string;
  type: 'chat' | 'post' | 'comment' | 'review';
  userId: string;
  location?: string;
  images?: string[];
  timestamp: Date;
}

import storageService from './storageService';

export class ModerationService {
  private spamWords: Set<string>;
  private inappropriateWords: Set<string>;
  private fakeReviewPatterns: RegExp[];

  constructor() {

    // Расширенная база спам-слов для travel-сообщества
    this.spamWords = new Set([
      // Рекламные слова
      'купить', 'заказать', 'дешево', 'скидка', 'акция', 'тур', 'отель',
      'бронирование', 'виза', 'билеты', 'экскурсии', 'гид', 'трансфер',
      'специальное предложение', 'ограниченное время', 'только сегодня',
      'бесплатно', 'подарок', 'бонус', 'кэшбэк', 'распродажа',
      
      // Ссылки и домены
      'http://', 'https://', 'www.', '.ru', '.com', '.org', '.net',
      'bit.ly', 'tinyurl', 'goo.gl', 't.me', 'vk.me',
      
      // Контактная информация
      'звоните', 'пишите', 'whatsapp', 'telegram', 'viber',
      'номер телефона', 'контакт', 'свяжитесь'
    ]);

    // Неподходящий контент
    this.inappropriateWords = new Set([
      'спам', 'реклама', 'мошенничество', 'обман', 'фейк', 'подделка',
      'накрутка', 'бот', 'автомат', 'массовая рассылка',
      'политика', 'религия', 'экстремизм', 'наркотики', 'алкоголь'
    ]);

    // Паттерны фейковых отзывов
    this.fakeReviewPatterns = [
      /отличный отель|прекрасный сервис|всем рекомендую/gi,
      /лучший в городе|невероятно|потрясающе/gi,
      /\d+ звезд|рейтинг \d+|\d+ из \d+/gi
    ];
  }

  // Основная функция модерации
  async moderateContent(content: ContentData): Promise<ModerationResult> {
    try {
      // Быстрые проверки
      const basicChecks = this.performBasicChecks(content);
      
      if (basicChecks.hasIssues) {
        return {
          isAppropriate: false,
          confidence: 0.9,
          issues: basicChecks.issues,
          suggestions: basicChecks.suggestions,
          category: basicChecks.category,
          action: 'hide'
        };
      }

      // Проверка на фейковые отзывы (для отзывов)
      if (content.type === 'review') {
        const fakeCheck = this.checkFakeReview(content.text);
        if (fakeCheck.isFake) {
          return {
            isAppropriate: false,
            confidence: 0.8,
            issues: ['Подозрение на фейковый отзыв'],
            suggestions: ['Проверьте подлинность отзыва'],
            category: 'fake',
            action: 'review'
          };
        }
      }

      // Проверка геолокации (если указана)
      if (content.location) {
        const geoCheck = await this.checkLocationValidity(content.location);
        if (!geoCheck.isValid) {
          return {
            isAppropriate: false,
            confidence: 0.7,
            issues: ['Некорректная геолокация'],
            suggestions: ['Проверьте правильность указанного места'],
            category: 'inappropriate',
            action: 'review'
          };
        }
      }

      // Все проверки пройдены
      return {
        isAppropriate: true,
        confidence: 0.95,
        issues: [],
        suggestions: [],
        category: 'safe',
        action: 'approve'
      };

    } catch (error) {
      return {
        isAppropriate: true, // В случае ошибки - пропускаем
        confidence: 0.5,
        issues: ['Ошибка проверки'],
        suggestions: ['Требуется ручная проверка'],
        category: 'safe',
        action: 'review'
      };
    }
  }

  // Быстрые проверки
  private performBasicChecks(content: ContentData) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let category: 'spam' | 'inappropriate' | 'fake' | 'safe' = 'safe';

    const text = content.text.toLowerCase();

    // Умная проверка на спам-слова
    const spamWordsFound = Array.from(this.spamWords).filter(word => 
      text.includes(word)
    );

    // Проверка на рекламные фразы
    const spamPhrases = [
      /специальное предложение/gi,
      /ограниченное время/gi,
      /только сегодня/gi,
      /звоните прямо сейчас/gi,
      /не упустите возможность/gi
    ];

    const spamPhrasesFound = spamPhrases.filter(phrase => phrase.test(text));

    // Проверка на избыточное использование восклицательных знаков
    const exclamationCount = (text.match(/!/g) || []).length;
    const isExcessiveExclamation = exclamationCount > 3;

    // Проверка на CAPS LOCK
    const capsRatio = (text.match(/[А-ЯЁ]/g) || []).length / text.length;
    const isExcessiveCaps = capsRatio > 0.3;

    // Подсчет спам-баллов
    let spamScore = 0;
    spamScore += spamWordsFound.length * 2;
    spamScore += spamPhrasesFound.length * 5;
    spamScore += isExcessiveExclamation ? 3 : 0;
    spamScore += isExcessiveCaps ? 4 : 0;

    if (spamScore >= 5) {
      const reasons = [];
      if (spamWordsFound.length > 0) reasons.push(`спам-слова: ${spamWordsFound.join(', ')}`);
      if (spamPhrasesFound.length > 0) reasons.push('рекламные фразы');
      if (isExcessiveExclamation) reasons.push('избыточные восклицательные знаки');
      if (isExcessiveCaps) reasons.push('избыточное использование заглавных букв');
      
      issues.push(`Обнаружен спам: ${reasons.join(', ')}`);
      suggestions.push('Уберите рекламные элементы и используйте нормальное форматирование');
      category = 'spam';
    }

    // Проверка на неподходящий контент
    const inappropriateWordsFound = Array.from(this.inappropriateWords).filter(word => 
      text.includes(word)
    );

    if (inappropriateWordsFound.length > 0) {
      issues.push(`Неподходящий контент: ${inappropriateWordsFound.join(', ')}`);
      suggestions.push('Используйте более подходящие формулировки');
      category = 'inappropriate';
    }

    // Проверка длины текста
    if (content.text.length < 10) {
      issues.push('Слишком короткий текст');
      suggestions.push('Добавьте больше деталей к вашему сообщению');
    }

    if (content.text.length > 2000) {
      issues.push('Слишком длинный текст');
      suggestions.push('Сократите текст до 2000 символов');
    }

    // Проверка на повторяющиеся символы
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

  // Проверка на фейковые отзывы
  private checkFakeReview(text: string): { isFake: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let isFake = false;

    // Проверка паттернов
    for (const pattern of this.fakeReviewPatterns) {
      if (pattern.test(text)) {
        reasons.push('Подозрительные формулировки');
        isFake = true;
      }
    }

    // Проверка на избыточную восторженность
    const enthusiasmWords = ['отлично', 'прекрасно', 'великолепно', 'потрясающе', 'невероятно'];
    const enthusiasmCount = enthusiasmWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;

    if (enthusiasmCount > 3) {
      reasons.push('Избыточная восторженность');
      isFake = true;
    }

    // Проверка на отсутствие конкретики
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

  // Проверка валидности геолокации
  private async checkLocationValidity(location: string): Promise<{ isValid: boolean; details?: any }> {
    try {
      // Упрощенная проверка - считаем все локации валидными
      // В будущем можно добавить реальную проверку через API
      return { isValid: true, details: { location } };
    } catch (error) {
      return { isValid: true }; // В случае ошибки - считаем валидным
    }
  }

  // Массовая модерация контента
  async moderateBatch(contents: ContentData[]): Promise<ModerationResult[]> {
    const results: ModerationResult[] = [];

    for (const content of contents) {
      const result = await this.moderateContent(content);
      results.push(result);
    }

    return results;
  }

  // Получение статистики модерации
  async getModerationStats(): Promise<{
    totalChecked: number;
    approved: number;
    hidden: number;
    reviewed: number;
    blocked: number;
    spamDetected: number;
    fakeReviews: number;
  }> {
    try {
      // Получаем статистику из localStorage (в будущем - из API)
      const stats = storageService.getItem('moderation_stats');
      if (stats) {
        return JSON.parse(stats);
      }
      
      // Возвращаем тестовые данные
      return {
        totalChecked: 156,
        approved: 142,
        hidden: 8,
        reviewed: 4,
        blocked: 2,
        spamDetected: 6,
        fakeReviews: 3
      };
    } catch (error) {
      return {
        totalChecked: 0,
        approved: 0,
        hidden: 0,
        reviewed: 0,
        blocked: 0,
        spamDetected: 0,
        fakeReviews: 0
      };
    }
  }

  // Сохранение статистики модерации
  private async saveModerationStats(stats: any) {
    try {
      storageService.setItem('moderation_stats', JSON.stringify(stats));
    } catch (error) {
      }
  }

  // Обновление статистики после модерации
  async updateStats(action: 'approve' | 'hide' | 'block' | 'review') {
    try {
      const currentStats = await this.getModerationStats();
      
      switch (action) {
        case 'approve':
          currentStats.approved++;
          break;
        case 'hide':
          currentStats.hidden++;
          break;
        case 'block':
          currentStats.blocked++;
          break;
        case 'review':
          currentStats.reviewed++;
          break;
      }
      
      currentStats.totalChecked++;
      await this.saveModerationStats(currentStats);
    } catch (error) {
      }
  }
}

export default new ModerationService();