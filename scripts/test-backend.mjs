// Tests d'intégration du backend Supabase (RLS, RPC, votes, temps réel, back office).
// Usage : SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/test-backend.mjs
// Par défaut : instance locale lancée par `npx supabase start`.
// Compte administrateur : TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (créé et promu premier
// administrateur s'il n'en existe aucun — cas d'une base locale neuve).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function envFromFile() {
  try {
    return Object.fromEntries(
      readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
}
const fileEnv = envFromFile()
const URL_ = process.env.SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.SUPABASE_ANON_KEY ?? fileEnv.VITE_SUPABASE_ANON_KEY

let passed = 0
let failed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n      ${e.message}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function expectError(promise, pattern) {
  const { error } = await promise
  assert(error, `une erreur était attendue (${pattern})`)
  if (pattern) assert(new RegExp(pattern, 'i').test(error.message), `message inattendu : ${error.message}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Attend la confirmation « Subscribed to PostgreSQL » (le slot de réplication peut mettre un moment).
function subscribeAndWait(channel) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('abonnement temps réel non confirmé')), 15000)
    channel.on('system', {}, (p) => {
      if (p.extension === 'postgres_changes') {
        clearTimeout(timer)
        p.status === 'ok' ? resolve() : reject(new Error(p.message))
      }
    })
    channel.subscribe((s) => s === 'CHANNEL_ERROR' && reject(new Error(s)))
  })
}

async function newUser() {
  const client = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  return { client, id: data.user.id }
}

async function adminUser() {
  const email = process.env.TEST_ADMIN_EMAIL ?? 'admin@retro.test'
  const password = process.env.TEST_ADMIN_PASSWORD ?? 'Test-Admin-2026!'
  const client = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  let { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    ;({ data, error } = await client.auth.signUp({ email, password }))
    if (error) throw error
  }
  const { data: hasAdmin } = await client.rpc('has_admin')
  if (!hasAdmin) {
    const r = await client.rpc('claim_first_admin')
    if (r.error) throw r.error
  }
  const { data: isAdmin } = await client.rpc('is_admin')
  if (!isAdmin) throw new Error(`${email} n'est pas administrateur (définissez TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD)`)
  return { client, id: data.user.id }
}

const alice = await adminUser() // administratrice et facilitatrice
const bob = await newUser() // participant (annuaire)
const carol = await newUser() // participante (annuaire)
const eve = await newUser() // extérieure, sans lien ni identité
const stamp = Date.now().toString(36)
const bobEmail = `bob.${stamp}@retro.test`
const carolEmail = `carol.${stamp}@retro.test`
const createdMembers = []

console.log('\nBack office et annuaire')
await test('un invité ne peut pas devenir administrateur ni créer de rétro', async () => {
  await expectError(eve.client.rpc('claim_first_admin'), 'compte e-mail|existe déjà')
  const { data } = await eve.client.rpc('is_admin')
  assert(data === false, 'pas administrateur')
  await expectError(
    eve.client.rpc('create_retro', {
      p_team_id: null, p_team_name: 'X', p_sprint_name: 'S', p_retro_date: null, p_facilitator_name: 'E',
      p_goal: '', p_closes_at: null, p_max_votes: 5, p_allow_multiple_votes: false, p_confidential_votes: false,
      p_allow_anonymous: true, p_participants_can_add: true, p_display_name: 'E',
    }),
    'administrateurs',
  )
})

await test('l’administrateur gère l’annuaire ; les invités n’y ont pas accès', async () => {
  const { data, error } = await alice.client
    .from('members')
    .insert([
      { email: bobEmail, civility: 'M.', first_name: 'Bob', last_name: 'Martin', job_title: 'Développeur' },
      { email: carolEmail, civility: 'Mme', first_name: 'Carol', last_name: 'Durand', job_title: 'Product Owner' },
    ])
    .select()
  if (error) throw error
  createdMembers.push(...data.map((m) => m.id))
  const { data: seen } = await eve.client.from('members').select('*')
  assert(seen.length === 0, 'annuaire invisible pour un invité')
  await expectError(eve.client.from('members').insert({ email: `x.${stamp}@retro.test` }))
  await expectError(alice.client.from('members').insert({ email: bobEmail.toUpperCase() }), 'duplicate|unique')
})

await test('paramètres modifiables uniquement par l’administrateur', async () => {
  const { data: s } = await eve.client.from('app_settings').select('*').single()
  assert(s.org_name, 'paramètres lisibles')
  const { data: upd } = await eve.client.from('app_settings').update({ org_name: 'Piraté' }).eq('id', 1).select()
  assert(upd.length === 0, 'modification refusée')
  const { data: ok, error } = await alice.client.from('app_settings').update({ allow_external_guests: false }).eq('id', 1).select()
  if (error) throw error
  assert(ok.length === 1, 'modification par l’admin')
})

await test('suggestions d’e-mails et identification', async () => {
  const { data: none } = await bob.client.rpc('suggest_members', { p_query: 'b' })
  assert(none.length === 0, 'au moins 2 caractères')
  const { data: sugg } = await bob.client.rpc('suggest_members', { p_query: `bob.${stamp}` })
  assert(sugg.length === 1 && sugg[0].job_title === 'Développeur' && sugg[0].civility === 'M.', 'suggestion trouvée')
  await expectError(eve.client.rpc('identify_member', { p_email: 'inconnu@nulle-part.test' }), 'inconnue')
  const { data: me, error } = await bob.client.rpc('identify_member', { p_email: bobEmail })
  if (error) throw error
  assert(me.first_name === 'Bob', 'identité renvoyée')
  await carol.client.rpc('identify_member', { p_email: carolEmail })
  const { data: mine } = await bob.client.rpc('my_member')
  assert(mine.length === 1 && mine[0].email === bobEmail, 'identité mémorisée')
})

console.log('\nCréation et partage')
let retro
let token
await test('create_retro crée la rétro, l’équipe et le facilitateur', async () => {
  const { data, error } = await alice.client.rpc('create_retro', {
    p_team_id: null,
    p_team_name: 'TEST AUTOMATIQUE (à ignorer)',
    p_sprint_name: 'Sprint 1',
    p_retro_date: '2026-10-24',
    p_facilitator_name: 'Alice',
    p_goal: 'Objectif',
    p_closes_at: null,
    p_max_votes: 3,
    p_allow_multiple_votes: false,
    p_confidential_votes: false,
    p_allow_anonymous: true,
    p_participants_can_add: true,
    p_display_name: 'Alice',
  })
  if (error) throw error
  retro = data
  assert(retro.status === 'draft', 'statut initial brouillon')
  const { data: inv, error: invErr } = await alice.client.from('retro_invites').select('token').eq('retro_id', retro.id).single()
  if (invErr) throw invErr
  token = inv.token
  assert(token.length === 32, 'jeton de partage')
  assert(!('share_token' in retro), 'le jeton ne circule plus avec la rétro')
})

await test('validation : sprint vide refusé', async () => {
  await expectError(
    alice.client.rpc('create_retro', {
      p_team_id: null, p_team_name: 'X', p_sprint_name: '  ', p_retro_date: null, p_facilitator_name: 'A',
      p_goal: '', p_closes_at: null, p_max_votes: 5, p_allow_multiple_votes: false, p_confidential_votes: false,
      p_allow_anonymous: true, p_participants_can_add: true, p_display_name: 'A',
    }),
    'check',
  )
})

await test('un extérieur ne voit pas la rétro', async () => {
  const { data } = await eve.client.from('retros').select('*').eq('id', retro.id)
  assert(data.length === 0, 'la rétro ne doit pas être visible')
})

await test('un extérieur ne peut pas lire cartes ni participants', async () => {
  const { data: p } = await eve.client.from('participants').select('*').eq('retro_id', retro.id)
  assert(p.length === 0, 'participants invisibles')
})

await test('sans identité annuaire, impossible de rejoindre', async () => {
  await expectError(eve.client.rpc('join_retro', { p_token: token, p_display_name: 'Eve' }), 'Identifiez-vous')
})

await test('seul l’administrateur lit le lien d’invitation', async () => {
  const { data } = await eve.client.from('retro_invites').select('*')
  assert(data.length === 0, 'lien invisible pour un invité')
})

await test('aperçu par jeton puis adhésion (identité annuaire)', async () => {
  const { data: prev } = await bob.client.rpc('preview_retro', { p_token: token })
  assert(prev[0].sprint_name === 'Sprint 1' && prev[0].already_joined === false, 'aperçu')
  const { data: id, error } = await bob.client.rpc('join_retro', { p_token: token, p_display_name: 'Bob' })
  if (error) throw error
  assert(id === retro.id, 'retourne l’id')
  await carol.client.rpc('join_retro', { p_token: token, p_display_name: 'Carol' })
  const { data } = await bob.client.from('retros').select('id').eq('id', retro.id)
  assert(data.length === 1, 'visible après adhésion')
  const { data: p } = await bob.client.from('participants').select('*').eq('retro_id', retro.id).eq('user_id', bob.id).single()
  assert(p.display_name === 'Bob Martin' && p.job_title === 'Développeur', 'nom et poste repris de l’annuaire')
})

await test('jeton invalide refusé', async () => {
  await expectError(eve.client.rpc('join_retro', { p_token: 'nope', p_display_name: 'Eve' }), 'invalide')
})

await test('un participant ne peut pas modifier la rétro ni s’auto-promouvoir', async () => {
  const { data: asFac } = await bob.client.rpc('is_facilitator', { p_retro_id: retro.id })
  assert(asFac === false, 'seuls les administrateurs animent')
  const { data } = await bob.client.from('retros').update({ status: 'open' }).eq('id', retro.id).select()
  assert(data.length === 0, 'mise à jour ignorée par RLS')
  const { error } = await bob.client.from('participants').update({ role: 'facilitator' }).eq('retro_id', retro.id).eq('user_id', bob.id)
  assert(error && /facilitateur/.test(error.message), 'promotion refusée')
})

await test('insertion directe dans participants / votes / cartes interdite', async () => {
  await expectError(eve.client.from('participants').insert({ retro_id: retro.id, user_id: eve.id, display_name: 'Eve' }))
  await expectError(bob.client.from('votes').insert({ retro_id: retro.id, card_id: retro.id, user_id: bob.id }))
  await expectError(bob.client.from('cards').insert({ retro_id: retro.id, category: 'positive', title: 'x' }))
})

console.log('\nContributions')
let bobCard, anonCard
await test('brouillon : participant ne peut pas contribuer, facilitateur oui', async () => {
  await expectError(
    bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Tôt', p_description: '', p_anonymous: false }),
    'fermées',
  )
  const { error } = await alice.client.rpc('create_card', {
    p_retro_id: retro.id, p_category: 'positive', p_title: 'Exemple', p_description: '', p_anonymous: false,
  })
  if (error) throw error
})

await test('ouverture : cartes, anonymat et propriété', async () => {
  await alice.client.from('retros').update({ status: 'open' }).eq('id', retro.id)
  const r1 = await bob.client.rpc('create_card', {
    p_retro_id: retro.id, p_category: 'negative', p_title: 'Trop de réunions', p_description: 'Détail', p_anonymous: false,
  })
  if (r1.error) throw r1.error
  bobCard = r1.data
  const r2 = await bob.client.rpc('create_card', {
    p_retro_id: retro.id, p_category: 'improvement', p_title: 'Idée anonyme', p_description: '', p_anonymous: true,
  })
  if (r2.error) throw r2.error
  anonCard = r2.data
  assert(anonCard.author_id === null, 'auteur masqué')
  const { data: seen } = await carol.client.from('cards').select('*').eq('id', anonCard.id).single()
  assert(seen.author_id === null, 'Carol ne voit pas l’auteur')
  const { data: owners } = await carol.client.from('card_owners').select('*').eq('card_id', anonCard.id)
  assert(owners.length === 0, 'propriété invisible pour Carol')
  const { data: mine } = await bob.client.from('card_owners').select('*').eq('card_id', anonCard.id)
  assert(mine.length === 1, 'Bob connaît sa carte')
})

await test('seul le propriétaire modifie sa carte anonyme', async () => {
  const { data: c1 } = await carol.client.from('cards').update({ title: 'Piraté' }).eq('id', anonCard.id).select()
  assert(c1.length === 0, 'Carol ne peut pas modifier')
  const { data: c2, error } = await bob.client.from('cards').update({ title: 'Idée anonyme v2' }).eq('id', anonCard.id).select()
  if (error) throw error
  assert(c2[0].title === 'Idée anonyme v2' && c2[0].author_id === null, 'Bob modifie, anonymat préservé')
})

await test('validation : titre trop long refusé', async () => {
  await expectError(
    bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'x'.repeat(141), p_description: '', p_anonymous: false }),
  )
})

