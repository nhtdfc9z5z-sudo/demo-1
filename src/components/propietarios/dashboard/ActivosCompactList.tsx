import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Home, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos: Contrato[];
  onOpenActivo: (propertyId: string) => void;
  filterPropertyId?: string | null;
}

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

type Estado = "cobrado" | "pendiente" | "vencido" | "sin_alquiler";

export default function ActivosCompactList({ properties, inquilinos, pagos, contratos, onOpenActivo, filterPropertyId }: Props) {
  const navigate = useNavigate();
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  const rows = useMemo(() => {
    const visibles = filterPropertyId ? properties.filter(p => p.id === filterPropertyId) : properties;
    return visibles.map(p => {
      const tenants = inquilinos.filter(i => i.property_id === p.id && i.rol_inquilino !== "avalista");
      const renta = resolveRentaEsperada(p.id, inquilinos, contratos, { mes, anio }) || 0;
      const pagosMes = pagos.filter(x => x.property_id === p.id && x.mes === mes && x.anio === anio && Number(x.importe_pagado || 0) > 0);
      const cobrado = pagosMes.reduce((s, x) => s + Number(x.importe_pagado || 0), 0);
      const valor = (p as any).valor_mercado_manual ?? (p as any).valor_estimado ?? 0;
      const rentNetaPct = valor > 0 && renta > 0 ? ((renta * 12 * 0.85) / valor) * 100 : null;

      let estado: Estado;
      if (tenants.length === 0) estado = "sin_alquiler";
      else if (cobrado >= renta && renta > 0) estado = "cobrado";
      else if (now.getDate() > 10) estado = "vencido";
      else estado = "pendiente";

      const parteVia = [(p as any).nombre_via, (p as any).numero].filter(Boolean).join(" ");
      const parteLugar = (p as any).municipio || (p as any).ciudad || "";
      const direccion = [parteVia, parteLugar].filter(Boolean).join(" · ");
      const nombre = (p as any).nombre_interno || (p as any).direccion || "Activo";

      const primeraParte = direccion.split("·")[0]?.trim().toLowerCase() || "";
      const esRedundante = !!direccion && primeraParte.length > 0 && nombre.toLowerCase().includes(primeraParte);
      return { id: p.id, nombre, direccion, esRedundante, renta, rentNetaPct, estado };
    });
  }, [properties, inquilinos, pagos, contratos, mes, anio, now, filterPropertyId]);

  const estadoBadge: Record<Estado, { label: string; cls: string; dot: string }> = {
    cobrado: { label: "Cobrado", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
    pendiente: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
    vencido: { label: "Vencido", cls: "bg-rose-50 text-rose-700 border-rose-100", dot: "bg-rose-500" },
    sin_alquiler: { label: "Sin alquiler", cls: "bg-secondary text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm"
    >
      <div className="flex items-center justify-between px-5 py-3 bg-secondary/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Home size={14} className="text-muted-foreground" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Activos</span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {rows.length} {rows.length === 1 ? "inmueble" : "inmuebles"}
            {filterPropertyId ? " · filtrado" : ""}
          </span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {rows.map((r) => {
          const b = estadoBadge[r.estado];
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpenActivo(r.id)}
              className="group relative w-full text-left grid grid-cols-12 items-center gap-2 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
            >
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: "hsl(var(--accent-mint))" }}
              />
              <div className="col-span-12 md:col-span-6 min-w-0 pl-2">
                <div className="text-sm font-semibold text-foreground truncate">{r.nombre}</div>
                {r.direccion && !r.esRedundante && <div className="text-[11px] text-muted-foreground truncate">{r.direccion}</div>}
              </div>
              <div className="hidden md:block col-span-2 text-right">
                <div className="text-xs font-mono text-foreground">
                  {r.rentNetaPct !== null ? `${r.rentNetaPct.toFixed(2).replace(".", ",")} %` : "—"}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">rent. neta</div>
              </div>
              <div className="col-span-6 md:col-span-2 text-right">
                <div className="text-sm font-mono font-semibold text-foreground">{fmt(r.renta)} €</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">renta/mes</div>
              </div>
              <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
                  {b.label}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/finanzas?propertyId=${r.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      navigate(`/finanzas?propertyId=${r.id}`);
                    }
                  }}
                  title="Ver finanzas"
                  aria-label="Ver finanzas del activo"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border bg-background hover:bg-secondary text-foreground transition-colors"
                >
                  <Wallet size={12} />
                  Finanzas
                </span>
                <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
