import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}

/**
 * Banner reutilizable para cambiar de "intención" en mitad del alta.
 * Ej.: en el paso OCR, ofrecer "Continuar manualmente" si la lectura
 * automática no es suficiente.
 */
export default function TrasvaseIntencionBanner({ title, description, ctaLabel, onCta }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onCta}>
        {ctaLabel} <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );
}