await test('option « participants peuvent proposer des cartes » désactivée', async () => {
  await alice.client.from('retros').update({ participants_can_add: false }).eq('id', retro.id)
  await expectError(
    bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Interdit', p_description: '', p_anonymous: false }),
    'fermées',
  )
  const { error } = await alice.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Carte admin', p_description: '', p_anonymous: false })
  if (error) throw error
  await alice.client.from('retros').update({ participants_can_add: true }).eq('id', retro.id)
})

await test('vitrine : rétros ouvertes listées pour les personnes identifiées seulement', async () => {
  const { data: invBob } = await bob.client.from('retro_invites').select('*')
  assert(invBob.length === 0, 'un participant ne voit pas le lien d’invitation')
  const { data: forBob } = await bob.client.rpc('list_my_retros')
  assert(forBob.some((r) => r.retro_id === retro.id && r.joined), 'visible et rejointe pour Bob')
  const { data: forEve } = await eve.client.rpc('list_my_retros')
  assert(forEve.length === 0, 'rien pour un invité non identifié')
  await expectError(eve.client.rpc('join_open_retro', { p_retro_id: retro.id }), 'pas invité')
})

console.log('\nCommentaires')
let parentComment
await test('commenter, répondre, modifier', async () => {
  const { data, error } = await carol.client.from('comments').insert({ card_id: bobCard.id, retro_id: retro.id, body: 'Je confirme' }).select().single()
  if (error) throw error
  parentComment = data
  assert(data.author_id === carol.id, 'auteur forcé')
  const r = await bob.client.from('comments').insert({ card_id: bobCard.id, retro_id: retro.id, body: 'Merci', parent_id: data.id }).select().single()
  if (r.error) throw r.error
  const { data: upd } = await bob.client.from('comments').update({ body: 'Hack' }).eq('id', data.id).select()
  assert(upd.length === 0, 'Bob ne modifie pas le commentaire de Carol')
  const { data: upd2 } = await carol.client.from('comments').update({ body: 'Je confirme !' }).eq('id', data.id).select()
  assert(upd2[0].body === 'Je confirme !', 'Carol modifie le sien')
})

