import Link from 'next/link';

import {
  EDITORIAL_VIDEO,
  EXPERIENCE_VIDEO,
  HERO_VIDEO,
} from '@/lib/luxury-videos';

import LuxeVideo from '@/components/luxe-video';
import HomeHighlights from '@/components/home/highlights';

import styles from './home.module.css';

const categories = [
  {
    number: '01',
    title: 'Sports Cars',
    filter: 'Sports Car',
    description:
      'Performance, precision and unmistakable character.',
  },
  {
    number: '02',
    title: 'Supercars',
    filter: 'Supercar',
    description:
      'Mid-engined exotics built for speed and presence.',
  },
  {
    number: '03',
    title: 'Hypercars',
    filter: 'Hypercar',
    description:
      'Extreme, low-volume machines at the top of the market.',
  },
  {
    number: '04',
    title: 'Grand Touring',
    filter: 'Grand Tourer',
    description:
      'Long-distance refinement with exceptional performance.',
  },
  {
    number: '05',
    title: 'Luxury Sedans',
    filter: 'Luxury Sedan',
    description:
      'Elegant comfort designed for effortless travel.',
  },
  {
    number: '06',
    title: 'Luxury SUVs',
    filter: 'Luxury SUV',
    description:
      'Comfort, presence and versatility for every journey.',
  },
  {
    number: '07',
    title: 'Convertibles',
    filter: 'Convertible',
    description:
      'Open-top grand touring and roadsters.',
  },
  {
    number: '08',
    title: 'Electric Luxury',
    filter: 'Electric Luxury',
    description:
      'All-electric premium vehicles and grand tourers.',
  },
] as const;

const advantages = [
  {
    number: '01',
    title: 'Premium Collection',
    description:
      'Explore a curated catalogue of luxury and performance vehicles.',
  },
  {
    number: '02',
    title: 'Real-Time Availability',
    description:
      'Check which vehicles can be reserved for your selected dates.',
  },
  {
    number: '03',
    title: 'Secure Reservations',
    description:
      'Create and manage your reservation through your personal account.',
  },
  {
    number: '04',
    title: 'Simple Management',
    description:
      'Follow reservation status and keep your customer profile up to date.',
  },
] as const;

const journeySteps = [
  {
    number: '01',
    title: 'Discover',
    description:
      'Explore the collection and compare the vehicles available in the catalogue.',
  },
  {
    number: '02',
    title: 'Choose your dates',
    description:
      'Select your preferred rental period and check actual availability.',
  },
  {
    number: '03',
    title: 'Reserve',
    description:
      'Sign in, complete your profile and submit your reservation online.',
  },
  {
    number: '04',
    title: 'Manage',
    description:
      'Follow the reservation status directly from your personal account.',
  },
] as const;

