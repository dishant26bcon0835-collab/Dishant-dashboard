REVOKE EXECUTE ON FUNCTION public.auto_receive_due_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_receive_due_orders() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;