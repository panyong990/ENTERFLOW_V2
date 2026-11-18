import { useId, type ReactNode } from "react";
import { Bell, Building2, ChevronDown, ChevronUp, LockKeyhole, Truck, UserRound } from "lucide-react";

const icons = { company: Building2, contact: UserRound, delivery: Truck, notifications: Bell, password: LockKeyhole };

export function CompanySettingsSection({ id, title, description, expanded, onToggle, children }: {
  id: keyof typeof icons;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const sectionId = useId();
  const Icon = icons[id];
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <section className="min-w-0 rounded-xl border border-slate-200/70 bg-white" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <h2>
        <button
          type="button"
          id={`${sectionId}-trigger`}
          aria-expanded={expanded}
          aria-controls={`${sectionId}-panel`}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:px-5"
        >
          <Icon aria-hidden="true" size={18} className="shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="block font-syne text-sm font-bold text-slate-900">{title}</span>
            <span className="mt-0.5 block font-dm text-xs font-normal text-slate-500">{description}</span>
          </span>
          <Chevron aria-hidden="true" size={18} className="shrink-0 text-slate-400" />
        </button>
      </h2>
      <div id={`${sectionId}-panel`} role="region" aria-labelledby={`${sectionId}-trigger`} hidden={!expanded} className="border-t border-slate-200/70 p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}
