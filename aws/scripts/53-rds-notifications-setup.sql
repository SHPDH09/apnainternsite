-- RDS notification bootstrap (no auth.users FK). Safe to re-run.

-- ── Admin auth helper (required by notification RPCs) ─────────────────────────
CREATE OR REPLACE FUNCTION public.auth_is_referral_partner_scoped_only(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _uid AND ur.role = 'referral_partner'::public.app_role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = _uid
      AND ur2.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role,
        'college_admin'::public.app_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_may_admin_list_students()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.auth_is_referral_partner_scoped_only(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$$;

-- ── Core tables ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target_type text NOT NULL DEFAULT 'filtered',
  target_user_id uuid,
  target_universities text[],
  target_colleges text[],
  target_domains text[],
  target_modes text[],
  status text NOT NULL DEFAULT 'published',
  recipient_count integer,
  class_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_type_check
  CHECK (target_type IN ('all', 'specific', 'filtered'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('draft', 'published'));

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_unread
  ON public.notification_deliveries (user_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON public.notification_deliveries (notification_id);

-- ── RLS (skip if auth roles missing) ────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
  CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

  DROP POLICY IF EXISTS "Admins manage notification deliveries" ON public.notification_deliveries;
  CREATE POLICY "Admins manage notification deliveries" ON public.notification_deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

  DROP POLICY IF EXISTS "Users read own notification deliveries" ON public.notification_deliveries;
  CREATE POLICY "Users read own notification deliveries" ON public.notification_deliveries
  FOR SELECT USING (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notification_deliveries;
  CREATE POLICY "Users mark own notifications read" ON public.notification_deliveries
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table OR undefined_object THEN
  ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notification_deliveries DISABLE ROW LEVEL SECURITY;
END $$;

-- ── Student list / publish RPCs (text class_id for RDS) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_notifications(p_limit integer DEFAULT 100)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_admin_list_students();
  RETURN QUERY
  SELECT n.*
  FROM public.notifications n
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.list_notifications_for_student()
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  created_at timestamptz,
  read_at timestamptz,
  is_read boolean,
  class_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.title,
    n.message,
    n.created_at,
    d.read_at,
    (d.read_at IS NOT NULL) AS is_read,
    n.class_id
  FROM public.notification_deliveries d
  JOIN public.notifications n ON n.id = d.notification_id
  WHERE d.user_id = auth.uid()
    AND n.status = 'published'
  ORDER BY n.created_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.student_unread_notification_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.notification_deliveries d
  JOIN public.notifications n ON n.id = d.notification_id
  WHERE d.user_id = auth.uid()
    AND d.read_at IS NULL
    AND n.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.student_mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET read_at = COALESCE(read_at, now())
  WHERE notification_id = p_notification_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, read_at)
    VALUES (p_notification_id, auth.uid(), now())
    ON CONFLICT (notification_id, user_id)
    DO UPDATE SET read_at = COALESCE(notification_deliveries.read_at, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_notifications(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_notifications_for_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_mark_notification_read(uuid) TO authenticated;
