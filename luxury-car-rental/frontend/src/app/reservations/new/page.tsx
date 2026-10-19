import { redirect } from 'next/navigation';

// ==========================================================
// PAGE : /reservations/new (ANCIEN PARCOURS)
// ==========================================================
//
// Le parcours de réservation autoritaire est désormais
// /vehicles/[id]/reserve : il envoie des instants précis,
// impose la validation serveur de disponibilité et gère
// lieux de départ/restitution indépendants et promotions.
//
// Cette ancienne route subsiste uniquement pour ne jamais
// casser un lien existant : elle redirige vers le parcours
// moderne en conservant le véhicule et les dates recherchées.

export default async function LegacyNewReservationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const first = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? value[0] ?? '' : value ?? '';

  const vehicleId = first(params.vehicleId);
  if (!vehicleId) {
    redirect('/vehicles');
  }

  const query = new URLSearchParams();
  const pickupDate = first(params.pickupDate);
  const returnDate = first(params.returnDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) query.set('pickupDate', pickupDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) query.set('returnDate', returnDate);
  const suffix = query.toString();

  redirect(`/vehicles/${encodeURIComponent(vehicleId)}/reserve${suffix ? `?${suffix}` : ''}`);
}
