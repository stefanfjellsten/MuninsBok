export function isBankingEnabledForOrganization(organizationId?: string | null): boolean {
  if (!organizationId) {
    return false;
  }

  const raw = import.meta.env["VITE_BANK_ENABLED_ORG_IDS"];
  if (typeof raw !== "string" || raw.trim() === "") {
    return true;
  }

  const normalized = raw.trim();
  if (normalized === "*") {
    return true;
  }

  const allowedIds = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedIds.includes(organizationId);
}
