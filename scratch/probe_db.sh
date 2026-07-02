#!/bin/bash
for pwd in VihtAdmin2026 VihtAdmin2026\! VihtSemaphoreAdmin2026\! VihtAdmin2025 Vihtclub Vihtclub2026 SRsUbh9shH2B; do
  echo "Trying: $pwd"
  docker run --rm --network host -e PGPASSWORD="$pwd" postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -p 6543 -U postgres -d postgres -c 'SELECT 1;' &>/dev/null
  if [ $? -eq 0 ]; then
    echo "SUCCESS! Password is $pwd"
    exit 0
  fi
done
echo "All failed."