const faqs = [
  {
    question:
      'How do I check if a vehicle is available?',
    answer:
      'Open the availability page and select your pickup and return dates. The system displays the vehicles available for that rental period.',
  },
  {
    question:
      'Do I need a driving licence?',
    answer:
      'Yes. Your customer profile must contain your driving licence information and the licence must remain valid until the scheduled return date.',
  },
  {
    question:
      'Can I cancel my reservation?',
    answer:
      'A pending reservation can be cancelled from your account while the scheduled pickup date is still in the future.',
  },
  {
    question:
      'Where can I follow my reservation?',
    answer:
      'Open My Reservations from your account to see your reservation number, dates and current status.',
  },
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMedia}>
          <LuxeVideo
            className={styles.heroVideo}
            src={HERO_VIDEO.src}
            poster={HERO_VIDEO.poster}
          />
        </div>
        <div className={styles.heroImage} />
        <div className={styles.heroOverlay} />

        <div className={styles.heroInner}>
          <div className={styles.heroBreadcrumb}>
            HOME
            <span>—</span>
            PREMIUM CAR RENTAL
          </div>

          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>
              THE ART OF DRIVING
            </p>

            <h1>
              Luxury car rental,
              <span>redefined.</span>
            </h1>

            <p className={styles.heroDescription}>
              Discover exceptional vehicles,
              check real-time availability and
              reserve your next driving experience
              through one seamless platform.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/vehicles"
                className={styles.primaryButton}
              >
                Discover the fleet
                <span>↗</span>
              </Link>

              <Link
                href="/availability"
                className={styles.secondaryButton}
              >
                Check availability
                <span>→</span>
              </Link>
            </div>
          </div>

          <div className={styles.heroBooking}>
            <div>
              <span>
                START YOUR JOURNEY
              </span>

              <strong>
                Find the right car for your dates.
              </strong>
            </div>

            <Link
              href="/availability"
              className={styles.bookingButton}
            >
              SEARCH AVAILABILITY
              <span>↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.benefitsStrip}>
        <div className={styles.benefitsInner}>
          <span>
            <small>01</small>
            Premium fleet
          </span>

          <span>
            <small>02</small>
            Real-time availability
          </span>

          <span>
            <small>03</small>
            Online reservations
          </span>

          <span>
            <small>04</small>
            Personal account
          </span>
        </div>
      </section>

      <section className={styles.selection}>
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionLabel}>
                THE LUXURY CARS SELECTION
              </p>

              <h2>
                Choose your
                <em> driving style.</em>
              </h2>
            </div>

            <p>
              Explore premium vehicles across
              distinct categories and discover
              the character that fits your next
              journey.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            {categories.map((category) => (
              <Link
                key={category.number}
                href={`/vehicles?category=${encodeURIComponent(
                  category.filter,
                )}`}
                className={styles.categoryCard}
              >
                <div
                  className={
                    styles.categoryTop
                  }
                >
                  <span>
                    {category.number}
                  </span>

                  <span
                    className={styles.arrow}
                  >
                    ↗
                  </span>
                </div>

                <div>
                  <h3>
                    {category.title}
                  </h3>

                  <p>
                    {
                      category.description
                    }
                  </p>
                </div>

                <span
                  className={styles.discover}
                >
                  DISCOVER THE COLLECTION
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HomeHighlights />

      <section
        className={styles.experience}
        id="experience"
      >
        <div className={styles.experienceVisual}>
          <LuxeVideo
            className={styles.experienceVideo}
            src={EXPERIENCE_VIDEO.src}
            poster={EXPERIENCE_VIDEO.poster}
          />
        </div>

        <div className={styles.experienceContent}>
          <p className={styles.sectionLabel}>
            PREMIUM CAR RENTAL
          </p>

          <h2>
            Simple.
            <br />
            Secure.
            <br />
            <em>Exceptional.</em>
          </h2>

          <p className={styles.experienceLead}>
            Luxury should not make the process
            complicated. Our platform brings
            catalogue, availability,
            reservations and your customer
            account together.
          </p>

          <Link
            href="/availability"
            className={styles.darkTextLink}
          >
            Start your reservation
            <span>↗</span>
          </Link>
        </div>
      </section>

      <section className={styles.advantages}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionLabel}>
              WHY LUXURY CARS
            </p>

            <h2>
              Designed around
              <em> your journey.</em>
            </h2>
          </div>

          <div className={styles.advantagesGrid}>
            {advantages.map((item) => (
              <article
                key={item.number}
                className={
                  styles.advantageCard
                }
              >
                <span>
                  {item.number}
                </span>

                <h3>{item.title}</h3>

                <p>
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.container}>
          <div className={styles.journeyHeader}>
            <p className={styles.sectionLabel}>
              HOW IT WORKS
            </p>

            <h2>
              From discovery
              <br />
              to <em>reservation.</em>
            </h2>
          </div>

          <div className={styles.journeyList}>
            {journeySteps.map((step) => (
              <article
                key={step.number}
                className={styles.journeyItem}
              >
                <span
                  className={
                    styles.journeyNumber
                  }
                >
                  {step.number}
                </span>

                <h3>{step.title}</h3>

                <p>
                  {step.description}
                </p>
              </article>
            ))}
          </div>

          <div className={styles.journeyAction}>
            <Link
              href="/register"
              className={
                styles.outlineDarkButton
              }
            >
              Create your account
              <span>↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.editorial}>
        <LuxeVideo
          className={styles.editorialVideo}
          src={EDITORIAL_VIDEO.src}
          poster={EDITORIAL_VIDEO.poster}
        />
        <div className={styles.editorialOverlay} />

        <div className={styles.editorialContent}>
          <p>
            YOUR CAR.
            <br />
            YOUR DATES.
            <br />
            YOUR JOURNEY.
          </p>

          <h2>
            Some drives are
            <br />
            impossible to forget.
          </h2>

          <Link
            href="/vehicles"
            className={styles.lightButton}
          >
            Explore the fleet
            <span>↗</span>
          </Link>
        </div>
      </section>

      <section
        className={styles.faq}
        id="faq"
      >
        <div className={styles.container}>
          <div className={styles.faqLayout}>
            <div className={styles.faqHeading}>
              <p
                className={
                  styles.sectionLabel
                }
              >
                FREQUENTLY ASKED QUESTIONS
              </p>

              <h2>
                Everything you need
                <em> before the drive.</em>
              </h2>

              <p>
                The essentials about
                availability, reservations and
                your customer account.
              </p>
            </div>

            <div className={styles.faqList}>
              {faqs.map((item, index) => (
                <details
                  key={item.question}
                  className={styles.faqItem}
                >
                  <summary>
                    <span>
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </span>

                    {item.question}

                    <i>+</i>
                  </summary>

                  <p>
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <div>
            <p className={styles.sectionLabel}>
              READY WHEN YOU ARE
            </p>

            <h2>
              Ready to choose
              <br />
              your next car?
            </h2>

            <p>
              Select your rental dates and
              discover which vehicles are
              available.
            </p>
          </div>

          <div className={styles.finalCtaActions}>
            <Link
              href="/availability"
              className={
                styles.primaryDarkButton
              }
            >
              Check availability
              <span>↗</span>
            </Link>

            <Link
              href="/vehicles"
              className={
                styles.secondaryDarkButton
              }
            >
              Discover the fleet
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
