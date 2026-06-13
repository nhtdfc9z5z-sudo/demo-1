import type { ProfileData } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { UserCheck, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ProfileCardProps {
  profile: ProfileData;
  onEdit: () => void;
}

const ProfileCard = ({ profile, onEdit }: ProfileCardProps) => {
  const fullName = [profile.nombre, profile.apellidos].filter(Boolean).join(" ");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      {profile.completed ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCheck size={17} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{fullName || "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground">Propietario</p>
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
              <p><span className="text-muted-foreground">Teléfono:</span> <span className="text-foreground">{profile.telefono || "—"}</span></p>
              <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{profile.email || "—"}</span></p>
              <p><span className="text-muted-foreground">IBAN:</span> <span className="text-foreground font-mono text-xs">{profile.iban || "—"}</span></p>
              <p><span className="text-muted-foreground">Bizum:</span> <span className="text-foreground">{profile.telefono_bizum || "—"}</span></p>
              <p><span className="text-muted-foreground">Contacto preferido:</span> <span className="text-foreground">{profile.preferencia_contacto || "—"}</span></p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onEdit} className="rounded-lg text-xs">
                  Editar
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <UserPlus size={17} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Completa tu perfil para empezar</p>
          </div>
          <Button size="sm" onClick={onEdit} className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
            Completar
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
