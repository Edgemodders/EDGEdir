# EDGEdir on Nexus Mods

The source of EDGEdir's Nexus Mods page lives here, so updates are edits in the repo, not in Nexus's text box. It follows EDGEdeck's and EDGEwave's (their `nexus/` folders).

| File | What it is |
|---|---|
| `description.bbcode` | The page's description, in Nexus's BBCode. Placeholders in parentheses (STATUS, SCREENSHOT, FEATURES) are filled in before the first release |
| `nexus.json` | The page, the main file's upload settings (`upload`), and after a pull the ids found and the hash of the description last pulled |
| `README.md` | This page: the other fields of the Nexus form, the download file, and how to update |

## The page

There is no page yet. The owner makes it on Nexus when the first release nears, then puts its number in `nexus.json` as `"page"` and runs `npm run nexus:pull -- --ids-only`, so the first release pushes this draft over Nexus's template.

From the first release on, the Release workflow's **Update Nexus Mods** box uploads each release: the zip as the main file (the first one on a new page, then a new version with the old one archived), the version's changelog, and `description.bbcode`. It stops first if the description was edited on Nexus since the last pull: then `npm run nexus:pull`, merge with `git diff nexus/`, commit, and run it again.

## The Nexus form

| Field | Value |
|---|---|
| Mod name | EDGEdir |
| Version | EDGEdir's version, from `package.json`; the release sets it |
| Category | Utilities, or Modders Resources and Tutorials as the other EDGE tools (check the list for Cyberpunk 2077 when creating the page) |
| Brief overview | An animation director for Cyberpunk 2077 in VS Code: design and stitch animations and acting sequences for the game's characters, and play them in the running game. A VS Code extension, not a game mod. (255 characters at most; settle it from the design) |
| Author | Edgemodders |
| Language | English |
| Primary image | `docs/assets/brand/nexus.png` (the social layout with room for the EDGEmodders header the owner adds by hand), or `social.png` |
| Requirements | Off-site: VS Code 1.90 or later (or VSCodium, or EDGEkit). On Nexus: whatever the design needs (REDnode for playing in the game, likely) |
| Permissions | MIT: open source, free to modify and redistribute with the license notice |
| Tags | Utility, tools, animation |

Tags cannot be set through Nexus's v3 API (only read): set them by hand on the page.

## The download

One main file: `EDGEdir-<version>-nexus.zip` (`tools/nexus-zip.mjs`), with:

| File | What it is |
|---|---|
| `edgedir-<version>.vsix` | The extension, the same file the Marketplace and Open VSX have |
| `README.txt` | How to install it: Install from VSIX in VS Code, or `code --install-extension` |
| `LICENSE.txt` | EDGEdir's license |

**Mod Manager Download is off** for this file (`"modManager": false`): it is a VS Code extension, and Vortex would deploy it into the game folder, where it does nothing.

## Commands

| Command | Does |
|---|---|
| `npm run nexus:status` | The page's version, its files and whether the description matches |
| `npm run nexus:pull` | The live description into `description.bbcode`, the ids into `nexus.json`. Then `git diff nexus/` and merge. With `-- --ids-only`, the ids and the live description's hash, keeping the repo's description |
| `node ../EDGErepo/tools/nexus/nexus.mjs check --version <v>` | What a release would do, and whether it may |
| `node tools/check-bbcode.mjs nexus/description.bbcode` | Checks the BBCode's tags before a push |

The Nexus tool lives in EDGErepo (`../EDGErepo/tools/nexus/`), shared by every Edgemodders repo: change it there. The Release workflow clones it at the tag `v1`.

## BBCode used

Nexus's BBCode has no tables or Markdown, so the page uses only: `[b]`, `[i]`, `[size=2..5]`, `[color=#hex]`, `[center]`, `[quote]`, `[line]`, `[list]` with `[*]`, `[url=...]` and `[img]`. Square brackets that are not tags confuse the checker, so placeholders use parentheses. The banner is linked from this repo's `main` branch on GitHub, so it must stay at its path. The colours are the house palette: yellow `#fcee0a` for headings, cyan `#19f3ff` for highlights.
