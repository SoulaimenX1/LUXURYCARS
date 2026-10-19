'use client';

import { Price } from '@/components/currency-provider';
import type { BookingQuote } from '@/lib/booking';
import styles from './booking.module.css';

// ==========================================================
// DEVIS AUTORITAIRE
// ==========================================================
//
// Tous les montants proviennent de NestJS (jamais du navigateur).
// La caution est affichée séparément du total de location.

export default function BookingPriceSummary({
  quote,
  loading,
  error,
}: {
  quote: BookingQuote | null;
  loading: boolean;
  error: string;
}) {
  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (!quote) {
    return (
      <p className={styles.loading}>
        {loading ? 'Calculating your quotation…' : 'Select a pickup location, dates and times to see your price.'}
      </p>
    );
  }

  return (
    <div>
      <table className={styles.priceTable}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Rental ({quote.rentalDays} {quote.rentalDays === 1 ? 'day' : 'days'} ×{' '}
              <Price value={quote.dailyPrice} />)
            </td>
            <td>
              <Price value={quote.baseAmount} />
            </td>
          </tr>
          {quote.extras.map((extra) => (
            <tr key={extra.id}>
              <td>
                {extra.name} ({extra.pricing})
              </td>
              <td>
                <Price value={extra.total} />
              </td>
            </tr>
          ))}
          {Number(quote.deliveryAmount) > 0 && (
            <tr>
              <td>Delivery</td>
              <td>
                <Price value={quote.deliveryAmount} />
              </td>
            </tr>
          )}
          <tr>
            <td>Pick-up service</td>
            <td>
              <Price value={quote.locationFees.pickup} />
            </td>
          </tr>
          <tr>
            <td>Return service</td>
            <td>
              <Price value={quote.locationFees.dropoff} />
            </td>
          </tr>
          <tr>
            <td>One-way fee</td>
            <td>
              <Price value={quote.locationFees.oneWay} />
            </td>
          </tr>
          {Number(quote.discountAmount) > 0 && (
            <tr>
              <td>Promotion {quote.promotionCode ? `(${quote.promotionCode})` : ''}</td>
              <td>
                −<Price value={quote.discountAmount} />
              </td>
            </tr>
          )}
          <tr className={styles.priceTotal}>
            <td>Rental total</td>
            <td>
              <Price value={quote.totalAmount} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className={styles.depositBox}>
        <span>
          Security deposit (separate from the rental total, refundable according to the rental terms)
        </span>
        <strong>
          <Price value={quote.depositAmount} />
        </strong>
      </div>

      {quote.terms.length > 0 && (
        <ul className={styles.terms}>
          {quote.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
