# Tracking Completo Italiano — Piano di Implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riscrivere il sistema di tracking analytics di drape-react con nomi italiani leggibili e copertura 100% di ogni interazione utente.

**Architecture:** Riscrittura di `analyticsService.ts` con nuovi nomi italiani per tutti i 105 tipi di evento. Aggiornamento di tutti i 32 file che importano le funzioni di tracking. Aggiunta di 9 nuovi punti di tracking mancanti. Aggiornamento del registry nella dashboard admin.

**Tech Stack:** TypeScript, React Native, Firestore, Zustand

**Spec:** `docs/superpowers/specs/2026-03-18-tracking-completo-design.md`

---

### Task 1: Riscrivere analyticsService.ts con nomi italiani

**Files:**
- Modify: `src/core/services/analyticsService.ts` (riscrittura completa)

Riscrivere tutte le 87 funzioni esportate con nomi italiani. Il pattern interno resta identico (`trackEvent(type, data)`). Cambia solo il `type` string e i nomi dei campi data.

- [ ] **Step 1: Creare la mappa di rinomina**

Ogni vecchia funzione → nuova funzione + nuovo type:

```
// Auth
trackLogin(method) → tracciaLogin(metodo) → type: 'login', metodo
trackRegister() → tracciaRegistrazione() → type: 'registrazione'
trackForgotPassword() → tracciaResetPassword() → type: 'reset_password'
trackLogout() → tracciaLogout() → type: 'logout'
trackDeleteAccount() → tracciaEliminaAccount() → type: 'elimina_account'
trackError(msg,ctx) → tracciaErrore(messaggio,contesto) → type: 'errore_app'

// Navigazione
trackScreenView(screen) → tracciaSchermata(schermata) → type: 'schermata'

// App lifecycle
(app_foreground) → type: 'app_primo_piano'
(app_background) → type: 'app_background'

// Progetti
trackProjectCreate(name,lang,mode,desc) → tracciaProgettoCreato(nome,linguaggio,modalita,descrizione)
trackProjectOpen(name) → tracciaProgettoAperto(nome)
trackProjectDelete(name) → tracciaProgettoEliminato(nome)
trackProjectRename(old,new) → tracciaProgettoRinominato(vecchio,nuovo)
trackProjectDuplicate(name) → tracciaProgettoDuplicato(nome)
trackProjectShare(name) → tracciaProgettoCondiviso(nome)
trackProjectFilter(filter) → tracciaProgettoFiltro(filtro)
trackProjectBulkDelete(count) → tracciaProgettoEliminaMultipli(quantita)

// Chat & AI
trackChatMessage(model,agent) → tracciaMessaggioChat(modello,modalita_agente)
trackChatTerminalCommand() → tracciaComandoTerminaleChat()
trackNewChat(type) → tracciaNuovaChat(tipo)
trackChatMinimize(collapsed) → tracciaChatMinimizzata(compressa)
trackChatSelect(title) → tracciaChatSelezionata(titolo)
trackChatDelete() → tracciaChatEliminata()
trackChatRename(title) → tracciaChatRinominata(nuovo_titolo)
trackChatPin(pinned) → tracciaChatFissata(fissata)
trackChatMoveFolder() → tracciaChatSpostataCartella()
trackChatOpenPreview() → tracciaAnteprimaDaChat()
trackChatWelcomeDismissed() → tracciaChatBenvenutoChiuso()
trackModelSelect(model) → tracciaModelloSelezionato(modello)

// Editor / Pannelli / Tab
trackPanelOpen(panel) → tracciaPannelloAperto(pannello)
trackPanelClose(panel) → tracciaPannelloChiuso(pannello)
trackTabOpen(tab) → tracciaTabAperto(tab)
trackTabSwitch(type) → tracciaTabCambiato(tipo_tab)
trackTabClose(type) → tracciaTabChiuso(tipo_tab)
trackFileOpen(name) → tracciaFileAperto(nome_file)
trackFileCreate(name,type) → tracciaFileCreato(nome_file,tipo_file)
trackFileDelete(name) → tracciaFileEliminato(nome_file)
trackFileRename(old,new) → tracciaFileRinominato(vecchio,nuovo)
trackFileSearch(query,mode) → tracciaRicercaFile(query,modalita)
trackBrowseFiles() → tracciaEsploraFile()
trackGridButton() → tracciaLayoutGriglia()
trackInspectMode(enabled) → tracciaModalitaIspettore(attivo)
trackElementSelected(sel) → tracciaElementoSelezionato(selettore)
trackViewportChange(mode) → tracciaCambioViewport(modalita)

// Anteprima
trackPreviewStart(name) → tracciaAnteprimaAvviata(nome_progetto)
trackPreviewReady(name) → tracciaAnteprimaPronta(nome_progetto)
trackPreviewRefresh() → tracciaAnteprimaAggiornata()
trackPreviewStop() → tracciaAnteprimaFermata()
trackPreviewError(msg) → tracciaErroreAnteprima(messaggio_errore)
trackPreviewFixWithAI() → tracciaFixAIAnteprima()

// Pubblicazione
trackPublish(slug) → tracciaPubblicazioneAvviata(slug)
trackPublishSuccess(slug,url) → tracciaPubblicazioneRiuscita(slug,url)
trackPublishError(msg) → tracciaErrorePubblicazione(messaggio_errore)
trackPublishShare(slug) → tracciaLinkPubblicazioneCondiviso(slug)
trackPublishOpenUrl(slug) → tracciaUrlPubblicazioneAperto(slug)
trackUnpublish(slug) → tracciaDePubblicato(slug)

// Git
trackGitAction(action) → tracciaAzioneGit(azione)
trackGitCommit() → tracciaCommitCreato()
trackGitCheckout(branch) → tracciaCambioBranch(branch)
trackGitPush() → tracciaPushEffettuato()
trackGitAuth(provider) → tracciaAuthGit(provider)
trackGitAuthSuccess(provider) → tracciaAuthGitRiuscita(provider)
trackGitAuthError(provider,msg) → tracciaErroreAuthGit(provider,messaggio_errore)
trackGitAccountRemove(provider) → tracciaAccountGitRimosso(provider)
trackGitRepoConnect(url) → tracciaRepoConnesso(url_repo)
trackGitRepoImport(name) → tracciaRepoImportato(nome_repo)
trackGitImport() → tracciaImportGitAvviato()
trackGitImportCancel() → tracciaImportGitAnnullato()
trackGitImportConfirm(url) → tracciaImportGitConfermato(url_repo)
trackGitTabSwitch(tab) → tracciaTabGitCambiato(tab)
trackGitBranchCreate(branch) → tracciaBranchCreato(branch)
trackGitCommitView() → tracciaCronologiaCommit()
trackGitSelectAll() → tracciaSelezionaTuttoGit()
trackGitLinkAccount(provider) → tracciaAccountGitCollegato(provider)
trackGitUnlinkAccount(provider) → tracciaAccountGitScollegato(provider)
trackGitConnectRepo() → tracciaConnettiRepo()

// Impostazioni
trackSettingsModalOpen(modal) → tracciaImpostazioniAperte(modale)
trackSettingsModalClose(modal) → tracciaImpostazioniChiuse(modale)
trackLanguageChange(lang) → tracciaLinguaCambiata(lingua)
trackPasswordChange() → tracciaPasswordCambiata()
trackPasswordChangeError(msg) → tracciaErroreCambioPassword(messaggio_errore)
trackEmailChange() → tracciaEmailCambiata()
trackEmailChangeError(msg) → tracciaErroreCambioEmail(messaggio_errore)
trackNameChange() → tracciaNomeCambiato()
trackEnvVarAdd(key) → tracciaVarAmbienteAggiunta(chiave)
trackEnvVarDelete(key) → tracciaVarAmbienteRimossa(chiave)
trackNotificationToggle(type,enabled) → tracciaNotificheToggle(tipo,attivo)
trackRestorePurchases() → tracciaAcquistiRipristinati()
trackLegalView(type) → tracciaDocumentoLegaleVisto(tipo)

// Piani & Acquisti
trackPlanSelect(plan) → tracciaPianoVisualizzato(piano)
trackPurchaseStart(id) → tracciaAcquistoAvviato(prodotto)
trackPurchaseSuccess(id,plan) → tracciaAcquistoCompletato(prodotto,piano)
trackPurchaseError(id,type) → tracciaErroreAcquisto(prodotto,tipo_errore)
trackPlansView(source) → tracciaPaginaPianiVista(sorgente)
trackPlansClose() → tracciaPaginaPianiChiusa()
trackBillingCycleChange(cycle) → tracciaCicloFatturazioneCambiato(ciclo)

// Onboarding
trackOnboardingStepCompleted(step) → tracciaOnboardingStepCompletato(step)
trackOnboardingSkip(step) → tracciaOnboardingStepSaltato(step)
trackOnboardingExperienceSelected(level) → tracciaOnboardingEsperienzaScelta(livello)
trackOnboardingReferralSelected(source) → tracciaOnboardingScopertaScelta(fonte)
trackOnboardingCompleted() → tracciaOnboardingCompletato()
trackOnboardingPlanSelected(plan) → tracciaOnboardingPianoScelto(piano)
trackOnboardingBack(step) → tracciaOnboardingIndietro(da_step)
trackTutorialStepAdvance(idx,name) → tracciaTutorialStepAvanzato(indice,nome_step)
trackTutorialSkip(idx) → tracciaTutorialSaltato(indice)
```

