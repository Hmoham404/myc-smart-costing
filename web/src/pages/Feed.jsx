import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Share2, Calculator, FileText, FlaskConical, Globe, Trash2, SlidersHorizontal, AlertTriangle, LineChart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Avatar } from '../components/ui'
import { money, num, timeAgo, ROLE_LABEL, STATUS_LABEL } from '../lib/format'

const KIND = {
  calculation: { icon: Calculator, color: '#42b72a', label: 'a réalisé un chiffrage' },
  quote: { icon: FileText, color: '#f02849', label: 'a mis à jour un devis' },
  sample: { icon: FlaskConical, color: '#8a3ffc', label: 'a enregistré un essai' },
  parameters: { icon: SlidersHorizontal, color: '#e8710a', label: 'a modifié les paramètres' },
  alert: { icon: AlertTriangle, color: '#e41e3f', label: 'a signalé une anomalie' },
  status: null,
}

function Attachment({ post }) {
  const m = post.meta || {}
  if (post.kind === 'calculation' && m.final_price != null) {
    return (
      <Link to={`/historique?id=${post.ref_id}`} className="post-attach" style={{ display: 'block', color: 'inherit' }}>
        <div className="card-sub" style={{ textTransform: 'uppercase', fontWeight: 600 }}>{m.client} · {m.reference} · {m.process}</div>
        <div className="kpis" style={{ marginTop: 8 }}>
          <div className="kpi"><div className="k-label">Prix de revient</div><div className="k-value">{money(m.unit_cost)}</div></div>
          <div className="kpi hero"><div className="k-label">Prix de vente</div><div className="k-value">{money(m.final_price)}</div></div>
          <div className="kpi"><div className="k-label">Quantité</div><div className="k-value">{num(m.quantity)}</div></div>
        </div>
      </Link>
    )
  }
  if (post.kind === 'quote' && m.number) {
    return (
      <Link to={`/devis/${post.ref_id}`} className="post-attach" style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'inherit' }}>
        <span className="rail-icon" style={{ background: '#f02849', width: 48, height: 48 }}><FileText size={24} /></span>
        <div><b>{m.number}</b> — {m.title}<div><span className={`pill ${m.status}`}>{STATUS_LABEL[m.status]}</span></div></div>
      </Link>
    )
  }
  return null
}

function Post({ post, me, onDelete }) {
  const [likes, setLikes] = useState(post.post_likes || [])
  const [comments, setComments] = useState(post.post_comments || [])
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const liked = likes.some((l) => l.user_id === me.id)
  const k = KIND[post.kind]
  const author = post.author?.full_name || 'MYC'

  const toggleLike = async () => {
    if (liked) {
      setLikes(likes.filter((l) => l.user_id !== me.id))
      await supabase.from('mc_post_likes').delete().match({ post_id: post.id, user_id: me.id })
    } else {
      setLikes([...likes, { user_id: me.id }])
      await supabase.from('mc_post_likes').insert({ post_id: post.id, user_id: me.id })
    }
  }
  const addComment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const { data } = await supabase.from('mc_post_comments').insert({ post_id: post.id, author_id: me.id, content: text.trim() })
      .select('*, author:mc_profiles(full_name)').single()
    if (data) setComments([...comments, data])
    setText('')
  }

  return (
    <div className="card post" style={{ padding: 0 }}>
      <div className="post-head">
        <Avatar name={author} />
        <div style={{ flex: 1 }}>
          <div><span className="post-author">{author}</span>{k && <span style={{ color: 'var(--muted)' }}> {k.label}</span>}</div>
          <div className="post-meta">{ROLE_LABEL[post.author?.role] || ''} · {timeAgo(post.created_at)} · <Globe size={12} /></div>
        </div>
        {k && <span className="rail-icon" style={{ background: k.color, width: 32, height: 32 }}><k.icon size={16} /></span>}
        {(post.author_id === me.id || me.role === 'admin') && (
          <button className="round-btn" style={{ background: 'none' }} title="Supprimer" onClick={() => onDelete(post.id)}><Trash2 size={16} /></button>
        )}
      </div>
      {post.content && <div className="post-body">{post.content}</div>}
      <Attachment post={post} />
      <div className="post-stats">
        <span>{likes.length > 0 && <><span className="like-dot"><ThumbsUp size={10} /></span>{likes.length}</>}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => setOpen(true)}>{comments.length > 0 && `${comments.length} commentaire(s)`}</span>
      </div>
      <div className="post-actions">
        <button className={`post-action ${liked ? 'liked' : ''}`} onClick={toggleLike}><ThumbsUp size={18} /> J'aime</button>
        <button className="post-action" onClick={() => setOpen(true)}><MessageCircle size={18} /> Commenter</button>
        <button className="post-action" onClick={() => navigator.clipboard?.writeText(post.content)}><Share2 size={18} /> Copier</button>
      </div>
      {open && (
        <div className="comments">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar name={c.author?.full_name} size={32} />
              <div className="comment-bubble"><b>{c.author?.full_name}</b>{c.content}</div>
            </div>
          ))}
          <form className="comment" onSubmit={addComment}>
            <Avatar name={me.full_name} size={32} />
            <input className="comment-input" placeholder="Écrivez un commentaire…" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </form>
        </div>
      )}
    </div>
  )
}

