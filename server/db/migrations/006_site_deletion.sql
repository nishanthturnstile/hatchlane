-- Up Migration
ALTER TABLE site_member DROP CONSTRAINT site_member_site_slug_fkey,
  ADD FOREIGN KEY (site_slug) REFERENCES site(slug) ON DELETE CASCADE;
ALTER TABLE site_invitation DROP CONSTRAINT site_invitation_site_id_fkey,
  ADD FOREIGN KEY (site_id) REFERENCES site(slug) ON DELETE CASCADE;
ALTER TABLE site_map DROP CONSTRAINT site_map_site_id_fkey,
  ADD FOREIGN KEY (site_id) REFERENCES site(slug) ON DELETE CASCADE;
ALTER TABLE site_asset DROP CONSTRAINT site_asset_site_id_fkey,
  ADD FOREIGN KEY (site_id) REFERENCES site(slug) ON DELETE CASCADE;
ALTER TABLE manhole_lock DROP CONSTRAINT manhole_lock_manhole_id_fkey,
  ADD FOREIGN KEY (manhole_id) REFERENCES site_asset(id) ON DELETE CASCADE;

-- Onboarding completion belongs to the account and can survive the first site.
ALTER TABLE admin_onboarding DROP CONSTRAINT admin_onboarding_check;
