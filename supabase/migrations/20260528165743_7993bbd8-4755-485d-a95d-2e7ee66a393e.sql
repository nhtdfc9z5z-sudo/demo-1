-- H2.4: Revocar EXECUTE público en funciones SECURITY DEFINER que son triggers
-- o helpers DB-only. Los triggers se ejecutan con privilegios del owner de la
-- tabla, no del invocador, así que revocar EXECUTE no afecta a su disparo.
-- Mantenemos has_role (usada por políticas RLS) y link_tenant_auth (RPC del
-- portal inquilino, restringida a authenticated).

-- Triggers de notificaciones
REVOKE EXECUTE ON FUNCTION public.notify_nueva_incidencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vencimiento_contrato() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_pago_notificado() FROM PUBLIC, anon, authenticated;

-- Trigger de asignación de owner
REVOKE EXECUTE ON FUNCTION public.set_incidencia_owner_from_property() FROM PUBLIC, anon, authenticated;

-- Trigger de creación de perfil al registrar usuario
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helpers DB-only (triggers utilitarios)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_numero_incidencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_proveedor_valoracion() FROM PUBLIC, anon, authenticated;

-- has_role: SE MANTIENE EXECUTE (la usan las políticas RLS)
-- link_tenant_auth: restringir a authenticated (portal inquilino)
REVOKE EXECUTE ON FUNCTION public.link_tenant_auth(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_tenant_auth(text) TO authenticated;