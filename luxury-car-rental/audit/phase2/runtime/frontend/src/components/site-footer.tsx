import Link from 'next/link';

import styles from './site-chrome.module.css';

// ==========================================================
// FOOTER COMMUN — LUXURY CARS
// ==========================================================
//
// Même pied de page sur tout le site public et client.
// ==========================================================

export default function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerTop}>

                <div className={styles.footerBrand}>
                    <Link href="/">
                        LUXURY
                        <em> CARS</em>
                    </Link>

                    <p>
                        Premium vehicles.
                        <br />
                        Exceptional journeys.
                    </p>
                </div>

                <div className={styles.footerColumn}>
                    <strong>EXPLORE</strong>

                    <Link href="/">Home</Link>

                    <Link href="/vehicles">
                        Our fleet
                    </Link>

                    <Link href="/contact">
                        Contact
                    </Link>
                </div>

                <div className={styles.footerColumn}>
                    <strong>ACCOUNT</strong>

                    <Link href="/login">
                        Sign in
                    </Link>

                    <Link href="/register">
                        Create account
                    </Link>

                    <Link href="/account">
                        My account
                    </Link>

                    <Link href="/account/reservations">
                        My reservations
                    </Link>

                    <Link href="/account/rentals">My rentals</Link>
                    <Link href="/account/premium">My premium collection</Link>
                </div>

            </div>

            <div className={styles.footerBottom}>
                <span>© 2026 LUXURY CARS</span>

                <span>
                    Web-Based Luxury Car Rental
                    Management System
                </span>

                <span>Prices recorded in EUR · Other currencies are indicative</span>
            </div>
        </footer>
    );
}