- [ ] **Step 2: Riscrivere analyticsService.ts**

Riscrivere il file completo con:
- Stessa funzione interna `trackEvent(type, data?)`
- Tutte le funzioni rinominate con i type italiani
- Aggiungere le 9 NUOVE funzioni:
  - `tracciaOnboardingSceltaProgetto(scelta)` → type: 'onboarding_scelta_progetto'
  - `tracciaOnboardingIdeaChip(idea)` → type: 'onboarding_idea_chip'
  - `tracciaImmagineCaricata(sorgente)` → type: 'immagine_caricata'
  - `tracciaModalitaChatCambiata(modalita)` → type: 'modalita_chat_cambiata'
  - `tracciaPianoApprovatoAgente()` → type: 'piano_approvato_agente'
  - `tracciaTemaCambiato(tema)` → type: 'tema_cambiato'
  - `tracciaProgettoImportato(nome, url)` → type: 'progetto_importato'
  - `tracciaSidebarToggle(aperta)` → type: 'sidebar_toggle'
  - `tracciaCopiaCodicePremuto()` → type: 'copia_codice'
- Mantenere gli export ANCHE con i vecchi nomi come alias per compatibilita temporanea

- [ ] **Step 3: Verificare che compili**

Run: `cd /Users/leon/Desktop/drape-react && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (gli alias garantiscono compatibilita)

- [ ] **Step 4: Commit**

```bash
git add src/core/services/analyticsService.ts
git commit -m "feat: riscrittura analyticsService con nomi italiani e 9 nuovi eventi"
```

---

### Task 2: Aggiornare le schermate con nomi italiani

**Files:** (aggiornare `tracciaSchermata()` con nomi italiani)
- Modify: `src/features/auth/AuthScreen.tsx`
- Modify: `src/features/onboarding/OnboardingFlowScreen.tsx`
- Modify: `src/features/onboarding/FirstProjectChoiceScreen.tsx`
- Modify: `src/features/onboarding/OnboardingPlansScreen.tsx`
- Modify: `src/features/projects/CreateProjectScreen.tsx`
- Modify: `src/features/projects/ProjectsHomeScreen.tsx`
- Modify: `src/features/projects/AllProjectsScreen.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/shared/components/ChatWelcomeOverlay.tsx`
- Modify: `src/shared/components/SpotlightOverlay.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Aggiornare ogni file** — sostituire i vecchi nomi screen con quelli italiani:

