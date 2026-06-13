import { Bell, Check, CheckCheck, Trash2, CreditCard, AlertTriangle, FileText, ChevronRight, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const tipoIcon: Record<string, React.ReactNode> = {
  pago: <CreditCard size={14} className="text-emerald-500" />,
  incidencia: <AlertTriangle size={14} className="text-amber-500" />,
  contrato: <FileText size={14} className="text-blue-500" />,
  info: <Bell size={14} className="text-muted-foreground" />,
};

const tipoBadge: Record<string, { label: string; className: string }> = {
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  incidencia: { label: "Incidencia", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  contrato: { label: "Contrato", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  info: { label: "Info", className: "bg-muted text-muted-foreground" },
};

function NotificationItem({
  n,
  onRead,
  onDelete,
  onClick,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (n: Notification) => void;
}) {
  const badge = tipoBadge[n.tipo] || tipoBadge.info;
  const isClickable = !!(onClick && (n.enlace || n.referencia_id || n.referencia_tipo));

  return (
    <div
      className={`flex gap-3 p-3 border-b border-border last:border-0 transition-colors ${
        n.leida ? "opacity-60" : "bg-primary/5"
      } ${isClickable ? "cursor-pointer hover:bg-accent/50" : ""}`}
      onClick={() => {
        if (isClickable) {
          if (!n.leida) onRead(n.id);
          onClick?.(n);
        }
      }}
    >
      <div className="mt-0.5">{tipoIcon[n.tipo] || tipoIcon.info}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground leading-tight">{n.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{n.mensaje}</p>
        {isClickable && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium mt-1">
            Ver detalle <ChevronRight size={10} />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {!n.leida && (
          <button
            onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Marcar como leída"
          >
            <Check size={12} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

interface NotificationCenterProps {
  onNavigate?: (notification: Notification) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Notificaciones">
          <Bell size={18} className="text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-in zoom-in-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={markAllAsRead}
            >
              <CheckCheck size={12} />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin notificaciones
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                n={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onClick={onNavigate}
              />
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
