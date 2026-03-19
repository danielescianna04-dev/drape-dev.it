# Tracking Completo Stile PostHog — Design Spec

**Data**: 2026-03-18
**Obiettivo**: Tracciamento al 100% di ogni interazione utente nell'app Drape, con tutte le etichette in italiano leggibile.

## Principio guida

Ogni evento scritto in Firestore `user_events` deve avere un `type` e dati che permettano di capire **al volo** cosa sta facendo l'utente, senza bisogno di traduzione o mapping. I nomi delle schermate e delle azioni sono in italiano nella sorgente (`analyticsService.ts`).

---

## 1. Architettura

### Approccio: etichette italiane alla sorgente

- `analyticsService.ts` usa nomi italiani per `type` e `screen`
- I dati arrivano in Firestore gia leggibili
- La dashboard admin li mostra direttamente
- I vecchi dati inglesi (pochissimi, causa bug consent) restano ma non creano problemi

### Struttura evento in Firestore

```
{
  type: "messaggio_chat",           // italiano, leggibile
  userId: "abc123",
  platform: "ios",
  deviceType: "phone",
  timestamp: serverTimestamp(),
  // campi specifici per tipo di evento:
  modello: "claude-3.5-sonnet",
  progetto: "conta calorie"
}
```

---

## 2. Registro completo eventi

### 2.1 Autenticazione (6 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `login` | Accesso effettuato | `metodo`: apple/google/email |
| `registrazione` | Nuovo account creato | |
| `reset_password` | Richiesta reset password | |
| `logout` | Disconnessione | |
| `elimina_account` | Account eliminato | |
| `errore_app` | Errore applicazione | `messaggio`, `contesto` |

### 2.2 Navigazione schermate (1 tipo, molti valori)

| type | screen | Descrizione |
|------|--------|-------------|
| `schermata` | `Splash` | Caricamento iniziale |
| `schermata` | `Login` | Schermata di autenticazione |
| `schermata` | `Onboarding` | Flusso di onboarding |
| `schermata` | `Benvenuto` | Step benvenuto onboarding |
| `schermata` | `Consenso` | Step consenso GDPR |
| `schermata` | `Esperienza` | Step livello esperienza |
| `schermata` | `Come ci hai trovato` | Step fonte scoperta |
| `schermata` | `Scelta Primo Progetto` | Crea nuovo vs clona |
| `schermata` | `Crea Progetto` | Creazione progetto (3 step) |
| `schermata` | `Descrivi Idea` | Step descrizione progetto |
| `schermata` | `Scegli Modalita` | Step scelta Agent vs Chat |
| `schermata` | `Home` | Schermata principale progetti |
| `schermata` | `Tutti i Progetti` | Lista completa progetti |
| `schermata` | `Editor` | IDE/terminale principale |
| `schermata` | `Impostazioni` | Pagina impostazioni |
| `schermata` | `Piani` | Pagina piani/abbonamenti |
| `schermata` | `Profilo` | Sezione profilo |
| `schermata` | `Account Git` | Sezione account Git |
| `schermata` | `Abbonamento` | Sezione abbonamento |
| `schermata` | `Aspetto` | Sezione tema/aspetto |
| `schermata` | `Notifiche` | Sezione notifiche |
| `schermata` | `Info App` | Sezione info/versione |
| `schermata` | `Dispositivo` | Sezione info dispositivo |

### 2.3 App lifecycle (2 eventi)

| type | Descrizione |
|------|-------------|
| `app_primo_piano` | App tornata in primo piano |
| `app_background` | App mandata in background |

