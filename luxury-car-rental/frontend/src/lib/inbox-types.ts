// Types partagés des notifications personnelles, indépendants des annonces de flotte.
export type InboxCategory = 'reservations' | 'rentals' | 'payments' | 'security' | 'fleet' | 'general';
export type InboxPriority = 'info' | 'success' | 'warning' | 'critical';
export interface InboxNotice {
  id: string;
  category: InboxCategory;
  priority: InboxPriority;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface InboxPreferences {
  bookingUpdates: boolean;
  rentalReminders: boolean;
  fleetNews: boolean;
  emailEnabled: boolean;
}

export function notifyInboxChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('luxury-inbox-changed'));
}