```
'auth' → 'Login'
'onboardingFlow' → 'Onboarding'
'onboarding' → 'Onboarding'
'onboarding_welcome' → 'Benvenuto'
'onboarding_experience' → 'Esperienza'
'onboarding_referral' → 'Come ci hai trovato'
'firstProjectChoice' → 'Scelta Primo Progetto'
'create' → 'Crea Progetto'
'home' → 'Home'
'allProjects' → 'Tutti i Progetti'
'terminal' → 'Editor'
'settings' → 'Impostazioni'
'plans' → 'Piani'
```

- [ ] **Step 2: Aggiungere screen view MANCANTI** — in `App.tsx` o nei rispettivi componenti, aggiungere `tracciaSchermata()` dove manca (Home, Editor, Login, Impostazioni, Piani)

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: nomi schermate in italiano per tracking"
```

---

### Task 3: Aggiornare i 32 file che importano analytics

**Files:** Tutti i 32 file elencati sopra

Grazie agli alias di compatibilita nel Task 1, questo task puo essere fatto gradualmente. Per ogni file:
1. Sostituire i vecchi import con i nuovi nomi
2. Sostituire le chiamate nel corpo del file

- [ ] **Step 1: File auth** — `AuthScreen.tsx`
- [ ] **Step 2: File onboarding** — `OnboardingFlowScreen.tsx`, `FirstProjectChoiceScreen.tsx`, `OnboardingPlansScreen.tsx`
- [ ] **Step 3: File progetti** — `CreateProjectScreen.tsx`, `ProjectsHomeScreen.tsx`, `AllProjectsScreen.tsx`
- [ ] **Step 4: File terminale** — `VSCodeSidebar.tsx`, `ChatPanel.tsx`, `TabBar.tsx`, `FileExplorer.tsx`, `PreviewPanel.tsx`, `PreviewWebView.tsx`, `PreviewAIChat.tsx`, `PreviewPublishSheet.tsx`
- [ ] **Step 5: File git** — `GitSheet.tsx`, `GitHubView.tsx`, `ConnectRepoModal.tsx`, `ImportGitHubModal.tsx`, `GitAuthPopup.tsx`, `GitHubAuthModal.tsx`
- [ ] **Step 6: File impostazioni** — `SettingsScreen.tsx`, `ChangeEmailModal.tsx`, `ChangePasswordModal.tsx`, `EditNameModal.tsx`, `AddGitAccountModal.tsx`
- [ ] **Step 7: File hooks/servizi** — `usePreviewChat.ts`, `usePreviewPublish.ts`, `iapService.ts`, `EnvVarsView.tsx`
- [ ] **Step 8: File shared** — `ChatWelcomeOverlay.tsx`, `SpotlightOverlay.tsx`
- [ ] **Step 9: File chat** — `ChatPage.tsx`
- [ ] **Step 10: Verificare compilazione**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git commit -am "refactor: migrazione completa a nomi tracking italiani"
```

