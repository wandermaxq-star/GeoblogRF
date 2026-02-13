import axios from 'axios';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import crypto from 'crypto';
import logger from '../../logger.js';

class SMSService {
  constructor() {
    this.apiId = process.env.SMS_RU_API_ID || null;
    this.baseUrl = 'https://sms.ru';
    this.isTestMode = process.env.NODE_ENV !== 'production';

    // Fail fast in production when SMS provider credentials are missing
    if (!this.apiId && process.env.NODE_ENV === 'production') {
      throw new Error('SMS_RU_API_ID is required in production environment');
    }
  }

  /**
   * Генерирует случайный 6-значный код
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Отправляет SMS с кодом подтверждения
   */
  async sendVerificationCode(phone, code) {
    if (this.isTestMode) {
      logger.info(`[TEST MODE] SMS код для ${phone}: ${code}`);
      return { success: true, code: code };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sms/send`, {
        api_id: this.apiId,
        to: phone,
        msg: `Ваш код подтверждения: ${code}. Код действителен 5 минут.`,
        json: 1
      });

      if (response.data.status === 'OK') {
        return { success: true, code: code };
      } else {
        throw new Error(`SMS отправка не удалась: ${response.data.status_text}`);
      }
    } catch (error) {
      console.error('Ошибка отправки SMS:', error.message);
      throw new Error('Не удалось отправить SMS');
    }
  }

  /**
   * Отправляет SMS для восстановления пароля
   */
  async sendPasswordResetCode(phone, code) {
    if (this.isTestMode) {
      logger.info(`[TEST MODE] SMS код восстановления для ${phone}: ${code}`);
      return { success: true, code: code };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sms/send`, {
        api_id: this.apiId,
        to: phone,
        msg: `Код восстановления пароля: ${code}. Код действителен 5 минут.`,
        json: 1
      });

      if (response.data.status === 'OK') {
        return { success: true, code: code };
      } else {
        throw new Error(`SMS отправка не удалась: ${response.data.status_text}`);
      }
    } catch (error) {
      console.error('Ошибка отправки SMS:', error.message);
      throw new Error('Не удалось отправить SMS');
    }
  }

  /**
   * Проверяет баланс SMS.ru
   */
  async checkBalance() {
    if (this.isTestMode) {
      return { balance: 1000, currency: 'RUB' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/my/balance`, {
        params: { api_id: this.apiId, json: 1 }
      });

      return { balance: response.data.balance, currency: 'RUB' };
    } catch (error) {
      console.error('Ошибка проверки баланса SMS:', error.message);
      return { balance: 0, currency: 'RUB' };
    }
  }
}

export default new SMSService();


