import AltaPickerSheet from "./AltaPickerSheet";

/**
 * Intenciones de alta.
 *
 * Las 3 primeras (`activo`, `alquiler`, `vinculacion`) son las que se
 * muestran al usuario en el picker principal. `pdf` y `otro-activo`
 * permanecen como valores legacy usados internamente por algunos
 * sub-flujos (PDF/foto = modo de entrada, no intención propia; y
 * `otro-activo` lo conservan `ActivoSimpleWizard`/`ResumenAltaFinal`
 * para sus mapas de textos).
 */
export type AltaIntencion =
  | "activo"
  | "alquiler"
  | "vinculacion"
  | "pdf"
  | "otro-activo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (intencion: "activo" | "alquiler" | "vinculacion") => void;
}

/**
 * @deprecated Usa `AltaPickerSheet` directamente. Este componente queda como
 * wrapper fino para no romper imports/tests legacy. Será eliminado cuando no
 * existan referencias activas.
 *
 * Internamente delega en `AltaPickerSheet`. El `onSelect` original sólo
 * recibía la intención del paso 1 — aquí se invoca igual cuando el usuario
 * elige una intención, dejando que el contenedor decida cómo continuar.
 */
const AltaIntencionPicker = ({ open, onOpenChange, onSelect }: Props) => {
  return (
    <AltaPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      onSelectVinculacion={() => onSelect("vinculacion")}
      onSelectModo={(intencion) => onSelect(intencion)}
    />
  );
};

export default AltaIntencionPicker;