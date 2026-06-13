import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus, Trash2, Info, ChevronDown, ChevronUp, Scale, Wallet } from "lucide-react";
import { useFianzas } from "@/hooks/useFianzas";
import {
  useGarantiasAdicionales,
  TIPOS_GARANTIA,
  ESTADOS_GARANTIA,
  type GarantiaAdicional,
} from "@/hooks/useGarantiasAdicionales";
import type { Contrato } from "@/hooks/useContratos";

interface Props {
  contrato: Contrato;
}

export default function FianzaGarantiasSection({ contrato }: Props) {
  const { fianzas, createFianza, updateFianza } = useFianzas();
  const { garantias, createGarantia, updateGarantia, deleteGarantia } = useGarantiasAdicionales(contrato.id);

  // Fianza vinculada a este contrato (por property + inquilino)
  const fianzaActual = useMemo(
    () =>
      fianzas.find(
        (f) =>
          f.property_id === contrato.property_id &&
          (!contrato.inquilino_id || f.inquilino_id === contrato.inquilino_id),
      ),
    [fianzas, contrato.property_id, contrato.inquilino_id],
  );

  const [addingFianza, setAddingFianza] = useState(false);
  const [fianzaImporte, setFianzaImporte] = useState(String(contrato.fianza_importe || contrato.renta_mensual || ""));
  const [fianzaFecha, setFianzaFecha] = useState(contrato.fecha_inicio || "");

  const [addingGarantia, setAddingGarantia] = useState(false);
  const [nuevaGarantia, setNuevaGarantia] = useState<Partial<GarantiaAdicional>>({
    tipo: "metalico",
    estado: "vigente",
    importe: 0,
  });
  const [garantiaAvanzada, setGarantiaAvanzada] = useState(false);

  async function guardarFianza() {
    if (!fianzaImporte) return;
    await createFianza({
      property_id: contrato.property_id,
      inquilino_id: contrato.inquilino_id,
      importe: Number(fianzaImporte),
      fecha_deposito: fianzaFecha || null,
      estado: "pendiente",
      comunidad_autonoma: null,
      organismo: null,
      meses_fianza: 1,
    });
    setAddingFianza(false);
  }

  async function guardarGarantia() {
    if (!nuevaGarantia.importe) return;
    await createGarantia({
      contrato_id: contrato.id,
      property_id: contrato.property_id,
      inquilino_id: contrato.inquilino_id,
      ...nuevaGarantia,
    });
    setNuevaGarantia({ tipo: "metalico", estado: "vigente", importe: 0 });
    setAddingGarantia(false);
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          Fianza y garantías
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Aviso tranquilo: independencia de la renta */}
        <div className="rounded-md bg-sky-50 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 p-3 flex items-start gap-2">
          <Info size={14} className="text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
          <p className="text-xs text-sky-900/80 dark:text-sky-200/80 leading-relaxed">
            La fianza y las garantías son independientes de la renta. Si actualizas la renta, esto no se toca.
          </p>
        </div>

        {/* FIANZA LEGAL */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-muted-foreground" />
              <div>
                <h4 className="text-sm font-semibold leading-none">Fianza</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">La del contrato oficial</p>
              </div>
            </div>
            {!fianzaActual && !addingFianza && (
              <Button size="sm" variant="outline" onClick={() => setAddingFianza(true)}>
                <Plus size={14} className="mr-1" />
                Registrar
              </Button>
            )}
          </div>

          {fianzaActual ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {Number(fianzaActual.importe).toLocaleString("es-ES")} €
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {fianzaActual.estado.replace("_", " ")}
                </Badge>
              </div>
              {fianzaActual.fecha_deposito && (
                <p className="text-xs text-muted-foreground">
                  Depositada: {new Date(fianzaActual.fecha_deposito).toLocaleDateString("es-ES")}
                </p>
              )}
              <Select
                value={fianzaActual.estado}
                onValueChange={(v) => updateFianza(fianzaActual.id, { estado: v })}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente de depositar</SelectItem>
                  <SelectItem value="depositada">Depositada</SelectItem>
                  <SelectItem value="devolucion_solicitada">Devolución solicitada</SelectItem>
                  <SelectItem value="devuelta">Devuelta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : addingFianza ? (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Importe (€)</Label>
                  <Input
                    type="number"
                    value={fianzaImporte}
                    onChange={(e) => setFianzaImporte(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha entrega</Label>
                  <Input
                    type="date"
                    value={fianzaFecha}
                    onChange={(e) => setFianzaFecha(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAddingFianza(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardarFianza}>Guardar</Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aún no la has registrado. Puedes completarla cuando quieras.
            </p>
          )}
        </section>

        {/* Separador visual entre bloques */}
        <div className="border-t border-border/60" />

        {/* GARANTÍAS ADICIONALES */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-muted-foreground" />
              <div>
                <h4 className="text-sm font-semibold leading-none">Otras garantías</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Aval, depósito extra o seguro</p>
              </div>
            </div>
            {!addingGarantia && (
              <Button size="sm" variant="outline" onClick={() => setAddingGarantia(true)}>
                <Plus size={14} className="mr-1" />
                Añadir
              </Button>
            )}
          </div>

          {garantias.length === 0 && !addingGarantia && (
            <p className="text-xs text-muted-foreground">
              Aún no hay garantías extra. Son opcionales y se gestionan aparte de la fianza.
            </p>
          )}

          {garantias.map((g) => (
            <div key={g.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{g.tipo}</Badge>
                  <span className="font-medium">
                    {Number(g.importe).toLocaleString("es-ES")} €
                  </span>
                  {g.mensualidades_equivalentes ? (
                    <span className="text-xs text-muted-foreground">
                      ({g.mensualidades_equivalentes} mens.)
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => deleteGarantia(g.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar garantía"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  value={g.estado}
                  onValueChange={(v) => updateGarantia(g.id, { estado: v as any })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_GARANTIA.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {g.fecha_entrega && (
                  <span className="text-xs text-muted-foreground self-center">
                    Entrega: {new Date(g.fecha_entrega).toLocaleDateString("es-ES")}
                  </span>
                )}
              </div>
              {g.notas && <p className="text-xs text-muted-foreground mt-2">{g.notas}</p>}
            </div>
          ))}

          {addingGarantia && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={nuevaGarantia.tipo}
                    onValueChange={(v) => setNuevaGarantia((p) => ({ ...p, tipo: v as any }))}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_GARANTIA.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Importe (€)</Label>
                  <Input
                    type="number"
                    value={nuevaGarantia.importe || ""}
                    onChange={(e) => setNuevaGarantia((p) => ({ ...p, importe: Number(e.target.value) }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {/* Más detalles: plegable para no saturar */}
              <button
                type="button"
                onClick={() => setGarantiaAvanzada(v => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {garantiaAvanzada ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {garantiaAvanzada ? "Ocultar detalles" : "Más detalles (opcional)"}
              </button>
              {garantiaAvanzada && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Mensualidades equivalentes</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={nuevaGarantia.mensualidades_equivalentes || ""}
                        onChange={(e) =>
                          setNuevaGarantia((p) => ({ ...p, mensualidades_equivalentes: Number(e.target.value) }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha entrega</Label>
                      <Input
                        type="date"
                        value={nuevaGarantia.fecha_entrega || ""}
                        onChange={(e) =>
                          setNuevaGarantia((p) => ({ ...p, fecha_entrega: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notas</Label>
                    <Textarea
                      rows={2}
                      value={nuevaGarantia.notas || ""}
                      onChange={(e) => setNuevaGarantia((p) => ({ ...p, notas: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAddingGarantia(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardarGarantia}>Guardar</Button>
              </div>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}