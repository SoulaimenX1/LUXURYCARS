// ==========================================================
// CLIENT DE RÉSERVATION (navigateur)
// ==========================================================
//
// Toutes les requêtes passent par les routes proxy Next.js
// (/api/...), jamais directement par NestJS : le JWT reste
// dans un cookie HttpOnly et l'URL du backend n'est pas exposée.
//
// Aucun montant ni statut n'est inventé côté navigateur : le
// serveur NestJS reste la seule source d'autorité (prix,
// disponibilité, référence de réservation).

import type { VehicleItem } from './catalog-types';

export type { VehicleItem };

// ----------------------------------------------------------
// LIEUX DE PRISE EN CHARGE
// ----------------------------------------------------------

export interface BookingLocation {
  id: string;
  code: string;
  name: string;
  category: string;
  city: string;
  country: string;
  address: string;
  canPickup: boolean;
  canDropoff: boolean;
  enabled?: boolean;
  timezone: string;
  opensAt: string;
  closesAt: string;
  turnaroundMinutes: number;
}

// ----------------------------------------------------------
// CALENDRIER DE DISPONIBILITÉ
// ----------------------------------------------------------

export interface CalendarSlot {
  time: string;
  at: string;
}

export type DayStatus = 'available' | 'partial' | 'unavailable' | 'past';

export interface CalendarDay {
  date: string;
  status: DayStatus;
  slots: CalendarSlot[];
  returnSlots: CalendarSlot[];
  reason: string | null;
}

export interface CalendarResponse {
  vehicleId: string;
  locationId: string;
  month: string;
  timezone: string;
  slotMinutes: number;
  minRentalDays: number;
  location: {
    id: string;
    name: string;
    category: string;
    city: string;
    country: string;
    address: string;
    timezone: string;
    opensAt: string;
    closesAt: string;
  };
  days: CalendarDay[];
}

// ----------------------------------------------------------
// VALIDATION D'INTERVALLE
// ----------------------------------------------------------

export interface AvailabilityCheckResult {
  available: boolean;
  reason: string | null;
  message: string | null;
  details: {
    vehicleId: string;
    pickupLocationId: string | null;
    pickupAt: string;
    returnAt: string;
    rentalDays: number;
    timezone: string;
    minRentalDays: number;
    openingHours: { opensAt: string; closesAt: string } | null;
  } | null;
}

// ----------------------------------------------------------
// ALTERNATIVES (quand le véhicule est indisponible)
// ----------------------------------------------------------

export interface NextAvailable {
  pickupAt: string;
  returnAt: string;
  durationDays: number;
}

export interface AlternativeVehicle {
  vehicleId: string;
  modelId: string;
  brandName?: string;
  modelName?: string;
  imageUrl?: string | null;
  dailyPrice?: number | null;
  available: boolean;
}

export interface AlternativesResponse {
  vehicleId: string;
  requested: {
    pickupAt: string;
    returnAt: string;
    pickupLocationId: string;
    dropoffLocationId: string;
  };
  available: boolean;
  message?: string | null;
  nextAvailable: NextAvailable | null;
  alternatives: AlternativeVehicle[];
}

// ----------------------------------------------------------
// DEVIS ET OPTIONS
// ----------------------------------------------------------

export interface BookingQuote {
  currency: 'EUR';
  vehicleId: string;
  rentalDays: number;
  dailyPrice: string;
  baseAmount: string;
  extrasAmount: string;
  deliveryAmount: string;
  discountAmount: string;
  totalAmount: string;
  depositAmount: string;
  promotionCode: string | null;
  pickupMethod: 'branch' | 'airport' | 'hotel';
  pickupLocationId: string | null;
  dropoffLocationId: string | null;
  pickupLocationName: string | null;
  dropoffLocationName: string | null;
  locationFees: {
    pickup: string;
    dropoff: string;
    oneWay: string;
    // Présents uniquement lors d'un côté porte-à-porte (additif).
    doorPickup?: string;
    doorDropoff?: string;
  };
  extras: {
    id: string;
    name: string;
    total: string;
    pricing: 'once' | 'daily';
    unitPrice: string;
  }[];
  terms: string[];
}

export interface PremiumOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  pricing: 'once' | 'daily';
  amount: string;
}

// ----------------------------------------------------------
// PROFIL CONDUCTEUR / PERMIS
// ----------------------------------------------------------

export interface CustomerLicence {
  fullName?: string;
  licenseNumber?: string;
  licenseCountry?: string;
  licenseIssuedOn?: string;
  licenseExpiresOn?: string;
}

// ----------------------------------------------------------
// RÉSERVATION CRÉÉE
// ----------------------------------------------------------

export interface CreatedReservation {
  id: string;
  reservationNumber: string;
  status: string;
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  rentalDays: number;
  dailyPrice: string;
  totalAmount: string;
  depositAmount: string;
  pickupLocationId?: string | null;
  dropoffLocationId?: string | null;
}

// ----------------------------------------------------------
// ERREUR API NORMALISÉE
// ----------------------------------------------------------

export class BookingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BookingApiError';
  }
}

function extractMessage(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const parts = message.filter((item): item is string => typeof item === 'string');
      if (parts.length) return parts.join(' ');
    }
  }
  return 'The server rejected this request.';
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new BookingApiError(extractMessage(payload), response.status);
  }
  return payload as T;
}

// ----------------------------------------------------------
// APPELS API
// ----------------------------------------------------------

