#!/bin/sh
set -eu
umask 077

secret_dir=${1:-.local/secrets}
mkdir -p "$secret_dir"
chmod 700 "$secret_dir"

for name in db-bootstrap db-migrator db-app auth-secret; do
  if [ -s "$secret_dir/$name" ]; then
    continue
  fi

  # Compose bind-mounts these files as-is. The enclosing directory limits host access.
  temporary=$(mktemp "$secret_dir/.password.XXXXXXXX")
  trap 'rm -f "$temporary"' EXIT
  openssl rand -hex 32 > "$temporary"
  chmod 444 "$temporary"
  if ! ln "$temporary" "$secret_dir/$name" && [ ! -s "$secret_dir/$name" ]; then
    exit 1
  fi
  rm -f "$temporary"
  trap - EXIT
done
