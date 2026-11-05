REVOKE ALL ON public.monitoring_credentials FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.monitoring_connections, public.metric_snapshots, public.alert_states FROM anon, authenticated;
REVOKE ALL ON public.monitoring_connections, public.metric_snapshots, public.alert_states FROM anon;