await test('usurpation d’auteur impossible', async () => {
  const { data } = await bob.client.from('comments').insert({ card_id: bobCard.id, retro_id: retro.id, body: 'x', author_id: carol.id }).select().single()
  assert(data.author_id === bob.id, 'author_id réécrit')
  await bob.client.from('comments').delete().eq('id', data.id)
})

await test('suppression d’un commentaire avec réponses = suppression douce', async () => {
  await carol.client.from('comments').delete().eq('id', parentComment.id)
  const { data } = await carol.client.from('comments').select('*').eq('id', parentComment.id).single()
  assert(data.is_deleted && data.body === '', 'commentaire masqué mais conservé')
  const { data: replies } = await carol.client.from('comments').select('*').eq('parent_id', parentComment.id)
  assert(replies.length === 1, 'réponse conservée')
})

console.log('\nVotes')
let ideaCard, otherCards = []
await test('vote fermé tant que le statut n’est pas « vote »', async () => {
  await expectError(bob.client.rpc('cast_vote', { p_card_id: bobCard.id }), 'pas ouvert')
})

await test('passage en vote : contributions fermées', async () => {
  for (const t of ['A', 'B', 'C']) {
    const { data } = await alice.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'improvement', p_title: `Idée ${t}`, p_description: '', p_anonymous: false })
    otherCards.push(data)
  }
  ideaCard = otherCards[0]
  await alice.client.from('retros').update({ status: 'voting' }).eq('id', retro.id)
  await expectError(
    bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Tard', p_description: '', p_anonymous: false }),
    'fermées',
  )
})

