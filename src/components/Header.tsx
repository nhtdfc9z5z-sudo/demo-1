import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";

const primaryItems = [
  { label: "Propietarios", to: "/login", primary: true },
  { label: "Inquilinos", to: "/login?role=inquilino", primary: false },
];

const upcomingItems = [
  "Gestor",
  "Fincas",
  "Ojeador",
  "Proveedores",
  "Rent to rent",
  "Vacacional",
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-2xl border-b border-border/60">
      <nav className="max-w-7xl mx-auto px-6 h-[var(--nav-height)] flex items-center justify-between">
        {/* Logo — bigger, with breathing room */}
        <div className="flex items-center gap-10">
          <Brand size="lg" />

          {/* Product modules with hierarchy */}
          <ul className="hidden lg:flex items-center gap-1">
            {primaryItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className={
                    item.primary
                      ? "px-4 py-2 rounded-full text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
                      : "px-4 py-2 rounded-full text-sm font-semibold text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mx-2 h-5 w-px bg-border" />
            {upcomingItems.map((label) => (
              <li key={label}>
                <span className="px-3 py-2 rounded-full text-xs font-medium text-muted-foreground/60 cursor-default relative group/nav">
                  {label}
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-widest uppercase text-primary/80 opacity-0 group-hover/nav:opacity-100 transition-opacity whitespace-nowrap">
                    Próximamente
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            to="/login"
            className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            Entrar
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground p-1" aria-label="Toggle menu">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 pb-6">
          <ul className="flex flex-col gap-1 pt-2">
            {primaryItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-semibold text-foreground hover:text-primary rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {upcomingItems.map((label) => (
              <li key={label}>
                <span className="block px-3 py-2.5 text-sm text-muted-foreground/50">
                  {label} <span className="text-[10px]">· Próximamente</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center px-4 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              Entrar
            </Link>
          </div>
        </motion.div>
      )}
    </header>
  );
};

export default Header;
