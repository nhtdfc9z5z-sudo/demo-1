import { useCallback, useMemo, useState, useEffect } from "react";
import type { Property } from "@/hooks/useProperties";
import type { Contrato } from "@/hooks/useContratos";
import type { Inquilino } from "@/hooks/useInquilinos";
import {
  seleccionarMensaje,
  type MensajeInteligente,
} from "@/lib/progresoInteligente/seleccionMensaje";
import {
  readState,
  markShown,
  markDismissed,
  markActionTaken,
  puedeMostrar,
} from "@/lib/progresoInteligente/storage";

interface Args {
  properties: Property[];
  contratos: Contrato[];
  inquilinos: Inquilino[];
  /** Opcional: override de "ahora" para tests. */
  now?: Date;
}

interface ProgresoApi {
  mensaje: MensajeInteligente | null;
  visible: boolean;
  cerrar: () => void;
  ejecutarAccion: () => void;
}

/**
 * Decide qué mensaje (si alguno) mostrar como banner inteligente.
 * No hace fetches — consume los datos ya cargados por la página.
 * No depende de Supabase directamente.
 */
export function useProgresoInteligente({
  properties,
  contratos,
  inquilinos,
  now,
}: Args): ProgresoApi {
  const ahora = now ?? new Date();

  const mensaje = useMemo(
    () => seleccionarMensaje({ properties, contratos, inquilinos, now: ahora }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [properties, contratos, inquilinos, ahora.toDateString()]
  );

  const [visible, setVisible] = useState(false);
  const [dismissedThisRender, setDismissedThisRender] = useState(false);

  useEffect(() => {
    if (!mensaje) {
      setVisible(false);
      return;
    }
    if (dismissedThisRender) return;
    const state = readState();
    if (!puedeMostrar(state, ahora)) {
      setVisible(false);
      return;
    }
    // Solo marcamos como "mostrado hoy" la primera vez.
    const yaMostradoHoy =
      state.lastShownAt &&
      new Date(state.lastShownAt).toDateString() === ahora.toDateString() &&
      state.lastMessageId === mensaje.id;
    if (!yaMostradoHoy) {
      markShown(mensaje.id, ahora);
    }
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensaje?.id, dismissedThisRender]);

  const cerrar = useCallback(() => {
    markDismissed(new Date());
    setVisible(false);
    setDismissedThisRender(true);
  }, []);

  const ejecutarAccion = useCallback(() => {
    markActionTaken(new Date());
    setVisible(false);
    setDismissedThisRender(true);
  }, []);

  return { mensaje, visible, cerrar, ejecutarAccion };
}