await test('un vote par idée (pas de double vote)', async () => {
  const { error } = await bob.client.rpc('cast_vote', { p_card_id: ideaCard.id })
  if (error) throw error
  await expectError(bob.client.rpc('cast_vote', { p_card_id: ideaCard.id }), 'déjà voté')
})

await test('quota de votes respecté (3)', async () => {
  await bob.client.rpc('cast_vote', { p_card_id: otherCards[1].id })
  await bob.client.rpc('cast_vote', { p_card_id: otherCards[2].id })
  await expectError(bob.client.rpc('cast_vote', { p_card_id: bobCard.id }), 'tous vos votes')
})

await test('retirer un vote libère un crédit', async () => {
  const { error } = await bob.client.rpc('remove_vote', { p_card_id: otherCards[2].id })
  if (error) throw error
  const r = await bob.client.rpc('cast_vote', { p_card_id: bobCard.id })
  if (r.error) throw r.error
})

await test('votes concurrents : impossible de dépasser le quota', async () => {
  await alice.client.from('retros').update({ allow_multiple_votes: true }).eq('id', retro.id)
  const results = await Promise.all(Array.from({ length: 10 }, () => carol.client.rpc('cast_vote', { p_card_id: ideaCard.id })))
  const ok = results.filter((r) => !r.error).length
  assert(ok === 3, `3 votes acceptés attendus, obtenu ${ok}`)
  const { count } = await carol.client.from('votes').select('*', { count: 'exact', head: true }).eq('user_id', carol.id)
  assert(count === 3, `3 votes en base, obtenu ${count}`)
})

