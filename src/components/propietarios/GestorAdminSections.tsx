import { useState } from "react";
import { Briefcase, Building2, ChevronDown, ChevronUp, Link2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Property } from "@/hooks/useProperties";

interface GestorAdminSectionsProps {
  property: Property;
  onUpdate: (propertyId: string, data: Partial<Property>) => Promise<void>;
  onInvite: (role: "gestor" | "comunidad") => void;
}

const GestorAdminSections = ({ property, onUpdate, onInvite }: GestorAdminSectionsProps) => {
  const [gestorOpen, setGestorOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [gestorEditing, setGestorEditing] = useState(false);
  const [adminEditing, setAdminEditing] = useState(false);

  const p = property as any;

  const hasGestor = !!(p.gestor_nombre || p.gestor_empresa);
  const hasAdmin = !!(p.admin_fincas_nombre || p.admin_fincas_empresa);

  // Gestor form state
  const [gestorForm, setGestorForm] = useState({
    gestor_empresa: p.gestor_empresa || "",
    gestor_nombre: p.gestor_nombre || "",
    gestor_telefono: p.gestor_telefono || "",
    gestor_email: p.gestor_email || "",
    gestor_nif: p.gestor_nif || "",
    gestor_notas: p.gestor_notas || "",
  });

  // Admin form state
  const [adminForm, setAdminForm] = useState({
    admin_fincas_empresa: p.admin_fincas_empresa || "",
    admin_fincas_nombre: p.admin_fincas_nombre || "",
    admin_fincas_telefono: p.admin_fincas_telefono || "",
    admin_fincas_email: p.admin_fincas_email || "",
    admin_fincas_nif: p.admin_fincas_nif || "",
    admin_fincas_notas: p.admin_fincas_notas || "",
  });

  const handleSaveGestor = async () => {
    await onUpdate(property.id, gestorForm as any);
    setGestorEditing(false);
  };

  const handleSaveAdmin = async () => {
    await onUpdate(property.id, adminForm as any);
    setAdminEditing(false);
  };

  const handleRemoveGestor = async () => {
    await onUpdate(property.id, {
      gestor_empresa: null, gestor_nombre: null, gestor_telefono: null,
      gestor_email: null, gestor_nif: null, gestor_notas: null,
    } as any);
    setGestorForm({ gestor_empresa: "", gestor_nombre: "", gestor_telefono: "", gestor_email: "", gestor_nif: "", gestor_notas: "" });
    setGestorEditing(false);
  };

  const handleRemoveAdmin = async () => {
    await onUpdate(property.id, {
      admin_fincas_empresa: null, admin_fincas_nombre: null, admin_fincas_telefono: null,
      admin_fincas_email: null, admin_fincas_nif: null, admin_fincas_notas: null,
    } as any);
    setAdminForm({ admin_fincas_empresa: "", admin_fincas_nombre: "", admin_fincas_telefono: "", admin_fincas_email: "", admin_fincas_nif: "", admin_fincas_notas: "" });
    setAdminEditing(false);
  };

  return (
    <div className="space-y-2">
      {/* Gestor fiscal */}
      {hasGestor ? (
        <Collapsible open={gestorOpen} onOpenChange={setGestorOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 text-left py-0.5 group">
              <Briefcase size={12} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground font-medium truncate">{p.gestor_empresa || p.gestor_nombre}</span>
              <span className="text-[10px] font-medium px-1.5 py-0 rounded-full bg-violet-100 text-violet-800 shrink-0 leading-4">Gestor</span>
              {p.gestor_telefono && <a href={`tel:${p.gestor_telefono}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-primary hover:underline hidden sm:inline">· {p.gestor_telefono}</a>}
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <span
                  onClick={(e) => { e.stopPropagation(); onInvite("gestor"); }}
                  className="text-[10px] font-medium px-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-0.5 leading-4"
                >
                  <Link2 size={8} /> Vincular con CapitalRent
                </span>
                {gestorOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {gestorEditing ? (
              <div className="mt-2 space-y-2 bg-secondary/50 rounded-lg px-3 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Empresa" value={gestorForm.gestor_empresa} onChange={(e) => setGestorForm(f => ({ ...f, gestor_empresa: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Contacto" value={gestorForm.gestor_nombre} onChange={(e) => setGestorForm(f => ({ ...f, gestor_nombre: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Teléfono" value={gestorForm.gestor_telefono} onChange={(e) => setGestorForm(f => ({ ...f, gestor_telefono: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Email" value={gestorForm.gestor_email} onChange={(e) => setGestorForm(f => ({ ...f, gestor_email: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="NIF/CIF" value={gestorForm.gestor_nif} onChange={(e) => setGestorForm(f => ({ ...f, gestor_nif: e.target.value }))} className="text-xs h-7" />
                </div>
                <Textarea placeholder="Notas" value={gestorForm.gestor_notas} onChange={(e) => setGestorForm(f => ({ ...f, gestor_notas: e.target.value }))} className="text-xs min-h-[40px]" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={handleRemoveGestor}><X size={11} className="mr-1" /> Eliminar</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setGestorEditing(false)}>Cancelar</Button>
                  <Button size="sm" className="text-xs h-6 px-2 gap-1" onClick={handleSaveGestor}><Save size={11} /> Guardar</Button>
                </div>
              </div>
            ) : (
              <div className="mt-1 pl-5 space-y-0.5">
                {p.gestor_nombre && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Contacto:</span> {p.gestor_nombre}</p>}
                {p.gestor_telefono && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Tel:</span> <a href={`tel:${p.gestor_telefono}`} className="text-primary hover:underline">{p.gestor_telefono}</a></p>}
                {p.gestor_email && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Email:</span> <a href={`mailto:${p.gestor_email}`} className="text-primary hover:underline">{p.gestor_email}</a></p>}
                {p.gestor_nif && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">NIF:</span> {p.gestor_nif}</p>}
                {p.gestor_notas && <p className="text-[11px] text-muted-foreground italic">{p.gestor_notas}</p>}
                <button className="text-[11px] text-primary hover:underline" onClick={() => setGestorEditing(true)}>Editar</button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <button
          onClick={() => { setGestorEditing(true); setGestorOpen(true); }}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 py-0.5"
        >
          <Plus size={11} /> Añadir gestor
        </button>
      )}

      {/* Show gestor form when adding new (no existing data) */}
      {!hasGestor && gestorEditing && (
        <div className="bg-secondary/50 rounded-lg px-3 py-2 space-y-2">
          <span className="text-[11px] font-semibold text-foreground">Nuevo gestor fiscal</span>
          <div className="grid grid-cols-2 gap-1.5">
            <Input placeholder="Empresa *" value={gestorForm.gestor_empresa} onChange={(e) => setGestorForm(f => ({ ...f, gestor_empresa: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Contacto" value={gestorForm.gestor_nombre} onChange={(e) => setGestorForm(f => ({ ...f, gestor_nombre: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Teléfono" value={gestorForm.gestor_telefono} onChange={(e) => setGestorForm(f => ({ ...f, gestor_telefono: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Email" value={gestorForm.gestor_email} onChange={(e) => setGestorForm(f => ({ ...f, gestor_email: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="NIF/CIF" value={gestorForm.gestor_nif} onChange={(e) => setGestorForm(f => ({ ...f, gestor_nif: e.target.value }))} className="text-xs h-7" />
          </div>
          <Textarea placeholder="Notas" value={gestorForm.gestor_notas} onChange={(e) => setGestorForm(f => ({ ...f, gestor_notas: e.target.value }))} className="text-xs min-h-[36px]" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setGestorEditing(false)}>Cancelar</Button>
            <Button size="sm" className="text-xs h-6 px-2 gap-1" onClick={handleSaveGestor} disabled={!gestorForm.gestor_empresa && !gestorForm.gestor_nombre}><Save size={11} /> Guardar</Button>
          </div>
        </div>
      )}

      {/* Admin de fincas */}
      {hasAdmin ? (
        <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 text-left py-0.5 group">
              <Building2 size={12} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground font-medium truncate">{p.admin_fincas_empresa || p.admin_fincas_nombre}</span>
              <span className="text-[10px] font-medium px-1.5 py-0 rounded-full bg-sky-100 text-sky-800 shrink-0 leading-4">Admin. fincas</span>
              {p.admin_fincas_telefono && <a href={`tel:${p.admin_fincas_telefono}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-primary hover:underline hidden sm:inline">· {p.admin_fincas_telefono}</a>}
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <span
                  onClick={(e) => { e.stopPropagation(); onInvite("comunidad"); }}
                  className="text-[10px] font-medium px-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-0.5 leading-4"
                >
                  <Link2 size={8} /> Vincular con CapitalRent
                </span>
                {adminOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {adminEditing ? (
              <div className="mt-2 space-y-2 bg-secondary/50 rounded-lg px-3 py-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <Input placeholder="Empresa" value={adminForm.admin_fincas_empresa} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_empresa: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Contacto" value={adminForm.admin_fincas_nombre} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_nombre: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Teléfono" value={adminForm.admin_fincas_telefono} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_telefono: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="Email" value={adminForm.admin_fincas_email} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_email: e.target.value }))} className="text-xs h-7" />
                  <Input placeholder="NIF/CIF" value={adminForm.admin_fincas_nif} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_nif: e.target.value }))} className="text-xs h-7" />
                </div>
                <Textarea placeholder="Notas" value={adminForm.admin_fincas_notas} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_notas: e.target.value }))} className="text-xs min-h-[36px]" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={handleRemoveAdmin}><X size={11} className="mr-1" /> Eliminar</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setAdminEditing(false)}>Cancelar</Button>
                  <Button size="sm" className="text-xs h-6 px-2 gap-1" onClick={handleSaveAdmin}><Save size={11} /> Guardar</Button>
                </div>
              </div>
            ) : (
              <div className="mt-1 pl-5 space-y-0.5">
                {p.admin_fincas_nombre && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Contacto:</span> {p.admin_fincas_nombre}</p>}
                {p.admin_fincas_telefono && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Tel:</span> <a href={`tel:${p.admin_fincas_telefono}`} className="text-primary hover:underline">{p.admin_fincas_telefono}</a></p>}
                {p.admin_fincas_email && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Email:</span> <a href={`mailto:${p.admin_fincas_email}`} className="text-primary hover:underline">{p.admin_fincas_email}</a></p>}
                {p.admin_fincas_nif && <p className="text-[11px] text-foreground"><span className="text-muted-foreground">NIF:</span> {p.admin_fincas_nif}</p>}
                {p.admin_fincas_notas && <p className="text-[11px] text-muted-foreground italic">{p.admin_fincas_notas}</p>}
                <button className="text-[11px] text-primary hover:underline" onClick={() => setAdminEditing(true)}>Editar</button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <button
          onClick={() => { setAdminEditing(true); setAdminOpen(true); }}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 py-0.5"
        >
          <Plus size={11} /> Añadir administración de fincas
        </button>
      )}

      {!hasAdmin && adminEditing && (
        <div className="bg-secondary/50 rounded-lg px-3 py-2 space-y-2">
          <span className="text-[11px] font-semibold text-foreground">Nueva administración de fincas</span>
          <div className="grid grid-cols-2 gap-1.5">
            <Input placeholder="Empresa *" value={adminForm.admin_fincas_empresa} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_empresa: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Contacto" value={adminForm.admin_fincas_nombre} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_nombre: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Teléfono" value={adminForm.admin_fincas_telefono} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_telefono: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="Email" value={adminForm.admin_fincas_email} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_email: e.target.value }))} className="text-xs h-7" />
            <Input placeholder="NIF/CIF" value={adminForm.admin_fincas_nif} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_nif: e.target.value }))} className="text-xs h-7" />
          </div>
          <Textarea placeholder="Notas" value={adminForm.admin_fincas_notas} onChange={(e) => setAdminForm(f => ({ ...f, admin_fincas_notas: e.target.value }))} className="text-xs min-h-[36px]" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setAdminEditing(false)}>Cancelar</Button>
            <Button size="sm" className="text-xs h-6 px-2 gap-1" onClick={handleSaveAdmin} disabled={!adminForm.admin_fincas_empresa && !adminForm.admin_fincas_nombre}><Save size={11} /> Guardar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorAdminSections;
