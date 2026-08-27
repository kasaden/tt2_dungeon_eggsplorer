# tt2_dungeon_eggsplorer

This repo provides the path to progress efficiently through the dungeon and collect the rewards.

## Viewer

`index.html` reads `depths.json` and shows the maps. It is plain static files, so any host works,
GitHub Pages included. Add `?depth=<id>` to link a specific depth.

## Editor

`edit.html` saves to `depths.json` directly, no export and nothing stored in the browser. It needs
the local server:

```bash
node server.js
```

Then go to http://127.0.0.1:4173/edit.html.
Edits are written after a short pause; the pill up top goes red if a save did not go through.

Push `depths.json` to update the public site.

`server.js` binds to 127.0.0.1 and is only there for editing, so keep it off any public host.
