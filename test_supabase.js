const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const SUPABASE_URL = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim().replace(/(^"|"$)/g, '');
const SUPABASE_KEY = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')).split('=')[1].trim().replace(/(^"|"$)/g, '');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
supabase.from('frota_custos').select('*', { count: 'exact', head: true })
  .then(res => console.log('TABLE DATA:', res))
  .catch(e => console.error(e));

fetch('http://127.0.0.1:8001/api/v1/proxy/produtividade_records?data.gte=2026-03-01&data.lte=2026-03-31')
  .then(r => r.json())
  .then(data => console.log('PYTHON LOCAL DATA:', data.length))
  .catch(e => console.error('PYTHON ERROR:', e.message));
