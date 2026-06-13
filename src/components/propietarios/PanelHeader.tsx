import { Link, useNavigate } from "react-router-dom";
import { Notification } from "@/hooks/useNotifications";
import { LogOut, Pencil, Sparkles, X, Menu, Trash2 } from "lucide-react";
import { Wand2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationCenter from "@/components/propietarios/NotificationCenter";
import GlobalSearch from "@/components/propietarios/GlobalSearch";
import PapeleraDialog from "@/components/propietarios/PapeleraDialog";
import AuditoriaDatosPanel, { AuditoriaDatosTrigger } from "@/components/propietarios/AuditoriaDatosPanel";
import { useAltaAlquiler } from "@/components/propietarios/AltaAlquilerContext";
import { Brand } from "@/components/Brand";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { ProfileData } from "@/hooks/useProfile";

export type PanelTab = "propiedades" | "inquilinos" | "incidencias" | "proveedores" | "finanzas" | "documentacion" | "documentos" | "fiscalidad";

interface PanelHeaderProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onSearchNavigate?: (tab: PanelTab, id?: string) => void;
  pendingPayments?: number;
  profileName?: string;
  profileData?: ProfileData;
  onEditProfile?: () => void;
  properties?: Property[];
  inquilinos?: Inquilino[];
  incidencias?: Incidencia[];
  onNotificationNavigate?: (notification: Notification) => void;
}

const PanelHeader = ({ activeTab, onTabChange, onSearchNavigate, pendingPayments = 0, profileName, profileData, onEditProfile, properties = [], inquilinos = [], incidencias = [], onNotificationNavigate }: PanelHeaderProps) => {
  const [papeleraOpen, setPapeleraOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const altaAlquiler = useAltaAlquiler();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [assistantDismissed, setAssistantDismissed] = useState(false);

  // Sprint 4.0 — abrir panel auditoría desde CTA del Centro de salud.
  useEffect(() => {
    const open = () => setAuditoriaOpen(true);
    window.addEventListener("cr:open-auditoria", open);
    return () => window.removeEventListener("cr:open-auditoria", open);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profileName || "Propietario";
  const initial = displayName[0].toUpperCase();

  // Check missing profile fields
  const missingFields = useMemo(() => {
    if (!profileData) return [];
    const fields: { key: string; label: string }[] = [];
    if (!profileData.nombre) fields.push({ key: "nombre", label: "Nombre" });
    if (!profileData.apellidos) fields.push({ key: "apellidos", label: "Apellidos" });
    if (!profileData.telefono) fields.push({ key: "telefono", label: "Teléfono" });
    if (!profileData.nif) fields.push({ key: "nif", label: "NIF/DNI" });
    if (!profileData.direccion) fields.push({ key: "direccion", label: "Dirección" });
    if (!profileData.iban) fields.push({ key: "iban", label: "IBAN" });
    return fields;
  }, [profileData]);

  const isMonday = new Date().getDay() === 1;
  const showAssistant = isMonday && missingFields.length > 0 && !assistantDismissed;

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Brand size="md" className="[&_>span:last-child]:hidden sm:[&_>span:last-child]:flex" />
          <GlobalSearch
            properties={properties}
            inquilinos={inquilinos}
            incidencias={incidencias}
            onNavigate={(tab, id) => onSearchNavigate ? onSearchNavigate(tab, id) : onTabChange(tab)}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => altaAlquiler.openPicker()}
              className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium"
              title="Dar de alta un activo o alquiler"
            >
              <Wand2 size={14} />
              Dar de alta
            </button>
            <button
              onClick={() => altaAlquiler.openPicker()}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground"
              aria-label="Dar de alta"
            >
              <Wand2 size={16} />
            </button>
            {showAssistant && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/15 hover:bg-amber-500/25 transition-colors animate-pulse">
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-background" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <span className="text-sm font-medium">Completa tu perfil</span>
                    </div>
                    <button onClick={() => setAssistantDismissed(true)} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Te falta información para tener el perfil al día:</p>
                    <ul className="space-y-1">
                      {missingFields.map(f => (
                        <li key={f.key} className="text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          {f.label}
                        </li>
                      ))}
                    </ul>
                    {onEditProfile && (
                      <button
                        onClick={() => { setAssistantDismissed(true); onEditProfile(); }}
                        className="mt-2 w-full text-xs font-medium text-center py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Completar ahora
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <AuditoriaDatosTrigger onOpen={() => setAuditoriaOpen(true)} />
            <NotificationCenter onNavigate={onNotificationNavigate} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <span className="text-sm font-medium text-foreground hidden sm:block truncate max-w-[180px]">
                    {displayName}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{initial}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onEditProfile && (
                  <DropdownMenuItem onClick={onEditProfile} className="gap-2 cursor-pointer">
                    <Pencil size={14} />
                    Editar perfil
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setPapeleraOpen(true)} className="gap-2 cursor-pointer">
                  <Trash2 size={14} />
                  Papelera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut size={14} />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>

        <PapeleraDialog open={papeleraOpen} onOpenChange={setPapeleraOpen} />
        <AuditoriaDatosPanel open={auditoriaOpen} onOpenChange={setAuditoriaOpen} />

        {/* Tab bar with scroll fade indicators */}
        <div className="relative -mb-px">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none sm:hidden" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none sm:hidden" />

          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {/* Primary tab: Patrimonio — visually dominant */}
            <button
              onClick={() => onTabChange("propiedades")}
              className={`relative px-4 sm:px-5 py-3 text-sm sm:text-base font-bold border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === "propiedades"
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground hover:text-primary"
              }`}
            >
              Patrimonio
              {pendingPayments > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1" title={`${pendingPayments} pago(s) pendiente(s) de confirmar`}>
                  {pendingPayments}
                </span>
              )}
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-border/60 mx-1 shrink-0" />

            {/* Secondary tabs */}
            {([
              { key: "inquilinos", label: "Inquilinos" },
              { key: "incidencias", label: "Incidencias" },
              { key: "finanzas", label: "Finanzas" },
              { key: "proveedores", label: "Proveedores" },
              { key: "documentacion", label: "Documentos" },
              { key: "fiscalidad", label: "Fiscal" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={`relative px-2.5 sm:px-3.5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}

            <div className="ml-auto shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors" aria-label="Más opciones">
                    <Menu size={18} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="cursor-pointer text-sm">Noticias</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-sm">Market place</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-sm">Alertas</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-sm">Historial</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-sm">Contacta</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-sm">Sobre CapitalRent</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-sm text-muted-foreground">Bases legales</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-sm text-muted-foreground">Cookies</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PanelHeader;