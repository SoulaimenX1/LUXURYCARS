'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { VehicleItem } from '@/lib/catalog-types';
import {
  BookingApiError,
  checkInterval,
  checkServiceAddress,
  createDeliveryQuote,
  createReservation,
  fetchAlternatives,
  fetchAvailabilityCalendar,
  fetchCustomerLicence,
  fetchOptions,
  fetchQuote,
  fetchVehicleLocations,
  monthKey,
  type AlternativesResponse,
  type AvailabilityCheckResult,
  type BookingLocation,
  type BookingQuote,
  type CalendarResponse,
  type CalendarSlot,
  type PremiumOption,
  type ServiceMode,
  type ServicePointInput,
  type ZoneCheckResult,
} from '@/lib/booking';

import VehicleBookingSummary from '@/components/booking/VehicleBookingSummary';
import PickupLocationSelector from '@/components/booking/PickupLocationSelector';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import DateTimeSelection from '@/components/booking/DateTimeSelection';
import DriverInformation from '@/components/booking/DriverInformation';
import BookingPriceSummary from '@/components/booking/BookingPriceSummary';
import BookingReview from '@/components/booking/BookingReview';
import UnavailableAlternatives from '@/components/booking/UnavailableAlternatives';

import styles from './reserve.module.css';
import bookingStyles from '@/components/booking/booking.module.css';
import { useToast } from '@/components/toast';

// ==========================================================
// PARCOURS DE RÉSERVATION
// véhicule → lieu réel → livraison/collecte → calendrier →
// heures → options → conducteur → devis autoritaire →
// confirmation en base.
// ==========================================================
//
// Un seul et même workflow pour tous les points d'entrée. Le
// véhicule provient de l'URL et n'est jamais remplacé par une
// voiture « équivalente ». Toute la disponibilité et tous les
// montants proviennent de NestJS/PostgreSQL.
//
// Étape « Delivery & collection » (additive) : chaque côté est
// soit un point de service approuvé, soit l'adresse du client
// (soumise à la zone active, vérifiée par le serveur). Les modes
// sans adresse restent strictement équivalents à l'ancien
// contrat point ↔ point.

interface BookingDraft {
  locationId: string;
  month: string;
  pickupDate: string;
  pickupTime: string;
  pickupAt: string;
  returnDate: string;
  returnTime: string;
  returnAt: string;
  extraIds: string[];
  pickupServiceMode: ServiceMode;
  dropoffServiceMode: ServiceMode;
}

