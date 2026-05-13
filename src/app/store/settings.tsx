import { createContext, useContext, useState, type ReactNode } from "react";

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

/* Section G — payment methods configurable in Settings, surfaced to clients in their portal. */
export interface PaymentMethod {
  id: string;
  label: string;
  type: "bank_transfer" | "gcash" | "cash" | "check" | "other";
  details: string;          // multi-line plain text shown to the client
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
  paymentMethods: PaymentMethod[];
}

const defaults: CompanySettings = {
  companyName: "Enter-Fil Industrial Products",
  addressLine1: "Sitio Hulo, Barangay Balasing",
  addressLine2: "San Jose Road, Santa Maria",
  cityProvince: "Santa Maria, Bulacan",
  zip: "3022",
  mainPhone: "+63 (2) 8861-5737",
  secondaryPhone: "+63 (2) 8653-3750",
  email: "enterfil.filtration@yahoo.com",
  officeHours: "Mon–Fri, 8:00 AM – 6:00 PM",
  defaultPlate: "ABC 1234",
  defaultDriver: "Roel Santos",
  defaultDriverContact: "+63 (956) 657-3837",
  documentFooter:
    "Enter-Fil Industrial Products · Sitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, 3022 Bulacan · +63 (2) 8861-5737 · enterfil.filtration@yahoo.com",
  bankDetails: {
    bankName: "BDO Unibank",
    accountName: "Enter-Fil Industrial Products, Inc.",
    accountNumber: "0012-3456-7890",
  },
  paymentMethods: [
    {
      id: "pm-bdo",
      label: "BDO Bank Transfer",
      type: "bank_transfer",
      details: "Bank: BDO Unibank\nAccount Name: Enter-Fil Industrial Products, Inc.\nAccount No: 0012-3456-7890\nBranch: Santa Maria, Bulacan",
    },
    {
      id: "pm-metrobank",
      label: "MetroBank Transfer",
      type: "bank_transfer",
      details: "Bank: MetroBank\nAccount Name: Enter-Fil Industrial Products, Inc.\nAccount No: 7891-23456-78\nBranch: Santa Maria, Bulacan",
    },
    {
      id: "pm-gcash",
      label: "GCash",
      type: "gcash",
      details: "GCash Number: 0956-657-3837\nAccount Name: Enter-Fil Industrial",
    },
    {
      id: "pm-cash",
      label: "Cash on Pickup",
      type: "cash",
      details: "Pay in person at:\nSitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, 3022 Bulacan\nMon–Fri 8:00 AM – 6:00 PM",
    },
  ],
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
