-- Permanent user purge: remove auth account + directory rows (not soft delete / Blocked status).

CREATE OR REPLACE FUNCTION public._admin_purge_user_best_effort(p_user_id text, p_email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_id text := nullif(trim(p_user_id), '');
  v_uuid uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_uuid := v_id::uuid;
  EXCEPTION WHEN others THEN
    v_uuid := NULL;
  END;

  IF v_email IS NULL AND v_uuid IS NOT NULL THEN
    SELECT lower(trim(u.email)) INTO v_email FROM auth.users u WHERE u.id = v_uuid LIMIT 1;
  END IF;
  IF v_email IS NULL THEN
    SELECT lower(trim(s.email)) INTO v_email FROM public.students s WHERE s.id = v_id LIMIT 1;
  END IF;

  BEGIN DELETE FROM public.attendance WHERE student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.assignment_submissions WHERE student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.certificates WHERE user_id::text = v_id OR student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.payment_success WHERE user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.id_card_generations WHERE student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.college_student_rosters WHERE student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.college_admin_assignments WHERE user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.admin_staff WHERE id::text = v_id OR user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.admin_permissions WHERE user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.academic_info WHERE user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.emergency_contacts WHERE user_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.beu_details WHERE student_id::text = v_id; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.staff_auth_sessions WHERE user_id = v_uuid; EXCEPTION WHEN others THEN NULL; END;
  BEGIN DELETE FROM public.staff_activity_log WHERE user_id = v_uuid; EXCEPTION WHEN others THEN NULL; END;

  IF v_email IS NOT NULL THEN
    BEGIN DELETE FROM public.password_resets WHERE lower(trim(email)) = v_email; EXCEPTION WHEN others THEN NULL; END;
  END IF;

  DELETE FROM public.user_roles WHERE user_id::text = v_id;
  DELETE FROM public.profiles WHERE id::text = v_id;
  DELETE FROM public.students WHERE id = v_id;

  IF v_uuid IS NOT NULL THEN
    BEGIN DELETE FROM auth.sessions WHERE user_id = v_uuid; EXCEPTION WHEN others THEN NULL; END;
    BEGIN DELETE FROM auth.refresh_tokens WHERE user_id = v_uuid; EXCEPTION WHEN others THEN NULL; END;
    DELETE FROM auth.identities WHERE user_id = v_uuid;
    DELETE FROM auth.users WHERE id = v_uuid;
  END IF;
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
BEGIN
  IF NOT (
    public.has_role(v_caller, 'admin'::public.app_role)
    OR public.has_role(v_caller, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin only' USING ERRCODE = '42501';
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  BEGIN
    v_uuid := v_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid user id';
  END;

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

REVOKE ALL ON FUNCTION public._admin_purge_user_best_effort(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_purge_student(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_student(text) TO authenticated;

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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin only' USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.admin_student_data_upload_delete_students(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_student_data_upload_delete_students(text[]) TO authenticated;

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
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin only' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.remove_staff_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_staff_access(uuid) TO authenticated;
