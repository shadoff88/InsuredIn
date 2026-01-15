// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') })

console.log('🔍 Checking environment variables...\n')

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_API',
  'SUPABASE_SECRET_API',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY'
]

let allPresent = true

required.forEach(key => {
  const value = process.env[key]
  if (value) {
    console.log(`✅ ${key}`)
  } else {
    console.log(`❌ ${key} - MISSING!`)
    allPresent = false
  }
})

if (allPresent) {
  console.log('\n✅ All environment variables present!')
} else {
  console.log('\n❌ Some environment variables are missing!')
  process.exit(1)
}