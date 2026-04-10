# GeoBlog Partner Program Refactor

## ✅ РЕАЛИЗОВАНО (2026-03-20)

### Структура партнёрской программы

```
┌─────────────────────────────────────────────────────────────────┐
│  SIMPLE USER (Активный автор)                                    │
│  ├── НЕТ реферальной ссылки                                      │
│  ├── НЕТ доступа к реферальному дашборду                         │
│  ├── Прогресс: маршруты + голоса                                 │
│  ├── Комиссия: 15% → 20% → 25% (только кураторские паки)         │
│  └── Статусы: novice → ambassador → expert                       │
│                                                                  │
│  PRO GUIDE (Профессиональный гид)                                │
│  ├── ЕСТЬ реферальная ссылка                                     │
│  ├── Доступ к /partner с полной статистикой                      │
│  ├── Премиум-рефералы: 10→10%, 25→15%, 50→20%, 100+→25%          │
│  ├── Продажи паков: 10→15%, 25→20%, 50→25%, 100+→30%             │
│  └── Статус: pro_guide                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `backend/src/migrations/2026-03-20-partner-role-separation.sql` | **НОВЫЙ** — миграция для `partner_role` |
| `frontend/src/data/partnerTiers.ts` | Разделение на `SimpleAuthorTiers`, `ProGuidePremiumTiers`, `ProGuidePackTiers` |
| `backend/src/services/affiliateService.js` | Новые функции: `getSimpleAuthorTier`, `getProGuidePremiumTier`, `getProGuidePackTier` |
| `backend/src/controllers/partnerController.js` | Разделение ответа API для simple/pro_guide |
| `frontend/src/pages/PartnerDashboard.tsx` | Разные UI для Simple User и Pro Guide |

---

## Цель
Свести воедино архитектуру партнёрской программы с чётким разделением:
- Pro (пользователи — покупатели офлайн-паков, подписок)
- Партнёры (авторы/гиды — создатели контента и реферальный канал)

Не смешивать метрики и премии.
Прописать рабочую схему: **simple-user** и **pro-guide**.

---

## 1. Бизнес-ролям

### 1.1 Simple User (Активный автор)
- Цель: вырастить качество контента
- Путь:
  - Новичок (0-4 закаливания)
  - Амбассадор (сделал голосования + meets requirements)
  - Про-Эксперт (сделал все 15 маршрутов/20+ хороших оценок)
- Доступ:
  - прогресс по `routes` + `votes`
  - публикация бесплатных / платных кураторских паков
  - комиссия: 15% → 20% → 25% (максимум)
- Нет доступа к рефералкам премиум

### 1.2 Pro Guide (Профессиональный гид)
- Цель: приносить аудиторию и оплаченный трафик
- Базовые условия:
  - авторитетная аудитория (соцсети, туры, практический опыт)
  - подтверждённая заявка/приглашение через админку
- Метрики роста:
  1) Premium subscriptions counts
     - 10 → 10%
     - 25 → 15%
     - 50 → 20%
     - 100+ → 25% (ежемесячно)
  2) Paid curated packs sales
     - 10 → 15%
     - 25 → 20%
     - 50 → 25%
     - 100+ → 30% (справедливо для эксклюзивного контента)
- Всегда доступен реферальный код
- Дашборд: premium/referrals/pack performance/bonus progress

---

## 2. Таблицы и поля БД

### users
- partner_status enum: `none | simple | ambassador | expert | pro_guide`
- referral_code (varchar)
- referred_by (user_id)
- partner_role (varchar) — `simple` или `pro_guide`
- is_pro_guide_allowed (boolean)

### affiliate_events
- event_type: `signup` | `first_subscription` | `paid_pack` | `paid_premium_referral` | `curated_pack_sale`
- amount
- commission_due
- referrer_id
- referred_user_id
- status: pending/paid/rejected

### partner_applications
- user_id
- application_type: `organic` | `pro_guide`
- status: `new` | `approved` | `rejected`
- snapshot metrics

---

## 3. API

### GET /api/partners/progress
Ответ:
```json
{
  "ok": true,
  "partner_status": "none|simple|ambassador|expert|pro_guide",
  "simple_progress": { "routes": 5, "needed_routes": 15, "votes": 12, "needed_votes": 20, "overall": 45 },
  "guide_progress": { "premium_paid_referrals": 43, "curated_pack_buyers": 21 },
  "tiers": {
    "simple": "15%|20%|25%",
    "guide_premium": "10|15|20|25",
    "guide_pack": "15|20|25|30"
  },
  "can_apply_pro_guide": false,
  "application": {...}
}
```

### POST /api/partners/apply
- Тип: organic
- Логика: делает `partner_status=pending` и сохраняет snapshot

### POST /api/partners/apply-guide
- Тип: pro_guide application
- Логика: сохраняет заявку и ставит `partner_status=pending` при `none`

### GET /api/partners/application
- Статус последней заявки

---

## 4. Сервисы (backend)

### affiliateService.getPartnerTier(referrerId)
Контрол:
- `pro_guide` => tier по оплаченных премиум-рефералах + pack sales
- `simple` (автор): рычаг “продажи кураторских паков” и локальный максимум 25%

Пример:
```js
const premiumRef = await pool.query(`SELECT COUNT(*) ... WHERE event_type='paid_premium_referral' ...`);
const packRef = await pool.query(`SELECT COUNT(*) ... WHERE event_type='curated_pack_sale' ...`);
```
-> return tiers accordingly
```

