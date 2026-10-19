import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_CONTACT } from '@/lib/site-contact';
import { buildApiUrl } from '@/lib/api';

import styles from './contact.module.css';

// ==========================================================
// CONTACT — LUXURY CARS
// ==========================================================
//
// Page publique de contact. Elle remplace l'ancienne page
// « Availability » de la navigation du site.
//
// Les coordonnées du siège proviennent de src/lib/site-contact.ts.
// Les points de collecte sont chargés dynamiquement depuis la base
// (rental_locations) via l'API publique : aucune liste codée en dur.
// ==========================================================

export const metadata: Metadata = {
    title: 'Contact',
    description:
        'Contact LUXURY CARS in Budapest, Hungary — telephone, email, opening hours and our collection points across the city.',
};

// Point de collecte renvoyé par GET /premium/locations.
interface RentalLocation {
    name: string;
    category: string;
    address: string;
    city: string;
    country: string;
    canPickup?: boolean;
}

// Libellés lisibles pour les catégories stockées en base.
const CATEGORY_LABELS: Record<string, string> = {
    showroom: 'Head office',
    airport: 'Airport',
    city_center: 'City centre',
    city_centre: 'City centre',
    hotel: 'Hotel',
    custom: 'Collection point',
};

async function loadCollectionPoints(): Promise<RentalLocation[]> {
    try {
        const response = await fetch(buildApiUrl('/premium/locations'), {
            cache: 'no-store',
        });
        if (!response.ok) {
            return [];
        }
        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
            return [];
        }
        return (data as RentalLocation[]).filter(
            (point) => point.canPickup !== false,
        );
    } catch {
        return [];
    }
}

export default async function ContactPage() {
    const collectionPoints = await loadCollectionPoints();

    return (
        <main className={styles.page}>

            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <p className={styles.eyebrow}>
                        GET IN TOUCH
                    </p>

                    <h1>
                        Speak with
                        <em> the maison</em>
                    </h1>

                    <p className={styles.lead}>
                        Our team is based in Budapest and
                        available to help you choose, reserve
                        and collect your vehicle.
                    </p>
                </div>
            </section>

            <section className={styles.container}>
                <div className={styles.cardGrid}>

                    <article className={styles.card}>
                        <span className={styles.cardLabel}>
                            HEAD OFFICE
                        </span>

                        <h2>{SITE_CONTACT.legalName}</h2>

                        <p className={styles.cardBody}>
                            {SITE_CONTACT.addressLine}
                            <br />
                            {SITE_CONTACT.postalCode}{' '}
                            {SITE_CONTACT.city}
                            <br />
                            {SITE_CONTACT.country}
                        </p>

                        <a
                            className={styles.cardLink}
                            href={SITE_CONTACT.mapUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open in maps
                            <span>↗</span>
                        </a>
                    </article>

                    <article className={styles.card}>
                        <span className={styles.cardLabel}>
                            TELEPHONE
                        </span>

                        <h2>Call the team</h2>

                        <p className={styles.cardBody}>
                            <a
                                className={styles.inlineLink}
                                href={`tel:${SITE_CONTACT.phoneHref}`}
                            >
                                {SITE_CONTACT.phone}
                            </a>
                        </p>

                        <p className={styles.hint}>
                            Speak to an advisor during
                            office hours.
                        </p>
                    </article>

                    <article className={styles.card}>
                        <span className={styles.cardLabel}>
                            EMAIL
                        </span>

                        <h2>Write to us</h2>

                        <p className={styles.cardBody}>
                            <a
                                className={styles.inlineLink}
                                href={`mailto:${SITE_CONTACT.email}`}
                            >
                                {SITE_CONTACT.email}
                            </a>
                        </p>

                        <p className={styles.hint}>
                            We reply within one business day.
                        </p>
                    </article>

                    <article className={styles.card}>
                        <span className={styles.cardLabel}>
                            OPENING HOURS
                        </span>

                        <h2>{SITE_CONTACT.hours}</h2>

                        <p className={styles.hint}>
                            Time zone {SITE_CONTACT.timezone}
                            {' · '}
                            collection by appointment outside
                            these hours.
                        </p>
                    </article>

                </div>
            </section>

            <section className={styles.container}>
                <div className={styles.sectionHeading}>
                    <p className={styles.eyebrow}>
                        PICK-UP &amp; RETURN
                    </p>

                    <h2>
                        Our collection points
                    </h2>

                    <p className={styles.sectionLead}>
                        Every reservation is collected
                        from one of these locations,
                        managed live by our team.
                    </p>
                </div>

                {collectionPoints.length === 0 ? (
                    <p className={styles.sectionLead}>
                        Our collection points are being
                        updated. Please contact us directly
                        to arrange your pick-up.
                    </p>
                ) : (
                    <div className={styles.pointsGrid}>
                        {collectionPoints.map((point) => (
                            <article
                                key={`${point.name}-${point.address}`}
                                className={styles.point}
                            >
                                <span className={styles.pointTag}>
                                    {CATEGORY_LABELS[point.category] ??
                                        point.category}
                                </span>

                                <h3>{point.name}</h3>

                                <p>{point.address}</p>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className={styles.cta}>
                <div className={styles.ctaInner}>
                    <div>
                        <p className={styles.eyebrow}>
                            READY WHEN YOU ARE
                        </p>

                        <h2>
                            Reserve online,
                            <em> collect in Budapest</em>
                        </h2>

                        <p className={styles.lead}>
                            Browse the fleet and start your
                            reservation in a few steps.
                        </p>
                    </div>

                    <div className={styles.ctaActions}>
                        <Link
                            href="/vehicles"
                            className={styles.primaryButton}
                        >
                            Discover the fleet
                            <span>↗</span>
                        </Link>

                        <Link
                            href="/"
                            className={styles.secondaryButton}
                        >
                            Back to home
                        </Link>
                    </div>
                </div>
            </section>

        </main>
    );
}
