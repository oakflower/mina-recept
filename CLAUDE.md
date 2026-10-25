# Mina recept

## What the project does
A web application for saving, finding and reusing your own recipes. The problem it solves: recipes end up scattered (bookmarks, screenshots, paper) and are hard to find when you are standing in the kitchen.

The first version is for a single user, with no login. Users and sharing may come later.

### Scope
- **MVP:** create, view, edit and delete recipes (title, description, ingredients with amount/unit/name, steps, servings, cooking time), free-text search on title and ingredients, tags/categories, and a "random recipe" function that picks a recipe at random from the saved ones (optionally within the current tag/search filter).
- **Also built:** scaling of ingredient amounts by servings on the recipe page (`public/scale.js`; non-numeric amounts are left unchanged).
- **Also built:** import of a recipe from an uploaded `.txt`/`.csv`/`.docx` file (Word text is extracted with `mammoth`) (`lib/importer.js`, `POST /api/import`, template in `public/mall.txt`). The file format is described by the template and the README.
- **Later:** image, favorites, import from URL.
- **Far future:** login, sharing, shopping list, weekly menu.

## Tech stack
Proposed stack (the user has no technology preference):

- **Backend:** Node.js + Express, REST API under `/api`.
- **Frontend:** plain HTML, CSS and JavaScript with no build step, served statically by Express.
- **Storage:** JSON file (`data/recipes.json`) behind a dedicated storage layer (`store.js`).

Why:
- Few moving parts and no build chain make the project easy to understand and change.
- `better-sqlite3` could not be installed in the development environment (Node 18 on Windows, no C++ toolchain), hence file-based storage.
- The storage layer is isolated so a real database can be swapped in later without touching the API.

## Project structure
- `server.js` – starts the server with the real storage file.
- `lib/app.js` – the Express app (routes). Takes a store as argument so tests can inject one.
- `lib/store.js` – the storage layer.
- `lib/validate.js` – validation and normalization of recipe input.
- `lib/importer.js` – turns the text of an uploaded file into recipe input.
- `public/` – the frontend (`index.html`, `app.js`, `scale.js`, `style.css`) and the import template `mall.txt`. Note that `public/app.js` is the frontend; the backend app is `lib/app.js`.
- `test/` – tests, with shared helpers in `test/helpers.js`.

## Conventions
- Code, identifiers and comments are in English. Everything the user sees (UI text and API error messages) is in Swedish.
- Error responses from the API have the shape `{ "errors": ["Swedish message", ...] }`.

## Simplicity
- Prefer the simplest solution that meets the current requirement. If two approaches work, choose the one with fewer parts.
- Do not build for hypothetical future requirements. Features listed under "Later" and "Far future" are not a reason to add abstractions, configuration options or extension points now; build them when they are actually requested.
- Readable code beats clever code. Choose clear names and straightforward control flow over terseness, tricks or compact one-liners.
- Do not add layers, patterns or helpers that only have a single caller, unless they make the code clearly easier to read.

## Architecture principles
- All reading/writing of data happens in the storage layer (`store.js`). Routes and frontend never touch the file directly.
- Validation and normalization of input happens in one place on the server, before data reaches storage.
- File import only parses text into recipe input. The result always goes through `normalizeRecipe` before it is saved, the same as input from the API. Keep the heading names in `lib/importer.js`, `public/mall.txt` and the README in sync.
- No mutable global variables; pass data as arguments.
- Functions do one thing and are small.
- Write the storage file atomically (write a temp file, then rename) so data is not corrupted.
- The UI must work well on mobile (used in the kitchen) and be in Swedish.
- Accessibility: sufficient contrast and full keyboard navigation.

## Testing strategy
- Use Node's built-in test runner (`node --test`); do not add a test framework.
- **Storage layer:** unit-test create, read, update, delete, search, tags and random selection against a temporary file. The storage file path must be injectable so tests never touch `data/recipes.json`.
- **API:** test each endpoint, including validation errors and 404s, by starting the server on a random port and calling it with the built-in `fetch`.
- **Frontend:** no automated tests in the first version; verify manually in the browser, including on a mobile-sized viewport.
- Every new feature or bug fix comes with a test at the lowest layer where it can be expressed.
- Tests must be independent and deterministic: no shared state between tests, and random behavior is tested with an injectable random source.
- All tests must pass before work is reported as done.

## Working with the user
- When a requirement is unclear or ambiguous, ask instead of assuming or interpreting it. This applies to behavior, scope, naming of user-facing text and technical choices alike.
- Keep questions short and concrete; where possible, offer two or three options with a recommendation.
- State clearly what was and was not done, and report failing tests as failing.

## Things the agent must NOT do
- Write, scaffold or install anything (code, config files, dependencies) until the user has explicitly asked for implementation. Discussing, planning, proposing and editing documentation such as this file is fine. A request for a spec, plan or example is not a request to implement it. If in doubt, ask. If the user interrupts and says to stop, stop immediately and do not continue with "just the small remaining part".
- Change the storage method or database without asking.
- Add external dependencies (npm packages) without asking first. Keep dependencies few.
- Introduce frameworks or build steps (React, bundlers, TypeScript, etc.) without asking.
- Build login, user management or sharing in the first version.
- Commit or push unless the user asks for it.
- Delete files or data without looking at what is being removed and confirming.
