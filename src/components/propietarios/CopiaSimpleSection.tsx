import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, FileText, Copy, MapPin, Building2, AlertCircle } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import { useToast } from "@/hooks/use-toast";

interface Props {
  properties: Property[];
  onBack: () => void;
}

const CopiaSimpleSection = ({ properties, onBack }: Props) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { toast } = useToast();

  const property = properties.find(p => p.id === selectedPropertyId);
  const hasRefCatastral = !!property?.referencia_catastral;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  const registradoresUrl = "https://www.registradores.org/registrosonline/nota-simple";

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a documentación
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Copia Simple / Nota Simple</h2>
          <p className="text-xs text-muted-foreground">Solicita la nota simple de tu propiedad al Registro de la Propiedad</p>
        </div>
      </div>

      {/* Property selector */}
      <div className="mb-6">
        <label className="text-xs text-muted-foreground mb-1.5 block">Selecciona un activo</label>
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Elige un activo..." />
          </SelectTrigger>
          <SelectContent>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {property && (
        <div className="space-y-4">
          {/* Property info card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              Datos de la propiedad
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoItem label="Dirección" value={property.direccion_completa} />
              <InfoItem label="Ciudad" value={[property.ciudad, property.provincia].filter(Boolean).join(", ")} />
              <InfoItem label="Código Postal" value={property.codigo_postal} />
              <InfoItem label="Tipo" value={property.tipo_vivienda} />
              <InfoItem label="Superficie" value={property.superficie_m2 ? `${property.superficie_m2} m²` : null} />
              <div className="sm:col-span-2">
                <InfoItem
                  label="Referencia Catastral"
                  value={property.referencia_catastral}
                  mono
                  copyable
                  onCopy={() => property.referencia_catastral && copyToClipboard(property.referencia_catastral, "Ref. catastral")}
                />
              </div>
            </div>
          </div>

          {!hasRefCatastral && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">Referencia catastral no disponible</p>
                <p className="text-xs text-amber-600/80 mt-0.5">
                  Edita el activo y añade la referencia catastral para poder solicitar la nota simple online.
                  También puedes buscarla en la <a href="https://www1.sedecatastro.gob.es/Accesos/SECAcceso.aspx" target="_blank" rel="noopener noreferrer" className="underline font-medium">Sede Electrónica del Catastro</a>.
                </p>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Cómo solicitar la Nota Simple</h3>

            <div className="space-y-3">
              <Step number={1} title="Accede al Registro Online">
                <p className="text-xs text-muted-foreground">
                  Entra en la web oficial de Registradores de España para solicitar la nota simple.
                </p>
              </Step>

              <Step number={2} title="Identifica la finca">
                <p className="text-xs text-muted-foreground">
                  Usa la referencia catastral o la dirección de tu propiedad para localizar la finca.
                  {hasRefCatastral && (
                    <button
                      className="ml-1 text-primary font-medium hover:underline inline-flex items-center gap-0.5"
                      onClick={() => copyToClipboard(property.referencia_catastral!, "Ref. catastral")}
                    >
                      <Copy size={10} /> Copiar ref. catastral
                    </button>
                  )}
                </p>
              </Step>

              <Step number={3} title="Realiza el pago y descarga">
                <p className="text-xs text-muted-foreground">
                  La nota simple tiene un coste de ~9,02€ y se obtiene de forma inmediata en formato PDF.
                </p>
              </Step>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            className="w-full h-12 text-base font-semibold rounded-xl gap-2"
            onClick={() => window.open(registradoresUrl, "_blank")}
          >
            <ExternalLink size={18} />
            Solicitar Nota Simple en Registradores.org
          </Button>

          {/* Additional links */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs gap-1.5"
              onClick={() => window.open("https://www1.sedecatastro.gob.es/Accesos/SECAcceso.aspx", "_blank")}
            >
              <MapPin size={12} /> Catastro online
            </Button>
            {hasRefCatastral && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs gap-1.5"
                onClick={() => window.open(`https://www1.sedecatastro.gob.es/CYCBienInmworble/OVCConCiworble.aspx?RefC=${property.referencia_catastral}`, "_blank")}
              >
                <FileText size={12} /> Ver datos catastrales
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoItem = ({ label, value, mono, copyable, onCopy }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
}) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      <p className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      {copyable && value && onCopy && (
        <button onClick={onCopy} className="text-muted-foreground hover:text-primary transition-colors">
          <Copy size={12} />
        </button>
      )}
    </div>
  </div>
);

const Step = ({ number, title, children }: { number: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
      {number}
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children}
    </div>
  </div>
);

export default CopiaSimpleSection;
