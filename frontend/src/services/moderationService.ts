/**
 * Клиентская превалидация контента.
 *
 * НЕ заменяет бэкенд-модерацию — используется ТОЛЬКО
 * для быстрого UX-фидбэка перед отправкой на сервер.
 */

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

// Спам-фразы (только явная реклама, без тревел-слов)
const SPAM_PHRASES: RegExp[] = [
  /специальное предложение/i,
  /ограниченное время/i,
  /только сегодня/i,
  /звоните прямо сейчас/i,
  /не упустите возможность/i,
];

const SPAM_WORDS = new Set([
  'бесплатно', 'кэшбэк', 'распродажа',
  'bit.ly', 'tinyurl', 'goo.gl',
  'звоните', 'свяжитесь', 'номер телефона',
]);

const INAPPROPRIATE_WORDS = new Set([
  'мошенничество', 'обман', 'фейк', 'подделка',
  'накрутка', 'массовая рассылка',
  'экстремизм', 'наркотики',
]);

export class ModerationService {
  /** Быстрая клиентская проверка контента */
  async moderateContent(content: ContentData): Promise<ModerationResult> {
    const { issues, suggestions, category } = this.check(content);

    if (issues.length > 0) {
      return { isAppropriate: false, confidence: 0.85, issues, suggestions, category, action: 'review' };
    }

    return { isAppropriate: true, confidence: 0.95, issues: [], suggestions: [], category: 'safe', action: 'approve' };
  }

  async moderateBatch(contents: ContentData[]): Promise<ModerationResult[]> {
    return Promise.all(contents.map(c => this.moderateContent(c)));
  }

  // ── Внутренние проверки ────────────────────────────────────────────

  private check(content: ContentData) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let category: ModerationResult['category'] = 'safe';
    const text = content.text.toLowerCase();

    // 1. Длина
    if (content.text.length < 10) {
      issues.push('Слишком короткий текст');
      suggestions.push('Добавьте больше деталей');
    }

    // 2. Повторяющиеся символы
    if (/(.)\1{5,}/.test(content.text)) {
      issues.push('Повторяющиеся символы');
      suggestions.push('Исправьте форматирование');
      category = 'spam';
    }

    // 3. Избыточный CAPS
    const capsRatio = (text.match(/[А-ЯЁ]/g) || []).length / Math.max(text.length, 1);
    if (capsRatio > 0.3 && text.length > 20) {
      issues.push('Слишком много заглавных букв');
      suggestions.push('Используйте нормальный регистр');
      category = 'spam';
    }

    // 4. Спам-слова + фразы
    let spamScore = 0;
    const foundWords = [...SPAM_WORDS].filter(w => text.includes(w));
    const foundPhrases = SPAM_PHRASES.filter(p => p.test(text));
    spamScore += foundWords.length * 2 + foundPhrases.length * 5;

    if (spamScore >= 5) {
      issues.push('Обнаружены рекламные элементы');
      suggestions.push('Уберите рекламные элементы');
      category = 'spam';
    }

    // 5. Неподходящий контент
    const badWords = [...INAPPROPRIATE_WORDS].filter(w => text.includes(w));
    if (badWords.length > 0) {
      issues.push(`Неподходящий контент: ${badWords.join(', ')}`);
      suggestions.push('Используйте более подходящие формулировки');
      category = 'inappropriate';
    }

    return { issues, suggestions, category };
  }
}

export default new ModerationService();