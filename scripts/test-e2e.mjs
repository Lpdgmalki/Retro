// Test de bout en bout : administrateur (back office) + deux invités de l'annuaire, en temps réel.
// Prérequis : Supabase démarré (migrations appliquées) et l'application servie sur APP_URL.
// Usage : APP_URL=http://localhost:5173 TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=… node scripts/test-e2e.mjs
// En local, le compte admin@retro.test est créé par `npm run db:test`.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const SHOTS = process.env.SHOTS_DIR ?? 'test-results'
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@retro.test'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'Test-Admin-2026!'
mkdirSync(SHOTS, { recursive: true })

const stamp = Date.now().toString(36)
const BOB = { email: `bob.martin.${stamp}@retro.test`, first: 'Bob', last: 'Martin', job: 'Développeur front-end' }
const CAROL = { email: `carol.durand.${stamp}@retro.test`, first: 'Carol', last: 'Durand', job: 'Product Owner' }
const TEAM = `Équipe Phoenix ${stamp}`

/** PNG 64×64 uni généré à la volée (photo de test). */
function makePng(r, g, b) {
  const size = 64
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) raw.set([r, g, b], y * (size * 3 + 1) + 1 + x * 3)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

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
  const admin = await newPage('admin')
  const bob = await newPage('bob', { width: 390, height: 844 }) // smartphone
  const carol = await newPage('carol')

  step('Un invité ne peut pas entrer dans le back office')
  await bob.goto(APP + '/admin')
  await bob.waitForURL(/\/admin\/login$/, T)

  step('Connexion administrateur')
  await admin.goto(APP)
  await admin.getByRole('link', { name: 'Accès back office' }).click()
  await admin.getByLabel('E-mail').fill(ADMIN_EMAIL)
  await admin.getByLabel('Mot de passe', { exact: true }).fill(ADMIN_PASSWORD)
  await admin.getByRole('button', { name: 'Se connecter' }).click()
  await admin.getByRole('link', { name: 'Annuaire' }).first().waitFor(T)

  step('Annuaire : ajout d’un utilisateur avec photo')
  await admin.getByRole('link', { name: 'Annuaire' }).first().click()
  await admin.getByRole('button', { name: 'Ajouter', exact: true }).click()
  const form = admin.getByRole('dialog', { name: 'Ajouter un utilisateur' })
  await form.getByLabel('Civilité').selectOption('M.')
  await form.getByLabel('Prénom').fill(BOB.first)
  await form.getByLabel('Nom', { exact: true }).fill(BOB.last)
  await form.getByLabel(/E-mail professionnel/).fill(BOB.email)
  await form.getByLabel('Poste').fill(BOB.job)
  await form.getByLabel('Photo').setInputFiles({ name: 'bob.png', mimeType: 'image/png', buffer: makePng(79, 70, 229) })
  await form.getByRole('img', { name: /Bob Martin/ }).waitFor(T)
  await form.getByRole('button', { name: 'Enregistrer' }).click()
  await admin.getByText(BOB.email).waitFor(T)

  step('Annuaire : import CSV')
  await admin.getByRole('button', { name: 'Importer' }).click()
  const csv = `email;civilite;prenom;nom;poste\n${CAROL.email};Madame;${CAROL.first};${CAROL.last};${CAROL.job}\nmauvais-email;M.;X;Y;Z\n`
  await admin.getByLabel('Fichier CSV').setInputFiles({ name: 'annuaire.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await admin.getByText(/1 nouvel\(s\) utilisateur/).waitFor(T)
  await admin.getByText(/e-mail invalide/).waitFor(T)
  await admin.getByRole('button', { name: /^Importer \(1\)/ }).click()
  await admin.getByText(CAROL.email).waitFor(T)
  await admin.screenshot({ path: `${SHOTS}/01-annuaire.png`, fullPage: true })

  step('Création d’une rétrospective (réservée à l’admin)')
  await admin.getByRole('link', { name: /Nouvelle rétro/ }).click()
  await admin.getByRole('button', { name: 'Créer la rétrospective' }).waitFor(T)
  const teamSelect = admin.getByLabel('Équipe ou projet')
  if (await teamSelect.count()) await teamSelect.selectOption('__new__')
  await admin.getByLabel(/Nom de la nouvelle équipe|Nom de l’équipe ou du projet/).fill(TEAM)
  await admin.getByLabel('Votre pseudo dans la session').fill('Alice (admin)')
  await admin.getByLabel(/^Sprint/).fill('Sprint 12')
  await admin.getByLabel(/^Facilitateur/).fill('Alice Martin')
  await admin.getByLabel(/Objectif ou contexte/).fill('Livrer le parcours de paiement mobile')
  await admin.getByRole('button', { name: 'Créer la rétrospective' }).click()
  const invite = admin.getByRole('dialog', { name: 'Inviter des participants' })
  await invite.waitFor(T)
  await invite.getByRole('button', { name: `Inviter ${BOB.email}` }).click()
  await invite.getByRole('button', { name: `Retirer l’invitation de ${BOB.email}` }).waitFor(T)
  await admin.waitForFunction(() => /\/join\/[0-9a-f]{32}$/.test(document.querySelector('#share-url')?.value ?? ''), null, T)
  const shareUrl = await admin.locator('#share-url').inputValue()
  await admin.screenshot({ path: `${SHOTS}/02-invitation.png` })
  await admin.keyboard.press('Escape')
  await admin.getByRole('button', { name: 'Ouvrir les contributions' }).click()
  await admin.getByText('Statut : En cours').waitFor(T)

  step('Vitrine : Bob (invité depuis l’annuaire) tape son e-mail, est accueilli puis arrive directement sur sa rétro')
  await bob.goto(APP)
  await bob.getByRole('button', { name: 'Rejoindre ma rétrospective' }).click()
  const access = bob.getByRole('dialog', { name: 'Identifiez-vous' })
  await access.getByLabel('Votre adresse e-mail professionnelle').fill(`bob.martin.${stamp}`)
  await bob.getByRole('option', { name: new RegExp(BOB.email.replace(/\./g, '\\.')) }).click()
  await bob.getByText('Bienvenue M. Bob Martin').waitFor(T)
  await bob.locator('p', { hasText: BOB.job }).first().waitFor(T)
  await bob.getByRole('img', { name: 'Bob Martin' }).first().waitFor(T)
  await bob.screenshot({ path: `${SHOTS}/03-vitrine-bienvenue.png`, animations: 'disabled' })
  await bob.getByRole('dialog').getByRole('button', { name: /Accéder à ma rétrospective/ }).click()
  await bob.getByRole('heading', { name: 'Sprint 12' }).waitFor(T)
  for (const forbidden of [/Nouvelle rétro/, /Présenter/, /Synthèse/]) {
    if (await bob.getByRole('link', { name: forbidden }).count()) throw new Error(`un invité voit « ${forbidden.source} »`)
  }
  if (await bob.getByRole('button', { name: 'Inviter' }).count()) throw new Error('un invité voit « Inviter »')

  step('Carol rejoint via le lien d’invitation (e-mail exact)')
  await carol.goto(shareUrl)
  await carol.getByText('Invitation à une rétrospective').waitFor(T)
  await carol.getByLabel('Votre adresse e-mail professionnelle').fill(CAROL.email)
  await carol.getByRole('button', { name: 'Continuer' }).click()
  await carol.getByText('Bienvenue Mme Carol Durand').waitFor(T)
  await carol.getByRole('button', { name: 'Rejoindre la rétrospective' }).click()
  await carol.getByRole('heading', { name: 'Sprint 12' }).waitFor(T)
  await admin.getByRole('button', { name: /Voir les 3 participants/ }).waitFor({ timeout: 30000 })

  step('Bob ajoute une carte ; l’admin la reçoit en direct')
  await bob.getByRole('tab', { name: /Négatif/ }).click()
  await bob.getByRole('button', { name: 'Ajouter dans Points négatifs' }).click()
  await bob.getByLabel(/^Titre/).fill('Trop d’interruptions pendant le sprint')
  await bob.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await admin.getByRole('heading', { name: 'Trop d’interruptions pendant le sprint' }).waitFor({ timeout: 30000 })

  step('Option : les participants ne peuvent plus proposer de cartes')
  await admin.getByRole('button', { name: 'Paramètres' }).click()
  await admin.getByRole('switch', { name: /participants peuvent proposer des cartes/ }).click()
  await admin.getByRole('button', { name: 'Enregistrer' }).click()
  await admin.getByText('Paramètres enregistrés').waitFor(T)
  await carol.getByRole('button', { name: 'Ajouter dans Points positifs' }).waitFor({ state: 'detached', timeout: 30000 })
  await admin.getByRole('button', { name: 'Ajouter dans Idées d’amélioration' }).click()
  await admin.getByLabel(/^Titre/).fill('Instaurer un « Bouclier » qui filtre les urgences')
  await admin.getByRole('button', { name: 'Ajouter', exact: true }).click()

  step('Commentaires et votes')
  await carol.getByRole('heading', { name: 'Trop d’interruptions pendant le sprint' }).click()
  const drawer = carol.getByRole('dialog', { name: 'Trop d’interruptions pendant le sprint' })
  await drawer.getByLabel('Ajouter un commentaire…').fill('Combien par jour environ ?')
  await drawer.getByRole('button', { name: 'Commenter' }).click()
  await drawer.getByText('Combien par jour environ ?').waitFor(T)
  await carol.keyboard.press('Escape')
  await admin.getByRole('button', { name: 'Lancer le vote' }).click()
  await admin.getByRole('button', { name: 'Confirmer' }).click()
  await carol.getByText(/Il vous reste 5 votes sur 5/).waitFor({ timeout: 30000 })
  await carol.getByRole('article', { name: 'Instaurer un « Bouclier » qui filtre les urgences' }).getByRole('button', { name: 'Voter pour cette idée' }).click()
  await carol.getByText(/Il vous reste 4 votes sur 5/).waitFor(T)
  await carol.screenshot({ path: `${SHOTS}/04-tableau-invitee.png`, fullPage: true })

  step('Clôture : le rapport s’affiche automatiquement chez les invités')
  await admin.getByRole('button', { name: 'Clôturer la rétrospective' }).click()
  await admin.getByRole('button', { name: 'Confirmer' }).click()
  await admin.getByText('Vote clôturé.').waitFor(T)
  await carol.getByText('Rapport de rétrospective').waitFor({ timeout: 30000 })
  await carol.getByText('Les idées les plus plébiscitées').waitFor(T)
  await bob.getByText('Rapport de rétrospective').waitFor({ timeout: 30000 })
  await admin.getByRole('link', { name: 'Synthèse' }).click()
  await admin.getByRole('button', { name: /Instaurer un « Bouclier/ }).last().click()
  const dialog = admin.getByRole('dialog', { name: 'Convertir en action' })
  await dialog.getByLabel('Responsable').fill('Bob Martin')
  await dialog.getByRole('button', { name: 'Créer l’action' }).click()
  await admin.getByRole('cell', { name: 'Instaurer un « Bouclier » qui filtre les urgences' }).first().waitFor(T)
  await admin.screenshot({ path: `${SHOTS}/05-synthese.png`, fullPage: true })
  await carol.reload()
  await carol.getByText('Notre plan d’actions').waitFor(T)
  await carol.getByText('Instaurer un « Bouclier » qui filtre les urgences').last().waitFor(T)
  await carol.screenshot({ path: `${SHOTS}/07-rapport-invite.png`, fullPage: true, animations: 'disabled' })
  await bob.screenshot({ path: `${SHOTS}/08-rapport-mobile.png`, fullPage: true, animations: 'disabled' })

  step('Paramètres du back office')
  await admin.getByRole('link', { name: 'Paramètres' }).first().click()
  await admin.getByText('Administrateurs').first().waitFor(T)
  await admin.getByText(ADMIN_EMAIL).waitFor(T)
  await admin.screenshot({ path: `${SHOTS}/06-parametres.png`, fullPage: true })

  step('Nettoyage : rétrospective et utilisateurs de test')
  await admin.getByRole('link', { name: 'Rétrospectives' }).first().click()
  await admin.getByRole('link', { name: 'Sprint 12' }).first().click()
  await admin.getByRole('button', { name: 'Paramètres' }).click()
  await admin.getByRole('button', { name: /Supprimer la rétrospective/ }).click()
  await admin.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await admin.waitForURL(/\/admin\/retros$/, T)
  await admin.getByRole('link', { name: 'Annuaire' }).first().click()
  for (const m of [BOB, CAROL]) {
    await admin.getByRole('button', { name: `Supprimer ${m.email}` }).click()
    await admin.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await admin.getByText(m.email).waitFor({ state: 'detached', timeout: 15000 })
  }

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