function messageOf(error: unknown): string {
  if (error instanceof BookingApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function formatDate(date: string): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ReservePage() {
  const params = useParams<{ id: string }>();
  const vehicleId = params.id;
  const router = useRouter();

  const toast = useToast();

  const draftKey = `booking-draft:${vehicleId}`;
  const pendingRestore = useRef<BookingDraft | null>(null);
  const previousLocation = useRef('');
  const initialPickup = useRef('');
  const initialReturn = useRef('');
  const prefillApplied = useRef(false);

  const [vehicle, setVehicle] = useState<VehicleItem | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [locationId, setLocationId] = useState('');

  const [month, setMonth] = useState<string>(() => monthKey());
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');

  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupAt, setPickupAt] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [returnAt, setReturnAt] = useState('');
  const [pickupSlots, setPickupSlots] = useState<CalendarSlot[]>([]);
  const [returnSlots, setReturnSlots] = useState<CalendarSlot[]>([]);

  const [options, setOptions] = useState<PremiumOption[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [dropoffLocationId, setDropoffLocationId] = useState('');
  const [promotionCode, setPromotionCode] = useState('');

  // ---- Livraison / collecte porte-à-porte (additif) ----
  // Les modes survivent au rafraîchissement (brouillon non sensible)
  // ; l'adresse reste en mémoire uniquement (jamais stockée).
  const [pickupServiceMode, setPickupServiceMode] = useState<ServiceMode>('APPROVED_POINT');
  const [dropoffServiceMode, setDropoffServiceMode] = useState<ServiceMode>('APPROVED_POINT');
  const [pickupDoor, setPickupDoor] = useState<DoorFormState>(EMPTY_DOOR);
  const [dropoffDoor, setDropoffDoor] = useState<DoorFormState>(EMPTY_DOOR);
  const [pickupZone, setPickupZone] = useState<ZoneCheckResult | null>(null);
  const [dropoffZone, setDropoffZone] = useState<ZoneCheckResult | null>(null);
  const [zoneChecking, setZoneChecking] = useState(false);

  const [licence, setLicence] = useState<Record<string, unknown> | null>(null);
  const [licenceMissing, setLicenceMissing] = useState(false);
  const [licenceLoading, setLicenceLoading] = useState(true);
  const [licenceError, setLicenceError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [availability, setAvailability] = useState<AvailabilityCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const [alternatives, setAlternatives] = useState<AlternativesResponse | null>(null);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [alternativesError, setAlternativesError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Fenêtre modale : permis de conduire obligatoire avant confirmation.
  const [showLicenceModal, setShowLicenceModal] = useState(false);

  const extraIdsKey = extraIds.join(',');
  const minMonth = useMemo(() => monthKey(), []);
  const timezone = calendar?.timezone ?? '';
  const selectedLocation = locations.find((item) => item.id === locationId) ?? null;
  const selectedDropoffLocation =
    locations.find((item) => item.id === (dropoffLocationId || locationId)) ?? selectedLocation;
  const locationName = selectedLocation?.name ?? '';
  const findDay = (date: string) => calendar?.days.find((item) => item.date === date);

  // Un côté porte-à-porte n'est utilisable qu'avec une adresse
  // complète (rue, ville, pays ISO) : tant qu'elle est incomplète,
  // devis et disponibilité restent en attente (jamais un refus
  // trompeur pendant la saisie).
  const pickupDoorReady = pickupServiceMode !== 'DOOR_TO_DOOR' || doorComplete(pickupDoor);
  const dropoffDoorReady = dropoffServiceMode !== 'DOOR_TO_DOOR' || doorComplete(dropoffDoor);
  // Clés de recherche de zone (débounce) : la zone ne dépend que
  // de la ville et du pays.
  const pickupZoneKey =
    pickupServiceMode === 'DOOR_TO_DOOR' &&
    pickupDoor.city.trim().length >= 2 &&
    /^[A-Za-z]{2}$/.test(pickupDoor.countryCode.trim())
      ? `${pickupDoor.countryCode.trim().toUpperCase()}|${pickupDoor.city.trim().toLowerCase()}`
      : '';
  const dropoffZoneKey =
    dropoffServiceMode === 'DOOR_TO_DOOR' &&
    dropoffDoor.city.trim().length >= 2 &&
    /^[A-Za-z]{2}$/.test(dropoffDoor.countryCode.trim())
      ? `${dropoffDoor.countryCode.trim().toUpperCase()}|${dropoffDoor.city.trim().toLowerCase()}`
      : '';
  // Les champs qui changent réellement le prix ou la disponibilité.
  const pickupDoorKey = `${pickupDoor.line1}|${pickupDoor.city}|${pickupDoor.countryCode}`;
  const dropoffDoorKey = `${dropoffDoor.line1}|${dropoffDoor.city}|${dropoffDoor.countryCode}`;

  // ----------------------------------------------------------
  // Brouillon : survit à un rafraîchissement (scénario H).
  // ----------------------------------------------------------
  /* eslint-disable react-hooks/set-state-in-effect --
     synchronisation volontaire avec sessionStorage et les API
     serveur (chargement, calendrier, permis, devis). */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(draftKey);
    } catch {
      raw = null;
    }

    if (raw) {
      try {
        const draft = JSON.parse(raw) as Partial<BookingDraft>;
        const restored: BookingDraft = {
          locationId: typeof draft.locationId === 'string' ? draft.locationId : '',
          month: typeof draft.month === 'string' ? draft.month : monthKey(),
          pickupDate: typeof draft.pickupDate === 'string' ? draft.pickupDate : '',
          pickupTime: typeof draft.pickupTime === 'string' ? draft.pickupTime : '',
          pickupAt: typeof draft.pickupAt === 'string' ? draft.pickupAt : '',
          returnDate: typeof draft.returnDate === 'string' ? draft.returnDate : '',
          returnTime: typeof draft.returnTime === 'string' ? draft.returnTime : '',
          returnAt: typeof draft.returnAt === 'string' ? draft.returnAt : '',
          extraIds: Array.isArray(draft.extraIds)
            ? draft.extraIds.filter((value) => typeof value === 'string')
            : [],
          pickupServiceMode:
            draft.pickupServiceMode === 'DOOR_TO_DOOR' ? 'DOOR_TO_DOOR' : 'APPROVED_POINT',
          dropoffServiceMode:
            draft.dropoffServiceMode === 'DOOR_TO_DOOR' ? 'DOOR_TO_DOOR' : 'APPROVED_POINT',
        };
        // Tant que ces valeurs ne sont pas appliquées à l'état, la
        // sauvegarde ci-dessous ne doit pas écraser le brouillon stocké.
        pendingRestore.current = restored;
        setLocationId(restored.locationId);
        setMonth(restored.month);
        setPickupDate(restored.pickupDate);
        setPickupTime(restored.pickupTime);
        setPickupAt(restored.pickupAt);
        setReturnDate(restored.returnDate);
        setReturnTime(restored.returnTime);
        setReturnAt(restored.returnAt);
        setExtraIds(restored.extraIds);
        setPickupServiceMode(restored.pickupServiceMode);
        setDropoffServiceMode(restored.dropoffServiceMode);
      } catch {
        // Un brouillon illisible est simplement ignoré.
      }
    } else if (typeof window !== 'undefined') {
      // Aucun brouillon : reprendre les dates recherchées dans la
      // page de disponibilité (le véhicule, lui, vient de l'URL).
      const search = new URLSearchParams(window.location.search);
      const pickup = search.get('pickupDate');
      const back = search.get('returnDate');
      if (pickup && /^\d{4}-\d{2}-\d{2}$/.test(pickup)) {
        initialPickup.current = pickup;
        setMonth(pickup.slice(0, 7));
      }
      if (back && /^\d{4}-\d{2}-\d{2}$/.test(back)) {
        initialReturn.current = back;
      }
    }
  }, [draftKey]);

  useEffect(() => {
    const pending = pendingRestore.current;
    if (pending) {
      const settled =
        pending.locationId === locationId &&
        pending.pickupDate === pickupDate &&
        pending.pickupAt === pickupAt &&
        pending.returnDate === returnDate &&
        pending.returnAt === returnAt;
      // Tant que l'état restauré n'est pas appliqué, l'écriture
      // écraserait le brouillon stocké par l'état initial (vide) du
      // même rendu. On attend la fin du chargement des lieux pour ne
      // jamais rester bloqué sur un lieu devenu invalide.
      if (!settled && locationsLoading) return;
      pendingRestore.current = null;
    }
    // Aucune écriture avant la fin du chargement des lieux : pendant
    // cette phase, l'état initial (vide) écraserait un brouillon
    // existant ou le pré-remplissage par paramètres d'URL.
    if (locationsLoading) return;
    const draft: BookingDraft = {
      locationId,
      month,
      pickupDate,
      pickupTime,
      pickupAt,
      returnDate,
      returnTime,
      returnAt,
      extraIds,
      pickupServiceMode,
      dropoffServiceMode,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Le stockage peut être indisponible : la réservation reste possible.
    }
  }, [
    draftKey,
    locationId,
    month,
    pickupDate,
    pickupTime,
    pickupAt,
    returnDate,
    returnTime,
    returnAt,
    extraIds,
    pickupServiceMode,
    dropoffServiceMode,
    locationsLoading,
  ]);

  // ----------------------------------------------------------
  // Véhicule : toujours celui de l'URL, jamais un équivalent.
  // ----------------------------------------------------------
  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    setCatalogError('');
    fetch('/api/vehicles/catalog', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!active) return;
        const list = Array.isArray(data) ? (data as VehicleItem[]) : [];
        const found = list.find((item) => item.id === vehicleId) ?? null;
        setVehicle(found);
        if (!found) setCatalogError('This vehicle is not available in the collection.');
      })
      .catch(() => {
        if (active) setCatalogError('Unable to load the vehicle details.');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [vehicleId]);

  // ----------------------------------------------------------
  // Lieux réellement desservis par ce véhicule.
  // ----------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    setLocationsLoading(true);
    setLocationsError('');
    fetchVehicleLocations(vehicleId, controller.signal)
      .then((list) => {
        setLocations(list);
        setLocationId((current) => {
          const id =
            current && list.some((item) => item.id === current) ? current : list[0]?.id ?? '';
          if (id) {
            setDropoffLocationId(id);
          }
          return id;
        });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setLocationsError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLocationsLoading(false);
      });
    return () => controller.abort();
  }, [vehicleId]);

  // Changer de lieu réinitialise les dates (la disponibilité change).
  useEffect(() => {
    if (previousLocation.current && previousLocation.current !== locationId) {
      setPickupDate('');
      setPickupTime('');
      setPickupAt('');
      setReturnDate('');
      setReturnTime('');
      setReturnAt('');
      setPickupSlots([]);
      setReturnSlots([]);
      setDropoffLocationId(locationId);
    }
    previousLocation.current = locationId;
  }, [locationId]);

  // ----------------------------------------------------------
  // Calendrier du mois affiché (rechargé à chaque changement
  // de véhicule, de lieu ou de mois).
  // ----------------------------------------------------------
  useEffect(() => {
    if (!locationId) {
      setCalendar(null);
      return;
    }
    const controller = new AbortController();
    setCalendarLoading(true);
    setCalendarError('');
    fetchAvailabilityCalendar(vehicleId, locationId, month, controller.signal)
      .then(setCalendar)
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setCalendar(null);
        setCalendarError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCalendarLoading(false);
      });
    return () => controller.abort();
  }, [vehicleId, locationId, month]);

  // Recaler les créneaux des dates choisies et appliquer, une seule
  // fois, les dates recherchées pré-remplies.
  useEffect(() => {
    if (!calendar) return;

    if (!prefillApplied.current && initialPickup.current) {
      const pickupDay = calendar.days.find((day) => day.date === initialPickup.current);
      if (pickupDay && pickupDay.slots.length) {
        prefillApplied.current = true;
        selectPickup(pickupDay.date);
        const back = initialReturn.current;
        const returnDay = back ? calendar.days.find((day) => day.date === back) : undefined;
        if (back && returnDay && back > pickupDay.date && returnDay.returnSlots.length) {
          selectReturn(back);
        }
        return;
      }
    }

    const pickupDay = calendar.days.find((day) => day.date === pickupDate);
    if (pickupDay) setPickupSlots(pickupDay.slots);
    const returnDay = calendar.days.find((day) => day.date === returnDate);
    if (returnDay) setReturnSlots(returnDay.returnSlots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, pickupDate, returnDate]);

  // Options premium (affichage uniquement ; le prix reste serveur).
  useEffect(() => {
    const controller = new AbortController();
    fetchOptions(controller.signal)
      .then(setOptions)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Permis du client connecté (le serveur revalide à la confirmation).
  useEffect(() => {
    const controller = new AbortController();
    setLicenceLoading(true);
    setLicenceError('');
    fetchCustomerLicence(controller.signal)
      .then(({ profile, missing }) => {
        setLicence(profile);
        setLicenceMissing(missing);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        if (error instanceof BookingApiError && error.status === 401) {
          setAuthRequired(true);
          return;
        }
        setLicenceError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLicenceLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Fermeture de la fenêtre « permis requis » avec la touche Échap.
  useEffect(() => {
    if (!showLicenceModal) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowLicenceModal(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLicenceModal]);

  // ----------------------------------------------------------
  // Zones porte-à-porte : vérification publique (ville + pays),
  // avec debounce — aucun prix n'est impliqué à ce stade.
  // ----------------------------------------------------------
  useEffect(() => {
    if (!pickupZoneKey && !dropoffZoneKey) {
      setPickupZone(null);
      setDropoffZone(null);
      setZoneChecking(false);
      return;
    }
    const controller = new AbortController();
    setZoneChecking(true);
    const timer = window.setTimeout(() => {
      const lookup = (key: string) => {
        const [countryCode, city] = key.split('|');
        return checkServiceAddress({ countryCode, city }, controller.signal);
      };
      void Promise.allSettled([
        pickupZoneKey
          ? lookup(pickupZoneKey).then((result) => {
              if (!controller.signal.aborted) setPickupZone(result);
            })
          : Promise.resolve().then(() => setPickupZone(null)),
        dropoffZoneKey
          ? lookup(dropoffZoneKey).then((result) => {
              if (!controller.signal.aborted) setDropoffZone(result);
            })
          : Promise.resolve().then(() => setDropoffZone(null)),
      ]).finally(() => {
        if (!controller.signal.aborted) setZoneChecking(false);
      });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pickupZoneKey, dropoffZoneKey]);

  // ----------------------------------------------------------
  // Devis autoritaire + revalidation de l'intervalle complet.
  // ----------------------------------------------------------
  useEffect(() => {
    if (
      !locationId ||
      !pickupAt ||
      !returnAt ||
      !pickupDoorReady ||
      !dropoffDoorReady
    ) {
      setQuote(null);
      setQuoteError('');
      setAvailability(null);
      setChecking(false);
      setQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setQuoteLoading(true);
    setQuoteError('');
    setChecking(true);

    const payload: Record<string, unknown> = {
      vehicleId,
      pickupAt,
      returnAt,
      pickupLocationId: locationId,
      dropoffLocationId,
      pickupMethod: 'branch',
      pickupServiceMode,
      dropoffServiceMode,
    };
    if (pickupServiceMode === 'DOOR_TO_DOOR') payload.pickupDoor = doorPoint(pickupDoor);
    if (dropoffServiceMode === 'DOOR_TO_DOOR') payload.dropoffDoor = doorPoint(dropoffDoor);
    if (extraIds.length) payload.extraIds = extraIds;
    if (promotionCode.trim()) payload.promotionCode = promotionCode.trim();

    void Promise.allSettled([
      fetchQuote(payload, controller.signal)
        .then(setQuote)
        .catch((error: unknown) => {
          if (isAbort(error)) return;
          setQuote(null);
          setQuoteError(messageOf(error));
        }),
      checkInterval(
        {
          vehicleId,
          pickupLocationId: locationId,
          dropoffLocationId: dropoffLocationId || locationId,
          pickupAt,
          returnAt,
          pickupServiceMode,
          dropoffServiceMode,
          ...(pickupServiceMode === 'DOOR_TO_DOOR'
            ? { pickupDoor: doorPoint(pickupDoor) }
            : {}),
          ...(dropoffServiceMode === 'DOOR_TO_DOOR'
            ? { dropoffDoor: doorPoint(dropoffDoor) }
            : {}),
        },
        controller.signal,
      )
        .then(setAvailability)
        .catch((error: unknown) => {
          if (isAbort(error)) return;
          setAvailability({
            available: false,
            reason: 'error',
            message: messageOf(error),
            details: null,
          });
        }),
    ]).finally(() => {
      if (!controller.signal.aborted) {
        setQuoteLoading(false);
        setChecking(false);
      }
    });

    return () => controller.abort();
  }, [vehicleId, locationId, pickupAt, returnAt, extraIdsKey, dropoffLocationId, promotionCode, pickupServiceMode, dropoffServiceMode, pickupDoorKey, dropoffDoorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------------------------------------
  // Alternatives : uniquement lorsque le véhicule choisi est
  // indisponible. Le serveur calcule la prochaine période libre
  // et des véhicules réellement disponibles sur l'intervalle.
  // ----------------------------------------------------------
  useEffect(() => {
    // Les suggestions servent les points de service (les horaires
    // de la zone porte diffèrent) : côté porte, le message du
    // serveur reste explicite et suffisant.
    if (
      !locationId ||
      !pickupAt ||
      !returnAt ||
      !availability ||
      availability.available ||
      pickupServiceMode === 'DOOR_TO_DOOR' ||
      dropoffServiceMode === 'DOOR_TO_DOOR'
    ) {
      setAlternatives(null);
      setAlternativesError('');
      setAlternativesLoading(false);
      return;
    }
    const controller = new AbortController();
    setAlternativesLoading(true);
    setAlternativesError('');
    fetchAlternatives(
      {
        vehicleId,
        pickupLocationId: locationId,
        dropoffLocationId: dropoffLocationId || locationId,
        pickupAt,
        returnAt,
      },
      controller.signal,
    )
      .then(setAlternatives)
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setAlternatives(null);
        setAlternativesError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setAlternativesLoading(false);
      });
    return () => controller.abort();
  }, [vehicleId, locationId, dropoffLocationId, pickupAt, returnAt, availability, pickupServiceMode, dropoffServiceMode]);

  /* eslint-enable react-hooks/set-state-in-effect */

  // ----------------------------------------------------------
  // Sélection des dates et des heures.
  // ----------------------------------------------------------
  function clearDates() {
    setPickupDate('');
    setPickupTime('');
    setPickupAt('');
    setReturnDate('');
    setReturnTime('');
    setReturnAt('');
    setPickupSlots([]);
    setReturnSlots([]);
  }

  function selectPickup(date: string) {
    if (!date) {
      clearDates();
      return;
    }
    const slots = findDay(date)?.slots ?? [];
    setPickupDate(date);
    setPickupSlots(slots);
    setPickupTime(slots[0]?.time ?? '');
    setPickupAt(slots[0]?.at ?? '');
    if (returnDate && returnDate <= date) {
      setReturnDate('');
      setReturnTime('');
      setReturnAt('');
      setReturnSlots([]);
    }
  }

  function selectReturn(date: string) {
    const slots = findDay(date)?.returnSlots ?? [];
    setReturnDate(date);
    setReturnSlots(slots);
    setReturnTime(slots[0]?.time ?? '');
    setReturnAt(slots[0]?.at ?? '');
  }

  function selectPickupTime(at: string) {
    const slot = pickupSlots.find((item) => item.at === at);
    setPickupAt(at);
    setPickupTime(slot?.time ?? '');
    if (returnAt && at >= returnAt) {
      setReturnAt('');
      setReturnTime('');
    }
  }

  function selectReturnTime(at: string) {
    const slot = returnSlots.find((item) => item.at === at);
    setReturnAt(at);
    setReturnTime(slot?.time ?? '');
  }

  // Applique une période réellement disponible calculée par le
  // serveur (prochaine fenêtre libre du même véhicule). Les dates
  // et heures sont dérivées dans le fuseau du point de service :
  // la valeur autoritaire reste l'instant ISO fourni par l'API.
  function applyInterval(nextPickupAt: string, nextReturnAt: string) {
    const zone = calendar?.timezone || timezone || undefined;
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const pickupValue = new Date(nextPickupAt);
    const returnValue = new Date(nextReturnAt);
    if (Number.isNaN(pickupValue.getTime()) || Number.isNaN(returnValue.getTime())) return;

    const nextPickupDate = dateFmt.format(pickupValue);
    const nextReturnDate = dateFmt.format(returnValue);

    setPickupDate(nextPickupDate);
    setPickupTime(timeFmt.format(pickupValue));
    setPickupAt(nextPickupAt);
    setReturnDate(nextReturnDate);
    setReturnTime(timeFmt.format(returnValue));
    setReturnAt(nextReturnAt);

    // Réaligner les créneaux affichés si le mois courant contient
    // ces journées, sinon basculer sur le mois de la prise en charge.
    const pickupDay = findDay(nextPickupDate);
    setPickupSlots(pickupDay?.slots ?? []);
    const returnDay = findDay(nextReturnDate);
    setReturnSlots(returnDay?.returnSlots ?? []);
    const targetMonth = nextPickupDate.slice(0, 7);
    if (targetMonth !== month) setMonth(targetMonth);
  }

  async function confirm() {
    // Sans permis enregistré, la confirmation ouvre une fenêtre
    // explicative au lieu d'appeler l'API.
    if (licenceMissing || !licence) {
      setSubmitError('');
      setShowLicenceModal(true);
      return;
    }
    if (!pickupDoorReady || !dropoffDoorReady) {
      setSubmitError('Complete the delivery address before confirming.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const serviceFields = {
        pickupServiceMode,
        dropoffServiceMode,
        ...(pickupServiceMode === 'DOOR_TO_DOOR'
          ? { pickupDoor: doorPoint(pickupDoor) }
          : {}),
        ...(dropoffServiceMode === 'DOOR_TO_DOOR'
          ? { dropoffDoor: doorPoint(dropoffDoor) }
          : {}),
      };
      // Étape 1 : devis persisté côté serveur (prix entièrement
      // autoritaire, réutilisable quelques minutes). Aucun montant
      // n'est accepté du navigateur.
      const persistedQuote = await createDeliveryQuote({
        vehicleId,
        pickupAt,
        returnAt,
        pickupLocationId: locationId,
        dropoffLocationId,
        pickupMethod: 'branch',
        ...serviceFields,
        ...(extraIds.length ? { extraIds } : {}),
        ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
      });
      // Étape 2 : réservation refermant le devis accepté — le
      // serveur revalide propriété, validité, empreinte et total
      // recalculé avant toute écriture.
      const result = await createReservation({
        vehicleId,
        pickupAt,
        returnAt,
        pickupLocationId: locationId,
        dropoffLocationId,
        pickupMethod: 'branch',
        ...serviceFields,
        quoteId: persistedQuote.id,
        ...(extraIds.length ? { extraIds } : {}),
        ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
      });
      const number =
        typeof result.reservationNumber === 'string' ? result.reservationNumber.trim() : '';
      if (!number) {
        throw new Error('The reservation was created without a reference number.');
      }
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // Ignorer un stockage indisponible.
      }
      toast.success(`Reservation ${number} received. We will confirm it shortly.`, 'Booking');
      router.push(`/reservations/${encodeURIComponent(number)}/confirmation`);
    } catch (error) {
      const text = messageOf(error);
      // Le serveur revalide le permis : une absence détectée côté
      // API ouvre la même fenêtre, plutôt qu'un message en ligne.
      if (/customer profile|driving licen[cs]e/i.test(text)) {
        setShowLicenceModal(true);
        return;
      }
      setSubmitError(text);
      toast.error(text, 'Booking');
    } finally {
      setSubmitting(false);
    }
  }

  // ----------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------
  if (catalogLoading) {
    return (
      <main className={styles.page}>
        <p className={bookingStyles.loading}>Loading the vehicle…</p>
      </main>
    );
  }

  if (!vehicle) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Vehicle unavailable</h1>
        <p className={bookingStyles.error} role="alert">
          {catalogError || 'This vehicle is not available in the collection.'}
        </p>
        <p>
          <Link href="/vehicles" className={bookingStyles.inlineLink}>
            ← Back to the collection
          </Link>
        </p>
      </main>
    );
  }

  const vehicleLabel = `${vehicle.brandName} ${vehicle.modelName}`;
  const pointPickupLabel = selectedLocation
    ? `${selectedLocation.name} — ${selectedLocation.address}`
    : '—';
  const pointDropoffLabel = selectedDropoffLocation
    ? `${selectedDropoffLocation.name} — ${selectedDropoffLocation.address}`
    : pointPickupLabel;
  // Les libellés de revue reflètent le mode choisi (adresse privée
  // affichée pour revue, jamais de prix calculés ici).
  const locationLabel =
    pickupServiceMode === 'DOOR_TO_DOOR'
      ? `Door delivery — ${doorLabel(pickupDoor)}`
      : pointPickupLabel;
  const dropoffLabel =
    dropoffServiceMode === 'DOOR_TO_DOOR'
      ? `Door return — ${doorLabel(dropoffDoor)}`
      : pointDropoffLabel;
  const pickupLabel = pickupDate
    ? `${formatDate(pickupDate)} · ${pickupTime}${timezone ? ` (${timezone})` : ''}`
    : 'Not selected';
  const returnLabel = returnDate
    ? `${formatDate(returnDate)} · ${returnTime}${timezone ? ` (${timezone})` : ''}`
    : 'Not selected';
  const canConfirm = Boolean(
    availability?.available &&
      quote &&
      pickupDoorReady &&
      dropoffDoorReady &&
      !authRequired &&
      !submitting,
  );

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/vehicles">Collection</Link>
        <span>/</span>
        <Link href={`/vehicles/${vehicleId}`}>{vehicleLabel}</Link>
        <span>/</span>
        <span>Reserve</span>
      </nav>

      <h1 className={styles.title}>Reserve this vehicle</h1>
      <p className={styles.subtitle}>
        You are reserving the exact vehicle shown below. Availability, prices and the security deposit
        are calculated by our system from live data.
      </p>

      {authRequired && (
        <div className={bookingStyles.noticeBox} role="alert">
          Please{' '}
          <Link
            href="/login"
            className={bookingStyles.inlineLink}
            title="Sign in to confirm your reservation"
          >
            sign in
          </Link>{' '}
          to complete and confirm your reservation.
        </div>
      )}

      <div className={styles.layout}>
        <div>
          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>1</span>
              <h2 className={bookingStyles.stepTitle}>Your vehicle</h2>
            </header>
            <VehicleBookingSummary vehicle={vehicle} />
          </section>

          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>2</span>
              <h2 className={bookingStyles.stepTitle}>Pickup location</h2>
            </header>
            <PickupLocationSelector
              locations={locations}
              selectedId={locationId}
              loading={locationsLoading}
              error={locationsError}
              onSelect={setLocationId}
            />
          </section>

          {locationId && (
            <section className={bookingStyles.step}>
              <header className={bookingStyles.stepHeader}>
                <span className={bookingStyles.stepNumber}>3</span>
                <h2 className={bookingStyles.stepTitle}>Drop-off location</h2>
              </header>
              <PickupLocationSelector
                locations={
                  locations.filter((l) => {
                    const from = locations.find((x) => x.id === locationId);
                    return from ? l.country === from.country : true;
                  })
                }
                selectedId={dropoffLocationId || locationId}
                loading={locationsLoading}
                error={locationsError}
                onSelect={setDropoffLocationId}
              />
            </section>
          )}

          {locationId && (
            <section className={bookingStyles.step}>
              <header className={bookingStyles.stepHeader}>
                <span className={bookingStyles.stepNumber}>4</span>
                <h2 className={bookingStyles.stepTitle}>Delivery &amp; collection</h2>
              </header>
              <p className={bookingStyles.stepHint}>
                Optional: the vehicle can be delivered to your address, or collected and
                returned at a service point. Door delivery is available only inside our
                active service zones, and its fee is added to your quote by our system.
              </p>

              {/* ---- Prise en charge ---- */}
              <p className={bookingStyles.optionName} style={{ marginTop: '.75rem' }}>
                Pickup
              </p>
              <div className={bookingStyles.optionList}>
                <label
                  className={`${bookingStyles.option} ${pickupServiceMode === 'APPROVED_POINT' ? bookingStyles.optionActive : ''}`}
                >
                  <input
                    type="radio"
                    name="pickup-service-mode"
                    checked={pickupServiceMode === 'APPROVED_POINT'}
                    onChange={() => setPickupServiceMode('APPROVED_POINT')}
                  />
                  <span className={bookingStyles.optionBody}>
                    <span className={bookingStyles.optionName}>Collect from a service point</span>
                    <span className={bookingStyles.optionMeta}>
                      {selectedLocation?.name ?? 'The point selected in step 2'}
                    </span>
                  </span>
                </label>
                <label
                  className={`${bookingStyles.option} ${pickupServiceMode === 'DOOR_TO_DOOR' ? bookingStyles.optionActive : ''}`}
                >
                  <input
                    type="radio"
                    name="pickup-service-mode"
                    checked={pickupServiceMode === 'DOOR_TO_DOOR'}
                    onChange={() => setPickupServiceMode('DOOR_TO_DOOR')}
                  />
                  <span className={bookingStyles.optionBody}>
                    <span className={bookingStyles.optionName}>Delivered to my address</span>
                    <span className={bookingStyles.optionMeta}>
                      Available inside the service zone; the delivery fee is added to your quote.
                    </span>
                  </span>
                </label>
              </div>

              {pickupServiceMode === 'DOOR_TO_DOOR' && (
                <>
                  <DoorAddressFields
                    idPrefix="pickup-door"
                    door={pickupDoor}
                    onChange={setPickupDoor}
                    zone={pickupZone}
                    zoneChecking={zoneChecking}
                  />
                  {!pickupDoorReady && (
                    <p className={bookingStyles.loading} style={{ marginTop: '.5rem' }}>
                      Complete the address to check zone coverage, availability and pricing.
                    </p>
                  )}
                </>
              )}

              {/* ---- Restitution ---- */}
              <p className={bookingStyles.optionName} style={{ marginTop: '1.25rem' }}>
                Return
              </p>
              <div className={bookingStyles.optionList}>
                <label
                  className={`${bookingStyles.option} ${dropoffServiceMode === 'APPROVED_POINT' ? bookingStyles.optionActive : ''}`}
                >
                  <input
                    type="radio"
                    name="dropoff-service-mode"
                    checked={dropoffServiceMode === 'APPROVED_POINT'}
                    onChange={() => setDropoffServiceMode('APPROVED_POINT')}
                  />
                  <span className={bookingStyles.optionBody}>
                    <span className={bookingStyles.optionName}>Return to a service point</span>
                    <span className={bookingStyles.optionMeta}>
                      {selectedDropoffLocation?.name ?? 'The point selected in step 3'}
                    </span>
                  </span>
                </label>
                <label
                  className={`${bookingStyles.option} ${dropoffServiceMode === 'DOOR_TO_DOOR' ? bookingStyles.optionActive : ''}`}
                >
                  <input
                    type="radio"
                    name="dropoff-service-mode"
                    checked={dropoffServiceMode === 'DOOR_TO_DOOR'}
                    onChange={() => setDropoffServiceMode('DOOR_TO_DOOR')}
                  />
                  <span className={bookingStyles.optionBody}>
                    <span className={bookingStyles.optionName}>Return to my address</span>
                    <span className={bookingStyles.optionMeta}>
                      Available inside the service zone; the collection fee is added to your quote.
                    </span>
                  </span>
                </label>
              </div>

              {dropoffServiceMode === 'DOOR_TO_DOOR' && (
                <>
                  <DoorAddressFields
                    idPrefix="dropoff-door"
                    door={dropoffDoor}
                    onChange={setDropoffDoor}
                    zone={dropoffZone}
                    zoneChecking={zoneChecking}
                  />
                  {!dropoffDoorReady && (
                    <p className={bookingStyles.loading} style={{ marginTop: '.5rem' }}>
                      Complete the address to check zone coverage, availability and pricing.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {locationId && (
            <section className={bookingStyles.step}>
              <header className={bookingStyles.stepHeader}>
                <span className={bookingStyles.stepNumber}>5</span>
                <h2 className={bookingStyles.stepTitle}>Choose your dates</h2>
              </header>
              <AvailabilityCalendar
                month={month}
                calendar={calendar}
                loading={calendarLoading}
                error={calendarError}
                pickupDate={pickupDate}
                returnDate={returnDate}
                minMonth={minMonth}
                onMonthChange={setMonth}
                onPickup={selectPickup}
                onReturn={selectReturn}
              />
              {pickupAt && returnAt && availability && !availability.available && (
                <UnavailableAlternatives
                  data={alternatives}
                  loading={alternativesLoading}
                  error={alternativesError}
                  timezone={timezone}
                  onUseInterval={applyInterval}
                />
              )}
            </section>
          )}

          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>6</span>
              <h2 className={bookingStyles.stepTitle}>Pickup &amp; return times</h2>
            </header>
            <DateTimeSelection
              locationName={locationName || '—'}
              timezone={timezone}
              pickupDate={pickupDate}
              returnDate={returnDate}
              pickupSlots={pickupSlots}
              returnSlots={returnSlots}
              pickupAt={pickupAt}
              returnAt={returnAt}
              onPickupTime={selectPickupTime}
              onReturnTime={selectReturnTime}
              onReset={clearDates}
            />
          </section>

          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>7</span>
              <h2 className={bookingStyles.stepTitle}>Optional services</h2>
            </header>
            {options.length === 0 ? (
              <p className={bookingStyles.loading}>No optional service is currently offered.</p>
            ) : (
              <>
              <div className={bookingStyles.optionList}>
                {options.map((option) => {
                  const active = extraIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`${bookingStyles.option} ${active ? bookingStyles.optionActive : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setExtraIds((current) =>
                            current.includes(option.id)
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id],
                          )
                        }
                      />
                      <span className={bookingStyles.optionBody}>
                        <span className={bookingStyles.optionName}>{option.name}</span>
                        {option.description && (
                          <span className={bookingStyles.optionMeta}>{option.description}</span>
                        )}
                        <span className={bookingStyles.optionMeta}>
                          {option.amount} EUR
                          {option.pricing === 'daily' ? ' / day' : ' once'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className={bookingStyles.optionList} style={{ marginTop: '1rem' }}>
                <label className={bookingStyles.option} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className={bookingStyles.optionName}>Promotion code (optional)</span>
                  <input
                    type="text"
                    value={promotionCode}
                    onChange={(e) => setPromotionCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30))}
                    placeholder="e.g. VIP10"
                    style={{ marginTop: '0.5rem', padding: '0.5rem', width: '100%', maxWidth: '280px' }}
                  />
                </label>
              </div>
              </>
            )}
          </section>

          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>8</span>
              <h2 className={bookingStyles.stepTitle}>Driver information</h2>
            </header>
            <DriverInformation
              profile={licence}
              missing={licenceMissing}
              loading={licenceLoading}
              error={licenceError}
              returnDate={returnDate}
            />
          </section>
        </div>

        <aside className={styles.aside}>
          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>9</span>
              <h2 className={bookingStyles.stepTitle}>Your price</h2>
            </header>
            <BookingPriceSummary quote={quote} loading={quoteLoading} error={quoteError} />
          </section>

          <section className={bookingStyles.step}>
            <header className={bookingStyles.stepHeader}>
              <span className={bookingStyles.stepNumber}>10</span>
              <h2 className={bookingStyles.stepTitle}>Review &amp; confirm</h2>
            </header>
            <BookingReview
              vehicleLabel={vehicleLabel}
              locationLabel={locationLabel}
              dropoffLabel={dropoffLabel}
              pickupLabel={pickupLabel}
              returnLabel={returnLabel}
              quote={quote}
              availability={availability}
              checking={checking}
              submitting={submitting}
              error={submitError}
              disabled={!canConfirm}
              onConfirm={confirm}
            />
            {!availability && !checking && (
              <p className={bookingStyles.loading} style={{ marginTop: '.75rem' }}>
                Select a pickup location, dates and times to enable confirmation.
              </p>
            )}
          </section>
        </aside>
      </div>

      {showLicenceModal && (
        <div
          className={bookingStyles.modalOverlay}
          role="presentation"
          onClick={() => setShowLicenceModal(false)}
        >
          <div
            className={bookingStyles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="licence-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className={bookingStyles.modalEyebrow}>Driving licence required</span>

            <h2 id="licence-modal-title" className={bookingStyles.modalTitle}>
              You must register your driving licence
            </h2>

            <p className={bookingStyles.modalMessage}>
              You need to add your driving licence details to your profile before
              confirming.
            </p>

            <div className={bookingStyles.modalActions}>
              <Link href="/account/profile" className={bookingStyles.modalPrimary} autoFocus>
                Add my licence
              </Link>

              <button
                type="button"
                className={bookingStyles.modalSecondary}
                onClick={() => setShowLicenceModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================================
// ADRESSE PORTE-À-PORTE (composant local, deux côtés)
// ==========================================================
//
// Aucun calcul de prix ni de zone ici : la saisie alimente les
// appels serveur (zone, devis, réservation) et rien d'autre. Les
// instructions d'accès (entryNotes) ne sont partagées qu'avec le
// client, les admins et le chauffeur assigné (contrôle d'accès
// côté serveur, jamais dans les réponses publiques).

interface DoorFormState {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  countryCode: string;
  meetingInstructions: string;
  entryNotes: string;
}

const EMPTY_DOOR: DoorFormState = {
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  countryCode: '',
  meetingInstructions: '',
  entryNotes: '',
};

// Une adresse est « prête » quand elle permet une vérification de
// zone et un devis serveur : rue, ville et code pays ISO.
function doorComplete(door: DoorFormState): boolean {
  return (
    door.line1.trim().length > 0 &&
    door.city.trim().length > 0 &&
    /^[A-Za-z]{2}$/.test(door.countryCode.trim())
  );
}

// Forme attendue par l'API (identique côté disponibilité, devis
// et réservation). Le serveur revalide chaque champ.
function doorPoint(door: DoorFormState): ServicePointInput {
  return {
    address: {
      line1: door.line1.trim(),
      ...(door.line2.trim() ? { line2: door.line2.trim() } : {}),
      city: door.city.trim(),
      ...(door.postalCode.trim() ? { postalCode: door.postalCode.trim() } : {}),
      countryCode: door.countryCode.trim().toUpperCase(),
    },
    ...(door.meetingInstructions.trim()
      ? { meetingInstructions: door.meetingInstructions.trim() }
      : {}),
    ...(door.entryNotes.trim() ? { entryNotes: door.entryNotes.trim() } : {}),
  };
}

function doorLabel(door: DoorFormState): string {
  const line = door.line1.trim();
  const city = door.city.trim();
  return [line, city].filter(Boolean).join(', ') || 'your address';
}

// Raisons de zone lisibles (vocabulaire serveur, traduit ici).
const ZONE_REASON_TEXT: Record<string, string> = {
  'address-not-in-zone': 'Door service is not offered at this address yet.',
  'city-not-in-zone': 'Door service is not offered in this city yet.',
  'address-service-disabled': 'Door service is currently unavailable for this area.',
  'no-active-zone': 'Door service is not offered at this address yet.',
  'invalid-zone-configuration': 'Door service is temporarily unavailable (setup issue).',
};

function zoneReasonText(reason: string | null): string {
  if (!reason) return 'Door service is not available for this address.';
  return ZONE_REASON_TEXT[reason] ?? 'Door service is not available for this address.';
}

function DoorAddressFields(props: {
  idPrefix: string;
  door: DoorFormState;
  onChange: (next: DoorFormState) => void;
  zone: ZoneCheckResult | null;
  zoneChecking: boolean;
}) {
  const { idPrefix, door, onChange, zone, zoneChecking } = props;
  const set = (patch: Partial<DoorFormState>) => onChange({ ...door, ...patch });
  const field = { padding: '0.5rem', width: '100%', maxWidth: '340px' };
  const labelBox = { display: 'grid', gap: '.25rem' } as const;

  return (
    <div style={{ display: 'grid', gap: '.75rem', marginTop: '.75rem', maxWidth: '620px' }}>
      <label style={{ ...labelBox, maxWidth: '340px' }}>
        <span className={bookingStyles.optionName}>Street and number</span>
        <input
          id={`${idPrefix}-line1`}
          type="text"
          maxLength={250}
          value={door.line1}
          onChange={(event) => set({ line1: event.target.value })}
          placeholder="12 Andrássy út"
          style={field}
        />
      </label>
      <label style={{ ...labelBox, maxWidth: '340px' }}>
        <span className={bookingStyles.optionName}>Apartment, floor… (optional)</span>
        <input
          type="text"
          maxLength={250}
          value={door.line2}
          onChange={(event) => set({ line2: event.target.value })}
          placeholder="2nd floor, door B"
          style={field}
        />
      </label>
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
        <label style={{ ...labelBox, flex: '1 1 180px' }}>
          <span className={bookingStyles.optionName}>City</span>
          <input
            id={`${idPrefix}-city`}
            type="text"
            maxLength={100}
            value={door.city}
            onChange={(event) => set({ city: event.target.value })}
            placeholder="Budapest"
            style={field}
          />
        </label>
        <label style={{ ...labelBox, flex: '0 1 120px' }}>
          <span className={bookingStyles.optionName}>Postal code (optional)</span>
          <input
            type="text"
            maxLength={16}
            value={door.postalCode}
            onChange={(event) => set({ postalCode: event.target.value })}
            placeholder="1054"
            style={field}
          />
        </label>
        <label style={{ ...labelBox, flex: '0 1 120px' }}>
          <span className={bookingStyles.optionName}>Country code</span>
          <input
            id={`${idPrefix}-country`}
            type="text"
            maxLength={2}
            value={door.countryCode}
            onChange={(event) =>
              set({
                countryCode: event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, 2),
              })
            }
            placeholder="HU"
            style={field}
          />
        </label>
      </div>
      <label style={{ ...labelBox, maxWidth: '420px' }}>
        <span className={bookingStyles.optionName}>Meeting instructions (optional)</span>
        <input
          type="text"
          maxLength={500}
          value={door.meetingInstructions}
          onChange={(event) => set({ meetingInstructions: event.target.value })}
          placeholder="Call on arrival; the garage entrance is on the left"
          style={{ ...field, maxWidth: '420px' }}
        />
      </label>
      <label style={{ ...labelBox, maxWidth: '420px' }}>
        <span className={bookingStyles.optionName}>
          Entry notes (optional, shared only with your driver)
        </span>
        <textarea
          maxLength={2000}
          rows={2}
          value={door.entryNotes}
          onChange={(event) => set({ entryNotes: event.target.value })}
          placeholder="Gate code, parking level…"
          style={{ ...field, maxWidth: '420px', resize: 'vertical' }}
        />
      </label>

      {zoneChecking && <p className={bookingStyles.loading}>Checking the service zone…</p>}
      {!zoneChecking && zone && zone.eligible && zone.zone && (
        <p className={bookingStyles.noticeBox}>
          Inside the service zone {zone.zone.name}
          {zone.zone.opensAt && zone.zone.closesAt
            ? ` — open ${zone.zone.opensAt.slice(0, 5)}–${zone.zone.closesAt.slice(0, 5)} (${zone.zone.timezone})`
            : ''}
          .
        </p>
      )}
      {!zoneChecking && zone && !zone.eligible && (
        <p className={bookingStyles.errorBox} role="alert">
          {zoneReasonText(zone.reason)}
        </p>
      )}
    </div>
  );
}
