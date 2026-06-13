import { useState } from "react";
import { MessageSquare, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import SectionCard from "./SectionCard";
import type { IncidenciaMensaje } from "@/hooks/useIncidencias";

const AUTORES = ["Inquilino", "Propietario", "Técnico", "Administrador de fincas", "Otro"];

interface Props {
  incidenciaId: string | null;
  mensajes: IncidenciaMensaje[];
  onRefresh: () => void;
  onCreate: (autor: string, mensaje: string) => Promise<void>;
  onUpdate: (id: string, mensaje: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const HistorialSection = ({ incidenciaId, mensajes, onRefresh, onCreate, onUpdate, onDelete }: Props) => {
  const [autor, setAutor] = useState("Propietario");
  const [autorCustom, setAutorCustom] = useState("");
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleSend = async () => {
    if (!nuevoMensaje.trim() || !incidenciaId) return;
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

  if (!incidenciaId) {
    return (
      <SectionCard title="Historial de conversaciones" icon={MessageSquare}>
        <p className="text-sm text-muted-foreground">Guarda la incidencia primero.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Historial de conversaciones" icon={MessageSquare}>
      <div className="space-y-4 mb-6">
        {mensajes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Sin mensajes</p>
        )}
        {mensajes.map(m => (
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
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
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
                        <AlertDialogAction
                          onClick={() => handleDelete(m.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                <p className="text-sm text-muted-foreground mt-0.5">{m.mensaje}</p>
              )}
            </div>
          </div>
        ))}
      </div>

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
    </SectionCard>
  );
};

export default HistorialSection;
