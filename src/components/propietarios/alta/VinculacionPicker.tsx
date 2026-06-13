import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserPlus, FileSignature } from "lucide-react";

export type VinculacionSubOpcion = "inquilino" | "contrato";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sub: VinculacionSubOpcion) => void;
}

/**
 * VinculacionPicker — NIVEL 2 para la intención `vinculacion`.
 *
 *  - "inquilino": inmueble existente + inquilino nuevo + contrato.
 *  - "contrato" : inmueble e inquilino existentes + contrato.
 */
const VinculacionPicker = ({ open, onOpenChange, onSelect }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-semibold text-foreground">¿Qué quieres vincular?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sobre un inmueble que ya tienes dado de alta.
          </p>
        </div>

        <div className="p-4 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => onSelect("inquilino")}
            className="group text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[96px] flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
              <UserPlus size={22} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-semibold text-foreground">
                Añadir inquilino a un inmueble existente
              </span>
              <span className="text-sm text-foreground/80">
                Eliges el inmueble, das de alta un inquilino nuevo y creas el contrato.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelect("contrato")}
            className="group text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[96px] flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
              <FileSignature size={22} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-semibold text-foreground">
                Añadir contrato a inmueble e inquilino existentes
              </span>
              <span className="text-sm text-foreground/80">
                Eliges ambos y solo creas el contrato encima.
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VinculacionPicker;