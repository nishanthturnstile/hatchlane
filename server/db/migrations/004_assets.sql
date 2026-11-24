-- Up Migration
CREATE TABLE site_asset (
  id uuid PRIMARY KEY,
  site_id text NOT NULL REFERENCES site(slug),
  printed_id text NOT NULL CHECK (char_length(printed_id) BETWEEN 1 AND 64),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  location_note text NOT NULL CHECK (char_length(location_note) <= 500),
  pin jsonb CHECK (jsonb_typeof(pin) = 'object')
);

CREATE UNIQUE INDEX site_asset_printed_id ON site_asset (site_id, lower(printed_id));
