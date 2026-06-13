import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Home,
  Users,
  Settings,
  Building2,
  Search,
  Truck,
  Repeat,
  Palmtree,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ModuleCard {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  to?: string;
}

const modules: ModuleCard[] = [
  { icon: Home, label: "Propietarios", description: "Activos, contratos, cobros, fiscalidad y documentación.", active: true, to: "/login?role=propietario" },
  { icon: Users, label: "Inquilinos", description: "Portal del inquilino: pagos, incidencias y documentos.", active: true, to: "/login?role=inquilino" },
  { icon: Settings, label: "Gestor", description: "Carteras multipropietario y herramientas de administrador profesional.", active: false },
  { icon: Building2, label: "Fincas", description: "Comunidades de propietarios, derramas y zonas comunes.", active: false },
  { icon: Search, label: "Ojeador", description: "Detección de oportunidades de inversión y análisis de rentabilidad.", active: false },
  { icon: Truck, label: "Proveedores", description: "Red de proveedores conectada a presupuestos e incidencias.", active: false },
  { icon: Repeat, label: "Rent to rent", description: "Modelo de subarriendo con control de margen y cuentas separadas.", active: false },
  { icon: Palmtree, label: "Vacacional", description: "Alquiler turístico: calendarios, channel manager y operativa.", active: false },
];

const ModulesGrid = () => {
  return (
    <section className="py-24 px-6 bg-background relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-primary/70 mb-3 block">
            Plataforma modular · Roadmap 2026 — 2027
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            Una plataforma que crece contigo
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Empieza con propietarios e inquilinos. Activa nuevos módulos a medida que
            profesionalizas la gestión de tu patrimonio.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((mod, i) => {
            const inner = (
              <motion.div
                key={mod.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className={`group relative rounded-2xl border p-6 transition-all duration-300 h-full ${
                  mod.active
                    ? "border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                    : "border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.02] to-transparent hover:border-primary/40 transition-colors"
                }`}
              >
                {mod.active ? (
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      Disponible
                    </span>
                  </div>
                ) : (
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-primary/70">
                    <Sparkles size={10} />
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      En desarrollo
                    </span>
                  </div>
                )}

                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300 ${
                  mod.active
                    ? "bg-primary/8 text-primary group-hover:bg-primary/12"
                    : "bg-primary/5 text-primary/60"
                }`}>
                  <mod.icon size={20} strokeWidth={1.5} />
                </div>

                <h3 className={`text-sm font-semibold mb-2 ${
                  mod.active ? "text-foreground" : "text-foreground/80"
                }`}>
                  {mod.label}
                </h3>

                <p className={`text-xs leading-relaxed ${
                  mod.active ? "text-muted-foreground" : "text-muted-foreground/80"
                }`}>
                  {mod.description}
                </p>

                {mod.active && (
                  <div className="mt-4 flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Acceder <ArrowRight size={12} />
                  </div>
                )}

                {!mod.active && (
                  <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-primary/60">
                    Próximamente
                  </div>
                )}
              </motion.div>
            );

            return mod.to ? (
              <Link key={mod.label} to={mod.to} className="no-underline">
                {inner}
              </Link>
            ) : (
              <div key={mod.label}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ModulesGrid;
