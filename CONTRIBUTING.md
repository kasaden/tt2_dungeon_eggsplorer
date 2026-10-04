# Contributing

Thanks for helping. The most useful contribution by far is a **map fix**: a wrong tile, a missing
reward, an unknown tile somebody has since opened. Code changes are welcome too.

The site is plain HTML, CSS and JavaScript. There is no build step and no dependency to install.
You only need [Node.js](https://nodejs.org/) 18 or newer, and only for the local editor.

## Fixing a map

You can also [open an issue](../../issues/new/choose) with a screenshot and let somebody else paint it.

To fix it yourself:

1. Fork the repository and clone your fork.
2. Run `node server.js` and open <http://127.0.0.1:4173/edit.html>. Never open `edit.html` with a
   double click: without the server nothing is saved.
3. Paint the depth. The editor writes `depths.json` as you go.
4. Check that you only changed what you meant to: `git diff depths.json`.
5. Check the file is still well formed: `node scripts/check-depths.js`.
6. Open the viewer (<http://127.0.0.1:4173/>) and look at the depth once more.
7. Open a pull request. Say which depths you touched and what the game showed you
   (a screenshot is the best proof). If you are not sure about a tile, say so in the description.

Please keep one pull request to one topic, for instance "depth 12: fix the key row" rather than
a rewrite of ten depths at once. It makes the review possible.

### About the data

The maps come from a community spreadsheet, credited in the README, and from the people who keep
correcting them. By sending a map change you agree it can be published with the rest of the maps.
The code is MIT, the maps are not covered by that licence, see the README.

## Changing the code

- Keep it plain: no framework, no bundler, no npm dependency. A new file is fine, a new tool to
  install is not.
- Match the surrounding code: two spaces, double quotes, semicolons. `.editorconfig` covers the
  basics.
- `GRID_SIZE` is declared in `edit.js`, `index.js` and `server.js`. If you change it, change all three.
- Cells are read in one place, `tileParts` in `index.js`. Do not add a second parser, add a case
  there so the totals, the Overview and the reward table keep agreeing.
- Both pages share `style.css`. Look at the viewer **and** the editor after a CSS change, and at a
  narrow phone width.
- The CI runs `node scripts/check-depths.js` and a syntax check of the scripts on every pull request.

## Commit messages

Short, in the imperative, with a type in front:

```
feat: add an overview page with every item
fix: leave the start tile out of the count
docs: explain the Overview in the README
chore(data): update depths
```

`feat`, `fix`, `docs`, `style` (formatting only), `refactor`, `chore`. Map changes are `chore(data)`.

## Reporting a problem

Open an issue and say what you expected, what happened, and the browser. For a map problem, name
the depth and the tile (for example "Depth 12, D6").
