import { describe, it, expect, beforeEach } from "vitest";
import {
  dedupePagosCompleto,
  dedupeTelemetry,
  PAGOS_DEDUPE_FASE4_DEPRECATION,
  shouldRecordGroup,
  shouldEmitAudit,
} from "@/lib/pagosDedupe";

describe("Sprint 3 Fase F — telemetría deduper", () => {
  beforeEach(() => dedupeTelemetry.reset());

  it("PAGOS_DEDUPE_FASE4_DEPRECATION declara estado y reemplazo", () => {
    expect(PAGOS_DEDUPE_FASE4_DEPRECATION.status).toBe("monitoring");
    expect(PAGOS_DEDUPE_FASE4_DEPRECATION.replacedBy).toContain("detectarConflictoPagoCompleto");
  });

  it("snapshot inicial está a cero", () => {
    const s = dedupeTelemetry.snapshot();
    expect(s.legacy_fase4_groups).toBe(0);
    expect(s.por_contrato_groups).toBe(0);
    expect(s.warnings_total).toBe(0);
  });

  it("recordGroup separa legacy vs por_contrato y cuenta dedupes", () => {
    dedupeTelemetry.recordGroup({ bucket: "legacy_fase4", deduped: true, warnings: 1 });
    dedupeTelemetry.recordGroup({ bucket: "legacy_fase4", deduped: false, warnings: 0 });
    dedupeTelemetry.recordGroup({ bucket: "por_contrato", deduped: true, warnings: 0 });
    const s = dedupeTelemetry.snapshot();
    expect(s.legacy_fase4_groups).toBe(2);
    expect(s.legacy_fase4_dedupes).toBe(1);
    expect(s.por_contrato_groups).toBe(1);
    expect(s.por_contrato_dedupes).toBe(1);
    expect(s.warnings_total).toBe(1);
  });

  it("reset deja contadores a cero y refresca started_at", async () => {
    dedupeTelemetry.recordGroup({ bucket: "legacy_fase4", deduped: true, warnings: 1 });
    const before = dedupeTelemetry.snapshot().started_at;
    await new Promise(r => setTimeout(r, 5));
    dedupeTelemetry.reset();
    const s = dedupeTelemetry.snapshot();
    expect(s.legacy_fase4_groups).toBe(0);
    expect(s.started_at >= before).toBe(true);
  });

  it("integración: dedupePagosCompleto no toca telemetría por sí solo (el llamador debe registrar)", () => {
    // dedupePagosCompleto es puro: no actualiza contadores. Es el caller
    // (finanzasEngine/fiscalPack) quien debe llamar a recordGroup.
    dedupePagosCompleto(
      [{ id: "a", importe_pagado: 770 } as any, { id: "b", importe_pagado: 770 } as any],
      770,
      "completo",
    );
    expect(dedupeTelemetry.snapshot().legacy_fase4_groups).toBe(0);
  });

  it("H1 — shouldRecordGroup/shouldEmitAudit deduplican por firma hasta reset", () => {
    expect(shouldRecordGroup("sig-A")).toBe(true);
    expect(shouldRecordGroup("sig-A")).toBe(false);
    expect(shouldRecordGroup("sig-B")).toBe(true);
    expect(shouldEmitAudit("aud-X")).toBe(true);
    expect(shouldEmitAudit("aud-X")).toBe(false);
    dedupeTelemetry.reset();
    expect(shouldRecordGroup("sig-A")).toBe(true);
    expect(shouldEmitAudit("aud-X")).toBe(true);
  });
});