---

### Task 4: Aggiungere i 9 nuovi punti di tracking mancanti

**Files:**
- Modify: `src/pages/Chat/ChatPage.tsx` — messaggio chat, immagine, modalita, piani
- Modify: `src/features/onboarding/FirstProjectChoiceScreen.tsx` — scelta progetto
- Modify: `src/features/projects/CreateProjectScreen.tsx` — idea chip
- Modify: `src/features/settings/SettingsScreen.tsx` — tema
- Modify: `src/features/terminal/components/VSCodeSidebar.tsx` — sidebar toggle
- Modify: vari file con `navigateTo('plans')` — sorgente piani

- [ ] **Step 1: ChatPage.tsx — aggiungere tracking invio messaggio**

Trovare il bottone send (~riga 3562) e aggiungere:
```typescript
tracciaMessaggioChat(selectedModel, agentMode);
```

- [ ] **Step 2: ChatPage.tsx — aggiungere tracking upload immagine**

Dopo selezione immagine (~riga 3788-3822):
```typescript
tracciaImmagineCaricata('galleria'); // o 'fotocamera'
```

- [ ] **Step 3: ChatPage.tsx — aggiungere tracking cambio modalita**

Nei toggle fast/agent (~riga 3420,3431):
```typescript
tracciaModalitaChatCambiata(mode);
```

- [ ] **Step 4: ChatPage.tsx e altri — aggiungere sorgente a navigazione piani**

Prima di ogni `navigateTo('plans')`, aggiungere:
```typescript
tracciaPaginaPianiVista('chat'); // o 'preview', 'settings', 'limite', 'home'
```

Files: ChatPage.tsx (5 punti), PreviewPublishSheet.tsx, PreviewServerStatus.tsx, PreviewAIChat.tsx, SettingsPanel.tsx, Sidebar.tsx (2 punti)

