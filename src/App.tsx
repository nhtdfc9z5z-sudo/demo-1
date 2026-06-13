import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { AltaAlquilerProvider } from "@/components/propietarios/AltaAlquilerContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index";
import Login from "./pages/Login";
import PropietariosPanel from "./pages/PropietariosPanel";
import InquilinoPortal from "./pages/InquilinoPortal";
import NotFound from "./pages/NotFound";
import Tesoreria from "./pages/Tesoreria";
import BackfillContratoIdPage from "./pages/BackfillContratoIdPage";
import ReconciliacionPagosPage from "./pages/ReconciliacionPagosPage";
import Sprint3TelemetriaPage from "./pages/Sprint3TelemetriaPage";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/propietarios" element={
          <PageTransition><ProtectedRoute><PropietariosPanel /></ProtectedRoute></PageTransition>
        } />
        <Route path="/finanzas" element={
          <PageTransition><ProtectedRoute><Tesoreria /></ProtectedRoute></PageTransition>
        } />
        <Route path="/inquilinos" element={
          <PageTransition><ProtectedRoute><InquilinoPortal /></ProtectedRoute></PageTransition>
        } />
        <Route path="/admin/backfill-contratos" element={
          <PageTransition><BackfillContratoIdPage /></PageTransition>
        } />
        <Route path="/admin/reconciliacion-pagos" element={
          <PageTransition><ReconciliacionPagosPage /></PageTransition>
        } />
        <Route path="/admin/sprint3-telemetria" element={
          <PageTransition><Sprint3TelemetriaPage /></PageTransition>
        } />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AltaAlquilerProvider>
            <AnimatedRoutes />
          </AltaAlquilerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;