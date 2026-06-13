import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Megaphone, Copy, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { Property } from "@/hooks/useProperties";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  properties: Property[];
  onBack: () => void;
}

const PORTALES = [
  { value: "idealista", label: "Idealista", color: "bg-green-500/10 text-green-700 border-green-500/30" },
  { value: "fotocasa", label: "Fotocasa", color: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  { value: "milanuncios", label: "Milanuncios", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  { value: "wallapop", label: "Wallapop", color: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  { value: "pisos_com", label: "Pisos.com", color: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  { value: "generico", label: "Genérico (copiable)", color: "bg-muted text-foreground border-border" },
];

interface AnuncioResult {
  titulo: string;
  descripcion: string;
  caracteristicas_destacadas: string[];
}

const GeneradorAnuncio = ({ properties, onBack }: Props) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedPortal, setSelectedPortal] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnuncioResult | null>(null);
  const [editedTitulo, setEditedTitulo] = useState("");
  const [editedDescripcion, setEditedDescripcion] = useState("");
  const { toast } = useToast();

  const property = properties.find(p => p.id === selectedPropertyId);

  const handleGenerate = async () => {
    if (!property || !selectedPortal) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-anuncio", {
        body: { property, portal: selectedPortal },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error generando anuncio");

      setResult(data.data);
      setEditedTitulo(data.data.titulo);
      setEditedDescripcion(data.data.descripcion);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo generar el anuncio", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    const text = `${editedTitulo}\n\n${editedDescripcion}${result?.caracteristicas_destacadas?.length ? "\n\n" + result.caracteristicas_destacadas.map(c => `• ${c}`).join("\n") : ""}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Anuncio copiado al portapapeles" });
  };

  const portalInfo = PORTALES.find(p => p.value === selectedPortal);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a documentación
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Megaphone size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Generador de anuncios</h2>
          <p className="text-xs text-muted-foreground">Crea anuncios optimizados para cada portal de alquiler con IA</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Vivienda</label>
          <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setResult(null); }}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Elige un inmueble..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Portal</label>
          <Select value={selectedPortal} onValueChange={(v) => { setSelectedPortal(v); setResult(null); }}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Elige un portal..." />
            </SelectTrigger>
            <SelectContent>
              {PORTALES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Portal chips */}
      {selectedPropertyId && (
        <div className="flex flex-wrap gap-2 mb-6">
          {PORTALES.map(p => (
            <button
              key={p.value}
              onClick={() => { setSelectedPortal(p.value); setResult(null); }}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                selectedPortal === p.value ? p.color + " ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Generate button */}
      {selectedPropertyId && selectedPortal && !result && (
        <Button
          className="w-full h-12 text-base font-semibold rounded-xl gap-2"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generando anuncio...</>
          ) : (
            <><Sparkles size={18} /> Generar anuncio para {portalInfo?.label}</>
          )}
        </Button>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className={cn("rounded-xl border p-4", portalInfo?.color || "border-border bg-card")}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase">{portalInfo?.label}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyAll}>
                  <Copy size={12} /> Copiar todo
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleGenerate} disabled={loading}>
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Regenerar
                </Button>
              </div>
            </div>

            {/* Editable title */}
            <div className="mb-3">
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Título</label>
              <input
                className="w-full text-lg font-bold text-foreground bg-transparent border-b border-dashed border-border pb-1 focus:outline-none focus:border-primary"
                value={editedTitulo}
                onChange={e => setEditedTitulo(e.target.value)}
              />
            </div>

            {/* Editable description */}
            <div className="mb-3">
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Descripción</label>
              <Textarea
                className="bg-transparent border-dashed min-h-[120px] text-sm text-foreground"
                value={editedDescripcion}
                onChange={e => setEditedDescripcion(e.target.value)}
              />
            </div>

            {/* Highlights */}
            {result.caracteristicas_destacadas?.length > 0 && (
              <div>
                <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider">Características destacadas</label>
                <ul className="space-y-1">
                  {result.caracteristicas_destacadas.map((c, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Quick copy buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs gap-1.5 flex-1"
              onClick={() => {
                navigator.clipboard.writeText(editedTitulo);
                toast({ title: "Título copiado" });
              }}
            >
              <Copy size={12} /> Copiar título
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs gap-1.5 flex-1"
              onClick={() => {
                navigator.clipboard.writeText(editedDescripcion);
                toast({ title: "Descripción copiada" });
              }}
            >
              <Copy size={12} /> Copiar descripción
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneradorAnuncio;
