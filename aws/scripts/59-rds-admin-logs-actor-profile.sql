-- Admin activity logs: actor identity columns + admin read access
ALTER TABLE public.admin_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS actor_tag TEXT,
  ADD COLUMN IF NOT EXISTS registration_source TEXT;

CREATE INDEX IF NOT EXISTS admin_logs_user_id_created_at_idx
  ON public.admin_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_logs_actor_role_idx
  ON public.admin_logs (actor_role);

-- Admins and super admins can read all audit logs
DROP POLICY IF EXISTS "Super admins view all logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins view all logs" ON public.admin_logs;
CREATE POLICY "Admins view all logs" ON public.admin_logs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admins, college admins, and staff dashboard users can insert logs
DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Dashboard users can insert logs" ON public.admin_logs;
CREATE POLICY "Dashboard users can insert logs" ON public.admin_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'college_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_staff
      WHERE id = auth.uid()
    )
  );