export default function Feed() {
  const { profile } = useApp()
  const nav = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [stats, setStats] = useState({ calcs: 0, quotes: 0, pending: 0, samples: 0, products: 0 })

  const load = useCallback(async () => {
    const { data } = await supabase.from('mc_posts')
      .select('*, author:mc_profiles(full_name, role), post_likes:mc_post_likes(user_id), post_comments:mc_post_comments(id, content, created_at, author:mc_profiles(full_name))')
      .order('created_at', { ascending: false }).limit(50)
    setPosts(data || []); setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const count = (t, f) => { let q = supabase.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return q }
    Promise.all([
      count('calculations'), count('quotes'), count('quotes', (q) => q.eq('status', 'soumis')), count('samples'), count('products'),
    ]).then(([a, b, c, d, e]) => setStats({ calcs: a.count || 0, quotes: b.count || 0, pending: c.count || 0, samples: d.count || 0, products: e.count || 0 }))
    const ch = supabase.channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mc_posts' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const publish = async () => {
    if (!draft.trim()) return
    await supabase.from('mc_posts').insert({ author_id: profile.id, kind: 'status', content: draft.trim() })
    setDraft(''); load()
  }
  const remove = async (id) => { await supabase.from('mc_posts').delete().eq('id', id); setPosts(posts.filter((p) => p.id !== id)) }

  const stories = [
    ['/calculateur', Calculator, stats.calcs, 'Chiffrages', 'linear-gradient(160deg,#42b72a,#1b7a10)'],
    ['/devis', FileText, stats.quotes, 'Devis', 'linear-gradient(160deg,#f02849,#a3001b)'],
    ['/devis', AlertTriangle, stats.pending, 'À valider', 'linear-gradient(160deg,#f7b928,#c47f00)'],
    ['/echantillons', FlaskConical, stats.samples, 'Échantillons', 'linear-gradient(160deg,#8a3ffc,#4b1aa8)'],
    ['/simulateur', LineChart, stats.products, 'Pièces', 'linear-gradient(160deg,#1877f2,#0b4fb3)'],
  ]

  return (
    <>
      <div className="stories">
        {stories.map(([to, Icon, v, l, bg]) => (
          <div key={l} className="story" style={{ background: bg }} onClick={() => nav(to)}>
            <div className="story-icon"><Icon size={18} /></div>
            <div><div className="story-value">{v}</div><div className="story-label">{l}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="composer-row">
          <Avatar name={profile?.full_name} />
          <input className="composer-input" placeholder={`Quoi de neuf, ${profile?.full_name?.split(' ')[0] || ''} ?`}
            value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && publish()} />
          {draft && <button className="btn btn-primary" onClick={publish}>Publier</button>}
        </div>
        <div className="composer-actions">
          <button className="composer-action" onClick={() => nav('/calculateur')}><Calculator size={20} color="#42b72a" /> Nouveau chiffrage</button>
          <button className="composer-action" onClick={() => nav('/devis')}><FileText size={20} color="#f02849" /> Devis</button>
          <button className="composer-action" onClick={() => nav('/echantillons')}><FlaskConical size={20} color="#8a3ffc" /> Essai</button>
        </div>
      </div>

      {loading && <div className="card empty">Chargement…</div>}
      {!loading && posts.length === 0 && (
        <div className="card empty">
          Aucune publication. Lancez un <Link to="/calculateur">premier chiffrage</Link> : il sera publié ici automatiquement.
        </div>
      )}
      {profile && posts.map((p) => <Post key={p.id} post={p} me={profile} onDelete={remove} />)}
    </>
  )
}
