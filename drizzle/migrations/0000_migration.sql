
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','sre','security_analyst','viewer');

-- Organizations & workspaces
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  join_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.workspaces(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text,
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 80),
  job_title text CHECK (job_title IS NULL OR char_length(job_title) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.profiles(organization_id);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.user_roles(organization_id);
GRANT SELECT, UPDATE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_org() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Org / profile / role policies
CREATE POLICY "members read own org" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org());
CREATE POLICY "admins update org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.current_org());

CREATE POLICY "members read workspaces" ON public.workspaces FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "admins insert workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update workspaces" ON public.workspaces FOR UPDATE TO authenticated USING (organization_id = public.current_org() AND public.has_role(auth.uid(),'admin')) WITH CHECK (organization_id = public.current_org());
CREATE POLICY "admins delete workspaces" ON public.workspaces FOR DELETE TO authenticated USING (organization_id = public.current_org() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "members read org profiles" ON public.profiles FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND organization_id = public.current_org());

CREATE POLICY "members read org roles" ON public.user_roles FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "admins update org roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (organization_id = public.current_org());

-- Infrastructure
CREATE TABLE public.clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'kubernetes',
  region text,
  node_count int NOT NULL DEFAULT 0 CHECK (node_count >= 0),
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','warning','degraded')),
  is_simulated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.clusters(organization_id);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES public.clusters(id) ON DELETE SET NULL,
  name text NOT NULL,
  namespace text NOT NULL DEFAULT 'default',
  replicas int NOT NULL DEFAULT 1 CHECK (replicas >= 0),
  ready_replicas int NOT NULL DEFAULT 1 CHECK (ready_replicas >= 0),
  cpu_baseline numeric NOT NULL DEFAULT 45,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','warning','degraded')),
  current_version text,
  previous_version text,
  is_simulated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.services(organization_id);
CREATE INDEX ON public.services(cluster_id);

CREATE TABLE public.infrastructure_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_simulated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.infrastructure_resources(organization_id);

-- Incidents
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  reference text NOT NULL DEFAULT ('INC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  severity text NOT NULL DEFAULT 'sev3' CHECK (severity IN ('sev1','sev2','sev3','sev4')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','awaiting_approval','remediating','monitoring','resolved','closed')),
  source text NOT NULL DEFAULT 'simulation' CHECK (source IN ('simulation','real','manual')),
  assignee_id uuid,
  created_by uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.incidents(organization_id, created_at DESC);
CREATE INDEX ON public.incidents(organization_id, status);

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  description text NOT NULL,
  is_simulated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.security_events(organization_id, created_at DESC);

CREATE TABLE public.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  scenario text NOT NULL CHECK (scenario IN ('cpu_spike')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','detected','no_anomaly','completed')),
  telemetry jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON public.simulation_runs(organization_id, created_at DESC);

CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  engine text NOT NULL DEFAULT 'rule-based-v1',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  root_cause text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  summary text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON public.investigations(incident_id);
CREATE INDEX ON public.investigations(organization_id);

CREATE TABLE public.investigation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('observed','hypothesis')),
  source text NOT NULL,
  title text NOT NULL,
  detail text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.investigation_evidence(investigation_id);

CREATE TABLE public.remediation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  investigation_id uuid REFERENCES public.investigations(id) ON DELETE SET NULL,
  title text NOT NULL,
  action text NOT NULL CHECK (action IN ('scale_out','restart_pods','rollback')),
  risk text NOT NULL DEFAULT 'low' CHECK (risk IN ('low','medium','high')),
  rationale text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','rejected','executing','executed','verified','failed')),
  execution_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification jsonb,
  executed_by uuid,
  executed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.remediation_plans(incident_id);
CREATE INDEX ON public.remediation_plans(organization_id);

CREATE TABLE public.remediation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.remediation_plans(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  decided_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.remediation_approvals(plan_id);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','agent','system')),
  agent text,
  action text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX ON public.audit_logs(incident_id, created_at);

-- Grants
GRANT SELECT ON public.clusters, public.services, public.infrastructure_resources TO authenticated;
GRANT UPDATE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.incidents, public.simulation_runs, public.investigations, public.remediation_plans TO authenticated;
GRANT SELECT, INSERT ON public.security_events, public.investigation_evidence, public.remediation_approvals, public.audit_logs TO authenticated;
GRANT ALL ON public.clusters, public.services, public.infrastructure_resources, public.incidents, public.security_events, public.simulation_runs, public.investigations, public.investigation_evidence, public.remediation_plans, public.remediation_approvals, public.audit_logs TO service_role;

ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read: any member of the org
CREATE POLICY "org read" ON public.clusters FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.services FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.infrastructure_resources FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.incidents FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.security_events FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.simulation_runs FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.investigations FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.investigation_evidence FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.remediation_plans FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.remediation_approvals FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE POLICY "org read" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id = public.current_org());

