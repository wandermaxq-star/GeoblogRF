import pool from '../../db.js';
import logger from '../../logger.js';
import { calculatePayouts, updatePayoutStatus } from '../services/affiliateService.js';

// возвращает список выплат с возможностью фильтра
export const listPayouts = async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM affiliate_payouts';
    const params = [];
    if (status) {
      params.push(status);
      sql += ' WHERE status=$1';
    }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('listPayouts error', err);
    res.status(500).json({ message: 'Ошибка получения выплат' });
  }
};

export const triggerCalculation = async (req, res) => {
  try {
    const { periodStart, periodEnd, minAmount } = req.body;
    const payouts = await calculatePayouts({ periodStart, periodEnd, minAmount });
    res.json({ created: payouts.length, payouts });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка при расчёте выплат' });
  }
};

export const changePayoutStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const p = await updatePayoutStatus(id, status);
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: 'Не удалось обновить статус' });
  }
};

/**
 * Список заявок с данными пользователя.
 * GET /api/partners/admin/applications?status=new&type=organic
 */
export const listApplications = async (req, res) => {
  try {
    const { status, type } = req.query;
    const params = [];
    const conds = [];

    if (status) { params.push(status); conds.push(`pa.status = $${params.length}`); }
    if (type)   { params.push(type);   conds.push(`pa.application_type = $${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         pa.*,
         u.username, u.email, u.partner_status
       FROM partner_applications pa
       JOIN users u ON u.id = pa.user_id
       ${where}
       ORDER BY pa.created_at DESC`,
      params
    );
    return res.json({ ok: true, applications: result.rows });
  } catch (err) {
    logger.error('listApplications error', { err });
    res.status(500).json({ message: 'Ошибка получения заявок' });
  }
};

/**
 * Изменение статуса заявки + статуса партнёра у пользователя.
 * PATCH /api/partners/admin/status
 * Body: { application_id, new_status, partner_status, note }
 *   new_status:    'new' | 'approved' | 'rejected'
 *   partner_status: 'none' | 'pending' | 'partner' | 'pro_guide'
 */
export const updatePartnerStatus = async (req, res) => {
  const adminId = req.user?.id;
  const { application_id, new_status, partner_status, note } = req.body;

  const allowedAppStatuses = ['new', 'approved', 'rejected'];
  const allowedPartnerStatuses = ['none', 'pending', 'partner', 'pro_guide'];

  if (!application_id) {
    return res.status(400).json({ ok: false, message: 'application_id обязателен' });
  }
  if (new_status && !allowedAppStatuses.includes(new_status)) {
    return res.status(400).json({ ok: false, message: 'Недопустимый new_status' });
  }
  if (partner_status && !allowedPartnerStatuses.includes(partner_status)) {
    return res.status(400).json({ ok: false, message: 'Недопустимый partner_status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Обновляем заявку
    const appRes = await client.query(
      `UPDATE partner_applications
       SET status = COALESCE($1, status),
           reviewer_note = COALESCE($2, reviewer_note),
           reviewer_id   = $3,
           reviewed_at   = NOW()
       WHERE id = $4
       RETURNING user_id, status`,
      [new_status || null, note || null, adminId, application_id]
    );

    if (appRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Заявка не найдена' });
    }

    const { user_id } = appRes.rows[0];

    // Автоматически выставляем partner_status при одобрении, если не указан явно
    let resolvedPartnerStatus = partner_status;
    if (!resolvedPartnerStatus && new_status === 'approved') {
      // Определяем тип заявки
      const typeRes = await client.query(
        'SELECT application_type FROM partner_applications WHERE id=$1',
        [application_id]
      );
      const appType = typeRes.rows[0]?.application_type;
      resolvedPartnerStatus = appType === 'pro_guide' ? 'pro_guide' : 'partner';
    } else if (!resolvedPartnerStatus && new_status === 'rejected') {
      resolvedPartnerStatus = 'none';
    }

    if (resolvedPartnerStatus) {
      await client.query(
        'UPDATE users SET partner_status=$1 WHERE id=$2',
        [resolvedPartnerStatus, user_id]
      );
    }

    await client.query('COMMIT');

    logger.info(`Admin ${adminId} updated partner application ${application_id}`, {
      new_status, resolvedPartnerStatus, user_id
    });

    return res.json({
      ok: true,
      application_id,
      new_status: new_status || appRes.rows[0].status,
      partner_status: resolvedPartnerStatus,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('updatePartnerStatus error', { err });
    res.status(500).json({ ok: false, message: 'Ошибка при обновлении статуса' });
  } finally {
    client.release();
  }
};

export const updateApplication = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  try {
    const result = await pool.query(
      'UPDATE partner_applications SET status=$1, reviewer_note=$2 WHERE id=$3 RETURNING *',
      [status, note, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Не удалось обновить заявку' });
  }
};

/**
 * Получить статистику для админ-панели
 * GET /api/partners/admin/stats
 */
export const getAdminStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM partner_applications WHERE status = 'new') as applications,
        (SELECT COUNT(*) FROM affiliate_payouts WHERE status = 'pending') as payouts_pending,
        (SELECT COUNT(*) FROM affiliate_refunds WHERE status = 'pending') as refunds_pending
    `);
    
    res.json(result.rows[0] || {
      applications: 0,
      payouts_pending: 0,
      refunds_pending: 0
    });
  } catch (err) {
    logger.error('getAdminStats error', { err });
    res.status(500).json({ message: 'Ошибка получения статистики' });
  }
};
