-- Up Migration
ALTER TABLE admin_onboarding ADD COLUMN map_resolved_at timestamptz;

CREATE TABLE site_map (
  site_id text PRIMARY KEY REFERENCES site(slug),
  revision uuid NOT NULL UNIQUE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -85 AND 85),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_km double precision NOT NULL CHECK (radius_km BETWEEN 0.5 AND 10),
  bounds jsonb NOT NULL,
  archive bytea NOT NULL CHECK (octet_length(archive) BETWEEN 127 AND 20971520)
);
