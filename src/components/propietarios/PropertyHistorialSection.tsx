import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Pencil, Trash2, Check, X, Link2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PropertyMensaje } from "@/hooks/usePropertyMensajes";
import type { Incidencia } from "@/hooks/useIncidencias";

const AUTORES = ["Inquilino", "Propietario", "Técnico", "Administrador de fincas", "Otro"];

interface Props {
  propertyId: string;
  incidencias: Incidencia[];
  mensajes: PropertyMensaje[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: (autor: string, mensaje: string) => Promise<void>;
  onUpdate: (id: string, mensaje: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onViewIncidencia?: (inc: Incidencia) => void;
}

const PropertyHistorialSection = ({
  propertyId, incidencias, mensajes, loading, onRefresh,
  onCreate, onUpdate, onDelete, onViewIncidencia,
}: Props) => {
  const [autor, setAutor] = useState("Propietario");
  const [autorCustom, setAutorCustom] = useState("");
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleSend = async () => {
    if (!nuevoMensaje.trim()) return;
    const finalAutor = autor === "Otro" ? autorCustom || "Otro" : autor;
    await onCreate(finalAutor, nuevoMensaje.trim());
    setNuevoMensaje("");
    onRefresh();
  };

  const handleUpdate = async (id: string) => {
    if (!editText.trim()) return;
    await onUpdate(id, editText.trim());
    setEditingId(null);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    onRefresh();
  };

  const getIncidenciaRef = (incidenciaId: string | null) => {
    if (!incidenciaId) return null;
    return incidencias.find(i => i.id === incidenciaId) || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={18} className="text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Historial de conversaciones</h3>
        <span className="text-xs text-muted-foreground ml-auto">{mensajes.length} mensaje{mensajes.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-secondary rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {mensajes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin conversaciones registradas</p>
          )}
          {mensajes.map(m => {
            const incRef = getIncidenciaRef(m.incidencia_id);
            return (
              <div key={m.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-primary">{m.autor[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{m.autor}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("es-ES")}
                    </span>
                    {incRef && (
                      <button
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                        onClick={() => onViewIncidencia?.(incRef)}
                      >
                        <Link2 size={10} />
                        Inc. #{incRef.numero_incidencia}
                      </button>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      {!m.incidencia_id && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => { setEditingId(m.id); setEditText(m.mensaje); }}
                          >
                            <Pencil size={12} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                                <Trash2 size={12} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar mensaje?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(m.id)} className="bg-destructive text-destructive-foreground">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === m.id ? (
                    <div className="flex gap-2 mt-1">
                      <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} className="flex-1" />
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdate(m.id)}>
                          <Check size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{m.mensaje}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex gap-2 mb-2">
          <Select value={autor} onValueChange={setAutor}>
            <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUTORES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          {autor === "Otro" && (
            <Input
              value={autorCustom}
              onChange={e => setAutorCustom(e.target.value)}
              placeholder="Nombre"
              className="max-w-[160px]"
            />
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={nuevoMensaje}
            onChange={e => setNuevoMensaje(e.target.value)}
            placeholder="Escribe un comentario..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!nuevoMensaje.trim()} className="self-end gap-1.5">
            <Send size={14} /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PropertyHistorialSection;
