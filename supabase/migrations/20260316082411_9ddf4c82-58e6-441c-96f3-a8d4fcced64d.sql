-- Allow property owners to insert notifications for their tenants (contract change notifications)
-- First drop the existing insert policy to replace it with a broader one
DROP POLICY IF EXISTS "Insert own or system notifications" ON public.notifications;

CREATE POLICY "Insert own or tenant notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR user_id IN (
    SELECT auth_user_id FROM public.inquilinos
    WHERE inquilinos.user_id = auth.uid()
    AND auth_user_id IS NOT NULL
  )
);