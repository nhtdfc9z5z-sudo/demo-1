import { useState, useEffect } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsappUtils";
import { Copy, Send, Link2, Briefcase, Building2, Check, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface InvitarDesdeViviendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  inquilinos: Inquilino[];
  preselectedInquilino?: Inquilino | null;
}

const ROLES = [
  {
    key: "inquilino" as const,
    label: "Inquilino",
    icon: UserPlus,
    description: "Accede a su vivienda, contrato, incidencias y calendario. Puede reportar incidencias y confirmar pagos.",
    enabled: true,
  },
  {
    key: "gestor" as const,
    label: "Gestor fiscal",
    icon: Briefcase,
    description: "Accede a ingresos, gastos, documentos fiscales e informes de la cartera.",
    enabled: false,
  },
  {
    key: "comunidad" as const,
    label: "Administración de fincas",
    icon: Building2,
    description: "Gestiona incidencias, avisos de comunidad, revisiones y mantenimientos del edificio.",
    enabled: false,
  },
];

const InvitarDesdeViviendaDialog = ({ open, onOpenChange, property, inquilinos, preselectedInquilino }: InvitarDesdeViviendaDialogProps) => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-select inquilino role when preselected
  useEffect(() => {
    if (open && preselectedInquilino) {
      setSelectedRole("inquilino");
    }
    if (!open) {
      setSelectedRole(null);
      setCopied(false);
    }
  }, [open, preselectedInquilino]);

  const propertyInquilinos = inquilinos.filter(
    (i) => i.property_id === property.id && i.rol_inquilino !== "avalista"
  );

  const baseUrl = window.location.origin;

  const handleCopy = (inq?: Inquilino) => {
    const emailParam = inq?.email ? `&email=${encodeURIComponent(inq.email)}` : "";
    const link = `${baseUrl}/login?role=inquilino${emailParam}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "Enlace copiado", description: "Compártelo con tu inquilino para que cree su cuenta." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = (inq?: Inquilino) => {
    const name = inq ? inq.nombre : "inquilino";
    const emailParam = inq?.email ? `&email=${encodeURIComponent(inq.email)}` : "";
    const link = `${baseUrl}/login?role=inquilino${emailParam}`;
    const text = `Hola ${name}, te invito a acceder al portal de inquilinos de ${property.nombre_interno}. Crea tu cuenta aquí: ${link}`;
    window.open(buildWhatsAppUrl(null, text), "_blank");
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // If preselected, show directly for that inquilino
  const targetInquilino = preselectedInquilino || null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Vincular con CapitalRent · {property.nombre_interno}</DialogTitle>
          <DialogDescription>
            {selectedRole ? "Envía el enlace de acceso." : "Selecciona el tipo de acceso que quieres otorgar."}
          </DialogDescription>
        </DialogHeader>

        {!selectedRole ? (
          <div className="space-y-2 mt-2">
            {ROLES.map((role) => (
              <button
                key={role.key}
                disabled={!role.enabled}
                onClick={() => setSelectedRole(role.key)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  role.enabled
                    ? "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    : "border-border/50 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  role.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <role.icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{role.label}</span>
                    {!role.enabled && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Próximamente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{role.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : selectedRole === "inquilino" ? (
          <div className="space-y-4 mt-2">
            {!preselectedInquilino && (
              <button
                onClick={() => setSelectedRole(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Volver
              </button>
            )}

            {/* Show specific inquilino or all */}
            {targetInquilino ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {targetInquilino.nombre} {targetInquilino.apellidos || ""}
                    </span>
                    {targetInquilino.email && (
                      <p className="text-xs text-muted-foreground">{targetInquilino.email}</p>
                    )}
                  </div>
                </div>

                {!targetInquilino.email ? (
                  <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    💡 Añade un email al inquilino para que la vinculación sea automática al registrarse.
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleCopy(targetInquilino)}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar enlace"}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleWhatsApp(targetInquilino)}
                  >
                    <Send size={13} />
                    WhatsApp
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {propertyInquilinos.length > 0 ? (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">Inquilinos de esta vivienda:</p>
                    {propertyInquilinos.map((inq) => (
                      <div key={inq.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-sm text-foreground">
                            {inq.nombre} {inq.apellidos || ""}
                          </span>
                          {inq.auth_user_id ? (
                            <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-0.5">
                              <Check size={9} /> Vinculado
                            </span>
                          ) : (
                            <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Pendiente
                            </span>
                          )}
                        </div>
                        {!inq.auth_user_id && (
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleCopy(inq)}>
                              <Copy size={11} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs gap-1 text-emerald-700" onClick={() => handleWhatsApp(inq)}>
                              <Send size={11} />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    💡 Primero añade un inquilino con su email a esta vivienda.
                  </p>
                )}

                {/* Generic link */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Enlace genérico:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                      {baseUrl}/login?role=inquilino
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCopy()} className="shrink-0 gap-1.5">
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitarDesdeViviendaDialog;
