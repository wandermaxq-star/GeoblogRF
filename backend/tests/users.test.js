import request from 'supertest';
import { createTestAppWithRoutes } from './helpers/testApp.js';
import pool from '../db.js';
import { generateToken } from '../src/utils/jwt.js';
import { v4 as uuidv4 } from 'uuid';

let app;

beforeAll(async () => {
  // Применяем схему реферальной системы напрямую
  try {
    const sql = `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8) UNIQUE,
        ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
      CREATE TABLE IF NOT EXISTS affiliate_events (
        id SERIAL PRIMARY KEY,
        referred_user_id UUID NOT NULL REFERENCES users(id),
        referrer_id UUID NOT NULL REFERENCES users(id),
        event_type TEXT NOT NULL,        product_type TEXT,           -- 'subscription' | 'paid_pack' | etc.
        product_id UUID,             -- optional id of route/pack sold        amount NUMERIC(10,2),
        commission_due NUMERIC(10,2),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS affiliate_events_referrer_idx ON affiliate_events(referrer_id);
      CREATE INDEX IF NOT EXISTS affiliate_events_status_idx ON affiliate_events(status);

      CREATE TABLE IF NOT EXISTS affiliate_payouts (
        id SERIAL PRIMARY KEY,
        referrer_id UUID NOT NULL REFERENCES users(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_amount NUMERIC(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'calculated',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_referrer ON affiliate_payouts(referrer_id);
      CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

      CREATE TABLE IF NOT EXISTS partner_applications (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'new',
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
    `;
    await pool.query(sql);
  } catch (migrErr) {
    // игнорируем, может быть уже применено или другая ошибка
    console.warn('affiliate migration error', migrErr.message);
  }

  // Создаём тестовое приложение с user-маршрутами
  app = await createTestAppWithRoutes({
    '/api/users': '../../src/routes/userRoutes.js',
    '/api/partners': '../../src/routes/affiliateRoutes.js',
    '/api/admin': '../../src/routes/adminStatsRoutes.js'
  });
}, 15000);

afterAll(async () => {
  await pool.end();
});

