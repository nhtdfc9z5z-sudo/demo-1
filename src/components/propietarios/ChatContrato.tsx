import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import type { Contrato } from "@/hooks/useContratos";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import { supabase } from "@/integrations/supabase/client";

interface ChatContratoProps {
  contrato: Contrato;
  property?: Property;
  inquilino?: Inquilino | null;
  onClose: () => void;
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-contrato`;

const ChatContrato = ({ contrato, property, inquilino, onClose }: ChatContratoProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const buildContext = () => {
    const parts: string[] = [];
    parts.push(`Título: ${contrato.titulo}`);
    parts.push(`Estado: ${contrato.estado}`);
    if (contrato.fecha_inicio) parts.push(`Fecha inicio: ${contrato.fecha_inicio}`);
    if (contrato.fecha_fin) parts.push(`Fecha fin: ${contrato.fecha_fin}`);
    if (contrato.renta_mensual) parts.push(`Renta mensual: ${contrato.renta_mensual} €`);
    if (contrato.notas) parts.push(`Notas/Cláusulas: ${contrato.notas}`);
    if (property) {
      parts.push(`Vivienda: ${property.nombre_interno}`);
      if (property.direccion_completa) parts.push(`Dirección: ${property.direccion_completa}`);
    }
    if (inquilino) {
      parts.push(`Inquilino: ${inquilino.nombre}${inquilino.apellidos ? " " + inquilino.apellidos : ""}`);
      if (inquilino.renta_mensual) parts.push(`Renta del inquilino: ${inquilino.renta_mensual} €`);
    }
    return parts.join("\n");
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      if (!accessToken) {
        throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          contratoContext: buildContext(),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al procesar. Inténtalo de nuevo." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Chat sobre el contrato</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Pregúntame sobre cláusulas, renovaciones, pagos o cualquier duda del contrato.</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {["¿Cuándo se renueva el contrato?", "¿Quién paga los suministros?", "¿Se renueva automáticamente?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={12} className="text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs prose-p:my-1 prose-li:my-0 max-w-none [&>*]:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User size={12} className="text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 size={12} className="text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground">Pensando…</div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre el contrato…"
            className="text-xs h-8"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim() || isLoading}>
            <Send size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatContrato;
