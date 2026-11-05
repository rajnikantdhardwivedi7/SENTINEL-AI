-- 1. Remediation state machine enforced in the database (not just in server code)
CREATE OR REPLACE FUNCTION public.enforce_remediation_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending_approval' THEN
      RAISE EXCEPTION 'New remediation plans must start as pending_approval';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN
    IF OLD.status IN ('verified','failed','rejected') THEN
      RAISE EXCEPTION 'Finished remediation plans are immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT (
       (OLD.status = 'pending_approval' AND NEW.status IN ('approved','rejected'))
    OR (OLD.status = 'approved' AND NEW.status = 'executing')
    OR (OLD.status = 'executing' AND NEW.status IN ('verified','failed'))
  ) THEN
    RAISE EXCEPTION 'Invalid remediation transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status IN ('approved','rejected') AND NOT EXISTS (
    SELECT 1 FROM public.remediation_approvals a WHERE a.plan_id = NEW.id AND a.decision = NEW.status
  ) THEN
    RAISE EXCEPTION 'A recorded human decision is required before a plan becomes %', NEW.status;
  END IF;
  IF NEW.status = 'executing' AND NEW.executed_by IS NULL THEN
    NEW.executed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_remediation_transition() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_plan_transition BEFORE INSERT OR UPDATE ON public.remediation_plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_remediation_transition();

-- 2. Approvals: one decision per plan, only while pending, same org
CREATE UNIQUE INDEX IF NOT EXISTS remediation_approvals_one_per_plan ON public.remediation_approvals(plan_id);
CREATE OR REPLACE FUNCTION public.enforce_approval_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record;
BEGIN
  SELECT status, organization_id INTO _p FROM public.remediation_plans WHERE id = NEW.plan_id;
  IF _p IS NULL OR _p.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Plan not found in this organization';
  END IF;
  IF _p.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Plan is no longer awaiting approval';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_approval_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_approval_insert BEFORE INSERT ON public.remediation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_approval_insert();

-- 3. Audit log: every row must be attributed to the signed-in caller (no anonymous/forged actor)
DROP POLICY IF EXISTS "members insert own audit" ON public.audit_logs;
CREATE POLICY "members insert own audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND actor_id = auth.uid() AND NOT public.has_role(auth.uid(),'viewer'));

-- 4. Helper functions are only needed by signed-in policies
REVOKE EXECUTE ON FUNCTION public.current_org() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;