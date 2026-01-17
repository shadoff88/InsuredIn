#!/bin/bash

# Script to apply the broker_users RLS fix migration
# Usage: ./APPLY_MIGRATION.sh

echo "========================================"
echo "Applying Broker RLS Fix Migration"
echo "========================================"
echo ""

# Check if environment variables are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SECRET_API" ]; then
    echo "❌ Error: Service role key not found"
    echo ""
    echo "Please set your Supabase service role key:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    echo ""
    echo "You can find this in:"
    echo "  Supabase Dashboard > Settings > API > service_role key"
    echo ""
    exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: Supabase URL not found"
    echo ""
    echo "Please set your Supabase URL:"
    echo "  export NEXT_PUBLIC_SUPABASE_URL='https://xxx.supabase.co'"
    echo ""
    exit 1
fi

echo "Running migration script..."
echo ""

npx tsx apply-migration-now.ts

echo ""
echo "Done!"
