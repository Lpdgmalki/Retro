// Test de bout en bout : deux navigateurs (facilitatrice + participant) en temps réel.
// Prérequis : Supabase local démarré et l'application servie (npm run dev) sur APP_URL.
// Usage : APP_URL=http://localhost:5173 node scripts/test-e2e.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const SHOTS = process.env.SHOTS_DIR ?? 'test-results'
mkdirSync(SHOTS, { recursive: true })

// Derrière un proxy HTTPS (environnements CI/cloud), on le transmet au navigateur.
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
const browser = await chromium.launch({ proxy })
const errors = []
const pages = []
async function newPage(name, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', ignoreHTTPSErrors: Boolean(proxy) })
  const page = await ctx.newPage()
  pages.push([name, page])
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] console: ${m.text()}`))
  return page
}
const step = (s) => console.log(`  → ${s}`)
const T = { timeout: 15000 }

try {
  const alice = await newPage('alice')
  const bob = await newPage('bob', { width: 390, height: 844 }) // smartphone

  step('Alice crée une rétrospective')
  await alice.goto(APP)
  await alice.getByRole('link', { name: /Créer ma première rétrospective/ }).click()
  await alice.getByLabel(/Nom de l’équipe ou du projet/).fill('Équipe Phoenix')
  await alice.getByLabel('Votre pseudo dans la session').fill('Alice')
  await alice.getByLabel(/^Sprint/).fill('Sprint 12')
  await alice.getByLabel(/^Facilitateur/).fill('Alice Martin')
  await alice.getByLabel(/Objectif ou contexte/).fill('Livrer le parcours de paiement mobile')
  await alice.screenshot({ path: `${SHOTS}/01-creation.png`, fullPage: true })
  await alice.getByRole('button', { name: 'Créer la rétrospective' }).click()
  await alice.getByRole('dialog', { name: 'Inviter l’équipe' }).waitFor(T)
  const shareUrl = await alice.locator('#share-url').inputValue()
  if (!shareUrl.includes('/join/')) throw new Error('lien de partage invalide')
  await alice.screenshot({ path: `${SHOTS}/02-partage.png` })
  await alice.keyboard.press('Escape')

  step('Bob rejoint via le lien (mobile)')
  await bob.goto(shareUrl)
  await bob.getByText('Invitation à une rétrospective').waitFor(T)
  await bob.screenshot({ path: `${SHOTS}/03-invitation-mobile.png` })
  await bob.getByLabel(/Votre nom ou pseudo/).fill('Bob')
  await bob.getByRole('button', { name: 'Rejoindre la rétrospective' }).click()
  await bob.getByRole('heading', { name: 'Sprint 12' }).waitFor(T)

  step('Alice voit Bob arriver et ouvre les contributions')
  await alice.getByRole('button', { name: /Voir les 2 participants/ }).waitFor(T)
  await alice.getByRole('button', { name: 'Ouvrir les contributions' }).click()
  await bob.getByText('Tout le monde peut ajouter des cartes et commenter.').waitFor(T).catch(async () => {
    // Côté participant, le stepper indique l'étape courante.
    await bob.locator('[aria-current="step"]', { hasText: 'En cours' }).waitFor({ timeout: 30000 })
  })

  step('Bob ajoute une carte « négatif » ; Alice la reçoit en direct')
  await bob.getByRole('tab', { name: /Négatif/ }).click()
  await bob.getByRole('button', { name: 'Ajouter dans Points négatifs' }).click()
  await bob.getByLabel(/^Titre/).fill('Trop d’interruptions pendant le sprint')
  await bob.getByLabel(/^Description/).fill('Les demandes urgentes arrivent directement aux développeurs.')
  await bob.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await alice.getByRole('heading', { name: 'Trop d’interruptions pendant le sprint' }).waitFor(T)

  step('Alice ajoute des cartes dans les autres colonnes')
  const add = async (col, title, anon = false) => {
    await alice.getByRole('button', { name: `Ajouter dans ${col}` }).click()
    await alice.getByLabel(/^Titre/).fill(title)
    if (anon) await alice.getByLabel('Publier anonymement').check()
    await alice.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await alice.getByRole('heading', { name: title }).waitFor(T)
  }
  await add('Points positifs', 'Excellente entraide sur les revues de code')
  await add('Idées d’amélioration', 'Instaurer un « Bouclier » qui filtre les urgences')
  await add('Idées d’amélioration', 'Atelier d’affinage chaque mardi', true)
  await add('Actions à mettre en place', 'Définir une Definition of Ready avec le PO')
  await bob.getByRole('tab', { name: /Idée/ }).click()
  await bob.getByRole('heading', { name: 'Atelier d’affinage chaque mardi' }).waitFor(T)
  if (!(await bob.getByText('Anonyme').first().isVisible())) throw new Error('carte anonyme non masquée')

  step('Commentaires et réponses en temps réel')
  await alice.getByRole('heading', { name: 'Trop d’interruptions pendant le sprint' }).click()
  const drawer = alice.getByRole('dialog', { name: 'Trop d’interruptions pendant le sprint' })
  await drawer.getByLabel('Ajouter un commentaire…').fill('Combien par jour environ ?')
  await drawer.getByRole('button', { name: 'Commenter' }).click()
  await drawer.getByText('Combien par jour environ ?').waitFor(T)
  await bob.getByRole('tab', { name: /Négatif/ }).click()
  await bob.getByRole('button', { name: /1 commentaire\(s\)/ }).click()
  const bobDrawer = bob.getByRole('dialog', { name: 'Trop d’interruptions pendant le sprint' })
  await bobDrawer.getByText('Combien par jour environ ?').waitFor(T)
  await bobDrawer.getByRole('button', { name: 'Répondre' }).click()
  await bobDrawer.getByLabel(/Répondre à Alice/).fill('Au moins 5 !')
  await bobDrawer.getByRole('button', { name: 'Répondre', exact: true }).last().click()
  await drawer.getByText('Au moins 5 !').waitFor(T)
  await alice.screenshot({ path: `${SHOTS}/04-commentaires.png` })
  await bob.screenshot({ path: `${SHOTS}/05-commentaires-mobile.png` })
  await alice.keyboard.press('Escape')
  await bob.keyboard.press('Escape')

  step('Alice lance le vote ; Bob vote (quota de 5)')
  await alice.getByRole('button', { name: 'Lancer le vote' }).click()
  await alice.getByRole('button', { name: 'Confirmer' }).click()
  await bob.getByText(/Il vous reste 5 votes sur 5/).waitFor(T)
  await bob.getByRole('tab', { name: /Idée/ }).click()
  const bobIdea = bob.getByRole('article', { name: 'Instaurer un « Bouclier » qui filtre les urgences' })
  await bobIdea.getByRole('button', { name: 'Voter pour cette idée' }).click()
  await bob.getByText(/Il vous reste 4 votes sur 5/).waitFor(T)
  const aliceIdea = alice.getByRole('article', { name: 'Instaurer un « Bouclier » qui filtre les urgences' })
  await aliceIdea.getByTitle('1 vote au total').waitFor(T)
  await aliceIdea.getByRole('button', { name: 'Voter pour cette idée' }).click()
  await bobIdea.getByTitle('2 votes au total').waitFor(T)
  await bob.getByRole('tab', { name: /Négatif/ }).click()
  await bob.getByRole('article', { name: 'Trop d’interruptions pendant le sprint' }).getByRole('button', { name: 'Voter pour cette idée' }).click()
  await bob.getByText(/Il vous reste 3 votes sur 5/).waitFor(T)
  await alice.screenshot({ path: `${SHOTS}/06-vote.png`, fullPage: true })
  await bob.screenshot({ path: `${SHOTS}/07-vote-mobile.png` })

  step('Alice clôture et consulte la synthèse')
  await alice.getByRole('button', { name: 'Clôturer la rétrospective' }).click()
  await alice.getByRole('button', { name: 'Confirmer' }).click()
  await alice.getByText('Vote clôturé.').waitFor(T)
  await alice.getByRole('link', { name: 'Synthèse' }).click()
  await alice.getByText('Top 5 des idées les plus votées').waitFor(T)

  step('Conversion de l’idée gagnante en action')
  await alice.getByRole('button', { name: /Instaurer un « Bouclier/ }).last().click()
  const dialog = alice.getByRole('dialog', { name: 'Convertir en action' })
  await dialog.getByLabel('Responsable').fill('Bob')
  await dialog.getByLabel('Priorité').selectOption('high')
  await dialog.getByRole('button', { name: 'Créer l’action' }).click()
  await alice.getByRole('cell', { name: 'Instaurer un « Bouclier » qui filtre les urgences' }).first().waitFor(T)
  await alice.screenshot({ path: `${SHOTS}/08-synthese.png`, fullPage: true })

  step('Export CSV des actions')
  const [download] = await Promise.all([alice.waitForEvent('download'), alice.getByRole('button', { name: 'Actions CSV' }).click()])
  if (!download.suggestedFilename().endsWith('.csv')) throw new Error('export CSV absent')

  step('Bob met à jour le statut de l’action depuis le tableau de bord')
  await bob.goto(APP)
  await bob.getByText('Actions à suivre').waitFor(T)
  await bob.getByLabel('Statut de l’action').first().selectOption('in_progress')
  await bob.screenshot({ path: `${SHOTS}/09-accueil-mobile.png`, fullPage: true })
  await alice.goto(APP + '/actions')
  await alice.getByText('Suivi des actions').waitFor(T)
  await alice.locator('select[aria-label="Statut de l’action"]').first().waitFor(T)
  const status = await alice.locator('table select[aria-label="Statut de l’action"]').first().inputValue()
  if (status !== 'in_progress') throw new Error(`statut attendu in_progress, obtenu ${status}`)

  step('Mode présentation')
  await alice.goto(APP)
  await alice.getByRole('link', { name: 'Sprint 12' }).first().click()
  await alice.getByRole('link', { name: /Présenter/ }).click()
  await alice.getByText('Vue d’ensemble').first().waitFor(T).catch(() => {})
  await alice.screenshot({ path: `${SHOTS}/10-presentation.png` })
  await alice.keyboard.press('ArrowRight')
  await alice.keyboard.press('ArrowRight')

  step('Dashboard desktop')
  await alice.goto(APP)
  await alice.getByText('Rétrospectives récentes').waitFor(T)
  await alice.screenshot({ path: `${SHOTS}/11-accueil.png`, fullPage: true })

  step('Nettoyage : suppression de la rétrospective de test')
  await alice.getByRole('link', { name: 'Sprint 12' }).first().click()
  await alice.getByRole('button', { name: 'Paramètres' }).click()
  await alice.getByRole('button', { name: /Supprimer la rétrospective/ }).click()
  await alice.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await alice.waitForURL(APP + '/', T)

  const relevant = errors.filter((e) => !/favicon|WebSocket|Download/i.test(e))
  if (relevant.length) {
    console.log('\nErreurs navigateur :\n' + relevant.join('\n'))
    process.exitCode = 1
  } else {
    console.log('\n✓ Parcours complet réussi')
  }
} catch (e) {
  console.error('\n✗ Échec :', e.message)
  for (const [name, p] of pages) await p.screenshot({ path: `${SHOTS}/echec-${name}.png`, fullPage: true }).catch(() => {})
  if (errors.length) console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
