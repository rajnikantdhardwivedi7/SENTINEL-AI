CREATE TABLE public.monitoring_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'prometheus' CHECK (kind IN ('prometheus')),
  name text NOT NULL DEFAULT 'Prometheus' CHECK (char_length(name) BETWEEN 1 AND 80),
  base_url text NOT NULL CHECK (base_url ~ '^https?://' AND char_length(base_url) <= 500),
  auth_type text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','bearer','basic')),
  has_credential boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  queries jsonb NOT NULL DEFAULT '{}'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_minutes integer NOT NULL DEFAULT 30 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','connected','error')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.monitoring_connections TO authenticated;
GRANT ALL ON public.monitoring_connections TO service_role;
ALTER TABLE public.monitoring_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.monitoring_connections FOR SELECT TO authenticated USING (organization_id = public.current_org());
CREATE TRIGGER t_monconn BEFORE UPDATE ON public.monitoring_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Credentials: no grants to anon/authenticated at all; only server code with the service role can read them.
CREATE TABLE public.monitoring_credentials (
  connection_id uuid PRIMARY KEY REFERENCES public.monitoring_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.monitoring_credentials TO service_role;
ALTER TABLE public.monitoring_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.monitoring_connections(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'real' CHECK (source IN ('real','simulation')),
  ok boolean NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ON public.metric_snapshots(organization_id, captured_at DESC);
GRANT SELECT ON public.metric_snapshots TO authenticated;
GRANT ALL ON public.metric_snapshots TO service_role;
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.metric_snapshots FOR SELECT TO authenticated USING (organization_id = public.current_org());

CREATE TABLE public.alert_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.monitoring_connections(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  rule text NOT NULL,
  last_value double precision,
  last_fired_at timestamptz NOT NULL DEFAULT now(),
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  suppressed_count integer NOT NULL DEFAULT 0,
  UNIQUE (connection_id, fingerprint)
);
GRANT SELECT ON public.alert_states TO authenticated;
GRANT ALL ON public.alert_states TO service_role;
ALTER TABLE public.alert_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.alert_states FOR SELECT TO authenticated USING (organization_id = public.current_org());