-- Allow Admin panel sub-admins (staff + can_manage_students / can_manage_staff) to purge users.

CREATE OR REPLACE FUNCTION public._staff_has_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_key
    WHEN 'can_manage_students' THEN (
      EXISTS (
        SELECT 1
        FROM public.admin_permissions ap
        WHERE ap.user_id = auth.uid()
          AND ap.can_manage_students IS TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM public.admin_staff s
        WHERE (s.id = auth.uid() OR s.user_id = auth.uid())
          AND COALESCE((s.permissions->>'can_manage_students')::boolean, false) IS TRUE
      )
    )
    WHEN 'can_manage_staff' THEN (
      EXISTS (
        SELECT 1
        FROM public.admin_permissions ap
        WHERE ap.user_id = auth.uid()
          AND ap.can_manage_staff IS TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM public.admin_staff s
        WHERE (s.id = auth.uid() OR s.user_id = auth.uid())
          AND COALESCE((s.permissions->>'can_manage_staff')::boolean, false) IS TRUE
      )
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_may_admin_purge_students()
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

  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN;
  END IF;

  IF public.has_role(auth.uid(), 'staff'::public.app_role)
     AND public._staff_has_permission('can_manage_students') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Access denied: student management permission required' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_purge_student(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_id text := nullif(trim(p_user_id), '');
  v_uuid uuid;
  v_caller uuid := auth.uid();
  v_target_super_admin boolean := false;
  v_caller_super_admin boolean := false;
  v_caller_is_admin boolean := false;
  v_allowed boolean := false;
BEGIN
  v_caller_is_admin := public.has_role(v_caller, 'admin'::public.app_role)
    OR public.has_role(v_caller, 'super_admin'::public.app_role);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  BEGIN
    v_uuid := v_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid user id';
  END;

  IF v_caller_is_admin THEN
    v_allowed := true;
  ELSIF public.has_role(v_caller, 'staff'::public.app_role) THEN
    IF public._staff_has_permission('can_manage_students')
       AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_id) THEN
      v_allowed := true;
    ELSIF public._staff_has_permission('can_manage_staff')
       AND EXISTS (
         SELECT 1
         FROM public.admin_staff ast
         WHERE ast.id = v_uuid OR ast.user_id = v_uuid
       ) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Access denied: admin or permitted sub-admin only' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL AND v_caller = v_uuid THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT public.has_role(v_caller, 'super_admin'::public.app_role) INTO v_caller_super_admin;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uuid AND ur.role = 'super_admin'::public.app_role
  ) INTO v_target_super_admin;

  IF v_target_super_admin AND NOT v_caller_super_admin THEN
    RAISE EXCEPTION 'Only super_admin can delete a super_admin account';
  END IF;

  IF v_target_super_admin AND v_caller_super_admin THEN
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'super_admin'::public.app_role) <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last super_admin account';
    END IF;
  END IF;

  PERFORM public._admin_purge_user_best_effort(v_id);

  IF v_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uuid) THEN
    RAISE EXCEPTION 'User account still exists after purge';
  END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', v_id, 'deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_data_upload_delete_students(p_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_id text;
  v_deleted int := 0;
BEGIN
  PERFORM public.assert_may_admin_purge_students();

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted_students', 0);
  END IF;

  FOREACH v_id IN ARRAY p_ids
  LOOP
    IF nullif(trim(v_id), '') IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public._admin_purge_user_best_effort(trim(v_id));
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'deleted_students', v_deleted);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_staff_access(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_id text := target_id::text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'staff'::public.app_role)
      AND public._staff_has_permission('can_manage_staff')
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: staff management permission required' USING ERRCODE = '42501';
  END IF;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'target_id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = target_id AND ur.role = 'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Cannot remove super_admin via remove_staff_access';
  END IF;

  DELETE FROM public.admin_staff WHERE id = target_id OR user_id = target_id;
  DELETE FROM public.admin_permissions WHERE user_id = target_id;
  DELETE FROM public.user_roles
  WHERE user_id = target_id
    AND role IN ('admin'::public.app_role, 'staff'::public.app_role);

  RETURN jsonb_build_object('ok', true, 'user_id', v_id, 'access_removed', true);
END;
$$;

REVOKE ALL ON FUNCTION public._staff_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_may_admin_purge_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._staff_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_may_admin_purge_students() TO authenticated;
