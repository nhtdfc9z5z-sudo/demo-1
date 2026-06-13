
DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "Insert own or system notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
