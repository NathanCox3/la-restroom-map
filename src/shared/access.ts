import type { AccessType, WheelchairStatus } from "./types";

export function normalizeAccess(value: string | null | undefined): AccessType {
  const access = value?.trim().toLowerCase();
  if (!access) return "unknown";
  if (["yes", "public", "permissive", "designated"].includes(access)) return "public";
  if (["customers", "customer", "destination"].includes(access)) return "customers";
  if (["private", "no", "restricted", "employees"].includes(access)) return "restricted";
  return "unknown";
}

export function normalizeWheelchair(value: string | null | undefined): WheelchairStatus {
  const wheelchair = value?.trim().toLowerCase();
  if (!wheelchair) return "unknown";
  if (["yes", "designated"].includes(wheelchair)) return "yes";
  if (["limited", "partial"].includes(wheelchair)) return "limited";
  if (["no", "none"].includes(wheelchair)) return "no";
  return "unknown";
}

export function parseBooleanTag(value: string | null | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
}

export function accessLabel(accessType: AccessType): string {
  switch (accessType) {
    case "public":
      return "Public access";
    case "customers":
      return "Customer access";
    case "restricted":
      return "Restricted";
    default:
      return "Access unknown";
  }
}

export function wheelchairLabel(wheelchair: WheelchairStatus): string {
  switch (wheelchair) {
    case "yes":
      return "Wheelchair accessible";
    case "limited":
      return "Limited accessibility";
    case "no":
      return "Not wheelchair accessible";
    default:
      return "Accessibility unknown";
  }
}
