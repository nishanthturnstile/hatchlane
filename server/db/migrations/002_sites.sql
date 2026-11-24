-- Up Migration
CREATE TABLE IF NOT EXISTS site (
  slug text PRIMARY KEY CHECK (length(slug) <= 63 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  time_zone text NOT NULL
);

ALTER TABLE site ADD COLUMN description text NOT NULL DEFAULT ''
  CHECK (char_length(description) <= 500);

CREATE TABLE IF NOT EXISTS site_member (
  site_slug text NOT NULL REFERENCES site(slug),
  user_id text NOT NULL REFERENCES "user"(id),
  duties text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (site_slug, user_id)
);

-- Existing site records and their assigned duties keep their original keys.
ALTER TABLE site_member ADD COLUMN role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('admin', 'member'));

UPDATE site_member m SET role = 'admin'
FROM "user" u WHERE u.id = m.user_id AND u.role = 'admin';

CREATE INDEX IF NOT EXISTS site_member_user_id ON site_member(user_id);

CREATE TABLE IF NOT EXISTS account_gate (
  user_id text PRIMARY KEY REFERENCES "user"(id),
  state text NOT NULL CHECK (state IN ('active', 'must_change', 'resetting')),
  reset_id uuid,
  CHECK ((state = 'resetting') = (reset_id IS NOT NULL))
);

CREATE TABLE admin_onboarding (
  user_id text PRIMARY KEY REFERENCES "user"(id),
  site_id text REFERENCES site(slug),
  completed_at timestamptz,
  CHECK (completed_at IS NULL OR site_id IS NOT NULL),
  FOREIGN KEY (site_id, user_id) REFERENCES site_member(site_slug, user_id)
);

-- Administrators already managing a site can keep using it after the upgrade.
INSERT INTO admin_onboarding (user_id, site_id, completed_at)
SELECT DISTINCT ON (user_id) user_id, site_slug, now()
FROM site_member WHERE role = 'admin' ORDER BY user_id, site_slug;

CREATE TABLE site_invitation (
  site_id text NOT NULL REFERENCES site(slug),
  email text NOT NULL CHECK (email = lower(email)),
  token_hash text NOT NULL UNIQUE,
  invited_by text NOT NULL REFERENCES "user"(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by text REFERENCES "user"(id),
  PRIMARY KEY (site_id, email),
  CHECK ((accepted_at IS NULL) = (accepted_by IS NULL)),
  FOREIGN KEY (site_id, accepted_by) REFERENCES site_member(site_slug, user_id)
);

REVOKE ALL ON TABLE schema_migrations FROM hatchlane_app;
