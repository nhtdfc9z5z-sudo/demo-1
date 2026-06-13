import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff, Loader2, Home, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "inquilino" ? "inquilino" : "propietario";
  const [role, setRole] = useState<"propietario" | "inquilino">(initialRole);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Rellena email y contraseña.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Contraseña muy corta", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const translateError = (msg: string) => {
      if (msg.includes("Invalid login credentials")) return "Email o contraseña incorrectos. ¿Ya tienes cuenta?";
      if (msg.includes("User already registered")) return "Este email ya está registrado. Pulsa 'Ya tengo cuenta' para acceder.";
      if (msg.includes("weak_password") || msg.includes("at least")) return "La contraseña debe tener al menos 6 caracteres.";
      return msg;
    };

    if (isSignUp) {
      const { error } = await signUp(email, password, role);
      if (error) {
        toast({ title: "Error al registrarse", description: translateError(error.message), variant: "destructive" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("user_roles").insert({ user_id: user.id, role });
          if (role === "inquilino") {
            const { data: linkResult } = await supabase.rpc("link_tenant_auth", { p_email: email });
            const res = linkResult as unknown as { success: boolean; error?: string };
            if (!res?.success) {
              toast({ title: "Acceso denegado", description: res?.error || "Tu email no está registrado como inquilino activo. Contacta con tu propietario.", variant: "destructive" });
              await supabase.auth.signOut();
              setSubmitting(false);
              return;
            }
          }
        }
        toast({ title: "¡Cuenta creada!", description: "Bienvenido. Ya puedes empezar." });
        navigate(role === "propietario" ? "/propietarios" : "/inquilinos");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "No se pudo acceder", description: translateError(error.message), variant: "destructive" });
      } else {
        if (role === "inquilino") {
          const { data: linkResult } = await supabase.rpc("link_tenant_auth", { p_email: email });
          const res = linkResult as unknown as { success: boolean; error?: string };
          if (!res?.success) {
            const { data: existing } = await supabase.from("inquilinos").select("id").eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();
            if (!existing) {
              toast({ title: "Acceso denegado", description: "No tienes un perfil de inquilino activo.", variant: "destructive" });
              await supabase.auth.signOut();
              setSubmitting(false);
              return;
            }
          }
        }
        navigate(role === "propietario" ? "/propietarios" : "/inquilinos");
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-background to-muted/30" />
      <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-[400px]"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Card container */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-xl shadow-black/[0.03]">
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center"
            >
              <Brand size="lg" to={false} className="flex-col gap-2" />
              <span className="text-[11px] text-muted-foreground/70 tracking-wide mt-1">Control de activos inmobiliarios</span>
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.h1
                key={isSignUp ? "signup" : "login"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="text-2xl font-bold text-foreground tracking-tight mt-4"
              >
                {isSignUp ? "Crear cuenta" : "Bienvenido"}
              </motion.h1>
            </AnimatePresence>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isSignUp ? "Regístrate para empezar" : "Accede a tu cuenta"}
            </p>
          </div>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 mb-7">
            {(["propietario", "inquilino"] as const).map((r) => {
              const active = role === r;
              const Icon = r === "propietario" ? Home : Users;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`relative flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={15} />
                  <span>{r === "propietario" ? "Propietario" : "Inquilino"}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-12 rounded-xl bg-background/80 border-border text-sm px-4 transition-shadow focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="h-12 rounded-xl bg-background/80 border-border text-sm px-4 pr-11 transition-shadow focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] shadow-md shadow-primary/20"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                isSignUp ? "Registrarse" : "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:underline font-medium transition-colors"
            >
              {isSignUp ? "Ya tengo cuenta" : "Crear cuenta nueva"}
            </button>
            <br />
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        {role === "inquilino" && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 border border-border/40"
          >
            💡 Para acceder como inquilino, tu propietario debe haberte registrado primero con tu email en la plataforma.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
