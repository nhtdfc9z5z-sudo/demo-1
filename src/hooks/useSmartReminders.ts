import { useMemo } from "react";
import type { Property } from "@/hooks/useProperties";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Inquilino } from "@/hooks/useInquilinos";

export type ReminderType = "pago_pendiente" | "ipc" | "contrato_vence" | "incidencia_abierta";
export type ReminderSeverity = "info" | "warning" | "urgent";

export interface Reminder {
  id: string;
  type: ReminderType;
  severity: ReminderSeverity;
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  actionLabel?: string;
  contratoId?: string;
}

export interface PropertyHealth {
  property: Property;
  status: "ok" | "attention" | "urgent";
  summary: string;
  reminders: Reminder[];
  tenantName?: string;
  rentAmount?: number;
}

export function useSmartReminders(
  properties: Property[],
  contratos: Contrato[],
  incidencias: Incidencia[],
  pagos: PagoRenta[],
  inquilinos: Inquilino[]
): { propertyHealths: PropertyHealth[]; totalReminders: number } {
  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const propertyHealths: PropertyHealth[] = properties.map((prop) => {
      const reminders: Reminder[] = [];

      const activeContratos = contratos.filter(
        (c) => c.property_id === prop.id && c.estado === "vigente" && !c.archivado
      );

      const activeTenants = inquilinos.filter(
        (i) => i.property_id === prop.id && (i.estado === "activo" || i.estado === "Activo")
      );
      const tenantName = activeTenants.length > 0
        ? activeTenants.map((t) => t.nombre).join(", ")
        : undefined;

      const rentAmount = activeContratos[0]?.renta_mensual ?? undefined;

      // --- 1. PAGO PENDIENTE ---
      // Only generate a Smart Reminder for missing payments when PendingPaymentsBanner
      // is NOT already covering this property (i.e., no inquilino-notified-but-unconfirmed payment exists).
      if (activeContratos.length > 0 && activeTenants.length > 0) {
        // [H2.9] Si el contrato tiene `fecha_inicio_control` posterior al mes
        // actual, no exigimos cobro todavía: CapitalRent aún no controla
        // pagos de este alquiler.
        const controlActivo = activeContratos.some((c) => {
          const ctrl = (c as any).fecha_inicio_control || c.fecha_inicio;
          if (!ctrl) return true;
          const d = new Date(ctrl);
          if (isNaN(d.getTime())) return true;
          const ctrlYM = d.getFullYear() * 12 + d.getMonth();
          const nowYM = currentYear * 12 + (currentMonth - 1);
          return ctrlYM <= nowYM;
        });
        if (!controlActivo) {
          // Saltamos el resto de comprobaciones de este bloque.
        } else {
        const hasConfirmedPayment = pagos.some(
          (p) => p.property_id === prop.id && p.mes === currentMonth && p.anio === currentYear && p.propietario_confirmado
        );
        const hasNotifiedPayment = pagos.some(
          (p) => p.property_id === prop.id && p.mes === currentMonth && p.anio === currentYear && p.inquilino_notificado && !p.propietario_confirmado
        );

        // If the tenant already notified → PendingPaymentsBanner handles it. Skip here.
        if (!hasNotifiedPayment && !hasConfirmedPayment && now.getDate() >= 5) {
          reminders.push({
            id: `pago-pend-${prop.id}`,
            type: "pago_pendiente",
            severity: now.getDate() >= 15 ? "urgent" : "warning",
            propertyId: prop.id,
            propertyName: prop.nombre_interno,
            title: now.getDate() >= 15
              ? `Aún no hay cobro registrado en ${monthName(currentMonth)}`
              : `¿Ya has cobrado la renta de ${monthName(currentMonth)}?`,
            description: now.getDate() >= 15
              ? "Llevas más de dos semanas sin registrar el cobro. Comprueba con tu inquilino."
              : "Cuando lo recibas, regístralo para tener el control al día.",
            actionLabel: "Registrar cobro",
          });
        }
        }
      }

      // --- 2. IPC ANUAL ---
      for (const contrato of activeContratos) {
        if (!contrato.fecha_inicio) continue;
        const startDate = new Date(contrato.fecha_inicio);
        const startMonth = startDate.getMonth() + 1;
        const startDay = startDate.getDate();

        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        if ([currentMonth, nextMonth].includes(startMonth)) {
          const yearsActive = currentYear - startDate.getFullYear();
          if (yearsActive >= 1) {
            const isThisMonth = startMonth === currentMonth;
            reminders.push({
              id: `ipc-${contrato.id}`,
              type: "ipc",
              severity: isThisMonth ? "warning" : "info",
              propertyId: prop.id,
              propertyName: prop.nombre_interno,
              contratoId: contrato.id,
              title: isThisMonth
                ? "Este mes puedes actualizar la renta por IPC"
                : "El mes que viene toca revisar el IPC",
              description: `Tu contrato cumple ${yearsActive} año${yearsActive > 1 ? "s" : ""} el día ${startDay}. Es buen momento para revisar si actualizas la renta.`,
              actionLabel: "Actualizar",
            });
          }
        }
      }

      // --- 3. CONTRATO PRÓXIMO A RENOVARSE ---
      for (const contrato of activeContratos) {
        if (!contrato.fecha_fin) continue;
        const endDate = new Date(contrato.fecha_fin);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          reminders.push({
            id: `contrato-exp-${contrato.id}`,
            type: "contrato_vence",
            severity: "info",
            propertyId: prop.id,
            propertyName: prop.nombre_interno,
            title: "Contrato renovado automáticamente",
            description: `El periodo original finalizó el ${formatDate(endDate)}. Se ha renovado automáticamente por la LAU. Revisa si necesitas actualizar condiciones.`,
            actionLabel: "Ver contrato",
          });
        } else if (diffDays <= 90) {
          reminders.push({
            id: `contrato-soon-${contrato.id}`,
            type: "contrato_vence",
            severity: diffDays <= 30 ? "warning" : "info",
            propertyId: prop.id,
            propertyName: prop.nombre_interno,
            title: diffDays <= 30
              ? `Tu contrato se renueva en ${diffDays} días`
              : `Tu contrato se renueva en unos ${Math.ceil(diffDays / 30)} meses`,
            description: `Se renovará automáticamente el ${formatDate(endDate)}. Si no deseas renovar, comunícalo con antelación al inquilino.`,
            actionLabel: "Revisar",
          });
        }
      }

      // --- 4. INCIDENCIAS ABIERTAS ---
      // Only show reminder when incidencias truly deserve attention:
      // - States that indicate stagnation ("Abierta", "Pendiente") — NOT actively managed ones
      // - Aged > 7 days for a single incidencia, or multiple open ones
      const stagnantStates = ["Abierta", "Pendiente"];
      const openIncidencias = incidencias.filter(
        (i) => i.property_id === prop.id && i.estado !== "Cerrada"
      );
      const stagnantIncidencias = openIncidencias.filter(
        (i) => stagnantStates.includes(i.estado || "Abierta")
      );

      if (openIncidencias.length > 0) {
        const oldest = openIncidencias.reduce((a, b) =>
          new Date(a.created_at) < new Date(b.created_at) ? a : b
        );
        const daysSinceOldest = Math.ceil(
          (now.getTime() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Show reminder only if: multiple open, OR stagnant ones exist with age > 7 days
        const worthShowing =
          openIncidencias.length >= 3 ||
          (stagnantIncidencias.length > 0 && daysSinceOldest >= 7) ||
          daysSinceOldest > 14;

        if (worthShowing) {
          reminders.push({
            id: `inc-open-${prop.id}`,
            type: "incidencia_abierta",
            severity: daysSinceOldest > 14 ? "urgent" : openIncidencias.length > 2 ? "warning" : "info",
            propertyId: prop.id,
            propertyName: prop.nombre_interno,
            title: openIncidencias.length === 1
              ? `Tienes una incidencia pendiente`
              : `Hay ${openIncidencias.length} incidencias abiertas`,
            description: openIncidencias.length === 1
              ? `"${oldest.concepto || "Sin concepto"}" — lleva ${daysSinceOldest} días en estado ${oldest.estado?.toLowerCase()}.`
              : `La más antigua lleva ${daysSinceOldest} días abierta. Echa un vistazo.`,
            actionLabel: "Ver",
          });
        }
      }

      // --- Status ---
      const hasUrgent = reminders.some((r) => r.severity === "urgent");
      const hasWarning = reminders.some((r) => r.severity === "warning");
      const status: PropertyHealth["status"] = hasUrgent ? "urgent" : hasWarning ? "attention" : "ok";

      const summary =
        reminders.length === 0
          ? "Todo al día"
          : reminders.length === 1
            ? reminders[0].title
            : `${reminders.length} cosas pendientes`;

      return { property: prop, status, summary, reminders, tenantName, rentAmount };
    });

    const order = { urgent: 0, attention: 1, ok: 2 };
    propertyHealths.sort((a, b) => order[a.status] - order[b.status]);

    const totalReminders = propertyHealths.reduce((sum, ph) => sum + ph.reminders.length, 0);

    return { propertyHealths, totalReminders };
  }, [properties, contratos, incidencias, pagos, inquilinos]);
}

function monthName(m: number): string {
  return ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m];
}

function formatDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
