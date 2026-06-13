import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AltaGuiadaWizardV2 from "./alta/AltaGuiadaWizardV2";
import AltaPickerSheet from "./alta/AltaPickerSheet";
import VinculacionPicker, { type VinculacionSubOpcion } from "./alta/VinculacionPicker";
import VinculacionInmueblePicker from "./alta/VinculacionInmueblePicker";
import VinculacionInquilinoPicker from "./alta/VinculacionInquilinoPicker";
import OtroActivoTipoPicker from "./alta/OtroActivoTipoPicker";
import type { TipoActivo } from "@/lib/altas/types";

export type AltaOrigen =
  | "vivienda"
  | "inquilino"
  | "contrato"
  | "dashboard"
  | "alta_guiada"
  | "panel";

export type AltaTipo = "vivienda" | "inquilino" | "contrato" | "completo";

export interface AltaAlquilerOptions {
  viviendaId?: string | null;
  inquilinoId?: string | null;
  contratoId?: string | null;
  modoInicial?: AltaTipo;
  origen?: AltaOrigen;
  /** Fase 2+3: si "pdf", añade paso inicial de captura OCR multi-archivo. */
  intencion?: "alquiler" | "pdf";
  /** Archivos pre-capturados (PDF/cámara) que se inyectan al CapturaOCRStep. */
  initialFiles?: File[];
  onCreated?: (r: { propertyId?: string; inquilinoId?: string; contratoId?: string }) => void;
}

interface Ctx {
  open: (opts?: AltaAlquilerOptions) => void;
  /** Fase 1: abre el picker unificado de intención (4 tarjetas). */
  openPicker: (opts?: { modoForzado?: "manual" }) => void;
  close: () => void;
  isOpen: boolean;
}

const AltaAlquilerContext = createContext<Ctx | null>(null);

