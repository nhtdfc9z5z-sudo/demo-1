/**
 * CatastroHelpPanel — Panel de ayuda que se muestra cuando todos los
 * intentos al Catastro se han agotado sin resultados.
 *
 * No muestra error técnico. Ofrece dos vías:
 *   1. 🔍 Abrir la Sede del Catastro en una nueva pestaña.
 *   2. ✏️ Introducir manualmente la referencia catastral.
 *
 * Reglas:
 *  - Se puede cerrar; no vuelve a aparecer hasta un nuevo intento.
 *  - Nunca bloquea guardado, alta ni OCR.
 *  - INE de provincia/municipio NO existe en el modelo: el enlace se abre
 *    sin parámetros INE (best-effort).
 */
import { Button } from "@/components/ui/button";
import { ExternalLink, Pencil, X } from "lucide-react";
import { CATASTRO_SEDE_URL } from "@/lib/catastro/prepararConsulta";

interface Props {
  /** Acción al pulsar "Introducir manualmente": focus en input refCatastral. */
  onManual?: () => void;
  /** Cerrar el panel. */
  onClose?: () => void;
}

export default function CatastroHelpPanel({ onManual, onClose }: Props) {
  return (
    <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-3 space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            No hemos podido obtener la referencia catastral
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Puedes encontrarla en:
          </p>
          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <li>📄 Tu recibo del IBI</li>
            <li>📋 El contrato de arrendamiento</li>
            <li>📜 Las escrituras o nota simple</li>
          </ul>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-2"
          asChild
        >
          <a href={CATASTRO_SEDE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Buscar en la Sede del Catastro
          </a>
        </Button>
        {onManual && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onManual}
          >
            <Pencil className="h-4 w-4" />
            Introducir manualmente
          </Button>
        )}
      </div>
    </div>
  );
}