describe('Users API (integration)', () => {
  describe('POST /api/users/login', () => {
    test('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'nonexistent_test_xyzzy@example.com', password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Неверный email/);
    });

    test('returns 400 without email', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 without password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 with invalid email format', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/profile', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
    });

    test('returns 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users/register', () => {
    test('returns 400 with missing fields', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 with short password', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: '123',
          phone: '+79001234567',
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('generates referral_code and accepts referrer', async () => {
      // create first user with unique email
      const makeEmail = () => `ref1_${Date.now()}_${Math.floor(Math.random()*100000)}@example.com`;
      const firstEmail = makeEmail();
      const first = await request(app)
        .post('/api/users/register')
        .send({
          email: firstEmail,
          username: 'ref1' + Math.floor(Math.random()*1000),
          password: 'password',
          phone: '+7900' + Math.floor(100000000 + Math.random()*900000000).toString().slice(0,7)
        });
      expect([201,409]).toContain(first.status); // allow rare uniqueness conflicts
      const refCode = first.body?.user?.referral_code;
      if (first.status === 201) {
        expect(refCode).toBeDefined();
      }

      // create second user using ?ref=
      const secondEmail = `ref2_${Date.now()}_${Math.floor(Math.random()*100000)}@example.com`;
      const second = await request(app)
        .post('/api/users/register?ref=' + refCode)
        .send({
          email: secondEmail,
          username: 'ref2' + Math.floor(Math.random()*1000),
          password: 'password',
          phone: '+7900' + Math.floor(200000000 + Math.random()*900000000).toString().slice(0,7)
        });
      expect(second.status).toBe(201);
      expect(second.body.user.referred_by).toBeDefined();
      expect(second.body.user.referred_by).not.toBeNull();

      // simulate SMS verification to activate second user
      await pool.query('UPDATE users SET is_verified=TRUE,is_active=TRUE WHERE id=$1',[second.body.user.id]);
      // call subscribe endpoint to generate affiliate event
      await request(app)
        .post('/api/users/subscribe')
        .set('Authorization', `Bearer ${generateToken(second.body.user.id, 'user')}`)
        .send({ amount: 199 });
      // check that affiliate_events entry was created
      const ev = await pool.query('SELECT * FROM affiliate_events WHERE referred_user_id=$1', [second.body.user.id]);
      expect(ev.rows.length).toBe(1);
      expect(ev.rows[0].event_type).toBe('first_subscription');

      // fetch partner dashboard for the referrer
      const tokenRef = generateToken(first.body.user.id, 'user');
      const dash = await request(app)
        .get('/api/users/partner')
        .set('Authorization', `Bearer ${tokenRef}`);
      expect(dash.status).toBe(200);
      expect(dash.body.referral_code).toBeDefined();
      expect(dash.body.referred_users).toBeGreaterThanOrEqual(1);
      expect(dash.body.total_commission).toBeGreaterThan(0);
      // new stats for paid packs should exist (zero until sales occur)
      expect(dash.body.paid_pack_sales).toBeDefined();
      expect(dash.body.next_paid_pack_bonus_in).toBeDefined();
    });
  });

  describe('affiliate payout calculation', () => {
    test('calculatePayouts groups events and updates status', async () => {
      // очистим таблицу перед вставкой, чтобы предыдущие тесты не мешали
      await pool.query('DELETE FROM affiliate_events');
      // вставим несколько событий вручную
      const userRes = await pool.query("SELECT id FROM users LIMIT 1");
      const referrerId = userRes.rows[0].id;
      // создаём два события с commission_due 1000 и 500
      await pool.query(
        `INSERT INTO affiliate_events (referred_user_id, referrer_id, event_type, amount, commission_due)
         VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)`,
        [referrerId, referrerId, 'first_subscription', 100, 15,
         referrerId, referrerId, 'first_iap', 50, 7.5]
      );
      // вызовем функцию расчёта из сервиса напрямую
      const { calculatePayouts } = await import('../src/services/affiliateService.js');
      const payouts = await calculatePayouts({ periodStart: '2000-01-01', periodEnd: '2100-01-01', minAmount: 10 });
      expect(Array.isArray(payouts)).toBe(true);
      expect(payouts[0].total_amount).toBeGreaterThan(0);

      // события должны быть помечены
      const after = await pool.query(`SELECT status FROM affiliate_events WHERE referrer_id=$1`, [referrerId]);
      expect(after.rows.every(r=>r.status === 'calculated')).toBe(true);
    });

    test('paid_pack event gives 20% commission and bonus on 100th sale', async () => {
      await pool.query('DELETE FROM affiliate_events');
      // take any existing user as referrer
      const usersRes = await pool.query("SELECT id FROM users LIMIT 2");
      const referrerId = usersRes.rows[0].id;
      let dummyReferredId;
      if (usersRes.rows.length > 1) {
        // use second user if available
        dummyReferredId = usersRes.rows[1].id;
      } else {
        // otherwise insert a new minimal user record
        const dummyUserRes = await pool.query(
          `INSERT INTO users (email, username, password_hash, role)
           VALUES ($1,$2,$3,'user') RETURNING id`,
          [`dummy_${Date.now()}`, `dummy_${Date.now()}`, 'x']
        );
        dummyReferredId = dummyUserRes.rows[0].id;
      }
      // insert 99 previous paid_pack sales for the same referrer
      // all of them can use the referrerId as referred_user_id, since the
      // duplicate check only matters for the new event which uses dummyId
      for (let i = 0; i < 99; i++) {
        await pool.query(
          `INSERT INTO affiliate_events (referred_user_id, referrer_id, event_type, amount, commission_due)
           VALUES ($1,$2,'paid_pack',$3,$4)`,
          [referrerId, referrerId, 100, 20] // dummy commission
        );
      }
      // now log a new paid_pack via service to get computed commission including bonus
      const { logAffiliateEvent } = await import('../src/services/affiliateService.js');
      const newEv = await logAffiliateEvent({ referredUserId: dummyReferredId, referrerId, eventType: 'paid_pack', amount: 100 });
      expect(newEv).not.toBeNull();
      // commission should be 25 (20% + 5% bonus on 100th sale)
      expect(Number(newEv.commission_due)).toBe(25);
    });

    test('updatePayoutStatus modifies a payout record', async () => {
      // возьмём существующую выплату
      const payRes = await pool.query('SELECT id,status FROM affiliate_payouts LIMIT 1');
      if (payRes.rows.length === 0) return;
      const { updatePayoutStatus } = await import('../src/services/affiliateService.js');
      const updated = await updatePayoutStatus(payRes.rows[0].id, 'paid');
      expect(updated.status).toBe('paid');
    });

    test('admin routes for payouts and applications work', async () => {
      // авторизованный админ токен
      const adminToken = generateToken('00000000-0000-0000-0000-000000000000', 'admin');
      // получить выплаты
      const pRes = await request(app)
        .get('/api/admin/affiliates/payouts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pRes.status).toBe(200);
      // запустить расчёт вручную
      const calcRes = await request(app)
        .post('/api/admin/affiliates/payouts/calc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodStart: '2000-01-01', periodEnd: '2100-01-01' });
      expect(calcRes.status).toBe(200);
      // заявку проверить
      const appRes = await request(app)
        .get('/api/admin/affiliates/applications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(appRes.status).toBe(200);
    });
  });

  describe('PUT /api/users/avatar', () => {
    test('returns 401 without auth token', async () => {
      const res = await request(app)
        .put('/api/users/avatar')
        .send({ avatar_url: 'https://example.com/avatar.png' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/users', () => {
    let token;
    let testEmail;
    beforeAll(async () => {
      // register a temporary user, retry if email collision occurs
      let registerRes;
      for (let i = 0; i < 5; i++) {
        testEmail = `testdel${Date.now()}_${Math.floor(Math.random()*100000)}@example.com`;
        const testUsername = `deleter${Math.floor(Math.random()*100000)}`;
        const testPhone = `+7900${Math.floor(100000 + Math.random()*900000)}`;
        registerRes = await request(app)
          .post('/api/users/register')
          .send({
            email: testEmail,
            username: testUsername,
            password: 'password123',
            phone: testPhone
          })
          .set('Content-Type', 'application/json');
        if (registerRes.status === 201) break;
        if (registerRes.status === 409) {
          // cleanup existing user and try again
          await pool.query('DELETE FROM users WHERE email=$1 OR username=$2 OR phone=$3', [testEmail, testUsername, testPhone]);
          continue;
        }
      }
      expect(registerRes.status).toBe(201);
      // simulate verify SMS by directly updating is_active true via DB (simpler)
      await pool.query('UPDATE users SET is_active=TRUE WHERE email=$1', [testEmail]);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: testEmail, password: 'password123' })
        .set('Content-Type', 'application/json');
      token = loginRes.body.token;
      expect(token).toBeDefined();
    });

    test('requires authentication', async () => {
      const res = await request(app).delete('/api/users');
      expect(res.status).toBe(401);
    });

    test('deactivates account', async () => {
      const res = await request(app)
        .delete('/api/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/деактивирован/i);
      // subsequent profile request should fail
      const profile = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(profile.status).toBe(401);

      // and login should no longer work
      const loginAgain = await request(app)
        .post('/api/users/login')
        .send({ email: testEmail, password: 'password123' })
        .set('Content-Type', 'application/json');
      expect(loginAgain.status).toBe(401);
    });
  });
});
