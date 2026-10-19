# Analys av kodbasen

Fynd som potentiellt behöver åtgärdas. Inget är åtgärdat ännu. Alla 38 tester passerade vid analystillfället.

Referenser till rader gäller koden vid analystillfället.

## A. Buggar och risker

1. **Operatorprioritet i `lib/validate.js:19`.** `item && item.amount === undefined ? '' : String(item.amount)` ger serverfel 500 för `ingredients: [null]`, och `amount: null` sparas som texten "null". Båda verifierade.
2. **Import tappar data tyst (`lib/importer.js:29-35`).** `1;dl;mjöl;extra` blir ingrediensen "extra". Verifierat.
3. **Rubrikord tolkas som rubrik (`lib/importer.js:15-21`).** Ett steg som bara är ordet "Tid" sätter tillagningstid och bryter pågående lista. Verifierat.
4. **`store.update` ersätter hela posten** med `{ id, ...data }`. Fält som läggs till senare (bild, favorit) försvinner vid varje redigering om de inte går via `normalizeRecipe`. Blir ett problem först när de funktionerna byggs.
5. **Frontend saknar felhantering (`public/app.js`).** `refresh()` (rad 90) kollar inte `ok`, och `api()` antar alltid JSON. Sökningen saknar debounce och ordning, så gamla svar kan skriva över nya.
6. **Okänd `/api/...`-route** faller igenom till static och ger HTML-404 i stället för JSON.

## B. Avvikelser från CLAUDE.md

7. **Tillgänglighet.** `<label>` i `ingredientRow` och `stepRow` är inte kopplade till sina fält, så fälten saknar tillgängligt namn. "Ta bort ingrediens" upprepas utan index. Fokus hanteras inte när rader läggs till eller tas bort.
8. **Funktioner ska vara små.** `showList` är ca 78 rader, `showForm` 43 och `showRecipe` 40, och blandar tillstånd, DOM-bygge och händelser. Djupt nästlade `el()`-anrop (rad 101–103 och 264–278) är svårlästa.
9. **Validering på ett ställe.** `/api/import` har egen kontroll ("Filen är tom.") och importern egna fel, parallellt med `normalizeRecipe`. Är den enda route med logik.
10. **Scope.** Filimporten (`importer.js`, `/api/import`, `mall.txt`, README-avsnitt) finns varken under MVP eller Later. Beslut behövs: behålla och dokumentera i CLAUDE.md, eller ta bort.

## C. Duplicerad logik

- Skiftlägesokänslig taggjämförelse och dedupe på tre ställen: `store.matchesTag`, `store.listTags`, `validate.normalizeTags`.
- Filtret heter `{q, tag}` i frontend och `{search, tag}` i store, översatt i `filterFromQuery`.
- Backend: `'Receptet finns inte.'` tre gånger. Mönstret normalisera, svara 400, anropa store upprepas i POST, PUT och import.
- Frontend: "Receptet finns inte"-sidan i både `showRecipe` och `showForm`. `onRandomClick` i två vyer. `#/recept/${id}${queryString(filter)}` på fyra ställen. `errorBox` skapas på tre ställen.
- Taggar delas på komma i formuläret men på komma och semikolon i importen.
- Importformatet beskrivs tre gånger (importerns tabeller, `mall.txt`, README), vilket kan glida isär.
- `cleanPositiveNumber` använder `null`, `NaN` och tal som tre-lägessignal, vilket är svårläst.

## D. Namngivning och struktur

- Två filer heter `app.js` (`lib/` och `public/`), dessutom `server.js`.
- `public/app.js` (295 rader) innehåller helpers, tre vyer och routing. Hanterbart nu, men Later-funktionerna (bild, favorit, skalning) går mot samma fil.
- Ingen `.editorconfig`, formatterare eller linter. Beroenden får inte läggas till utan att fråga.
- CSS: en hårdkodad färg (`#fdecec`) utanför variablerna.

## E. Teknisk skuld på sikt

- **`amount` är fritext.** "Skala portioner" (Later) kräver numeriska mängder, så beslutet bör tas innan mycket data samlats. Filen har ingen schemaversion eller `createdAt`, så migrering blir manuell.
- **`store` läser och tolkar hela filen vid varje anrop** (även `get`), med synkron I/O. Okej för en användare. Innehållet valideras inte vid läsning: en handredigerad post utan `tags` kraschar `matchesTag`.
- **Testluckor:** `null`-ingrediens, korrupt fil, okänd route och flervärdesquery (`?q=a&q=b`). Temp-kataloger städas aldrig. `startServer` ligger i `api.test.js` medan övriga hjälpare ligger i `helpers.js`.
- **CLAUDE.md saknar** mappstruktur, att koden är engelsk men UI:t svenskt, felformatet `{ errors: [...] }`, API-kontrakt och beslut om importfunktionen.
