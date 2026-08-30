import { useEffect, useState } from 'react';
import { isSfxMuted, onSfxMute, toggleSfxMuted } from '../scene/sfx.js';

/**
 * The one place to turn the tank's audio off. The underwater bed runs for the
 * whole visit, so it needs a switch — bottom-right, opposite the contact text,
 * in the same corner-caption voice.
 *
 * `.ui-surface` is what keeps a click here from also knocking the glass (the
 * scene's window-level tap handlers skip anything inside that class).
 */
export default function SoundToggle() {
  const [muted, setMuted] = useState(isSfxMuted);

  // the mute state lives in the sfx module, not in React — mirror it
  useEffect(() => onSfxMute(setMuted), []);

  return (
    <button
      type="button"
      className={`sound-toggle ui-surface${muted ? ' is-off' : ''}`}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      onClick={() => toggleSfxMuted()}
    >
      <span className="sound-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="sound-word">{muted ? 'sound off' : 'sound on'}</span>
    </button>
  );
}
