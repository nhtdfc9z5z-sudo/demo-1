import { Brand } from "./Brand";

const Footer = () => {
  return (
    <footer className="border-t border-border/60 py-12 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Brand size="sm" showTagline />

          <div className="flex gap-8">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacidad</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Términos</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contacto</a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} CapitalRent. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;