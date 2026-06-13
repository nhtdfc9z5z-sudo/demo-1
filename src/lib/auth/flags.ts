/**
 * Feature flags ligados al plan del usuario.
 *
 * Por ahora todos los usuarios son premium. Más adelante esto se conectará
 * al pricing real (Stripe / tabla `subscriptions`).
 */
import type { User } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isPremium = (_user: User | null): boolean => true;