export async function fetchVehicleLocations(
  vehicleId: string,
  signal?: AbortSignal,
): Promise<BookingLocation[]> {
  const response = await fetch(`/api/vehicles/${vehicleId}/locations`, {
    cache: 'no-store',
    signal,
  });
  const payload = await readJson<BookingLocation[]>(response);
  return Array.isArray(payload) ? payload : [];
}

export async function fetchAvailabilityCalendar(
  vehicleId: string,
  locationId: string,
  month: string,
  signal?: AbortSignal,
): Promise<CalendarResponse> {
  const query = new URLSearchParams({ locationId, month });
  const response = await fetch(
    `/api/vehicles/${vehicleId}/availability-calendar?${query.toString()}`,
    { cache: 'no-store', signal },
  );
  return readJson<CalendarResponse>(response);
}

export async function checkInterval(
  input: {
    vehicleId: string;
    pickupLocationId?: string;
    dropoffLocationId?: string;
    pickupAt: string;
    returnAt: string;
    // Modes de service (additifs) : sans eux, contrat historique
    // point ↔ point inchangé. Un côté porte-à-porte valide sa zone
    // côté serveur ; aucune donnée n'est calculée ici.
    pickupServiceMode?: ServiceMode;
    dropoffServiceMode?: ServiceMode;
    pickupDoor?: ServicePointInput;
    dropoffDoor?: ServicePointInput;
  },
  signal?: AbortSignal,
): Promise<AvailabilityCheckResult> {
  const response = await fetch('/api/availability/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });
  return readJson<AvailabilityCheckResult>(response);
}

export async function fetchAlternatives(
  input: {
    vehicleId: string;
    pickupLocationId: string;
    dropoffLocationId?: string;
    pickupAt: string;
    returnAt: string;
  },
  signal?: AbortSignal,
): Promise<AlternativesResponse> {
  const response = await fetch('/api/availability/alternatives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });
  return readJson<AlternativesResponse>(response);
}

export async function fetchOptions(signal?: AbortSignal): Promise<PremiumOption[]> {
  const response = await fetch('/api/premium/options', { cache: 'no-store', signal });
  const payload = await readJson<unknown>(response);
  return Array.isArray(payload) ? (payload as PremiumOption[]) : [];
}

export async function fetchQuote(
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<BookingQuote> {
  const response = await fetch('/api/premium/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });
  return readJson<BookingQuote>(response);
}

export async function fetchCustomerLicence(
  signal?: AbortSignal,
): Promise<{ profile: Record<string, unknown> | null; missing: boolean }> {
  const response = await fetch('/api/customer-profile', { cache: 'no-store', signal });
  if (response.status === 404) return { profile: null, missing: true };
  const payload = await readJson<Record<string, unknown>>(response);
  return { profile: payload, missing: false };
}

export async function createReservation(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  return readJson<Record<string, unknown>>(response);
}

// ----------------------------------------------------------
// UTILITAIRES DE CALENDRIER (côté affichage uniquement)
// ----------------------------------------------------------

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return monthKey(date);
}

export function firstWeekdayOfMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  // 0 = lundi … 6 = dimanche (semaine commençant lundi).
  const sundayBased = new Date(year, index - 1, 1).getDay();
  return (sundayBased + 6) % 7;
}

export function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
}

export function formatMonthLabel(month: string, locale: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

// ----------------------------------------------------------
// LIVRAISON / COLLECTE PORTE-À-PORTE
// ----------------------------------------------------------
//
// Un côté de prestation est soit un point de service approuvé,
// soit l'adresse privée du client (soumise à une zone de service
// active). Aucun montant ni aucune zone ne sont décidés ici : le
// serveur NestJS reste la seule autorité (prix, éligibilité,
// devis persistés).

export type ServiceMode = 'APPROVED_POINT' | 'DOOR_TO_DOOR';

export interface ServiceAddressInput {
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  countryCode: string;
}

export interface ServicePointInput {
  address: ServiceAddressInput;
  meetingInstructions?: string;
  entryNotes?: string;
}

export interface ServiceZoneSummary {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  cities: string[];
  timezone: string;
  opensAt: string | null;
  closesAt: string | null;
  leadTimeMinutes: number;
  afterHoursAllowed: boolean;
  holidayExceptions: unknown[];
  fleetRestrictions: Record<string, unknown>;
}

export interface ZoneCheckResult {
  eligible: boolean;
  reason: string | null;
  zone: ServiceZoneSummary | null;
}

// Vérification PUBLIQUE d'une adresse (zone active, ville
// desservie, fuseau) — aucun montant, aucune donnée persistée.
export async function checkServiceAddress(
  input: { countryCode: string; city?: string },
  signal?: AbortSignal,
): Promise<ZoneCheckResult> {
  const response = await fetch('/api/service-zones/check-address', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });
  return readJson<ZoneCheckResult>(response);
}

// Devis de livraison PERSISTÉ (validité limitée côté serveur) :
// le serveur recalcule tout ; le navigateur ne transmet jamais un
// montant. La réservation revalidera ce devis avant écriture.
export interface DeliveryQuoteResult extends BookingQuote {
  id: string;
  expiresAt: string;
}

export async function createDeliveryQuote(
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<DeliveryQuoteResult> {
  const response = await fetch('/api/delivery/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });
  return readJson<DeliveryQuoteResult>(response);
}
