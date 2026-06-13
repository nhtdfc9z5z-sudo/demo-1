import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export const Field = ({ label, children }: FieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  onBlur?: () => void;
}

export const TextField = ({ label, value, onChange, placeholder, type = "text", onBlur }: TextFieldProps) => (
  <Field label={label}>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="h-10 rounded-xl text-sm"
    />
  </Field>
);

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}

export const NumberField = ({ label, value, onChange, placeholder, suffix }: NumberFieldProps) => (
  <Field label={label}>
    <div className="relative">
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder={placeholder}
        className="h-10 rounded-xl text-sm"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  </Field>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = ({ label, value, onChange, options, placeholder }: SelectFieldProps) => (
  <Field label={label}>
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-xl text-sm">
        <SelectValue placeholder={placeholder || "Seleccionar"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

interface SelectFieldWithOtherProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  otherPlaceholder?: string;
}

export const SelectFieldWithOther = ({ label, value, onChange, options, placeholder, otherPlaceholder = "Especificar..." }: SelectFieldWithOtherProps) => {
  const predefinedValues = options.filter(o => o.value !== "otro").map(o => o.value);
  const isCustom = value !== "" && !predefinedValues.includes(value);
  const [showOther, setShowOther] = useState(isCustom);
  const [customText, setCustomText] = useState(isCustom ? value : "");

  useEffect(() => {
    const custom = value !== "" && !predefinedValues.includes(value);
    setShowOther(custom);
    if (custom) setCustomText(value);
  }, [value]);

  const handleSelectChange = (v: string) => {
    if (v === "otro") {
      setShowOther(true);
      setCustomText("");
      onChange("");
    } else {
      setShowOther(false);
      setCustomText("");
      onChange(v);
    }
  };

  return (
    <Field label={label}>
      <Select value={showOther ? "otro" : (value || undefined)} onValueChange={handleSelectChange}>
        <SelectTrigger className="h-10 rounded-xl text-sm">
          <SelectValue placeholder={placeholder || "Seleccionar"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showOther && (
        <Input
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={otherPlaceholder}
          className="h-10 rounded-xl text-sm mt-1.5"
          autoFocus
        />
      )}
    </Field>
  );
};

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export const SwitchField = ({ label, checked, onChange }: SwitchFieldProps) => (
  <div className="flex items-center justify-between py-1">
    <Label className="text-sm text-foreground">{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
