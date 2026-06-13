import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  guardarComunicacion,
  type ComunicacionCanal,
  type ComunicacionContexto,
} from "@/lib/comunicaciones/guardarComunicacion";
import { Mail, MessageCircle, FileText, Send, RefreshCw, Copy, Save, Info, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  contexto: ComunicacionContexto;
  contrato?: any | null;
  inmueble?: any | null;
  inquilino?: any | null;
  propietario?: any | null;
  /** Datos específicos del contexto (ej. renta_actual, nueva_renta, porcentaje, prorroga_anos…). */
  datos?: Record<string, any>;
  defaultCanal?: ComunicacionCanal;
}

const CANALES: { id: ComunicacionCanal; label: string; icon: typeof FileText }[] = [
  { id: "carta", label: "Carta formal", icon: FileText },
  { id: "burofax", label: "Burofax", icon: Send },
  { id: "email", label: "Email", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const CTX_TITLE: Record<ComunicacionContexto, string> = {
  revision_renta: "Comunicación: revisión de renta",
  renovacion: "Comunicación: renovación",
  no_renovacion: "Comunicación: no renovación",
  generico: "Comunicación al inquilino",
};

export default function ComunicacionLegalSheet({
  open,
  onClose,
  contexto,
  contrato,
  inmueble,
  inquilino,
  propietario,
  datos,
  defaultCanal = "carta",
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [canal, setCanal] = useState<ComunicacionCanal>(defaultCanal);
  const [instrucciones, setInstrucciones] = useState("");
  const [texto, setTexto] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCanal(defaultCanal);
      setTexto("");
      setInstrucciones("");
    }
  }, [open, defaultCanal]);

  const generar = async () => {
    setGenerating(true);
    try {
      const body: any = {
        contexto,
        tipo_comunicacion: canal,
        contrato,
        inmueble,
        inquilino,
        instrucciones_adicionales: instrucciones || undefined,
        datos: {
          ...(datos || {}),
          propietario,
        },
      };
      const { data, error } = await supabase.functions.invoke("generate-comunicacion-contrato", { body });
      if (error) throw error;
      setTexto((data as any)?.texto || "");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "No se pudo generar el texto.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: "Texto copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const guardar = async () => {
    if (!user) return;
    if (!texto.trim()) {
      toast({ title: "No hay texto", description: "Genera o escribe el contenido antes de guardar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await guardarComunicacion({
        userId: user.id,
        contratoId: contrato?.id || null,
        propertyId: contrato?.property_id || inmueble?.id || null,
        canal,
        contexto,
        texto,
      });
      qc.invalidateQueries({ queryKey: ["documentos"] });
      toast({ title: "Guardado en documentos del contrato" });
      onClose();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{CTX_TITLE[contexto]}</SheetTitle>
          <SheetDescription>{contrato?.titulo || inmueble?.nombre_interno || "Contrato"}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {/* Canal */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Formato</Label>
            <div className="grid grid-cols-2 gap-2">
              {CANALES.map((c) => {
                const Icon = c.icon;
                const active = canal === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCanal(c.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors min-h-[44px] ${
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Icon size={16} className={active ? "text-primary" : "text-muted-foreground"} />
                    <span className="font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instrucciones opcionales */}
          <div className="space-y-2">
            <Label htmlFor="instr" className="text-xs uppercase tracking-wide text-muted-foreground">
              Instrucciones adicionales (opcional)
            </Label>
            <Textarea
              id="instr"
              rows={2}
              placeholder="Ej. mencionar la disponibilidad para una visita previa, tono especialmente cordial…"
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
            />
          </div>

          {/* Generar */}
          <Button onClick={generar} disabled={generating} className="w-full gap-2">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {texto ? "Regenerar" : "Generar con IA"}
          </Button>

          {/* Texto editable */}
          <div className="space-y-2">
            <Label htmlFor="texto" className="text-xs uppercase tracking-wide text-muted-foreground">
              Texto (editable)
            </Label>
            <Textarea
              id="texto"
              rows={14}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pulsa 'Generar con IA' o escribe aquí tu propio texto."
              className="font-mono text-xs"
            />
          </div>

          {/* Aviso legal */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
            <Info size={14} className="text-amber-700 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
              Revisa siempre el contenido antes de enviarlo. Esta comunicación es una propuesta generada por IA y no constituye asesoramiento jurídico.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={copiar} disabled={!texto} className="gap-2">
              <Copy size={14} /> Copiar texto
            </Button>
            <Button onClick={guardar} disabled={saving || !texto} className="gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar en documentos
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}