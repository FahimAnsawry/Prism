-- A project's components (Button, Card, Sidebar, … as layout trees), by name.
ALTER TABLE "project" ADD COLUMN "components" JSONB;
