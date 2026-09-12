import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerDb } from '../lib/getServerDb.js';

type PaymentLookupResult = {
  source: 'order' | 'payment' | 'email';
  status?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  email?: string | null;
  amountPaise?: number | null;
  rows?: Array<Record<string, unknown>>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const orderId = String(req.query.orderId || '').trim();
  const paymentId = String(req.query.paymentId || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!orderId && !paymentId && !email) {
    return res.status(400).json({
      success: false,
      message: 'Provide orderId, paymentId, or email',
    });
  }

  let db;
  try {
    db = getServerDb();
  } catch (cfgErr: unknown) {
    const msg = cfgErr instanceof Error ? cfgErr.message : String(cfgErr);
    return res.status(500).json({ success: false, message: msg });
  }

  try {
    if (orderId) {
      const { data, error } = await db
        .from('payment_orders')
        .select('status, payment_id, order_id, amount_paise, email')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, message: 'Order not found' });

      return res.status(200).json({
        success: true,
        source: 'order',
        status: data.status,
        paymentId: data.payment_id,
        orderId: data.order_id,
        email: data.email ?? null,
        amountPaise: data.amount_paise ?? null,
      } satisfies PaymentLookupResult & { success: true });
    }

    if (paymentId) {
      const [orderRes, successRes] = await Promise.all([
        db
          .from('payment_orders')
          .select('status, payment_id, order_id, amount_paise, email')
          .eq('payment_id', paymentId)
          .maybeSingle(),
        db
          .from('payment_success')
          .select('payment_id, order_id, status, amount_paise, email, user_id, created_at')
          .eq('payment_id', paymentId)
          .maybeSingle(),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (successRes.error) throw successRes.error;

      const row = orderRes.data || successRes.data;
      if (!row) {
        return res.status(404).json({ success: false, message: 'Payment not found in database' });
      }

      return res.status(200).json({
        success: true,
        source: 'payment',
        status: row.status,
        paymentId: row.payment_id,
        orderId: row.order_id ?? null,
        email: row.email ?? null,
        amountPaise: row.amount_paise ?? null,
      });
    }

    const { data, error } = await db
      .from('payment_success')
      .select('payment_id, order_id, status, amount_paise, email, user_id, created_at')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data?.length) {
      return res.status(404).json({ success: false, message: 'No payment records found for this email' });
    }

    const primary = data[0];
    return res.status(200).json({
      success: true,
      source: 'email',
      status: primary.status,
      paymentId: primary.payment_id,
      orderId: primary.order_id ?? null,
      email: primary.email ?? email,
      amountPaise: primary.amount_paise ?? null,
      rows: data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Status Check Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