export function AltaAlquilerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<AltaAlquilerOptions>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerModoForzado, setPickerModoForzado] = useState<"manual" | undefined>(undefined);
  const [tipoActivoOpen, setTipoActivoOpen] = useState(false);

  // NIVEL 2 — vinculación.
  const [vincPickerOpen, setVincPickerOpen] = useState(false);
  const [vincInmuebleOpen, setVincInmuebleOpen] = useState(false);
  const [vincInquilinoOpen, setVincInquilinoOpen] = useState(false);
  const [vincSub, setVincSub] = useState<VinculacionSubOpcion | null>(null);
  const [vincPropertyId, setVincPropertyId] = useState<string | null>(null);

  const open = useCallback((o?: AltaAlquilerOptions) => {
    setOpts(o || {});
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const openPicker = useCallback((o?: { modoForzado?: "manual" }) => {
    setPickerModoForzado(o?.modoForzado);
    setPickerOpen(true);
  }, []);

  // Permite que cualquier componente del flujo de alta solicite reabrir el
  // picker (p.ej. "Dar de alta otro inmueble" desde ResumenAltaFinal).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ modoForzado?: "manual" }>).detail;
      setPickerModoForzado(detail?.modoForzado);
      setPickerOpen(true);
    };
    window.addEventListener("cr:open-alta-picker", handler);
    return () => window.removeEventListener("cr:open-alta-picker", handler);
  }, []);

  // ───────────────────── NIVEL 1/2 unificados (AltaPickerSheet) ─────────────────────
  const handleVinculacionDesdePicker = useCallback(() => {
    setVincPickerOpen(true);
  }, []);

  const handleModoDesdePicker = useCallback(
    (
      intencion: "activo" | "alquiler",
      modo: "pdf" | "camera" | "manual",
      files?: File[],
    ) => {
      if (intencion === "alquiler") {
        open({
          origen: "alta_guiada",
          intencion: modo === "manual" ? "alquiler" : "pdf",
          initialFiles: modo === "manual" ? undefined : files,
        });
        return;
      }
      // contexto === "activo"
      if (modo !== "manual") {
        open({
          origen: "alta_guiada",
          intencion: "pdf",
          initialFiles: files,
        });
        return;
      }
      // Manual → preguntar tipo de inmueble (vivienda, garaje, …).
      setTipoActivoOpen(true);
    },
    [open],
  );

  const handleTipoActivo = useCallback((tipo: TipoActivo) => {
    setTipoActivoOpen(false);
    if (tipo === "vivienda") {
      // PropertiesTab escucha este evento y monta el wizard residencial.
      window.dispatchEvent(new CustomEvent("cr:open-alta-vivienda"));
      return;
    }
    window.dispatchEvent(
      new CustomEvent("cr:open-alta-otro-activo", { detail: { tipo } }),
    );
  }, []);

  // ───────────────────── NIVEL 2: vinculación ─────────────────────
  const handleVincSub = useCallback((sub: VinculacionSubOpcion) => {
    setVincPickerOpen(false);
    setVincSub(sub);
    setVincPropertyId(null);
    setVincInmuebleOpen(true);
  }, []);

  const handleVincInmueble = useCallback(
    (propertyId: string) => {
      setVincInmuebleOpen(false);
      setVincPropertyId(propertyId);
      if (vincSub === "inquilino") {
        // Inmueble existente + inquilino nuevo + contrato.
        open({
          viviendaId: propertyId,
          origen: "alta_guiada",
          intencion: "alquiler",
        });
        return;
      }
      // vincSub === "contrato" → pedir inquilino existente.
      setVincInquilinoOpen(true);
    },
    [vincSub, open],
  );

  const handleVincInquilino = useCallback(
    (inquilinoId: string) => {
      setVincInquilinoOpen(false);
      if (!vincPropertyId) return;
      open({
        viviendaId: vincPropertyId,
        inquilinoId,
        origen: "alta_guiada",
        intencion: "alquiler",
      });
    },
    [vincPropertyId, open],
  );

  // Fallback CTAs cuando no hay inmuebles / inquilinos aún.
  const handleAltaInmuebleDesdeVinc = useCallback(() => {
    setVincInmuebleOpen(false);
    setVincInquilinoOpen(false);
    // Reabrimos el picker unificado en el paso 1.
    setPickerOpen(true);
  }, []);

  const handleAltaInquilinoDesdeVinc = useCallback(() => {
    setVincInquilinoOpen(false);
    setVincInmuebleOpen(false);
    // No hay flujo aislado "inquilino sin contrato" — reabrimos el picker.
    setPickerOpen(true);
  }, []);

  const value = useMemo<Ctx>(() => ({ open, openPicker, close, isOpen }), [open, openPicker, close, isOpen]);

  return (
    <AltaAlquilerContext.Provider value={value}>
      {children}
      <AltaGuiadaWizardV2
        open={isOpen}
        onClose={close}
        prefilledPropertyId={opts.viviendaId ?? null}
        prefilledInquilinoId={opts.inquilinoId ?? null}
        intencion={opts.intencion ?? "alquiler"}
        initialFiles={opts.initialFiles}
        onCreated={opts.onCreated}
      />
      <AltaPickerSheet
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) setPickerModoForzado(undefined);
        }}
        modoForzado={pickerModoForzado}
        onSelectVinculacion={handleVinculacionDesdePicker}
        onSelectModo={handleModoDesdePicker}
      />
      <OtroActivoTipoPicker
        open={tipoActivoOpen}
        onOpenChange={setTipoActivoOpen}
        onSelect={handleTipoActivo}
        incluirVivienda
      />
      <VinculacionPicker
        open={vincPickerOpen}
        onOpenChange={setVincPickerOpen}
        onSelect={handleVincSub}
      />
      <VinculacionInmueblePicker
        open={vincInmuebleOpen}
        onOpenChange={setVincInmuebleOpen}
        onSelect={handleVincInmueble}
        onAltaInmueble={handleAltaInmuebleDesdeVinc}
      />
      <VinculacionInquilinoPicker
        open={vincInquilinoOpen}
        onOpenChange={setVincInquilinoOpen}
        propertyIdFiltro={vincPropertyId}
        onSelect={handleVincInquilino}
        onAltaInquilino={handleAltaInquilinoDesdeVinc}
      />
    </AltaAlquilerContext.Provider>
  );
}

export function useAltaAlquiler(): Ctx {
  const ctx = useContext(AltaAlquilerContext);
  if (!ctx) {
    // Safe no-op fallback so call sites don't crash if provider not mounted
    return {
      open: () => console.warn("[AltaAlquiler] Provider not mounted"),
      openPicker: () => console.warn("[AltaAlquiler] Provider not mounted"),
      close: () => {},
      isOpen: false,
    };
  }
  return ctx;
}