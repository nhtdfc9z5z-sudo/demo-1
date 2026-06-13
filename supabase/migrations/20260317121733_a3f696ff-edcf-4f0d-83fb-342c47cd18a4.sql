ALTER TABLE public.profiles ADD COLUMN whatsapp_app text NOT NULL DEFAULT 'whatsapp';
-- Valid values: 'whatsapp' (wa.me) or 'whatsapp_business' (api.whatsapp.com/send)