### 2.4 Onboarding (12 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `onboarding_step_completato` | Step completato | `step`: benvenuto/consenso/esperienza/scoperta |
| `onboarding_step_saltato` | Step saltato | `step` |
| `onboarding_esperienza_scelta` | Livello esperienza selezionato | `livello`: principiante/sviluppatore/studente/curioso |
| `onboarding_scoperta_scelta` | Fonte scoperta selezionata | `fonte`: tiktok/instagram/youtube/amico/ricerca/twitter/altro |
| `onboarding_completato` | Onboarding intero completato | |
| `onboarding_piano_scelto` | Piano scelto durante onboarding | `piano` |
| `onboarding_indietro` | Tornato indietro | `da_step` |
| `onboarding_scelta_progetto` | Scelta primo progetto | `scelta`: crea_nuovo/clona_github |
| `onboarding_idea_chip` | Selezionato template idea | `idea`: chat_ai/mood_tracker/social/landing/ecommerce/portfolio |
| `tutorial_step_avanzato` | Step tutorial avanzato | `indice`, `nome_step` |
| `tutorial_saltato` | Tutorial saltato | `indice` |
| `chat_benvenuto_chiuso` | Overlay benvenuto chat chiuso | |

### 2.5 Progetti (9 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `progetto_creato` | Progetto creato | `nome`, `linguaggio`, `modalita`, `descrizione` |
| `progetto_aperto` | Progetto aperto | `nome` |
| `progetto_eliminato` | Progetto eliminato | `nome` |
| `progetto_rinominato` | Progetto rinominato | `vecchio_nome`, `nuovo_nome` |
| `progetto_duplicato` | Progetto duplicato | `nome` |
| `progetto_condiviso` | Progetto condiviso | `nome` |
| `progetto_filtro` | Filtro progetti applicato | `filtro` |
| `progetto_elimina_multipli` | Eliminazione multipla | `quantita` |
| `progetto_importato` | Progetto importato da Git | `nome`, `url_repo` |

### 2.6 Editor / Pannelli / Tab (14 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `pannello_aperto` | Pannello aperto | `pannello`: file/chat/multitasking/anteprima/git/terminale |
| `pannello_chiuso` | Pannello chiuso | `pannello` |
| `tab_aperto` | Tab aperto | `tab` |
| `tab_cambiato` | Cambio tab | `tipo_tab` |
| `tab_chiuso` | Tab chiuso | `tipo_tab` |
| `file_aperto` | File aperto | `nome_file` |
| `file_creato` | File creato | `nome_file`, `tipo_file` |
| `file_eliminato` | File eliminato | `nome_file` |
| `file_rinominato` | File rinominato | `vecchio_nome`, `nuovo_nome` |
| `ricerca_file` | Ricerca file | `query`, `modalita` |
| `esplora_file` | Esplorazione file browser | |
| `modalita_ispettore` | Ispettore attivato/disattivato | `attivo` |
| `elemento_selezionato` | Elemento selezionato in preview | `selettore` |
| `cambio_viewport` | Cambio viewport responsive | `modalita` |
| `layout_griglia` | Toggle layout griglia | |

### 2.7 Chat & AI (14 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `messaggio_chat` | Messaggio AI inviato | `modello`, `modalita_agente` |
| `comando_terminale_chat` | Comando terminale via chat | |
| `nuova_chat` | Nuova conversazione creata | `tipo_chat` |
| `chat_minimizzata` | Chat minimizzata/espansa | `compressa` |
| `chat_selezionata` | Chat selezionata | `titolo` |
| `chat_eliminata` | Chat eliminata | |
| `chat_rinominata` | Chat rinominata | `nuovo_titolo` |
| `chat_fissata` | Chat fissata/rimossa | `fissata` |
| `chat_spostata_cartella` | Chat spostata in cartella | |
| `anteprima_da_chat` | Anteprima aperta da chat | |
| `modello_selezionato` | Modello AI selezionato | `modello` |
| `immagine_caricata` | Immagine caricata in chat | `sorgente`: galleria/fotocamera |
| `modalita_chat_cambiata` | Toggle modalita fast/agent | `modalita` |
| `piano_approvato_agente` | Piano agente approvato | |

### 2.8 Anteprima (6 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `anteprima_avviata` | Anteprima avviata | `nome_progetto` |
| `anteprima_pronta` | Anteprima pronta | `nome_progetto` |
| `anteprima_aggiornata` | Anteprima aggiornata | |
| `anteprima_fermata` | Anteprima fermata | |
| `errore_anteprima` | Errore anteprima | `messaggio_errore` |
| `fix_ai_anteprima` | Fix AI per errore anteprima | |

