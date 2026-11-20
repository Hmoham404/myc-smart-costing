import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Publie une entrée dans le fil d'actualité (n'interrompt jamais l'action principale) */
export async function publishPost(authorId, kind, content, refId = null, meta = {}) {
  try {
    await supabase.from('mc_posts').insert({ author_id: authorId, kind, content, ref_id: refId, meta })
  } catch (e) {
    console.warn('post non publié', e)
  }
}
