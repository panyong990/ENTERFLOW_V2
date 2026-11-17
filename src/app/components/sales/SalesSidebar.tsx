import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "../Sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";

export function SalesSidebar({ active, onNavigate, onLogout, userName }: { active: string; onNavigate: (id: string) => void; onLogout: () => void; userName: string }) {
  const [open, setOpen] = useState(false);
  return <><div className="hidden md:flex"><Sidebar role="sales" active={active} onNavigate={onNavigate} onLogout={onLogout} userName={userName} /></div><div className="w-12 shrink-0 bg-[#1A2B4A] pt-3 text-white md:hidden"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger aria-label="Open Sales navigation" className="h-10 w-12"><Menu size={20} className="mx-auto" /></SheetTrigger><SheetContent side="left" className="w-[240px] gap-0 border-0 p-0 [&>button]:text-white"><SheetTitle className="sr-only">Sales navigation</SheetTitle><Sidebar role="sales" active={active} onNavigate={id => { onNavigate(id); setOpen(false); }} onLogout={onLogout} userName={userName} /></SheetContent></Sheet></div></>;
}
