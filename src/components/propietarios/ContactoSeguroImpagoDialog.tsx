import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Mail, MessageCircle, Copy, Check, Phone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { buildWhatsAppUrl } from "@/lib/whatsappUtils";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";
import { resolveRentaEsperada } from "@/lib/rentaUtils";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface SeguroImpago {
  id: string;
  compania: string | null;
  num_poliza: string | null;
  telefono: string | null;
  email: string | null;
  observaciones: string | null;
  tomador: string | null;
}

interface ContactoSeguroImpagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos?: Contrato[];
  anio: number;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContactoSeguroImpagoDialog({
  open, onOpenChange, property, inquilinos, pagos, contratos, anio,
}: ContactoSeguroImpagoDialogProps) {
  const { profile } = useProfile();
  const { toast } = useToast();
  const [seguro, setSeguro] = useState<SeguroImpago | null>(null);
  const [loadingSeguro, setLoadingSeguro] = useState(false);
  const [copied, setCopied] = useState(false);

  const mainInquilino = inquilinos.find(
    i => i.property_id === property.id && i.rol_inquilino !== "avalista"
  );

  // Fetch seguro de impago from the new seguros_impago table
  // Look for one linked to this property or to the inquilino
  useEffect(() => {
    if (!open || !property.id) return;
    setLoadingSeguro(true);

    const fetchSeguro = async () => {
      // Try by property_id first
      let { data } = await supabase
        .from("seguros_impago" as any)
        .select("id, compania, num_poliza, telefono, email, observaciones, tomador")
        .eq("property_id", property.id)
        .eq("estado", "activo")
        .limit(1)
        .maybeSingle();

      // If not found by property, try via inquilino link
      if (!data && mainInquilino) {
        const { data: links } = await supabase
          .from("seguro_impago_inquilinos" as any)
          .select("seguro_impago_id")
          .eq("inquilino_id", mainInquilino.id);

        if (links && links.length > 0) {
          const seguroIds = (links as any[]).map(l => l.seguro_impago_id);
          const { data: seguroData } = await supabase
            .from("seguros_impago" as any)
            .select("id, compania, num_poliza, telefono, email, observaciones, tomador")
            .in("id", seguroIds)
            .eq("estado", "activo")
            .limit(1)
            .maybeSingle();
          data = seguroData as any;
          data = seguroData;
        }
      }

      setSeguro((data as any) as SeguroImpago | null);
      setLoadingSeguro(false);
    };

    fetchSeguro();
  }, [open, property.id, mainInquilino?.id]);

  // Find unpaid months
  const mesesImpagos = useMemo(() => {
    const now = new Date();
    const currentAbsMonth = now.getFullYear() * 12 + now.getMonth();
    const result: { mes: number; anio: number }[] = [];

    for (let a = anio - 1; a <= anio; a++) {
      for (let m = 0; m < 12; m++) {
        const absMonth = a * 12 + m;
        if (absMonth > currentAbsMonth) continue;

        if (mainInquilino) {
          const entrada = mainInquilino.fecha_entrada ? new Date(mainInquilino.fecha_entrada) : null;
          if (entrada && absMonth < entrada.getFullYear() * 12 + entrada.getMonth()) continue;
          const salida = mainInquilino.fecha_salida ? new Date(mainInquilino.fecha_salida) : null;
          if (salida && absMonth > salida.getFullYear() * 12 + salida.getMonth()) continue;
        }

        const hasPago = pagos.some(
          p => p.property_id === property.id && p.mes === m + 1 && p.anio === a && p.propietario_confirmado
        );
        if (!hasPago) {
          result.push({ mes: m, anio: a });
        }
      }
    }
    return result;
  }, [pagos, property.id, anio, mainInquilino]);

  const rentaEsperada = resolveRentaEsperada(property.id, inquilinos, contratos || []) ?? 0;
  const totalDeuda = mesesImpagos.length * rentaEsperada;

  const ownerName = [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "El propietario";
  const tenantName = mainInquilino
    ? [mainInquilino.nombre, mainInquilino.apellidos].filter(Boolean).join(" ")
    : "El inquilino";

  const generatedText = useMemo(() => {
    const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    const mesesList = mesesImpagos.map(m => `${MESES[m.mes]} ${m.anio}`).join(", ");

    return `Estimados Sres. de ${seguro?.compania || "[Compañía aseguradora]"},

Me dirijo a ustedes en calidad de propietario/a del inmueble sito en ${property.direccion_completa || "[dirección del inmueble]"}, para comunicarles la existencia de impagos de renta por parte del inquilino.

DATOS DEL SINIESTRO:
• Nº Póliza: ${seguro?.num_poliza || "[nº póliza]"}
• Tomador: ${ownerName}
• NIF del propietario: ${profile?.nif || "[NIF]"}
• Dirección del inmueble: ${property.direccion_completa || "[dirección]"}

DATOS DEL INQUILINO:
• Nombre: ${tenantName}
• DNI: ${mainInquilino?.dni || "[DNI]"}
• Teléfono: ${mainInquilino?.telefono || "[teléfono]"}
• Email: ${mainInquilino?.email || "[email]"}

DETALLE DE IMPAGOS:
• Renta mensual pactada: ${rentaEsperada ? formatImporte(rentaEsperada) + "€" : "[importe]"}
• Meses impagados: ${mesesList || "Ninguno"}
• Número de mensualidades impagadas: ${mesesImpagos.length}
• Deuda total acumulada: ${totalDeuda ? formatImporte(totalDeuda) + "€" : "[importe total]"}

Por todo lo anterior, solicito la activación de la cobertura de impago de alquiler conforme a las condiciones de mi póliza.

Quedo a su disposición para cualquier documentación adicional que requieran.

Atentamente,
${ownerName}
${profile?.telefono || ""}
${profile?.email || ""}

Fecha: ${today}`;
  }, [seguro, property, mainInquilino, mesesImpagos, rentaEsperada, totalDeuda, ownerName, tenantName, profile]);

  const [editableText, setEditableText] = useState("");

  useEffect(() => {
    if (open) setEditableText(generatedText);
  }, [open, generatedText]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableText);
    setCopied(true);
    toast({ title: "Texto copiado al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Comunicación de impago - Póliza ${seguro?.num_poliza || ""}`);
    const body = encodeURIComponent(editableText);
    window.open(`mailto:${seguro?.email || ""}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleWhatsApp = () => {
    const url = buildWhatsAppUrl(seguro?.telefono, editableText);
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            Contactar seguro de impago
          </DialogTitle>
          <DialogDescription>
            {property.nombre_interno} — {tenantName}
          </DialogDescription>
        </DialogHeader>

        {loadingSeguro ? (
          <p className="text-sm text-muted-foreground py-4">Cargando datos del seguro...</p>
        ) : !seguro ? (
          <div className="py-6 text-center space-y-2">
            <ShieldCheck size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No se encontró un seguro de impago activo para este inquilino o vivienda.</p>
            <p className="text-xs text-muted-foreground">Puedes añadir uno desde Documentación → Seguros de impago.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 size={14} className="text-muted-foreground" />
                  {seguro.compania || "Aseguradora"}
                </h3>
                <Badge variant="outline" className="text-[10px]">Póliza: {seguro.num_poliza || "—"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {seguro.telefono && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} className="text-muted-foreground" />
                    <a href={`tel:${seguro.telefono}`} className="text-primary hover:underline">{seguro.telefono}</a>
                  </div>
                )}
                {seguro.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} className="text-muted-foreground" />
                    <a href={`mailto:${seguro.email}`} className="text-primary hover:underline">{seguro.email}</a>
                  </div>
                )}
              </div>
              {seguro.observaciones && (
                <p className="text-[11px] text-muted-foreground italic">{seguro.observaciones}</p>
              )}
            </div>

            <div className="flex items-center justify-between bg-destructive/10 rounded-xl p-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Meses impagados: </span>
                <span className="font-bold text-destructive">{mesesImpagos.length}</span>
              </div>
              {totalDeuda > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Deuda total: </span>
                  <span className="font-bold text-destructive">{formatImporte(totalDeuda)}€</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Escrito generado (editable)</h4>
              <Textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                rows={16}
                className="text-xs font-mono leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
              {seguro.email && (
                <Button size="sm" className="gap-1.5" onClick={handleEmail}>
                  <Mail size={14} />
                  Enviar por email
                </Button>
              )}
              {seguro.telefono && (
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleWhatsApp}>
                  <MessageCircle size={14} />
                  Enviar por WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
