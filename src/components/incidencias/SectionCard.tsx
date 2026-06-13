import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}

export const FormRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2 items-start py-1.5">
    <label className="text-sm text-muted-foreground md:pt-2">{label}</label>
    <div>{children}</div>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }: SectionCardProps) => (
  <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
      <Icon size={18} className="text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export default SectionCard;
