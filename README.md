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

## Teknik

- Node.js och Express, REST-API under `/api`
- Frontend i ren HTML, CSS och JavaScript utan byggsteg, serverad statiskt av Express
- Lagring i en JSON-fil bakom ett eget lagringslager (`lib/store.js`)
- Tester med Nodes inbyggda testkörare (`node --test`)

Projektets riktlinjer finns i [CLAUDE.md](CLAUDE.md).
