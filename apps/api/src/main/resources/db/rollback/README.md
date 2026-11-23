# Manual rollback scripts (SRS 26)
Flyway Community has no automatic undo. Each `U<n>__*.sql` reverses the matching `V<n>` migration.
They live OUTSIDE `db/migration` on purpose so Flyway never runs them by accident.
Run one by hand only after taking a backup, then delete the matching row in `flyway_schema_history`.
Preferred approach: ship additive migrations and roll back by redeploying the previous app image.
