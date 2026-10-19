-- Notifications personnelles : migration additive. Ne modifie pas le flux éditorial "notifications".
CREATE TABLE IF NOT EXISTS user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category varchar(32) NOT NULL CHECK (category IN ('reservations','rentals','payments','security','fleet','general')),
    priority varchar(12) NOT NULL DEFAULT 'info' CHECK (priority IN ('info','success','warning','critical')),
    title varchar(180) NOT NULL,
    message text NOT NULL DEFAULT '',
    entity_type varchar(40),
    entity_id uuid,
    action_url varchar(350),
    event_key varchar(180),
    read_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_notification_internal_url CHECK (action_url IS NULL OR (left(action_url,1) = '/' AND left(action_url,2) <> '//')),
    CONSTRAINT uq_user_notification_event UNIQUE (recipient_id,event_key)
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_inbox ON user_notifications(recipient_id,created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(recipient_id) WHERE read_at IS NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    booking_updates boolean NOT NULL DEFAULT true,
    rental_reminders boolean NOT NULL DEFAULT true,
    fleet_news boolean NOT NULL DEFAULT true,
    email_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Réservée aux futures transmissions réellement configurées (email/SMS/push).
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
    channel varchar(16) NOT NULL CHECK(channel IN ('email','sms','push')),
    status varchar(16) NOT NULL CHECK(status IN ('queued','sent','failed')),
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);
