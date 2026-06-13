import { useState } from "react";

import { motion } from "framer-motion";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/hooks/useAuth";
import { useInquilinoPortal } from "@/hooks/useInquilinoPortal";
import { useInquilinoEventos } from "@/hooks/useInquilinoEventos";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Home, User, LogOut, Mail, Phone, MapPin, Calendar,
  Euro, BedDouble, Bath, Ruler, Building2, Edit2, Check, X,
  Wrench, AlertCircle, Clock, CheckCircle2, ChevronDown,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NuevaIncidenciaDialog from "@/components/inquilino-portal/NuevaIncidenciaDialog";
import CalendarioSection from "@/components/inquilino-portal/CalendarioSection";
import PagarRentaDialog from "@/components/inquilino-portal/PagarRentaDialog";
import DocumentosSection from "@/components/inquilino-portal/DocumentosSection";

const InquilinoPortal = () => {
  const { user, signOut } = useAuth();
  const { inquilino, property, incidencias, loading, linked, rentaResuelta, updateProfile, createIncidencia } = useInquilinoPortal();
  const { eventos, createEvento, updateEvento, deleteEvento } = useInquilinoEventos(inquilino?.id || null, user?.id || null);
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const { pagos, notificarPago, getPagoForMonth } = usePagosRenta({
    inquilinoId: inquilino?.id,
  });
  const pagoActual = getPagoForMonth(mesActual, anioActual, inquilino?.id || undefined);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ email: "", telefono: "", nombre: "", apellidos: "" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (linked === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">Acceso no autorizado</h1>
          <p className="text-muted-foreground mb-6">
            No se encontró ningún inquilino activo asociado a <strong>{user?.email}</strong>.
            Contacta con tu propietario para que registre tu email.
          </p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </motion.div>
      </div>
    );
  }

  const startEditing = () => {
    setEditData({
      email: inquilino?.email || "",
      telefono: inquilino?.telefono || "",
      nombre: inquilino?.nombre || "",
      apellidos: inquilino?.apellidos || "",
    });
    setProfileOpen(true);
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateProfile(editData);
      toast({ title: "Perfil actualizado" });
      setEditing(false);
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    }
  };

  const handleNotificarPago = inquilino?.property_id ? async (datos?: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: prop } = await supabase
      .from("properties")
      .select("user_id")
      .eq("id", inquilino.property_id!)
      .maybeSingle();
    if (prop) {
      await notificarPago(inquilino.id, inquilino.property_id!, mesActual, anioActual, prop.user_id, datos);
    }
  } : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brand size="sm" to={false} />
            <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">· Inquilino</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{inquilino?.nombre}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-semibold text-foreground">
            Hola, {inquilino?.nombre} 👋
          </h2>
          <p className="text-muted-foreground mt-1">Bienvenido a tu portal de inquilino.</p>
        </motion.div>

        {/* Collapsible Profile & Property */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Profile - Collapsible */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">
                          {`${inquilino?.nombre || ""} ${inquilino?.apellidos || ""}`.trim()}
                        </p>
                        <p className="text-xs text-muted-foreground">Inquilino</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <div className="flex justify-end mb-3">
                      {!editing ? (
                        <Button variant="ghost" size="sm" onClick={startEditing}>
                          <Edit2 className="w-4 h-4 mr-1" /> Editar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            <Check className="w-4 h-4 mr-1" /> Guardar
                          </Button>
                        </div>
                      )}
                    </div>
                    {editing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                            <Input value={editData.nombre} onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Apellidos</label>
                            <Input value={editData.apellidos} onChange={e => setEditData(p => ({ ...p, apellidos: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                          <Input type="email" value={editData.email} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Teléfono</label>
                          <Input value={editData.telefono} onChange={e => setEditData(p => ({ ...p, telefono: e.target.value }))} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <InfoRow icon={Mail} label="Email" value={inquilino?.email} />
                        <InfoRow icon={Phone} label="Teléfono" value={inquilino?.telefono} />
                        <InfoRow icon={Calendar} label="Entrada" value={inquilino?.fecha_entrada ? new Date(inquilino.fecha_entrada).toLocaleDateString("es-ES") : null} />
                        <InfoRow icon={Euro} label="Renta mensual" value={rentaResuelta ? `${rentaResuelta} €/mes` : null} />
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </motion.div>

          {/* Property - Collapsible */}
          {property && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Collapsible open={propertyOpen} onOpenChange={setPropertyOpen}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">{property.nombre_interno}</p>
                          <p className="text-xs text-muted-foreground">Mi vivienda</p>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${propertyOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                      <InfoRow icon={MapPin} label="Dirección" value={property.direccion_completa} />
                      <InfoRow icon={MapPin} label="Ciudad" value={[property.ciudad, property.provincia].filter(Boolean).join(", ")} />
                      <InfoRow icon={Building2} label="Tipo" value={property.tipo_vivienda} />
                      <InfoRow icon={Ruler} label="Superficie" value={property.superficie_m2 ? `${property.superficie_m2} m²` : null} />
                      <InfoRow icon={BedDouble} label="Habitaciones" value={property.num_habitaciones?.toString()} />
                      <InfoRow icon={Bath} label="Baños" value={property.num_banos?.toString()} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </motion.div>
          )}
        </div>

        {/* Calendario 3 meses */}
        <CalendarioSection
          eventos={eventos}
          onCreateEvento={createEvento}
          onUpdateEvento={updateEvento}
          onDeleteEvento={deleteEvento}
          rentaMensual={rentaResuelta}
          pagoActual={pagoActual}
          onNotificarPago={handleNotificarPago}
          numberOfMonths={3}
        />

        {/* Pagar Renta Button */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <PagarRentaDialog
            rentaMensual={rentaResuelta}
            pagoActual={pagoActual}
            onNotificarPago={handleNotificarPago}
            inquilinoNombre={`${inquilino?.nombre || ""} ${inquilino?.apellidos || ""}`.trim()}
            mesActual={mesActual}
            anioActual={anioActual}
            propertyId={inquilino?.property_id}
          />
        </motion.div>

        {/* Incidencias */}
        {(() => {
          const abiertas = incidencias.filter(inc => inc.estado !== "Cerrada");
          const cerradas = incidencias.filter(inc => inc.estado === "Cerrada");
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Mis incidencias</h3>
                    <p className="text-xs text-muted-foreground">
                      {abiertas.length} activa{abiertas.length !== 1 ? "s" : ""}
                      {cerradas.length > 0 && ` · ${cerradas.length} cerrada${cerradas.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <NuevaIncidenciaDialog
                  onSubmit={createIncidencia}
                  direccion={property?.direccion_completa || ""}
                />
              </div>

              {abiertas.length === 0 && cerradas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay incidencias registradas.</p>
              ) : (
                <div className="space-y-3">
                  {abiertas.map(inc => (
                    <IncidenciaRow key={inc.id} inc={inc} />
                  ))}

                  {cerradas.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-2 pt-3 border-t border-border text-sm text-muted-foreground hover:text-foreground transition-colors group">
                          <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                          Historial de incidencias cerradas ({cerradas.length})
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-3 mt-3">
                          {cerradas.map(inc => (
                            <IncidenciaRow key={inc.id} inc={inc} />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* Documentos */}
        {inquilino && (
          <DocumentosSection
            inquilinoId={inquilino.id}
            tipoInquilino={inquilino.tipo_inquilino}
          />
        )}

        {/* Coming soon cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="grid grid-cols-2 gap-4"
        >
          {[
            { label: "Mensajes", icon: "💬", desc: "Próximamente" },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-border bg-card p-4 text-center opacity-60">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
};

const IncidenciaRow = ({ inc }: { inc: any }) => (
  <div className="rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-muted-foreground">#{inc.numero_incidencia}</span>
          <EstadoBadge estado={inc.estado} />
          {inc.prioridad && inc.prioridad <= 2 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgente</Badge>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{inc.concepto || "Sin concepto"}</p>
        {inc.direccion && <p className="text-xs text-muted-foreground mt-0.5">{inc.direccion}</p>}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(inc.fecha_hora_incidencia || inc.created_at).toLocaleDateString("es-ES")}
      </span>
    </div>
  </div>
);

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
  <div className="flex items-center gap-3">
    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm text-foreground truncate">{value || "—"}</p>
    </div>
  </div>
);

const estadoConfig: Record<string, { icon: any; color: string }> = {
  Abierta: { icon: AlertCircle, color: "text-orange-500" },
  "En curso": { icon: Clock, color: "text-blue-500" },
  "Pendiente presupuesto": { icon: Clock, color: "text-amber-500" },
  "Presupuesto aceptado": { icon: CheckCircle2, color: "text-emerald-500" },
  "En reparación": { icon: Wrench, color: "text-blue-600" },
  Cerrada: { icon: CheckCircle2, color: "text-muted-foreground" },
};

const EstadoBadge = ({ estado }: { estado: string | null }) => {
  const st = estado || "Abierta";
  const cfg = estadoConfig[st] || estadoConfig["Abierta"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {st}
    </span>
  );
};

export default InquilinoPortal;
