# tt2_dungeon_eggsplorer

Community maps for the Tap Titans 2 Dungeon Eggsplorer event: the path through each depth
and what it drops along the way.

**Site:** https://kasaden.github.io/tt2_dungeon_eggsplorer/

The maps are rebuilt from the [community spreadsheet](https://docs.google.com/spreadsheets/d/1hbrPgt0tHw-fJSjUZ6PY56TLY6uEIxX-lImWFQnKDos/edit?gid=1900671761#gid=1900671761). Two pages share one data file:
`index.html` is the public read-only viewer, `edit.html` is the editor and only runs locally.

## Reading a map

Each depth is a 9x9 grid, columns A to I, rows 1 to 9. A cell shows what you find there,
with the amount on the first line.

| Tile | Meaning |
| --- | --- |
| `↑` `↓` | Move to the next or previous depth |
| `🚩` Start | Where the event begins, on depth 1 only |
| `🔒` Silver / Gold / named Lock | Blocked, needs the matching key |
| `🔑` Silver / Gold / named Key | Opens the matching lock |
| `🔓` Lock-free | Tile with no lock on it |
| `❓` Unknown | Behind a lock nobody has opened yet, contents unknown |
| `⏳` Takes time | Time-gated by the game, there is no way through it yet and it opens later |
| Event Bundle | One event equipment plus Fire Stones and Diamonds, amounts vary |

The table beside the grid totals the rewards, either for the depth on screen or for the whole
dungeon. Locks and the markers above are left out of it: you spend keys on locks, you do not
collect them.

The count next to the depth name is how many tiles the depth holds. The `↑` does not count:
you land on it coming from the depth above, you never walk onto it.

Add `?depth=<id>` to the URL to link a single depth.

## Editing the maps

The editor writes `depths.json` on disk as you paint, so it needs the local server:

```bash
node server.js
```

Then open <http://127.0.0.1:4173/edit.html>. Pick an item in the palette, set a quantity if it
takes one, then click or drag on the grid. The right button erases, drag included, so you do not
have to reach for the Erase item to clear a few tiles. Saves happen on their own a moment after
each change; the pill at the top right goes red if one fails. Commit and push `depths.json` to
publish.

Two things to know:

- Do not open `edit.html` by double-clicking it. A `file://` page has no server behind it and
  nothing will be saved. Always go through `http://127.0.0.1:4173`.
- If `depths.json` changed outside the editor, a `git checkout` for instance, reload the page
  before painting. The open tab still holds the old state and would write it back over the file.

`server.js` listens on `127.0.0.1` only and exists for editing. Set `PORT` to use another port.

## The depths.json format

```json
{
  "version": 1,
  "gridSize": 9,
  "depths": [
    {
      "id": "depth-1787671687528-wz10nx",
      "name": "Depth 1",
      "cells": [{ "text": "5 🔥", "textColor": "#f0a22e", "bgColor": "#59627f" }]
    }
  ]
}
```

Every depth carries exactly 81 cells, read left to right and top to bottom. Cell text is cut at
32 characters when the file loads.

The viewer holds no item table: it reads everything back out of `text`. Four shapes matter.

| Text | Counted as |
| --- | --- |
| `5 🔥` | 5 Fire Stones, name taken from `ICON_NAMES` |
| `3\nSkill Points` | 3 Skill Points |
| `🔑\nSilver Key` | one `🔑 Silver Key` |
| `Event Bundle` | one Event Bundle |

A newline splits the two lines of a cell. Anything whose label ends with an entry of `NOT_LOOT`
never reaches the totals. Editing the file by hand is fine as long as those shapes hold.

## Adapting the project

| File | Role |
| --- | --- |
| `index.html` `index.js` | Public viewer |
| `edit.html` `edit.js` | Editor, local only |
| `server.js` | Static files plus `PUT /api/depths`, which writes `depths.json` |
| `style.css` | Shared by both pages |
| `depths.json` | The maps |
| `og-image.png` | Link preview image |

Three places to know:

- **The palette** is the `ITEMS` array at the top of `edit.js`. `name` shows in the palette,
  `short` is what lands on the cell, so a long name can still get a short label. An item without
  `quantity: false` gets a number field. `icon` puts an emoji next to that number, `other` makes
  a free text field, `special` a field whose value is placed before `suffix`.
- **The grid size** is `GRID_SIZE`, declared in `edit.js`, `index.js` **and** `server.js`.
  All three have to agree.
- **What is excluded from the totals** is `NOT_LOOT` in `index.js`, matched on the end of a
  label. `ICON_NAMES` next to it gives a name to cells that carry only an icon.

## Publishing

The site is plain static files. In the repository settings, Pages, serve from the `main` branch
at the root. Pushing `depths.json` updates the maps.

`index.html` holds two absolute URLs, `og:url` and `og:image`, used by Discord and the like to
build a link preview. Fix both if the address ever changes; a relative path will not do.

## License

The code is MIT, see `LICENSE`. The maps in `depths.json` are not covered by it: they come from
the community spreadsheet linked above and belong to the people credited below.

## Credits

Thanks to rawrzcookie and ミケ for the spreadsheet, and to Maxxximka and Leo for the data.

Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This project is not affiliated with
or endorsed by Game Hive.
