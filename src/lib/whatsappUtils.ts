export type WhatsAppApp = "whatsapp" | "whatsapp_business";

const STORAGE_KEY = "capitalrent_whatsapp_app";

/** Save user preference (called from profile sync) */
export function setWhatsAppPreference(app: WhatsAppApp) {
  localStorage.setItem(STORAGE_KEY, app);
}

/** Get current preference */
export function getWhatsAppPreference(): WhatsAppApp {
  return (localStorage.getItem(STORAGE_KEY) as WhatsAppApp) || "whatsapp";
}

/**
 * Generates a WhatsApp URL based on user preference (WhatsApp or WhatsApp Business).
 * 
 * @param phone - Phone number (optional, will be cleaned)
 * @param text - Message text (optional)
 */
export function buildWhatsAppUrl(
  phone?: string | null,
  text?: string | null,
): string {
  const app = getWhatsAppPreference();
  const cleanPhone = phone?.replace(/\s+/g, "").replace(/^\+/, "") || "";
  const encodedText = text ? encodeURIComponent(text.substring(0, 4000)) : "";

  if (app === "whatsapp_business") {
    const params = new URLSearchParams();
    if (cleanPhone) params.set("phone", cleanPhone);
    if (encodedText) params.set("text", decodeURIComponent(encodedText));
    return `https://api.whatsapp.com/send?${params.toString()}`;
  }

  // Default: regular WhatsApp (wa.me)
  if (cleanPhone && encodedText) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}`;
  }
  if (encodedText) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/`;
}