- [ ] **Step 5: FirstProjectChoiceScreen.tsx — tracking scelta progetto**

```typescript
// Bottone "Crea nuovo" (~riga 113)
tracciaOnboardingSceltaProgetto('crea_nuovo');

// Bottone "Clona da GitHub" (~riga 160)
tracciaOnboardingSceltaProgetto('clona_github');
```

- [ ] **Step 6: CreateProjectScreen.tsx — tracking idea chip**

Quando un utente seleziona un template idea:
```typescript
tracciaOnboardingIdeaChip(chipId); // 'chat_ai', 'mood_tracker', ecc.
```

- [ ] **Step 7: SettingsScreen.tsx — tracking cambio tema**

In AppearanceSection, al cambio tema:
```typescript
tracciaTemaCambiato(theme); // 'chiaro', 'scuro', 'auto'
```

- [ ] **Step 8: VSCodeSidebar.tsx — tracking sidebar toggle**

```typescript
tracciaSidebarToggle(isOpen);
```

- [ ] **Step 9: Verificare compilazione e commit**

```bash
npx tsc --noEmit
git commit -am "feat: 9 nuovi punti di tracking mancanti"
```

---

### Task 5: Rimuovere gli alias di compatibilita

**Files:**
- Modify: `src/core/services/analyticsService.ts`

- [ ] **Step 1: Rimuovere tutti gli export alias** (i vecchi nomi inglesi)
- [ ] **Step 2: Verificare compilazione** — `npx tsc --noEmit` — deve passare senza errori
- [ ] **Step 3: Commit**

```bash
git commit -am "chore: rimossi alias inglesi da analyticsService"
```

---

### Task 6: Aggiornare la dashboard admin

**Files:**
- Modify: `admin-ui/src/pages/UsersPage.tsx` — aggiornare `EVENT_REGISTRY` con nuovi nomi italiani
- Modify: `admin-ui/src/pages/UsersPage.tsx` — rimuovere `translateScreen()` (non piu necessario)

- [ ] **Step 1: Aggiornare EVENT_REGISTRY** — aggiungere tutti i nuovi type italiani come chiavi, mantenere i vecchi inglesi per dati storici

- [ ] **Step 2: Rimuovere translateScreen()** — le schermate arrivano gia in italiano

- [ ] **Step 3: Build e deploy dashboard**

```bash
cd admin-ui && npx tsc -b && npx vite build
scp -i ~/.ssh/id_ed25519_drape -P 49222 -r dist/* root@77.42.1.116:/var/www/drape-dev.it/admin/new/
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: dashboard admin aggiornata per tracking italiano"
```

---

### Task 7: Test end-to-end

- [ ] **Step 1: Verificare build completa** — `cd drape-react && npx tsc --noEmit`
- [ ] **Step 2: Verificare che l'app si avvia** — test manuale su simulatore
- [ ] **Step 3: Verificare eventi in Firestore** — aprire l'app, fare login, navigare, creare progetto → verificare che gli eventi in `user_events` hanno i nuovi nomi italiani
- [ ] **Step 4: Verificare dashboard** — aprire dettaglio utente nella dashboard → la timeline deve mostrare etichette italiane leggibili
- [ ] **Step 5: Commit finale e push**

```bash
git push origin main
```

---

## Ordine di esecuzione

```
Task 1 (analyticsService) → Task 2 (schermate) → Task 3 (32 file) → Task 4 (9 nuovi) → Task 5 (rimuovi alias) → Task 6 (dashboard) → Task 7 (test)
```

I Task 1-5 sono tutti nel repo drape-react.
Il Task 6 e nel repo drape-dev.it.
Il Task 7 e trasversale.

## Stima

- **Task 1**: il piu critico, ~30 min (riscrittura analyticsService)
- **Task 2**: ~10 min (nomi schermate)
- **Task 3**: il piu lungo, ~45 min (32 file da aggiornare)
- **Task 4**: ~20 min (9 nuovi tracking)
- **Task 5**: ~5 min (pulizia alias)
- **Task 6**: ~15 min (dashboard)
- **Task 7**: ~10 min (test)
