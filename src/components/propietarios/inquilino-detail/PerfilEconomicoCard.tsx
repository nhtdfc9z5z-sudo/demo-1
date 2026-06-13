import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pencil, TrendingUp, X, Save } from "lucide-react";
import { usePerfilEconomico, SCORING_LABELS, SCORING_COLORS, type PerfilEconomico } from "@/hooks/usePerfilEconomico";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Contrato } from "@/hooks/useContratos";

interface PerfilEconomicoCardProps {
  inquilino: Inquilino;
  contratos: Contrato[];
}

const SITUACIONES = [
  { value: "asalariado", label: "Asalariado" },
  { value: "autonomo", label: "Autónomo" },
  { value: "pensionista", label: "Pensionista" },
  { value: "otro", label: "Otro" },
];

const PerfilEconomicoCard = ({ inquilino, contratos }: PerfilEconomicoCardProps) => {
  const { perfil, loading, upsert } = usePerfilEconomico(inquilino.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<PerfilEconomico>>({});

  const activeContrato = contratos.find(c => c.inquilino_id === inquilino.id && !c.archivado && c.estado !== "finalizado");
  const rentaContrato = activeContrato?.renta_mensual != null ? Number(activeContrato.renta_mensual) : null;

  const startEdit = () => {
    setForm({
      ingresos_mensuales: perfil?.ingresos_mensuales ?? null,
      ingresos_tipo: perfil?.ingresos_tipo ?? "netos",
      situacion_laboral: perfil?.situacion_laboral ?? inquilino.tipo_inquilino ?? "asalariado",
      empresa_actual: perfil?.empresa_actual ?? null,
      antiguedad_laboral_meses: perfil?.antiguedad_laboral_meses ?? null,
      renta_maxima_estimada: perfil?.renta_maxima_estimada ?? null,
      scoring_estado: perfil?.scoring_estado ?? "sin_datos",
      scoring_notas: perfil?.scoring_notas ?? null,
      tiene_aval_bancario: perfil?.tiene_aval_bancario ?? false,
      deudas_conocidas: perfil?.deudas_conocidas ?? false,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    // Calculate ratio if we have data
    const ingresos = form.ingresos_mensuales ? Number(form.ingresos_mensuales) : null;
    const renta = rentaContrato ?? (form.renta_maxima_estimada ? Number(form.renta_maxima_estimada) : null);
    let ratio: number | null = null;
    if (ingresos && ingresos > 0 && renta) {
      ratio = Math.round((renta / ingresos) * 100);
    }
    await upsert({ ...form, ratio_esfuerzo: ratio });
    setEditing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const scoringEstado = perfil?.scoring_estado || "sin_datos";
  const scoringColor = SCORING_COLORS[scoringEstado] || SCORING_COLORS.sin_datos;
  const scoringLabel = SCORING_LABELS[scoringEstado] || "Sin datos";

  // View mode
  if (!editing) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Perfil económico</h4>
              {inquilino.rol_inquilino === "avalista" && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Avalista</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${scoringColor}`}>
                {scoringLabel}
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startEdit}>
                <Pencil size={12} /> Editar
              </Button>
            </div>
          </div>

          {!perfil ? (
            <p className="text-xs text-muted-foreground italic">
              No hay datos económicos registrados. Pulsa "Editar" para añadir información de solvencia.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {perfil.ingresos_mensuales != null && (
                  <div>
                    <span className="text-muted-foreground">Ingresos: </span>
                    <span className="text-foreground font-medium">
                      {perfil.ingresos_mensuales.toLocaleString("es-ES")} €/mes
                      {perfil.ingresos_tipo ? ` (${perfil.ingresos_tipo})` : ""}
                    </span>
                  </div>
                )}
                {perfil.situacion_laboral && (
                  <div>
                    <span className="text-muted-foreground">Situación: </span>
                    <span className="text-foreground font-medium capitalize">{perfil.situacion_laboral}</span>
                  </div>
                )}
                {perfil.empresa_actual && (
                  <div>
                    <span className="text-muted-foreground">Empresa: </span>
                    <span className="text-foreground font-medium">{perfil.empresa_actual}</span>
                  </div>
                )}
                {perfil.antiguedad_laboral_meses != null && (
                  <div>
                    <span className="text-muted-foreground">Antigüedad: </span>
                    <span className="text-foreground font-medium">
                      {perfil.antiguedad_laboral_meses >= 12
                        ? `${Math.floor(perfil.antiguedad_laboral_meses / 12)} año(s)`
                        : `${perfil.antiguedad_laboral_meses} meses`}
                    </span>
                  </div>
                )}
                {perfil.renta_maxima_estimada != null && (
                  <div>
                    <span className="text-muted-foreground">Renta asumible estimada: </span>
                    <span className="text-foreground font-medium">{perfil.renta_maxima_estimada} €</span>
                  </div>
                )}
                {perfil.ratio_esfuerzo != null && (
                  <div>
                    <span className="text-muted-foreground">Ratio esfuerzo: </span>
                    <span className={`font-medium ${perfil.ratio_esfuerzo > 35 ? "text-red-600" : perfil.ratio_esfuerzo > 30 ? "text-amber-600" : "text-emerald-600"}`}>
                      {perfil.ratio_esfuerzo}%
                    </span>
                    <span className="text-muted-foreground ml-1">(orientativo)</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-muted-foreground">
                  Aval bancario: <span className="font-medium text-foreground">{perfil.tiene_aval_bancario ? "Sí" : "No"}</span>
                </span>
                <span className="text-muted-foreground">
                  Deudas conocidas: <span className="font-medium text-foreground">{perfil.deudas_conocidas ? "Sí" : "No"}</span>
                </span>
              </div>
              {perfil.scoring_notas && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 whitespace-pre-wrap">{perfil.scoring_notas}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="ring-2 ring-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Perfil económico</h4>
            {inquilino.rol_inquilino === "avalista" && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Avalista</span>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
              <X size={12} />
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
              <Save size={12} /> Guardar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ingresos mensuales (€)</label>
            <Input
              type="number"
              placeholder="2400"
              value={form.ingresos_mensuales ?? ""}
              onChange={e => setForm(f => ({ ...f, ingresos_mensuales: e.target.value ? Number(e.target.value) : null }))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <Select value={form.ingresos_tipo || "netos"} onValueChange={v => setForm(f => ({ ...f, ingresos_tipo: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="netos">Netos</SelectItem>
                <SelectItem value="brutos">Brutos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Situación laboral</label>
            <Select value={form.situacion_laboral || "asalariado"} onValueChange={v => setForm(f => ({ ...f, situacion_laboral: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SITUACIONES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Empresa actual</label>
            <Input
              placeholder="Nombre empresa"
              value={form.empresa_actual ?? ""}
              onChange={e => setForm(f => ({ ...f, empresa_actual: e.target.value || null }))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Antigüedad (meses)</label>
            <Input
              type="number"
              placeholder="36"
              value={form.antiguedad_laboral_meses ?? ""}
              onChange={e => setForm(f => ({ ...f, antiguedad_laboral_meses: e.target.value ? Number(e.target.value) : null }))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Renta asumible estimada (€)</label>
            <Input
              type="number"
              placeholder="900"
              value={form.renta_maxima_estimada ?? ""}
              onChange={e => setForm(f => ({ ...f, renta_maxima_estimada: e.target.value ? Number(e.target.value) : null }))}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Ratio preview */}
        {form.ingresos_mensuales && (rentaContrato || form.renta_maxima_estimada) && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            Ratio de esfuerzo estimado:{" "}
            <span className="font-medium text-foreground">
              {Math.round(((rentaContrato ?? Number(form.renta_maxima_estimada)) / Number(form.ingresos_mensuales)) * 100)}%
            </span>
            <span className="ml-1">(orientativo — no es criterio vinculante)</span>
          </div>
        )}

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.tiene_aval_bancario || false}
              onCheckedChange={v => setForm(f => ({ ...f, tiene_aval_bancario: v }))}
            />
            <label className="text-xs text-muted-foreground">Aval bancario</label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.deudas_conocidas || false}
              onCheckedChange={v => setForm(f => ({ ...f, deudas_conocidas: v }))}
            />
            <label className="text-xs text-muted-foreground">Deudas conocidas</label>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Evaluación del propietario</label>
          <Select value={form.scoring_estado || "sin_datos"} onValueChange={v => setForm(f => ({ ...f, scoring_estado: v }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sin_datos">Sin datos</SelectItem>
              <SelectItem value="pendiente">Pendiente de revisión</SelectItem>
              <SelectItem value="favorable">Favorable</SelectItem>
              <SelectItem value="desfavorable">Desfavorable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Notas de evaluación</label>
          <Textarea
            placeholder="Observaciones sobre solvencia, documentación revisada, etc."
            value={form.scoring_notas ?? ""}
            onChange={e => setForm(f => ({ ...f, scoring_notas: e.target.value || null }))}
            className="text-sm min-h-[60px]"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PerfilEconomicoCard;
