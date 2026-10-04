export interface ClientCompanySettings {
  companyName: string;
  industry: string;
  addressLine1: string;
  addressLine2: string;
  cityProvince: string;
  zip: string;
}

const storageKey = (clientName: string) =>
  `enterflow.client-company-settings.v1:${clientName.trim().toLocaleLowerCase()}`;

export function getClientCompanySettings(clientName: string): ClientCompanySettings | null {
  const serialized = window.localStorage.getItem(storageKey(clientName));
  if (!serialized) return null;

  const settings: unknown = JSON.parse(serialized);
  if (
    typeof settings !== "object" || settings === null ||
    !("companyName" in settings) || typeof settings.companyName !== "string" ||
    !("industry" in settings) || typeof settings.industry !== "string" ||
    !("addressLine1" in settings) || typeof settings.addressLine1 !== "string" ||
    !("addressLine2" in settings) || typeof settings.addressLine2 !== "string" ||
    !("cityProvince" in settings) || typeof settings.cityProvince !== "string" ||
    !("zip" in settings) || typeof settings.zip !== "string"
  ) {
    throw new Error(`Saved company settings for "${clientName}" are invalid.`);
  }

  return settings;
}

export function saveClientCompanySettings(clientName: string, settings: ClientCompanySettings): void {
  window.localStorage.setItem(storageKey(clientName), JSON.stringify(settings));
}

export function clientCompanyAddress(settings: ClientCompanySettings | null): string {
  if (!settings) return "Address not provided";

  const address = [
    settings.addressLine1.trim(),
    settings.addressLine2.trim(),
    settings.cityProvince.trim(),
    settings.zip.trim(),
  ].filter(Boolean).join(", ");

  return address || "Address not provided";
}