-- Responders (admin, sre, security_analyst): triage incidents, run investigations, log security events
CREATE POLICY "responders insert" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]));
CREATE POLICY "responders update" ON public.incidents FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org());
CREATE POLICY "responders insert" ON public.security_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]));
CREATE POLICY "responders insert" ON public.investigations FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]));
CREATE POLICY "responders update" ON public.investigations FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org());
CREATE POLICY "responders insert" ON public.investigation_evidence FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]));
CREATE POLICY "responders insert" ON public.remediation_plans FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre','security_analyst']::public.app_role[]));
CREATE POLICY "members insert own audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND (actor_id IS NULL OR actor_id = auth.uid()) AND NOT public.has_role(auth.uid(),'viewer'));

-- Operators (admin, sre): simulations, approvals, execution
CREATE POLICY "operators insert" ON public.simulation_runs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre']::public.app_role[]));
CREATE POLICY "operators update" ON public.simulation_runs FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org());
CREATE POLICY "operators update" ON public.remediation_plans FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org());
CREATE POLICY "operators decide" ON public.remediation_approvals FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org() AND decided_by = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['admin','sre']::public.app_role[]));
CREATE POLICY "operators update" ON public.services FOR UPDATE TO authenticated
  USING (organization_id = public.current_org() AND public.has_any_role(auth.uid(), ARRAY['admin','sre']::public.app_role[]))
  WITH CHECK (organization_id = public.current_org());

-- updated_at triggers
CREATE TRIGGER t_org BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_ws BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_prof BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_svc BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_inc BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_plan BEFORE UPDATE ON public.remediation_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed simulated infrastructure for a new organization
CREATE OR REPLACE FUNCTION public.seed_organization(_org uuid, _ws uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c1 uuid; c2 uuid; s_checkout uuid; s_auth uuid;
BEGIN
  INSERT INTO clusters(organization_id, workspace_id, name, region, node_count, status) VALUES (_org,_ws,'prod-us-east-1','us-east-1',12,'healthy') RETURNING id INTO c1;
  INSERT INTO clusters(organization_id, workspace_id, name, region, node_count, status) VALUES (_org,_ws,'prod-eu-west-1','eu-west-1',8,'healthy') RETURNING id INTO c2;
  INSERT INTO services(organization_id, workspace_id, cluster_id, name, namespace, replicas, ready_replicas, cpu_baseline, current_version, previous_version)
    VALUES (_org,_ws,c1,'api-gateway','edge',6,6,41,'v3.2.0','v3.1.4');
  INSERT INTO services(organization_id, workspace_id, cluster_id, name, namespace, replicas, ready_replicas, cpu_baseline, current_version, previous_version)
    VALUES (_org,_ws,c1,'checkout-svc','commerce',4,4,48,'v2.14.1','v2.14.0') RETURNING id INTO s_checkout;
  INSERT INTO services(organization_id, workspace_id, cluster_id, name, namespace, replicas, ready_replicas, cpu_baseline, current_version, previous_version)
    VALUES (_org,_ws,c1,'payments-svc','commerce',4,4,52,'v5.0.2','v5.0.1');
  INSERT INTO services(organization_id, workspace_id, cluster_id, name, namespace, replicas, ready_replicas, cpu_baseline, current_version, previous_version)
    VALUES (_org,_ws,c2,'auth-svc','identity',3,3,34,'v1.9.0','v1.8.7') RETURNING id INTO s_auth;
  INSERT INTO services(organization_id, workspace_id, cluster_id, name, namespace, replicas, ready_replicas, cpu_baseline, current_version, previous_version)
    VALUES (_org,_ws,c2,'inventory-svc','commerce',2,2,28,'v0.8.3','v0.8.2');
  INSERT INTO infrastructure_resources(organization_id, workspace_id, service_id, kind, name, metadata)
    VALUES (_org,_ws,s_checkout,'deployment','checkout-svc','{"strategy":"RollingUpdate"}'),
           (_org,_ws,s_checkout,'hpa','checkout-svc-hpa','{"min":2,"max":10,"targetCPU":70}'),
           (_org,_ws,NULL,'database','postgres-primary','{"engine":"postgres","version":"16"}');
  INSERT INTO security_events(organization_id, service_id, event_type, severity, description)
    VALUES (_org,s_auth,'brute_force','medium','23 failed logins from 203.0.113.42 in 5 minutes');
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_organization(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- New user: join org by code (viewer) or create own org (admin)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _ws uuid; _code text; _name text; _role public.app_role;
BEGIN
  _code := upper(trim(coalesce(NEW.raw_user_meta_data->>'join_code','')));
  _name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name','')),'');
  IF _code <> '' THEN
    SELECT id INTO _org FROM organizations WHERE join_code = _code;
  END IF;
  IF _org IS NULL THEN
    INSERT INTO organizations(name) VALUES (coalesce(_name, split_part(NEW.email,'@',1)) || '''s organization') RETURNING id INTO _org;
    INSERT INTO workspaces(organization_id, name, environment) VALUES (_org,'Production','production') RETURNING id INTO _ws;
    PERFORM seed_organization(_org, _ws);
    _role := 'admin';
  ELSE
    _role := 'viewer';
  END IF;
  INSERT INTO profiles(id, organization_id, email, display_name) VALUES (NEW.id, _org, NEW.email, _name);
  INSERT INTO user_roles(user_id, organization_id, role) VALUES (NEW.id, _org, _role);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
