// ========================
// SUPABASE — CLIENTE COMPARTIDO
// Este archivo es el ÚNICO lugar donde se configura la conexión a Supabase.
// La "SUPABASE_KEY" es una clave PÚBLICA ("publishable"), diseñada para
// exponerse en el navegador — igual que ocurre en cualquier sitio con
// Supabase/Firebase. La protección real de tus datos NO depende de
// ocultar esta clave, sino de las políticas de Row Level Security (RLS)
// activas en tu proyecto. Revisa el archivo supabase_rls.sql incluido.
// ========================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://juvngeftlkqghlwmnmro.supabase.co";
export const SUPABASE_KEY = "sb_publishable_wJQMZheTqWUkK9LtCTNqPQ_xppWGUAk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
