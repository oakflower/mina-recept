# Mina recept

Webbapp för att spara, hitta och återanvända egna recept, så att de inte ligger utspridda i bokmärken, skärmdumpar och på papper.

Live: https://mina-recept.fly.dev

## Vad det gör

Du kan skapa, visa, redigera och ta bort recept med ingredienser, steg, portioner, tid och kalorier per portion. Recepten går att söka på titel eller ingrediens, filtrera på taggar och kalorier, och du kan slumpa fram ett recept. På receptsidan kan du räkna om ingrediensmängderna efter antal portioner, och du kan importera recept från en `.txt`-, `.csv`- eller `.docx`-fil.

## Kom igång

### Krav

- [Node.js](https://nodejs.org/) 18 eller senare
- Inga externa tjänster eller API-nycklar behövs

### Installation

```bash
git clone https://github.com/oakflower/mina-recept
cd mina-recept
npm install
```

### Konfiguration

Ingen `.env`-fil behövs (och därmed ingen `.env.example`). Den enda inställningen är miljövariabeln `PORT`, som är valfri och har värdet 3000 som standard:

```bash
PORT=8080 npm start
```

I PowerShell:

```powershell
$env:PORT = 8080; npm start
```

Recepten sparas i `data/recipes.json`, som skapas första gången du sparar ett recept. Filen ingår inte i git.

### Kör projektet

```bash
npm start
```

Öppna sedan http://localhost:3000 i webbläsaren.

Kör tester och lint:

```bash
npm test
npm run lint
```

## Importera recept från fil

På startsidan kan du ladda upp en `.txt`-, `.csv`- eller `.docx`-fil. Där finns även en mall att ladda ner (`public/mall.txt`). Receptet sparas direkt och kan redigeras efteråt.

```
Titel: Pannkakor
Beskrivning: Klassiska tunna pannkakor.
Portioner: 4
Tid: 30
Kalorier: 350
Taggar: Frukost, Barnvänligt
Ingredienser:
3;dl;vetemjöl
smör till stekning
Steg:
1. Vispa ihop smeten.
2. Stek i smör.
```

- Ingredienser skrivs `mängd;enhet;namn`. En rad med bara ett namn går också bra.
- Tid anges i minuter. Kalorier anges som kcal per portion.
- Från Excel: spara som **CSV UTF-8**, annars blir å, ä och ö fel.
- Från Word: bara texten läses in, med samma rubriker som i mallen.

## Arkitektur

Backend är en Express-app med ett REST-API under `/api` (`lib/app.js`). Indata valideras och normaliseras på ett ställe (`lib/validate.js`) innan den når lagringslagret (`lib/store.js`), som är den enda koden som läser och skriver datafilen. Filimport (`lib/importer.js`) gör bara om texten till receptdata som sedan går samma väg genom valideringen som API-anrop. Frontend är statiska filer i `public/` som Express serverar utan byggsteg.

```
mina-recept/
├── server.js          # Startar servern med den riktiga lagringsfilen
├── lib/
│   ├── app.js         # Express-appen och routes (tar emot en store, så tester kan injicera en egen)
│   ├── store.js       # Lagringslagret (JSON-fil, skrivs atomiskt)
│   ├── validate.js    # Validering och normalisering av receptdata
│   └── importer.js    # Gör om en uppladdad fil till receptdata
├── public/            # Frontend: index.html, app.js, scale.js, style.css och importmallen mall.txt
├── test/              # Tester med Nodes inbyggda testkörare
├── data/              # recipes.json skapas här (ingår inte i git)
├── Dockerfile         # Bygger avbilden för Fly.io
├── fly.toml           # Fly.io-konfiguration
└── .github/workflows/ # CI/CD med GitHub Actions
```

## Teknisk stack

| Komponent | Val | Anledning |
|---|---|---|
| Backend | Node.js och Express | Få delar och lätt att förstå och ändra |
| Frontend | Ren HTML, CSS och JavaScript | Inget byggsteg; fungerar bra på mobil i köket |
| Lagring | JSON-fil bakom `lib/store.js` | `better-sqlite3` gick inte att installera i utvecklingsmiljön; lagringslagret kan bytas ut mot en databas senare |
| Wordimport | `mammoth` | Läser ut text ur `.docx` |
| Tester | `node --test` | Inget testramverk behövs |
| Lint | ESLint | Fångar fel innan de når `main` |
| CI/CD | GitHub Actions | Kör lint och tester och deployar vid push till `main` |
| Hosting | Fly.io med en volym | Receptfilen ligger kvar mellan deployer |

## Kvalitetskontroll och deploy

GitHub Actions (`.github/workflows/ci.yml`) kör lint och tester vid push till `main` och vid pull requests mot `main`. Misslyckas något av dem stoppas körningen. Projektet har inget byggsteg. Vid en lyckad push till `main` deployas appen till [Fly.io](https://fly.io). Recepten ligger på en Fly Volume monterad på `/app/data`.

Engångsuppsättning av Fly:

```bash
fly auth login
fly launch --no-deploy
fly volumes create recipe_data --size 1
fly tokens create deploy
```

Lägg token från sista kommandot som GitHub Secret `FLY_API_TOKEN` (Settings, Secrets and variables, Actions). Håll appen på en maskin (`fly scale count 1`), eftersom en volym hör till en enda maskin.

## Begränsningar

- Ingen inloggning: appen är gjord för en användare, och den som har länken kan läsa, ändra och ta bort alla recept, även i den deployade versionen.
- Lagringen är en JSON-fil. Det fungerar för några hundra recept men skalar inte till mycket mer, och eftersom volymen hör till en maskin går appen inte att skala ut. Det finns ingen automatisk backup av `data/recipes.json`.
- Inga bilder, favoriter eller import från länk.
- Wordimporten läser bara ut text. Tabeller, bilder och formatering ignoreras, och texten måste följa mallens rubriker.
- Mängder skalas bara om de är tal; andra mängder (till exempel "en nypa") lämnas oförändrade.
- Frontend har inga automatiska tester, bara manuell kontroll i webbläsaren. API och lagring har tester.
- Den deployade maskinen stoppas när ingen använder appen, så första laddningen kan ta några sekunder.

## Utvecklat med

Claude Code (agentdriven utveckling) som del av kursen Next-Generation Software Development with AI. Projektets riktlinjer för agenten finns i [CLAUDE.md](CLAUDE.md).
