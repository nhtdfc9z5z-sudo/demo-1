import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, UserPlus, ArrowRight } from "lucide-react";
import type { Property } from "@/hooks/useProperties";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
  onAddInquilinoYContrato: (property: Property) => void;
  onIrAFicha: (property: Property) => void;
}

/**
 * Pantalla de éxito tras crear un activo desde PropertyCreateWizard.
 * Solo se muestra en modo CREAR (no en edición). Permite encadenar con el
 * AltaGuiadaWizardV2 reutilizando el activo recién creado.
 */
export default function PropertyCreatedSuccessSheet({
  open,
  onOpenChange,
  property,
  onAddInquilinoYContrato,
  onIrAFicha,
}: Props) {
  if (!property) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <SheetTitle className="text-xl">Inmueble creado correctamente</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {property.nombre_interno || "Activo"}
            </span>{" "}
            ya está en tu patrimonio. ¿Qué quieres hacer ahora?
          </p>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full justify-start gap-3 h-auto py-4 rounded-xl"
            onClick={() => onAddInquilinoYContrato(property)}
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            <div className="text-left flex-1">
              <div className="font-semibold text-base">+ Añadir inquilino y contrato</div>
              <div className="text-xs opacity-90 font-normal">
                Continuar con el alta de alquiler para este activo
              </div>
            </div>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-4 rounded-xl"
            onClick={() => onIrAFicha(property)}
          >
            <ArrowRight className="h-5 w-5 shrink-0" />
            <div className="text-left flex-1">
              <div className="font-semibold text-base">Ir a la ficha del activo</div>
              <div className="text-xs opacity-70 font-normal">
                Completar datos catastrales, fotos, documentos…
              </div>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}