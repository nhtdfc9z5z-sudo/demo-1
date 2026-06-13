CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_enlace_recordatorio_uniq
  ON public.notifications (user_id, enlace)
  WHERE enlace LIKE 'recordatorio:%';