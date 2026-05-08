import { createContext, useContext, useState, type ReactNode } from "react";

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface CompanySettings {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  cityProvince: string;
  zip: string;
  mainPhone: string;
  secondaryPhone: string;
  email: string;
  officeHours: string;
  defaultPlate: string;
  defaultDriver: string;
  defaultDriverContact: string;
  documentFooter: string;
  bankDetails: BankDetails;
}

const defaults: CompanySettings = {
  companyName: "Enter-Fil Industrial Products",
  addressLine1: "Block 12 Lot 4, Diamond St.",
  addressLine2: "Carmona Industrial Estate",
  cityProvince: "Carmona, Cavite",
  zip: "4116",
  mainPhone: "+63 (046) 430-1234",
  secondaryPhone: "+63 (917) 555-0140",
  email: "sales@enter-fil.ph",
  officeHours: "Mon–Sat, 8:00 AM – 5:00 PM",
  defaultPlate: "ABC 1234",
  defaultDriver: "Roel Santos",
  defaultDriverContact: "+63 (917) 555-2244",
  documentFooter:
    "Enter-Fil Industrial Products · Block 12 Lot 4 Diamond St., Carmona Industrial Estate, Cavite 4116 · +63 (046) 430-1234 · sales@enter-fil.ph",
  bankDetails: {
    bankName: "BDO Unibank",
    accountName: "Enter-Fil Industrial Products, Inc.",
    accountNumber: "0012-3456-7890",
  },
};

interface Ctx {
  settings: CompanySettings;
  update: (patch: Partial<CompanySettings>) => void;
  save: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(defaults);
  const update: Ctx["update"] = (patch) => setSettings((p) => ({ ...p, ...patch }));
  const save: Ctx["save"] = () => {};
  return (
    <SettingsContext.Provider value={{ settings, update, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings must be used inside SettingsProvider");
  return c;
}
