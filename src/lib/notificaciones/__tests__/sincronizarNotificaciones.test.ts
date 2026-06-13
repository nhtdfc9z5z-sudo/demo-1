import { describe, it, expect } from "vitest";
import { construirNotificacionesDesdeRecordatorios } from "../sincronizarNotificaciones";
import type { Recordatorio } from "@/hooks/useRecordatorios";
import type { Notification } from "@/hooks/useNotifications";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

const baseRecordatorio = (over: Partial<Recordatorio>): Recordatorio => ({
  id: "r-" + Math.random(),
  user_id: "u1",
  tipo: "renta_pendiente",
  origen_tipo: "pago_renta",
  origen_id: `${UUID_A}:2026-01`,
  titulo: "Renta pendiente",
  descripcion: "Faltan 800€ de Enero",
  fecha_objetivo: null,
  prioridad: 1,
  estado: "pendiente",
  completado_at: null,
  descartado_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
});

const properties = [{ id: UUID_A, nombre_interno: "Piso Centro" }];

describe("construirNotificacionesDesdeRecordatorios", () => {
  it("genera notificación de pago con el nombre del activo", () => {
    const out = construirNotificacionesDesdeRecordatorios([baseRecordatorio({})], [], properties);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      tipo: "pago",
      titulo: "Renta pendiente · Piso Centro",
      referencia_id: UUID_A,
      referencia_tipo: "pago_renta",
      enlace: `recordatorio:${UUID_A}:2026-01`,
    });
  });

  it("omite recordatorios con prioridad > 2", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [baseRecordatorio({ prioridad: 3 })],
      [],
      properties,
    );
    expect(out).toHaveLength(0);
  });

  it("omite recordatorios no pendientes", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [baseRecordatorio({ estado: "completado" })],
      [],
      properties,
    );
    expect(out).toHaveLength(0);
  });

  it("deduplica contra notificaciones existentes <24h con mismo enlace", () => {
    const r = baseRecordatorio({});
    const existente: Notification = {
      id: "n1",
      user_id: "u1",
      tipo: "pago",
      titulo: "x",
      mensaje: "x",
      leida: false,
      enlace: `recordatorio:${r.origen_id}`,
      referencia_id: UUID_A,
      referencia_tipo: "pago_renta",
      created_at: new Date().toISOString(),
    };
    const out = construirNotificacionesDesdeRecordatorios([r], [existente], properties);
    expect(out).toHaveLength(0);
  });

  it("vuelve a generar si la notificación previa tiene >24h", () => {
    const r = baseRecordatorio({});
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const existente: Notification = {
      id: "n1",
      user_id: "u1",
      tipo: "pago",
      titulo: "x",
      mensaje: "x",
      leida: true,
      enlace: `recordatorio:${r.origen_id}`,
      referencia_id: UUID_A,
      referencia_tipo: "pago_renta",
      created_at: old,
    };
    const out = construirNotificacionesDesdeRecordatorios([r], [existente], properties);
    expect(out).toHaveLength(1);
  });

  it("mapea contrato_vence → tipo contrato + referencia uuid de contrato", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [
        baseRecordatorio({
          tipo: "contrato_vence",
          origen_tipo: "contrato",
          origen_id: UUID_B,
          titulo: "Contrato",
          descripcion: "Vence en 30 días",
          prioridad: 2,
        }),
      ],
      [],
      properties,
    );
    expect(out[0]).toMatchObject({
      tipo: "contrato",
      titulo: "Contrato próximo a renovarse",
      referencia_id: UUID_B,
      referencia_tipo: "contrato_renovacion",
    });
  });

  it("mapea revision_renta_anualidad → contrato_revision con UUID base", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [
        baseRecordatorio({
          tipo: "revision_renta_anualidad",
          origen_tipo: "contrato",
          origen_id: `${UUID_B}:anualidad:2`,
          prioridad: 2,
        }),
      ],
      [],
      properties,
    );
    expect(out[0].referencia_id).toBe(UUID_B);
    expect(out[0].referencia_tipo).toBe("contrato_revision");
    expect(out[0].titulo).toBe("Revisión de renta");
  });

  it("ignora tipos no mapeados (ocr_fallido, auditoria_hallazgo)", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [
        baseRecordatorio({ tipo: "ocr_fallido", origen_tipo: "documento", origen_id: UUID_B, prioridad: 2 }),
        baseRecordatorio({ tipo: "auditoria_hallazgo", origen_tipo: "auditoria", origen_id: UUID_B, prioridad: 1 }),
      ],
      [],
      properties,
    );
    expect(out).toHaveLength(0);
  });

  it("ignora recordatorios sin origen_id (no construye clave de dedupe vacía)", () => {
    const out = construirNotificacionesDesdeRecordatorios(
      [baseRecordatorio({ origen_id: "" as unknown as string })],
      [],
      properties,
    );
    expect(out).toHaveLength(0);
  });
});