# Interaction sound effects

Drop audio files here — the site probes for them lazily and stays silent if a
file is missing, so nothing breaks while this folder is empty.

Expected files (mp3 preferred, wav also works):

| file | played when | suggested character |
|---|---|---|
| `knock.mp3` | clicking/tapping empty water on the home section | short muffled underwater "thunk", ~150–300ms |
| `poke.mp3` | clicking/tapping the axolotl or octopus | soft squishy "boop", ~100–200ms |

Volume is applied in code (`src/scene/sfx.js`, default 0.5) with a little random
pitch jitter per play, so export at a comfortable normalized level.
