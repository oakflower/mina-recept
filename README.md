# Mina recept

Webbapp för att spara, hitta och återanvända egna recept. Sök på titel eller ingrediens, filtrera på taggar, slumpa fram ett recept och importera recept från fil. Första versionen är för en användare och har ingen inloggning.

## Krav

- [Node.js](https://nodejs.org/) 18 eller senare

## Starta

```bash
npm install
npm start
```

Öppna sedan http://localhost:3000 i webbläsaren.

För att använda en annan port, sätt miljövariabeln `PORT`:

```bash
PORT=8080 npm start
```

I PowerShell:

```powershell
$env:PORT = 8080; npm start
```

Recepten sparas i `data/recipes.json`, som skapas första gången du sparar ett recept. Filen ingår inte i git.

## Köra testerna

```bash
npm test
```

## Importera recept från fil

På startsidan kan du ladda upp en `.txt`- eller `.csv`-fil. Där finns även en mall att ladda ner (`public/mall.txt`). Receptet sparas direkt och kan redigeras efteråt.

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
- Tid anges i minuter. Kalorier anges som kcal per portion och kan användas för att filtrera listan.
- Från Excel: spara som **CSV UTF-8**, annars blir å, ä och ö fel.

## Kvalitetskontroll och deploy

Kör lint och tester lokalt:

```bash
npm run lint
npm test
```

GitHub Actions (`.github/workflows/ci.yml`) kör lint och tester vid push till `main` och vid pull requests mot `main`. Misslyckas något av dem stoppas körningen. Projektet har inget byggsteg. Vid en lyckad push till `main` deployas appen till [Fly.io](https://fly.io) (`fly.toml`, `Dockerfile`). Recepten ligger på en Fly Volume monterad på `/app/data`, så de finns kvar mellan deployer.

Engångsuppsättning av Fly:

```bash
fly auth login
fly launch --no-deploy
fly volumes create recipe_data --size 1
fly tokens create deploy
```

Lägg token från sista kommandot som GitHub Secret `FLY_API_TOKEN` (Settings, Secrets and variables, Actions). Håll appen på en maskin (`fly scale count 1`), eftersom en volym hör till en enda maskin.

## Teknik

- Node.js och Express, REST-API under `/api`
- Frontend i ren HTML, CSS och JavaScript utan byggsteg, serverad statiskt av Express
- Lagring i en JSON-fil bakom ett eget lagringslager (`lib/store.js`)
- Tester med Nodes inbyggda testkörare (`node --test`), lint med ESLint

Projektets riktlinjer finns i [CLAUDE.md](CLAUDE.md).
