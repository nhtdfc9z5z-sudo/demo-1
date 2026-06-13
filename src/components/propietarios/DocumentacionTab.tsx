import { useState } from "react";
import { FileText, Receipt, Shield, Package, Handshake, Building2, ChevronRight, Calculator, FileSearch, Megaphone, Leaf, ScrollText, FolderArchive, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentosTab from "./DocumentosTab";
import FacturasSection from "./FacturasSection";
import FianzasSection from "./FianzasSection";
import DeclaracionHaciendaSection from "./DeclaracionHaciendaSection";
import InventarioSection from "./InventarioSection";
import CopiaSimpleSection from "./CopiaSimpleSection";
import GeneradorAnuncio from "./GeneradorAnuncio";
import CEESection from "./CEESection";
import SegurosImpagoSection from "./SegurosImpagoSection";
import ContratosSection from "./ContratosSection";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface DocCategory {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  enabled: boolean;
}

const categories: DocCategory[] = [
  { key: "contratos", icon: <ScrollText size={20} />, title: "Contratos", description: "Contratos de arrendamiento originales vinculados a tus activos.", enabled: true },
  { key: "seguros_impago", icon: <Shield size={20} />, title: "Seguros de impago", description: "Pólizas de impago vinculadas a contratos e inquilinos.", enabled: true },
  { key: "inventario", icon: <Package size={20} />, title: "Inventario", description: "Inventario documentado del contenido de cada activo con fotos y descripciones.", enabled: true },
  { key: "fianza", icon: <Shield size={20} />, title: "Depósito de fianza", description: "Gestión del depósito obligatorio de fianza por comunidad autónoma.", enabled: true },
  { key: "acuerdos", icon: <Handshake size={20} />, title: "Acuerdos", description: "Acuerdos firmados con inquilinos, proveedores u otras partes.", enabled: false },
  { key: "facturas", icon: <Receipt size={20} />, title: "Facturas", description: "Auto-organizadas con análisis OCR. También se añaden desde finanzas e incidencias.", badge: "OCR", enabled: true },
  { key: "copia_simple", icon: <FileSearch size={20} />, title: "Copia Simple / Nota Simple", description: "Solicita la nota simple de tu activo al Registro de la Propiedad.", badge: "Online", enabled: true },
  { key: "escrituras", icon: <FileText size={20} />, title: "Escrituras", description: "Escrituras de propiedad y documentos notariales.", enabled: false },
  { key: "cee", icon: <Leaf size={20} />, title: "CEE", description: "Certificados de eficiencia energética de tus activos.", enabled: true },
  { key: "comunidad", icon: <Building2 size={20} />, title: "Documentación de comunidad", description: "Actas, estatutos, presupuestos y otra documentación de la comunidad de vecinos.", enabled: false },
  { key: "hacienda", icon: <Calculator size={20} />, title: "Declaración de Hacienda", description: "Informe automático con ingresos, gastos y datos fiscales para tu gestor. Descárgalo o envíalo por email.", badge: "Auto", enabled: true },
  { key: "anuncio", icon: <Megaphone size={20} />, title: "Generar anuncio", description: "Crea anuncios optimizados con IA para Idealista, Fotocasa, Wallapop y más.", badge: "IA", enabled: true },
  { key: "otros", icon: <FolderArchive size={20} />, title: "Otros documentos", description: "Repositorio general con OCR. Cualquier documento que no encaje en las categorías anteriores.", badge: "OCR", enabled: true },
];

interface DocumentacionTabProps {
  properties: Property[];
  inquilinos?: Inquilino[];
  profile?: { nombre?: string | null; apellidos?: string | null; telefono?: string | null; email?: string | null; nif?: string | null } | null;
  onPropertyCreated?: () => void;
  onInquilinoCreated?: () => void;
}

const DocumentacionTab = ({ properties, inquilinos = [], profile = null, onPropertyCreated, onInquilinoCreated }: DocumentacionTabProps) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection === "contratos") {
    return <ContratosSection properties={properties} inquilinos={inquilinos} profile={profile} onBack={() => setActiveSection(null)} onPropertyCreated={onPropertyCreated} onInquilinoCreated={onInquilinoCreated} />;
  }
  if (activeSection === "facturas") {
    return <FacturasSection properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "fianza") {
    return <FianzasSection properties={properties} inquilinos={inquilinos} profile={profile} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "hacienda") {
    return <DeclaracionHaciendaSection properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "copia_simple") {
    return <CopiaSimpleSection properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "inventario") {
    return <InventarioSection properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "anuncio") {
    return <GeneradorAnuncio properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "cee") {
    return <CEESection properties={properties} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "seguros_impago") {
    return <SegurosImpagoSection properties={properties} inquilinos={inquilinos} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "otros") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)} className="gap-1.5">
          <ArrowLeft size={14} /> Volver
        </Button>
        <DocumentosTab />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Documentación</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Gestiona todos los documentos de tus activos organizados por categoría.
      </p>

      <div className="grid gap-3">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => cat.enabled && setActiveSection(cat.key)}
            className={`flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 text-left transition-all group ${
              cat.enabled ? "hover:border-primary/30 hover:shadow-sm cursor-pointer" : "opacity-60 cursor-default"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {cat.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{cat.title}</span>
                {cat.badge && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {cat.badge}
                  </span>
                )}
                {!cat.enabled && !cat.badge && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Próximamente
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cat.description}</p>
            </div>
            {cat.enabled && (
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DocumentacionTab;