await test('extérieur ne peut pas voter', async () => {
  await expectError(eve.client.rpc('cast_vote', { p_card_id: ideaCard.id }), 'rejoindre')
})

await test('totaux agrégés visibles (mode public)', async () => {
  const { data } = await bob.client.rpc('get_vote_totals', { p_retro_id: retro.id })
  const t = Object.fromEntries(data.map((r) => [r.card_id, Number(r.votes)]))
  assert(t[ideaCard.id] === 4, `4 votes sur l’idée A, obtenu ${t[ideaCard.id]}`)
  const { data: usage } = await bob.client.rpc('get_vote_usage', { p_retro_id: retro.id })
  assert(usage.find((u) => u.user_id === carol.id).used == 3, 'usage Carol')
})

console.log('\nVote confidentiel')
await test('votes des autres et totaux masqués pendant le vote', async () => {
  await alice.client.from('retros').update({ confidential_votes: true }).eq('id', retro.id)
  const { data: v } = await bob.client.from('votes').select('*').eq('retro_id', retro.id)
  assert(v.every((x) => x.user_id === bob.id), 'Bob ne voit que ses votes')
  const { data: t } = await bob.client.rpc('get_vote_totals', { p_retro_id: retro.id })
  assert(t.length === 0, 'totaux masqués')
})

await test('clôture : totaux agrégés révélés, votes individuels toujours masqués', async () => {
  const { data: r } = await alice.client.from('retros').update({ status: 'closed' }).eq('id', retro.id).select().single()
  assert(r.votes_revealed === true, 'votes_revealed activé')
  const { data: t } = await bob.client.rpc('get_vote_totals', { p_retro_id: retro.id })
  assert(t.length > 0, 'totaux visibles')
  const { data: v } = await bob.client.from('votes').select('*').eq('retro_id', retro.id)
  assert(v.every((x) => x.user_id === bob.id), 'votes individuels toujours privés')
})

await test('rétro terminée : plus de vote ni de commentaire', async () => {
  await expectError(bob.client.rpc('cast_vote', { p_card_id: ideaCard.id }), 'pas ouvert')
  await expectError(bob.client.from('comments').insert({ card_id: bobCard.id, retro_id: retro.id, body: 'tard' }))
})

console.log('\nActions')
let action
await test('le facilitateur convertit une idée en action', async () => {
  const { data, error } = await alice.client
    .from('action_items')
    .insert({ retro_id: retro.id, team_id: retro.team_id, title: 'Mettre en place la DoR', source_card_id: ideaCard.id, priority: 'high' })
    .select()
    .single()
  if (error) throw error
  action = data
  assert(action.source_title === 'Idée A', 'titre source copié')
})

await test('un participant ne crée pas d’action mais peut suivre son statut', async () => {
  await expectError(bob.client.from('action_items').insert({ retro_id: retro.id, team_id: retro.team_id, title: 'x' }))
  const { data } = await bob.client.from('action_items').update({ status: 'in_progress' }).eq('id', action.id).select()
  assert(data[0].status === 'in_progress', 'statut mis à jour')
})

