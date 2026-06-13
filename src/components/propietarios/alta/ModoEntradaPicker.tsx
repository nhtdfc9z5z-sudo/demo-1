import AltaPickerSheet from "./AltaPickerSheet";

export type ModoEntrada = "pdf" | "manual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated título dinámico ya no se usa (el Sheet calcula el suyo). */
  title?: string;
  /** @deprecated subtítulo dinámico ya no se usa. */
  subtitle?: string;
  onSelect: (modo: ModoEntrada) => void;
}

/**
 * @deprecated Sustituido por `AltaPickerSheet` (paso 2 interno). Se mantiene
 * como wrapper fino para no romper imports/tests legacy. El wrapper abre el
 * Sheet en el paso 1; cuando el usuario completa los dos pasos, traduce la
 * elección al contrato antiguo (`pdf` | `manual`). Será eliminado cuando no
 * existan referencias activas.
 */
const ModoEntradaPicker = ({ open, onOpenChange, onSelect }: Props) => {
  return (
    <AltaPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      onSelectVinculacion={() => {
        // Legacy: la API antigua no contemplaba vinculación; cerramos.
        onOpenChange(false);
      }}
      onSelectModo={(_intencion, modo) => {
        // Mapeo legacy: camera y pdf → "pdf"; manual → "manual".
        onSelect(modo === "manual" ? "manual" : "pdf");
      }}
    />
  );
};

export default ModoEntradaPicker;