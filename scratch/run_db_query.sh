#!/bin/bash
ssh -i /tmp/viht_key -o StrictHostKeyChecking=no root@194.5.78.150 "docker run --rm --network host -e PGPASSWORD=VihtAdmin2026 postgres:alpine psql -h db.ufihkyhvvqfusgavndmh.supabase.co -U postgres -d postgres -c 'SELECT 1;'"
