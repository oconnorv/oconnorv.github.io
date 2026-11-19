# oconnorv.com

The home page is **BITSTREAM**, a digital preservation brick-breaker. Four pages are hidden in the
bricks: CV, CV of Failures, About Me and Contact. Catching one pauses the game and offers to open it
in a new tab. Plain HTML, CSS and JavaScript: no build step, no dependencies.

## Editing the pages

The content lives in `cv.html`, `failures.html`, `about.html` and `contact.html`. Edit the text
inside `<main class="panel">`; the `<!-- EDIT -->` comments mark the placeholders. The yellow
"Placeholder" notes can be deleted once real content is in.

On the Contact page, the email address is put together by a script (to slow down scrapers):
set `data-email-user` to the part before the @.

To rename a hidden file, change its label, or point it at a different page, edit `js/config.js`.

## Changing the game

| File | What's in it |
|---|---|
| `js/game/levels.js` | The 12 levels, drawn as text grids (legend at the top of the file) |
| `js/game/powerups.js` | Power-up names, effects and how often they drop |
| `js/game/constants.js` | Paddle size and speed, ball size, timings |
| `js/game/game.js` | The rules: physics, scoring, lives, hidden files |
| `js/game/render.js` | All the drawing |
| `js/game/audio.js` | Sound effects (synthesized, no audio files) |

## Running it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk won't work, because browsers
block JavaScript modules on `file://` pages.

Add `?debug=1` to the address for test keys: `1`–`9`, `0`, `-`, `=` jump to levels 1–12, `F` drops a
file, `U` drops a random power-up, `K` clears the level. `?debug=1&level=7` starts on level 7.

## Tests

```bash
node dev/sim.mjs
```

A bot plays every level with the real game code and checks that each can be cleared, that the ball
never gets stuck or passes through a brick, and that levels 1–3 hide all four files. It runs a
"skilled" and a "casual" player to show the difficulty curve. `node dev/sim.mjs 20 9` runs level 9
twenty times.

```bash
node dev/smoke.mjs --shots /tmp/shots
```

Browser checks with Playwright: no console errors, no scrolling at five screen sizes, controls,
pause, sound setting, the "this is annoying" button and the file dialog. `--shots` also saves
screenshots of every level.

## Publishing

Before committing a change, run:

```bash
node dev/stamp.mjs
```

It gives every script and stylesheet a version tag based on its contents. GitHub Pages lets browsers
reuse files for up to 10 minutes, so without the tags a visitor (or you, testing) can end up with the
new page and old game code. `node dev/smoke.mjs` fails if the tags are out of date.

GitHub Pages publishes the `main` branch automatically. Moving `oconnorv.com` from DreamHost is in
[DEPLOY.md](DEPLOY.md).

## Credits

Pixel font: [Silkscreen](https://github.com/googlefonts/silkscreen) by Jason Kottke, SIL Open Font
License (`fonts/SILKSCREEN-LICENSE.txt`). Everything else is original to this site.
