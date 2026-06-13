import type { PagoRenta } from "@/hooks/usePagosRenta";

/**
 * H2.6 — builder de "Actividad reciente" para pagos.
 *
 * Reglas:
 *  - `pago_real` (confirmado por el propietario) → entrada "Renta cobrada".
 *  - `historico_reconstruido` (o cualquier pago confirmado con
 *    `afecta_finanzas_actuales === false`) NUNCA se etiqueta como
 *    "Renta cobrada". Se agrupa por (contrato_id || property_id) + día de
 *    registro y se muestra como "Histórico reconstruido — N meses".
 *  - `propietario_confirmado_at` se usa SOLO como fecha de registro /
 *    ordenación. La fecha visible principal es el devengo (mes/año).
 */

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export type PagoAgendaItem =
  | {
      kind: "pago_real";
      id: string;
      pago: PagoRenta;
      fechaOrden: Date;
    }
  | {
      kind: "historico_individual";
      id: string;
      pago: PagoRenta;
      fechaOrden: Date;
    }
  | {
      kind: "historico_grupo";
      id: string;
      pagos: PagoRenta[];
      fechaOrden: Date;
      totalImporte: number;
      mesMin: { mes: number; anio: number };
      mesMax: { mes: number; anio: number };
      propertyId: string;
      contratoId: string | null;
    };

function isHistorico(p: PagoRenta): boolean {
  return (
    p.tipo_registro === "historico_reconstruido" ||
    p.tipo_registro === "regularizado" ||
    p.afecta_finanzas_actuales === false
  );
}

export function buildPagoAgendaItems(
  pagos: PagoRenta[],
  opts?: { since?: Date },
): PagoAgendaItem[] {
  const since = opts?.since;
  const items: PagoAgendaItem[] = [];
  const historicos: PagoRenta[] = [];

  for (const p of pagos) {
    if (!p.propietario_confirmado || !p.propietario_confirmado_at) continue;
    const d = new Date(p.propietario_confirmado_at);
    if (since && d < since) continue;

    if (isHistorico(p)) {
      historicos.push(p);
    } else {
      items.push({
        kind: "pago_real",
        id: `pago-${p.id}`,
        pago: p,
        fechaOrden: d,
      });
    }
  }

  // Agrupar históricos por (contrato_id || property_id) + día de registro.
  const groups = new Map<string, PagoRenta[]>();
  for (const p of historicos) {
    const day = new Date(p.propietario_confirmado_at!).toISOString().slice(0, 10);
    const groupKey = `${p.contrato_id ?? `prop:${p.property_id}`}::${day}`;
    const arr = groups.get(groupKey);
    if (arr) arr.push(p);
    else groups.set(groupKey, [p]);
  }

  for (const [key, arr] of groups) {
    if (arr.length === 1) {
      const p = arr[0];
      items.push({
        kind: "historico_individual",
        id: `hist-${p.id}`,
        pago: p,
        fechaOrden: new Date(p.propietario_confirmado_at!),
      });
    } else {
      const sorted = [...arr].sort(
        (a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes),
      );
      const total = arr.reduce(
        (s, p) => s + Number(p.importe_pagado || 0),
        0,
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      // Usamos la fecha de registro más reciente del grupo como orden.
      const fechaOrden = new Date(
        Math.max(
          ...arr.map((p) => new Date(p.propietario_confirmado_at!).getTime()),
        ),
      );
      items.push({
        kind: "historico_grupo",
        id: `histgrp-${key}`,
        pagos: arr,
        fechaOrden,
        totalImporte: total,
        mesMin: { mes: first.mes, anio: first.anio },
        mesMax: { mes: last.mes, anio: last.anio },
        propertyId: arr[0].property_id,
        contratoId: arr[0].contrato_id ?? null,
      });
    }
  }

  items.sort((a, b) => b.fechaOrden.getTime() - a.fechaOrden.getTime());
  return items;
}

export function formatDevengo(mes: number, anio: number): string {
  const idx = Math.max(0, Math.min(11, mes - 1));
  return `${MESES_CORTOS[idx]} ${anio}`;
}

export function formatDevengoRango(
  a: { mes: number; anio: number },
  b: { mes: number; anio: number },
): string {
  if (a.mes === b.mes && a.anio === b.anio) return formatDevengo(a.mes, a.anio);
  if (a.anio === b.anio) {
    const i1 = Math.max(0, Math.min(11, a.mes - 1));
    const i2 = Math.max(0, Math.min(11, b.mes - 1));
    return `${MESES_CORTOS[i1]} – ${MESES_CORTOS[i2]} ${a.anio}`;
  }
  return `${formatDevengo(a.mes, a.anio)} – ${formatDevengo(b.mes, b.anio)}`;
}

export function isRegistradoHoy(fecha: Date, now: Date = new Date()): boolean {
  return fecha.toDateString() === now.toDateString();
}