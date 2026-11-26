#!/usr/bin/env bash
# Applies every Flyway migration to a throw-away MySQL database to prove the whole chain works.
# Usage: ./scripts/verify_migrations.sh [mysql-args...]   e.g.  ./scripts/verify_migrations.sh -u root -p
# Needs the `mysql` command line client. It creates and drops the database `dialoo_migration_check`.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../apps/api/src/main/resources/db" && pwd)"
DB=dialoo_migration_check
M=(mysql --default-character-set=utf8mb4 "$@")
"${M[@]}" -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
apply() { echo "  applying $(basename "$1")"; "${M[@]}" "$DB" < "$1"; }
for f in $(ls "$DIR"/migration/V*.sql | sort -V); do apply "$f"; done
for f in "$DIR"/migration/R__*.sql; do apply "$f"; done
for f in $(ls "$DIR"/demo/*.sql | sort -V); do apply "$f"; done
echo "Tables: $("${M[@]}" -N "$DB" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB' AND table_type='BASE TABLE'")"
"${M[@]}" -e "DROP DATABASE $DB;"
echo "OK - all migrations applied cleanly."
