import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock4, TrendingUp, Building2, FileText, Wallet, AlertCircle, ChevronRight } from "lucide-react";
import { Brand } from "./Brand";

const Hero = () => {
  return (
    <section className="relative pt-28 md:pt-32 pb-16 overflow-hidden bg-gradient-to-b from-secondary/40 via-background to-background">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/[0.05] rounded-full blur-3xl pointer-events-none" />

      {/* HERO copy (compact) */}
      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-bold uppercase tracking-[0.12em]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Plataforma de gestión patrimonial
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05] text-balance"
        >
          Todo tu patrimonio
          <br />
          bajo <span className="text-primary">control.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Activos, contratos, cobros y rentabilidad en una sola plataforma.
          Diseñada para propietarios e inversores que profesionalizan su patrimonio inmobiliario.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            to="/login?role=propietario"
            className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-[0.97] shadow-xl shadow-primary/25"
          >
            Soy propietario
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/login?role=inquilino"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-card border border-border text-foreground text-sm font-bold hover:bg-muted hover:border-primary/30 transition-all active:scale-[0.97]"
          >
            Soy inquilino
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold font-mono"
        >
          Gratis para empezar · Sin tarjeta · Datos cifrados
        </motion.p>

        {/* Emotional anchor — over the canvas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex items-center justify-center gap-3"
        >
          <span className="h-px w-12 bg-border" />
          <p className="text-sm md:text-[15px] font-medium text-foreground/70 italic">
            Menos hojas de cálculo. Más rentabilidad.
          </p>
          <span className="h-px w-12 bg-border" />
        </motion.div>
      </div>

      {/* PRODUCT CANVAS — visible en primer scroll */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative max-w-6xl mx-auto px-6 mt-14"
      >
        <div className="relative p-2.5 bg-gradient-to-b from-border/60 to-border/20 rounded-[1.75rem] shadow-2xl shadow-primary/10">
          <div className="relative overflow-hidden bg-card rounded-[1.35rem] border border-border/60">
            {/* browser chrome */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-secondary/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
              </div>
              <div className="px-3 py-1 bg-background border border-border rounded-md text-[10px] text-muted-foreground font-mono">
                capitalrent.app / patrimonio
              </div>
              <div className="w-12" />
            </div>

            <div className="grid grid-cols-12 gap-px bg-border/40">
              {/* sidebar */}
              <aside className="col-span-3 bg-card p-5 space-y-6 hidden md:block">
                <div className="space-y-3">
                  <div className="pb-3 border-b border-border/60">
                    <Brand size="sm" to={false} />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase pt-2">Workspace</div>
                  <div className="space-y-1">
                    <SidebarItem icon={<Building2 size={13} />} label="Patrimonio" active />
                    <SidebarItem icon={<Wallet size={13} />} label="Tesorería" badge="8" />
                    <SidebarItem icon={<FileText size={13} />} label="Contratos" />
                    <SidebarItem icon={<AlertCircle size={13} />} label="Incidencias" badge="2" badgeTone="warn" />
                    <SidebarItem icon={<TrendingUp size={13} />} label="Fiscalidad" />
                  </div>
                </div>
                <div className="pt-4 border-t border-border/60">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase mb-3">Ocupación cartera</div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "96%" }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>11 / 12 activos</span>
                    <span className="text-primary font-semibold">96%</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/60">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase mb-2">Próxima renovación</div>
                  <div className="text-[11px] font-medium text-foreground">C/ Serrano 42 · 3ºB</div>
                  <div className="text-[10px] font-mono text-muted-foreground">14 jul 2026 · IPC +3,2 %</div>
                </div>
              </aside>

              {/* main */}
              <div className="col-span-12 md:col-span-9 bg-card p-6 md:p-8">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Patrimonio</h3>
                    <p className="text-sm text-muted-foreground">Cartera consolidada · Ejercicio 2026</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">Valor patrimonial</div>
                    <div className="text-2xl font-semibold text-foreground font-mono tracking-tight">2.847.500 €</div>
                    <div className="text-[10px] font-mono text-emerald-600 font-semibold">▲ 4,8 % vs. tasación 2025</div>
                  </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                  <KpiCard label="Cobrado junio" value="13.620 €" sub="esperado 14.880 € · 92 %" icon={<CheckCircle2 size={14} />} tone="success" />
                  <KpiCard label="Rentabilidad neta" value="6,42 %" sub="bruta 7,84 %" icon={<TrendingUp size={14} />} tone="primary" />
                  <KpiCard label="Incidencias" value="2 abiertas" sub="1 alta · 1 media" icon={<Clock4 size={14} />} tone="warning" />
                </div>

                {/* Asset list — feels like the real app */}
                <div className="rounded-xl border border-border/60 mb-4 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/40 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Activos</span>
                      <span className="text-[10px] font-mono text-muted-foreground/70">12 inmuebles</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">Junio 2026</div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {[
                      { ref: "MAD-04", name: "C/ Serrano 42 · 3ºB", city: "Madrid · Salamanca", rent: "1.450", yld: "5,8 %", state: "Cobrado", tone: "ok" },
                      { ref: "BCN-07", name: "Avda. Diagonal 188 · 4ª", city: "Barcelona · Eixample", rent: "1.820", yld: "6,1 %", state: "Cobrado", tone: "ok" },
                      { ref: "VLC-11", name: "C/ Colón 17 · bajo", city: "Valencia · L'Eixample", rent: "1.260", yld: "7,4 %", state: "Pendiente", tone: "warn" },
                      { ref: "SEV-02", name: "Pza. Nueva 6 · ático", city: "Sevilla · Casco Antiguo", rent: "1.090", yld: "6,9 %", state: "Cobrado", tone: "ok" },
                    ].map((a) => (
                      <div key={a.ref} className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                        <div className="col-span-1 text-[10px] font-mono text-muted-foreground">{a.ref}</div>
                        <div className="col-span-5 min-w-0">
                          <div className="text-[12px] font-semibold text-foreground truncate">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground">{a.city}</div>
                        </div>
                        <div className="col-span-2 text-right hidden md:block">
                          <div className="text-[11px] font-mono text-foreground">{a.yld}</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">rent. neta</div>
                        </div>
                        <div className="col-span-2 text-right">
                          <div className="text-[12px] font-mono font-semibold text-foreground">{a.rent} €</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">renta/mes</div>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            a.tone === "ok"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${a.tone === "ok" ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {a.state}
                          </span>
                          <ChevronRight size={12} className="text-muted-foreground/40" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* treasury mini chart */}
                <div className="rounded-xl border border-border/60 p-4 bg-gradient-to-t from-primary/[0.04] to-transparent relative overflow-hidden h-28">
                  <div className="flex justify-between relative z-10">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Tesorería neta · 12 meses</div>
                      <div className="text-[15px] font-mono font-semibold text-foreground mt-0.5">+ 132.480 €</div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 font-mono">+12,4 % vs 2025</span>
                  </div>
                  <svg className="absolute bottom-0 left-0 w-full h-16" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path d="M0,38 L8,32 L18,30 L28,22 L38,26 L48,18 L58,20 L68,12 L78,15 L88,8 L100,10 L100,40 L0,40 Z" fill="hsl(var(--primary) / 0.12)" />
                    <path d="M0,38 L8,32 L18,30 L28,22 L38,26 L48,18 L58,20 L68,12 L78,15 L88,8 L100,10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust band */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
          {[
            { k: "Control de cobros", v: "Renta, deuda y compensaciones" },
            { k: "Fiscalidad preparada", v: "IRPF consolidado por activo" },
            { k: "Multiinmueble", v: "Cartera global en una vista" },
            { k: "Documentación", v: "Contratos y facturas centralizados" },
          ].map((s) => (
            <div key={s.k} className="bg-card px-5 py-4 text-center md:text-left">
              <div className="text-sm md:text-[15px] font-bold text-foreground tracking-tight">{s.k}</div>
              <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-snug">{s.v}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

const SidebarItem = ({
  icon,
  label,
  active,
  badge,
  badgeTone = "muted",
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  badgeTone?: "muted" | "warn";
}) => (
  <div
    className={`h-9 rounded-lg flex items-center justify-between px-3 text-xs ${
      active
        ? "bg-primary/10 border border-primary/15 text-primary font-semibold"
        : "text-muted-foreground font-medium hover:bg-secondary/60"
    }`}
  >
    <span className="flex items-center gap-2.5">
      {icon}
      {label}
    </span>
    {badge && (
      <span
        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
          badgeTone === "warn"
            ? "bg-amber-100 text-amber-700"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {badge}
      </span>
    )}
  </div>
);

const KpiCard = ({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: "success" | "primary" | "warning";
}) => {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
      : tone === "warning"
      ? "text-amber-600 bg-amber-50 border-amber-100"
      : "text-primary bg-primary/10 border-primary/15";
  return (
    <div className="p-3 md:p-4 rounded-xl bg-secondary/40 border border-border/60">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{label}</div>
        <div className={`w-6 h-6 rounded-md border flex items-center justify-center ${toneCls}`}>{icon}</div>
      </div>
      <div className="text-lg md:text-xl font-semibold text-foreground font-mono tracking-tight">{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
};

export default Hero;
