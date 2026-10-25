#!/bin/sh
# Regénère supabase/install.sql : remise à zéro + toutes les migrations, à coller en une fois
# dans l'éditeur SQL de Supabase.
set -e
cd "$(dirname "$0")/.."
{
  printf -- "-- =============================================================================\n"
  printf -- "-- INSTALLATION COMPLÈTE DE RÉTRO SPRINT (à copier-coller en entier dans le SQL Editor)\n"
  printf -- "-- Peut être relancé sans risque : efface d'abord l'installation précédente de l'application.\n"
  printf -- "-- Fichier généré par scripts/build-install-sql.sh — ne pas modifier à la main.\n"
  printf -- "-- =============================================================================\n\n"
  cat supabase/reset.sql
  for f in supabase/migrations/*.sql; do printf "\n-- >>> %s\n" "$(basename "$f")"; cat "$f"; done
} > supabase/install.sql