await test('carte source d’une autre rétro refusée', async () => {
  const { data: other } = await alice.client.rpc('create_retro', {
    p_team_id: retro.team_id, p_team_name: null, p_sprint_name: 'Sprint 2', p_retro_date: '2026-11-07',
    p_facilitator_name: 'Alice', p_goal: '', p_closes_at: null, p_max_votes: 5, p_allow_multiple_votes: false,
    p_confidential_votes: false, p_allow_anonymous: true, p_participants_can_add: true, p_display_name: 'Alice',
  })
  await expectError(
    alice.client.from('action_items').insert({ retro_id: other.id, team_id: other.team_id, title: 'x', source_card_id: ideaCard.id }),
    'même rétrospective',
  )
  // Cloisonnement : Bob (même équipe, non invité) ne voit pas cette rétro et ne peut pas la rejoindre.
  const { data: seen } = await bob.client.from('retros').select('id').eq('id', other.id)
  assert(seen.length === 0, 'rétro non invitée invisible')
  await expectError(bob.client.rpc('join_open_retro', { p_retro_id: other.id }), 'pas invité')
  // Invitation nominative de Carol depuis l'annuaire.
  const { data: carolMember } = await alice.client.from('members').select('id').eq('email', carolEmail).single()
  const { error: invErr } = await alice.client.from('retro_member_invites').insert({ retro_id: other.id, member_id: carolMember.id })
  if (invErr) throw invErr
  await expectError(bob.client.from('retro_member_invites').insert({ retro_id: other.id, member_id: carolMember.id }))
  await alice.client.from('retros').update({ status: 'open' }).eq('id', other.id)
  const { data: carolList } = await carol.client.rpc('list_my_retros')
  assert(carolList.some((r) => r.retro_id === other.id && !r.joined), 'rétro invitée listée pour Carol')
  const { data: bobList } = await bob.client.rpc('list_my_retros')
  assert(!bobList.some((r) => r.retro_id === other.id), 'rétro non listée pour Bob')
  const { error: joinErr } = await carol.client.rpc('join_open_retro', { p_retro_id: other.id })
  if (joinErr) throw joinErr
  await expectError(
    bob.client.rpc('create_card', { p_retro_id: other.id, p_category: 'positive', p_title: 'x', p_description: '', p_anonymous: false }),
    'rejoindre',
  )
  await alice.client.from('retros').delete().eq('id', other.id)
})

console.log('\nTemps réel')
await test('une carte créée par Bob arrive chez Carol en temps réel', async () => {
  await alice.client.from('retros').update({ status: 'open' }).eq('id', retro.id)
  const received = []
  const channel = carol.client
    .channel('t-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards', filter: `retro_id=eq.${retro.id}` }, (p) => received.push(p.new))
  await subscribeAndWait(channel)
  const { error } = await bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Temps réel !', p_description: '', p_anonymous: false })
  if (error) throw error
  for (let i = 0; i < 30 && received.length === 0; i++) await sleep(200)
  await carol.client.removeChannel(channel)
  assert(received.some((c) => c.title === 'Temps réel !'), 'événement reçu')
})

await test('un extérieur abonné ne reçoit rien (RLS temps réel)', async () => {
  const received = []
  const channel = eve.client
    .channel('e-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards', filter: `retro_id=eq.${retro.id}` }, (p) => received.push(p.new))
  await subscribeAndWait(channel)
  await bob.client.rpc('create_card', { p_retro_id: retro.id, p_category: 'positive', p_title: 'Secret', p_description: '', p_anonymous: false })
  await sleep(2500)
  await eve.client.removeChannel(channel)
  assert(received.length === 0, 'aucune fuite')
})

console.log('\nDroits de suppression')
await test('le dernier facilitateur ne peut pas être retiré', async () => {
  const { error } = await alice.client.from('participants').update({ role: 'participant' }).eq('retro_id', retro.id).eq('user_id', alice.id)
  assert(error, 'refusé')
})

await test('le facilitateur supprime la rétro (cascade)', async () => {
  const { error } = await alice.client.from('retros').delete().eq('id', retro.id)
  if (error) throw error
  const { data } = await alice.client.from('cards').select('id').eq('retro_id', retro.id)
  assert(data.length === 0, 'cartes supprimées')
})

if (createdMembers.length) await alice.client.from('members').delete().in('id', createdMembers)

console.log(`\n${passed} réussi(s), ${failed} échoué(s)\n`)
process.exit(failed ? 1 : 0)
