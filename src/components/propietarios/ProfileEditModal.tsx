import { useState, useEffect } from "react";
import type { ProfileData } from "@/hooks/useProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  onSave: (data: ProfileData) => void;
}

const ProfileEditModal = ({ open, onClose, profile, onSave }: ProfileEditModalProps) => {
  const [form, setForm] = useState<ProfileData>(profile);

  useEffect(() => {
    if (open) setForm(profile);
  }, [open, profile]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Datos de perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="Carlos"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Apellidos</Label>
            <Input
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="García López"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">NIF / CIF</Label>
            <Input
              value={form.nif}
              onChange={(e) => setForm({ ...form, nif: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="12345678A"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Domicilio (dirección del propietario)</Label>
            <Input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="Calle Mayor 1, 2ºA, 28001 Madrid"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Teléfono</Label>
            <Input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="+34 600 000 000"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="carlos@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">IBAN (para recibir pagos)</Label>
            <Input
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Teléfono Bizum</Label>
            <Input
              value={form.telefono_bizum}
              onChange={(e) => setForm({ ...form, telefono_bizum: e.target.value })}
              className="h-11 rounded-xl"
              placeholder="+34 600 000 000"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preferencia de contacto</Label>
            <Select value={form.preferencia_contacto} onValueChange={(v) => setForm({ ...form, preferencia_contacto: v })}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Teléfono">Teléfono</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Aplicación de WhatsApp</Label>
            <Select value={form.whatsapp_app || "whatsapp"} onValueChange={(v) => setForm({ ...form, whatsapp_app: v })}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="whatsapp_business">WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => onSave(form)}
              className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditModal;