### 2.9 Pubblicazione (6 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `pubblicazione_avviata` | Pubblicazione avviata | `slug` |
| `pubblicazione_riuscita` | Pubblicazione riuscita | `slug`, `url` |
| `errore_pubblicazione` | Errore pubblicazione | `messaggio_errore` |
| `link_pubblicazione_condiviso` | Link condiviso | `slug` |
| `url_pubblicazione_aperto` | URL aperto | `slug` |
| `de_pubblicato` | Progetto de-pubblicato | `slug` |

### 2.10 Git (20 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `azione_git` | Azione Git generica | `azione` |
| `commit_creato` | Commit creato | |
| `cambio_branch` | Cambio branch | `branch` |
| `push_effettuato` | Push effettuato | |
| `auth_git` | Autenticazione Git avviata | `provider` |
| `auth_git_riuscita` | Auth Git riuscita | `provider` |
| `errore_auth_git` | Errore auth Git | `provider`, `messaggio_errore` |
| `account_git_rimosso` | Account Git rimosso | `provider` |
| `repo_connesso` | Repository connesso | `url_repo` |
| `repo_importato` | Repository importato | `nome_repo` |
| `import_git_avviato` | Import Git avviato | |
| `import_git_annullato` | Import Git annullato | |
| `import_git_confermato` | Import Git confermato | `url_repo` |
| `tab_git_cambiato` | Cambio tab Git | `tab` |
| `branch_creato` | Branch creato | `branch` |
| `cronologia_commit` | Cronologia commit visualizzata | |
| `seleziona_tutto_git` | Seleziona tutto per commit | |
| `account_git_collegato` | Account Git collegato | `provider` |
| `account_git_scollegato` | Account Git scollegato | `provider` |
| `connetti_repo` | Connessione repository | |

### 2.11 Impostazioni (13 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `impostazioni_aperte` | Modale impostazioni aperta | `modale` |
| `impostazioni_chiuse` | Modale impostazioni chiusa | `modale` |
| `lingua_cambiata` | Lingua cambiata | `lingua` |
| `password_cambiata` | Password cambiata | |
| `errore_cambio_password` | Errore cambio password | `messaggio_errore` |
| `email_cambiata` | Email cambiata | |
| `errore_cambio_email` | Errore cambio email | `messaggio_errore` |
| `nome_cambiato` | Nome profilo cambiato | |
| `var_ambiente_aggiunta` | Variabile ambiente aggiunta | `chiave` |
| `var_ambiente_rimossa` | Variabile ambiente rimossa | `chiave` |
| `notifiche_toggle` | Notifiche attivate/disattivate | `tipo_notifica`, `attivo` |
| `acquisti_ripristinati` | Acquisti ripristinati | |
| `tema_cambiato` | Tema cambiato | `tema`: chiaro/scuro/auto |

### 2.12 Piani & Acquisti (8 eventi)

| type | Descrizione | Campi extra |
|------|-------------|-------------|
| `piano_visualizzato` | Piano visualizzato | `piano` |
| `acquisto_avviato` | Acquisto avviato | `prodotto` |
| `acquisto_completato` | Acquisto completato | `prodotto`, `piano` |
| `errore_acquisto` | Errore acquisto | `prodotto`, `tipo_errore` |
| `pagina_piani_vista` | Pagina piani visualizzata | `sorgente`: home/chat/preview/settings/limite/onboarding |
| `pagina_piani_chiusa` | Pagina piani chiusa | |
| `ciclo_fatturazione_cambiato` | Ciclo fatturazione cambiato | `ciclo` |
| `documento_legale_visto` | Documento legale visualizzato | `tipo`: privacy/termini |

---

## 3. Gap da colmare (nuovi tracking)

Questi eventi NON esistono nel codice attuale e vanno aggiunti:

