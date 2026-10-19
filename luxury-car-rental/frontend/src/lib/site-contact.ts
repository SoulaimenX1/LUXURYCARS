// ==========================================================
// CONTACT DU SITE — LUXURY CARS
// ==========================================================
//
// Coordonnées publiques centralisées du site (siège, téléphone,
// e-mail, horaires).
//
// Pour mettre à jour le contact affiché sur le site, il suffit de
// modifier cette constante : aucune autre page n'a besoin d'être
// touchée.
//
// Les points de collecte ne sont PAS définis ici : ils proviennent
// de la base (rental_locations) et sont lus dynamiquement par la
// page de contact.
// ==========================================================

export const SITE_CONTACT = {
    company: 'LUXURY CARS',
    legalName: 'Luxury Cars Kft.',
    email: 'info@luxurycars.hu',
    phone: '+36 1 555 0100',
    /** Même numéro, sans espaces, pour le lien tel:. */
    phoneHref: '+3615550100',
    addressLine: 'Andrássy út 12',
    postalCode: '1061',
    city: 'Budapest',
    country: 'Hungary',
    timezone: 'Europe/Budapest',
    hours: 'Every day · 09:00 – 18:00',
    mapUrl:
        'https://www.google.com/maps/search/?api=1&query=Andr%C3%A1ssy+%C3%BAt+12%2C+1061+Budapest',
} as const;
