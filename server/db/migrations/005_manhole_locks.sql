-- Up Migration
ALTER TABLE site_asset ADD COLUMN pin_revision integer NOT NULL DEFAULT 0;

CREATE TABLE manhole_lock (
  manhole_id uuid NOT NULL REFERENCES site_asset(id),
  door smallint NOT NULL CHECK (door IN (1, 2)),
  serial text NOT NULL UNIQUE CHECK (serial ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  description text NOT NULL CHECK (char_length(description) <= 500),
  PRIMARY KEY (manhole_id, door)
);
