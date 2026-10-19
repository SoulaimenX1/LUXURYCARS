// ==========================================================
// FORMATAGE PARTAGÉ — prix, libellés
// ==========================================================
//
// Ces helpers étaient dupliqués dans plusieurs pages
// (catalogue, disponibilité, réservations client et admin).
// Ils sont désormais centralisés ici.
// ==========================================================

export function formatAmount(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLabel(value: string): string {
  if (!value) {
    return 'Not specified';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}