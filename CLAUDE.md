# EDGEdir: notes for Claude sessions

EDGEdir is the EDGE platform's animation director for Cyberpunk 2077 (PC), built as a VS Code extension (`edgemodders.edgedir`) with its own activity bar icon. Its purpose, from the repo's description: a director tool for designing and stitching animations and acting sequences for NPCs. What it does, how, and its phases are for the design (`docs/design.md`, not written yet), agreed with the owner before any feature work.

It is one of the Edgemodders repos, checked out side by side in `E:\Modding\Cyberpunk 2077\`. REDnode's `CLAUDE.md` and `docs/dev-setup.md` (`../REDnode`) set the shared conventions. The scaffold was copied from EDGEhack's (`../EDGEhack`, its first commit after the initial one, with its current release workflow).

## Current status and next step

- **Asked for by the owner on 2026-11-16:** the repo with build and brand scaffolding, set up in the REDnode session and handed to another session. The owner said EDGEdir is a new VS Code extension with its own activity bar icon.
- **Scaffold built (2026-11-16), EDGEdir 0.0.1, not released:** the extension skeleton (an activity bar container with three empty views, Desk, Library and Animations, each with welcome text; the views are placeholders until the design names them), `src/views.ts` with 3 unit tests that check the views against package.json, the Check, Release, Docs site and Verify publish tokens workflows, the brand (`tools/brand/`: mark "EDr", since EDGEdeck already uses "ED", over a timeline of keyframes; activity icon a clapperboard in the HUD brackets), the Nexus page source (`nexus/`, no page yet) and the docs site. **Next: research and a design document with phases, for the owner's review.**
- **Open on GitHub, for the owner:** the repo's social preview (upload `docs/assets/brand/social.png` in Settings > General); Settings > Pages > Source: GitHub Actions; whether the organisation secrets `VSCE_PAT`, `OVSX_PAT` and `NEXUS_KEY` reach this repo; the Nexus page (none yet).

## What the platform already has for animations (2026-11-16)

Starting points for the design's research, each in its own repo; verify before relying on any:

| Where | What |
|---|---|
| REDnode 0.66.8 (`../REDnode`, docs/world.md "Animations on a spawned character (#39)") | `world.spawn({ record, workspot })` gives a spawned person a workspot (the game's `.workspot` poses and loops); `world.useWorkspot`, `world.stopWorkspot`, `world.workspotState`; MCP `world_spawn` with `workspot` and `world_animate`. A1's findings: a workspot plays only in an entity that carries it (the person is their own device); gameplay workspots loop and walk in; a quest's workspot plays once, briefly, after a T pose (made for a scene to drive); playing an animation that no workspot holds has no base-game call. A2's in-game test was under way on 2026-11-16 |
| REDbridge 0.13.0 (`../REDbridge`, issue #14) | `project.export` of a `.mesh` with its rig (`rig`, `rigs`), an entity in one appearance on one skeleton (`appearance`), and `.anims` with root motion (`rootMotion`) to glTF. #14 stays open for `.anims` import, `anims.info` and rig import (EDGEfab's rows) |
| EDGEquest (`../EDGEquest`) | Happenings around V, and its request #39 to REDnode (animations on a spawned character, its design's "Animations" section); quest scenes are where the game stitches animations itself |
| EDGEbuilder (`../EDGEbuilder`) | Scenes of NPCs and props loaded into the game with REDnode's `world.load`; the shared EDGE Library's rules (`docs/library.md`) |
| EDGEfab (`../EDGEfab`) | Animation work in its plan, through REDbridge #14 |

## Conventions

The same as REDnode's:

- **Commits:** commit straight to `main` and push, in small logical commits. Agree the plan in chat first. Use a PR only for large or risky changes, and ask before opening one. End commit messages with the attribution line the session's instructions give.
- **Git identity:** set per repo to `CyberbuildsAI` with the GitHub no-reply email (docs/dev-setup.md). The global identity on the dev PC is another one: never change it.
- **Versions:** one version, in `package.json`. Raise it with each hand test build, and refer to it as "EDGEdir <version>".
- **Release gate (the owner's rule):** no release (the Release workflow with Make a release, a Marketplace, Open VSX or Nexus upload) until every hand test of the changes since the last release has passed (docs/testing.md). Check this and say what is still open before a release run, even when asked to release.
- **Releases:** start a release run (`gh workflow run release.yml -f release=true`, with `-f nexus=true` for Nexus) only when the owner asks in chat. The workflow is described at the top of `.github/workflows/release.yml`.
- **README at each release (the owner's rule):** before a release run, update README.md's status line (`**Status: <version> released on <date>** ...`) and draw the status badge again (the `status` entry in `tools/brand/badges.py`, then `python -I tools/brand/badges.py docs/assets/brand/badges`; the README's `<img alt>` too). `tools/release/readme-check.mjs` checks it. Between releases, keep the status line and the badge current with the phase.
- **Changelog (the owner's rule, the same in every Edgemodders repo):** `CHANGELOG.md` at the root, a section per release, newest first, with **Unreleased** on top, grouped **New**, **Changed**, **Fixed**, **Other**; a line in the same commit as each change a player would notice. `docs/changelog.md` is made from it by the Docs site workflow: never commit it.
- **Shared files:** the Nexus tool lives in EDGErepo (`../EDGErepo/tools/nexus/nexus.mjs`); the Release workflow clones it at the tag `v1`, and `npm run nexus:pull` and `nexus:status` run it from the sibling checkout. `tools/release/readme-check.mjs` is REDnode's, copied as it is.
- **Nexus:** the page source is `nexus/` (`nexus/README.md`). Tags are set by hand. Never list the owner's own account (Cyberbuilds) in Nexus credits.
- **Writing style:** plain, short sentences. Tables for comparisons and lists of facts. Mark anything unverified as unverified. Never "exposes" for a port or endpoint; always say how access is locked in the same place.
- **Never commit game files** or data extracted from them: archives, animations, rigs, TweakDB dumps, record lists or name tables read from the game. A design may quote a few names as examples.
- **Requests to other repos** (REDnode for in-game playback, REDbridge for animation files, REDcode for projects) go to that repo as a `request` issue with the shape that would work, after the owner agrees. Requests from other repos come here the same way: read open `request` issues at the start of a session.

## Tests

- Automated: `npm run typecheck`, `npm run build`, `npm test` (also the Check workflow on every push).
- Hand tests: numbered steps the owner runs in VS Code (F5, **Run EDGEdir**), written in docs/testing.md with what each step should show. Record every test's first run and later runs' results there, and keep the roadmap table in docs/index.md current.
- In-game tests: a fixed order of numbered steps; REDnode's **Test timer** only when log timing matters. The game needs about 12 to 16 GB of RAM.

## Docs site

- `docs/` is published by GitHub Pages at https://edgemodders.github.io/EDGEdir/ through `.github/workflows/pages.yml` (Settings > Pages > Source: GitHub Actions). Jekyll renders it with the HUD layout (`docs/_layouts/default.html`, `docs/assets/css/hud.css`, copied from the other EDGE repos).
- Add every new page to `nav` in `docs/_config.yml`.
- The banner, social image, Nexus picture, icon and badges come from `tools/brand/` (`render.ps1`). Update the status badge in `badges.py` when the phase changes, then render again.
