import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { setWhatsAppPreference } from "@/lib/whatsappUtils";

export interface ProfileData {
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  nif: string;
  direccion: string;
  preferencia_contacto: string;
  completed: boolean;
  iban: string;
  telefono_bizum: string;
  whatsapp_app: string;
}

const emptyProfile: ProfileData = {
  nombre: "",
  apellidos: "",
  telefono: "",
  email: "",
  nif: "",
  direccion: "",
  preferencia_contacto: "Email",
  completed: false,
  iban: "",
  telefono_bizum: "",
  whatsapp_app: "whatsapp",
};

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile = emptyProfile, isLoading: loading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return emptyProfile;
      const { data, error } = await supabase
        .from("profiles")
        .select("nombre, apellidos, telefono, email, nif, direccion, preferencia_contacto, completed, iban, telefono_bizum, whatsapp_app")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { ...emptyProfile, email: user.email ?? "" };
      const waApp = (data as any).whatsapp_app ?? "whatsapp";
      setWhatsAppPreference(waApp as any);

      return {
        nombre: data.nombre ?? "",
        apellidos: data.apellidos ?? "",
        telefono: data.telefono ?? "",
        email: data.email ?? user.email ?? "",
        nif: (data as any).nif ?? "",
        direccion: (data as any).direccion ?? "",
        preferencia_contacto: data.preferencia_contacto ?? "Email",
        completed: data.completed ?? false,
        iban: (data as any).iban ?? "",
        telefono_bizum: (data as any).telefono_bizum ?? "",
        whatsapp_app: waApp,
      };
    },
    enabled: !!user,
  });

  const saveMut = useMutation({
    mutationFn: async (data: ProfileData) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("profiles")
        .update({
          nombre: data.nombre,
          apellidos: data.apellidos,
          telefono: data.telefono,
          email: data.email,
          nif: data.nif,
          direccion: data.direccion || null,
          preferencia_contacto: data.preferencia_contacto,
          iban: data.iban || null,
          telefono_bizum: data.telefono_bizum || null,
          whatsapp_app: data.whatsapp_app || "whatsapp",
          completed: true,
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil guardado", description: "Tu información se ha actualizado correctamente." });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el perfil.", variant: "destructive" });
    },
  });

  const saveProfile = async (data: ProfileData) => {
    try { await saveMut.mutateAsync(data); } catch {}
  };

  return { profile, loading, saveProfile, refetch: () => queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }) };
}
