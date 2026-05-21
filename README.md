# Warhammer Stratagems

A lightweight tabletop companion for browsing Warhammer 40,000 stratagems and tracking Command Points during a game.

Live app: [https://nohearts.github.io](https://nohearts.github.io)

## Features

- Browse stratagem cards loaded from the Wahapedia data export.
- Track Command Points with quick increment, decrement, spend, and refund controls.
- Search by stratagem name, effect, target, phase, faction, or detachment.
- Filter by CP cost, stratagem type, faction, detachment, and phase.
- Show only stratagems you can currently afford with your remaining CP.
- Faction cards use stable pastel tinting to make mixed results easier to scan.
- Detachment choices update based on the selected faction.
- Core stratagems stay visible for every faction and detachment, since they are universally usable.
- CP total and used-stratagem counts are saved locally in your browser.

## Data

The app uses a generated JSON file at `data/stratagems.json`, produced from Wahapedia's Warhammer 40,000 10th edition CSV export.

To refresh the local data:

```powershell
node tools/update-wahapedia-data.mjs
```

The generated data includes Wahapedia attribution in the app UI.

## Legal / Attribution

This is an unofficial fan-made tool and is not affiliated with, endorsed by, or sponsored by Games Workshop.

Warhammer 40,000, faction names, rules text, and related marks belong to Games Workshop. Stratagem data is generated from the Wahapedia public data export and is attributed in the app UI. If you are the rights holder and want data removed or changed, please contact the repository owner.

## Local Use

Because the app fetches local JSON/XML data, serve the folder with a small static server instead of opening `index.html` directly.

Example:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).
