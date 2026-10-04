import { query } from "../../aws/server/db.js";

/** Admin, super_admin, or staff with can_manage_blog. */
export async function assertBlogAdmin(userId: string): Promise<boolean> {
  const { rows: roleRows } = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.user_roles
     WHERE user_id = $1::uuid AND role::text IN ('admin', 'super_admin')
     LIMIT 1`,
    [userId]
  );
  if (roleRows.length) return true;

  const { rows: staffRows } = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM public.user_roles
     WHERE user_id = $1::uuid AND role::text = 'staff'
     LIMIT 1`,
    [userId]
  );
  if (staffRows.length) return true;

  try {
    const { rows } = await query<{ ok: number }>(
      `SELECT 1 AS ok FROM public.admin_permissions
       WHERE user_id = $1::uuid AND COALESCE(can_manage_blog, false) = true
       LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