| Evento | File da modificare | Dove |
|--------|-------------------|------|
| `messaggio_chat` mancante sul bottone invio | `ChatPage.tsx:3562` | onPress del send button |
| `pagina_piani_vista` con sorgente (9 punti) | `ChatPage.tsx`, `PreviewPublishSheet.tsx`, `Sidebar.tsx`, ecc. | prima di ogni `navigateTo('plans')` |
| `onboarding_scelta_progetto` | `FirstProjectChoiceScreen.tsx:113,160` | onPress crea/clona |
| `immagine_caricata` | `ChatPage.tsx:3788-3822` | dopo selezione immagine |
| `modalita_chat_cambiata` | `ChatPage.tsx:3420,3431` | toggle fast/agent |
| `schermata` per Home, Editor, Auth, Settings, Plans | `App.tsx` + schermate | al mount di ogni screen |
| `onboarding_idea_chip` | `CreateProjectScreen.tsx` | selezione chip idea |
| `tema_cambiato` | `SettingsScreen.tsx` (AppearanceSection) | cambio tema |
| `progetto_importato` | `GitSheet.tsx` / `FirstProjectChoiceScreen.tsx` | import completato |

---

## 4. Aggiornamento dashboard admin

Il `EVENT_REGISTRY` in `UsersPage.tsx` va aggiornato per mappare i nuovi nomi italiani. Dato che i nomi sono gia leggibili, il registry serve principalmente per:
- Icone emoji
- Colori per categoria
- Funzione `detail()` per estrarre campi extra

Il `translateScreen()` nella dashboard puo essere rimosso — le schermate arrivano gia in italiano.

---

## 5. File da modificare

### In drape-react:
1. **`src/core/services/analyticsService.ts`** — Riscrittura completa: rinominare tutte le funzioni e i type in italiano
2. **`src/pages/Chat/ChatPage.tsx`** — Aggiungere tracking mancanti (invio messaggio, piani, immagini, modalita)
3. **`src/features/onboarding/FirstProjectChoiceScreen.tsx`** — Aggiungere tracking scelta progetto
4. **`src/features/onboarding/OnboardingFlowScreen.tsx`** — Aggiornare nomi step
5. **`src/features/projects/CreateProjectScreen.tsx`** — Aggiungere tracking idea chip
6. **`src/features/projects/ProjectsHomeScreen.tsx`** — Aggiornare screen view
7. **`src/features/projects/AllProjectsScreen.tsx`** — Aggiornare screen view
8. **`src/features/settings/SettingsScreen.tsx`** — Aggiungere tracking tema, screen view
9. **`src/features/terminal/components/*.tsx`** — Aggiornare tutti i nomi eventi
10. **`src/App.tsx`** — Aggiungere screen view per schermate principali
11. **Tutti i file che importano da analyticsService** — Aggiornare i nomi delle funzioni

### In drape-dev.it (dashboard admin):
1. **`admin-ui/src/pages/UsersPage.tsx`** — Aggiornare `EVENT_REGISTRY` con nuovi nomi italiani
2. **`admin/new/events.js`** — Aggiornare (se vanilla dashboard ancora usata)
3. **`server.js`** — Nessuna modifica necessaria (legge da Firestore direttamente)

---

## 6. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Mix dati vecchi (inglese) e nuovi (italiano) in Firestore | Pochissimi dati storici causa bug consent; accettabile |
| Errori di import dopo rinomina funzioni | Ricerca globale e sostituzione sistematica |
| File analyticsService.ts diventa troppo grande | Gia 476 righe, con rinomina restera simile |
| Indice Firestore per nuovi campi | I campi cambiano nome ma la struttura (userId + timestamp) resta identica |

---

## 7. Conteggio finale

**Totale tipi di evento: ~105**
- 6 autenticazione
- 23 schermate (tipo `schermata` con diversi valori `screen`)
- 2 app lifecycle
- 12 onboarding
- 9 progetti
- 15 editor/pannelli/tab
- 14 chat & AI
- 6 anteprima
- 6 pubblicazione
- 20 git
- 13 impostazioni
- 8 piani & acquisti

**Nuovi eventi da aggiungere: 9**
**Eventi da rinominare: tutti i 65+ esistenti**
**File da modificare: ~15-20**