### affiliateService.logAffiliateEvent({referredUserId, referrerId, eventType, amount})
- for `paid_pack` / `paid_premium_referral` / `curated_pack_sale`
- commission calculation from tier and bonus by 100-segment

---

## 5. UI

### /pro
- контент про подписки и оффлайн-паки
- блок: «Я не партнер — перейти в /partners»
- нет роферальных процентов

### /partners
- два блока:
  1. «Для активных пользователей» (progress + simple-tier)
  2. «Для профессиональных гидов» (pro-guide pipeline)

### /partner/dashboard
- Статистика, команда, payout
- Не показывает гидский процент простому

### partnerTiers
Разделить на 2 массива:
- simplePartnerTiers = [15,20,25]
- proGuidePremiumTiers = [10,15,20,25]
- proGuidePackTiers = [15,20,25,30]

---

## 6. Дашборды

### 6.1 Простого пользователя
- 15 маршрутов
- 20+ голосов
- «Подай заявку»/«Текущий статус»
- максимум 25% кураторской
- через `/partners/progress` возвращается `simple_progress` (routes_pct, votes_pct, is_eligible)
- постепенный путь: `novice` → `ambassador` → `pro_expert`

### 6.2 Партнёрская панель (`/partner`)
- `/api/users/partner` возвращает:
  - `referral_code`
  - `referred_users`, `total_events`, `signup_events`, `subscription_events`, `paid_pack_sales`
  - `tier` + `commission_rate`
  - `total_commission`, `next_paid_pack_bonus_in`
- на UI `PartnerDashboard` отображается:
  - уровень (`formatTier`), ставка (15-30% и bonus)
  - Earnings карточки: code, referrals, total_commission, воронка событий, paid_pack_sales
  - стратегия: 30-дней по `first_subscription` + активная подписка

### 6.3 PRO D – оффлайн / доступ к маршрутам (ProPage)
- раздел `/pro` должен показывать преимущества подписки:
  - полный доступ к оффлайн-картам в регионах, не входящих в купленные пакеты (время подписки)
  - скачивание любых регионов и коридоров фунционал
  - создание и сохранение curated-паков
  - дисконт на эксклюзивные пакеты гидов (набор `price`, `discount`)
  - в зависимости от статы: `isPremium` + `purchasedPacks`.
- логика доступа:
  - для платного пакета (если есть запись в `user_purchased_route_packs`) доступ всегда (постоянно), даже при истёкшей подписке
  - для region/premium-only пакета доступ только пока `isPremium=true` ( и `subscription_expires_at > now`)
  - если premium юзер скачал пакет и регион, после окончания подписки остаётся доступ к купленному пакету (исключение: region-карта вне пакета
    перестаёт обновляться/недоступна)
- отдельные API:
  - POST `/api/curated-route-packs/:id/purchase`
  - GET `/api/users/purchased-route-packs`
  - (возможно) GET `/api/users/premium-access`.

### 6.4 Статистика по скаченному паку
- пока в дашборде есть `paid_pack_sales` (кол-во продаж оплаченных пакетов).
- нужно добавить отдельную детализацию по каждому паку:
  - `pack_id`, `pack_name`, `sales_count`, `revenue`, `bonus_progress`
  - это можно вычислять из `affiliate_events` (event_type='paid_pack' + product_id поле), но текущий API предоставляет только агрегаты

### Про-гид
- premium referrals
- curated pack sales
- монетизация + поощрения

---

## 7. Полный пример команды действий (пока в файле)
1. Добавить миграции
2. Изменить `getPartnerProgress` + `apply`/`apply-guide` в контроллере
3. Перенести `getPartnerTier` в `affiliateService` по платящим рефам
4. Правка `PartnersPage` и `ProPage` для разделения
5. Тесты (backend + frontend)
6. Проверить вручную по сценариям

---

## 8. Интерпретация, то что ты написал
- `simple` max 25% = проверенный путь
- `pro_guide` max 30% (packs) + 25% (premium referral)
- исключительно true pro-guide получает реф-ссылку и доступ на early API
- `simple` без реф-ссылок

---

## 9. Конфиг пару мыслей (файл data)
`frontend/src/data/partnerProgramConfig.ts`
```ts
export const SimpleAuthorTiers = [
  { level: 'novice', threshold: 0, commission: 15 },
  { level: 'ambassador', threshold: 15, commission: 20 },
  { level: 'pro_expert', threshold: 25, commission: 25 }
];

export const ProGuidePremiumTiers = [
  { threshold: 10, commission: 10 },
  { threshold: 25, commission: 15 },
  { threshold: 50, commission: 20 },
  { threshold: 100, commission: 25 },
];

export const ProGuidePackTiers = [
  { threshold: 10, commission: 15 },
  { threshold: 25, commission: 20 },
  { threshold: 50, commission: 25 },
  { threshold: 100, commission: 30 },
];
```

---

## 10. Follow-up
- создам следующими шагами конкретные PR-дифф файлы для `partnerController`, `affiliateService`, `PartnersPage`, `ProPage`.
- потом аккуратно переведём всю логику в одну архитектуру.

---

*Файл сгенерирован автоматически в репозитории по просьбе разработчика для одобрения модели.*
