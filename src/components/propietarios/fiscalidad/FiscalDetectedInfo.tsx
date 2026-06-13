import { Home, FileText, Users, Building2, Shield, Receipt, Wrench, Calculator, FolderOpen, CheckCircle2 } from "lucide-react";

interface DetectedInfoProps {
  detectedInfo: {
    viviendas: number;
    contratos: number;
    inquilinos: number;
    comunidades: number;
    derramas: number;
    seguros: number;
    reparaciones: number;
    impuestos: number;
    facturas: number;
  };
}

const items = [
  { key: "viviendas", label: "Activos", icon: Home },
  { key: "contratos", label: "Contratos", icon: FileText },
  { key: "inquilinos", label: "Inquilinos", icon: Users },
  { key: "comunidades", label: "Cuotas comunidad", icon: Building2 },
  { key: "derramas", label: "Derramas activas", icon: Calculator },
  { key: "seguros", label: "Seguros", icon: Shield },
  { key: "reparaciones", label: "Reparaciones", icon: Wrench },
  { key: "impuestos", label: "Impuestos", icon: Receipt },
  { key: "facturas", label: "Facturas", icon: FolderOpen },
] as const;

const FiscalDetectedInfo = ({ detectedInfo }: DetectedInfoProps) => {
  const totalDetected = Object.values(detectedInfo).reduce((s, v) => s + v, 0);
  if (totalDetected === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-foreground">Información detectada</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Datos encontrados automáticamente en tu cuenta</p>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {items.map(({ key, label, icon: Icon }) => {
          const count = detectedInfo[key];
          if (count === 0) return null;
          return (
            <div key={key} className="flex flex-col items-center text-center py-3 px-2 rounded-xl bg-secondary/50">
              <Icon size={18} className="text-primary mb-1.5" />
              <span className="text-lg font-bold text-foreground">{count}</span>
              <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FiscalDetectedInfo;
