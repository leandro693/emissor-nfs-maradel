// ============================================================
//  supabaseClient.js — instância única do cliente Supabase
//  A "publishable key" é pública por design (segura no front).
//  Troque os valores abaixo se reusar em outro projeto.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL  = 'https://vccmbsntbtmwgaabhcxk.supabase.co';
export const SUPABASE_KEY  = 'sb_publishable_W22mBY9wB_k4w_J6eM2PsQ_r1-R3F1M';

// Cliente compartilhado por toda a aplicação.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
