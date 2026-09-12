import type { VercelRequest, VercelResponse } from '@vercel/node';

const APPLY_CODE =
  process.env.RDS_APPLY_SECRET?.trim() ||
  process.env.ADMIN_BOOTSTRAP_CODE?.trim() ||
  'apnaintern-owner-setup-v1';

/** Apply numbered aws/scripts/*.sql to RDS (Vercel — needs DATABASE_URL). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const body =
    req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
      ? (req.body as { code?: string })
      : (() => {
          try {
            return JSON.parse(String(req.body || '{}')) as { code?: string };
          } catch {
            return {};
          }
        })();

  if (body.code !== APPLY_CODE) {
    return res.status(403).json({ ok: false, message: 'Invalid apply code' });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return res.status(503).json({
      ok: false,
      message: 'DATABASE_URL is not configured on this deployment',
    });
  }

  try {
    const { applyAllRdsSql } = await import('../aws/server/rds-apply-all.js');
    const result = await applyAllRdsSql();
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rds-apply-all]', message);
    return res.status(500).json({ ok: false, message });
  }
}
