const CHECKLIST = [
  'Turn Krisp off in Discord.',
  'Set Discord attenuation to 0%.',
  'Share the World View window and enable Include Audio.',
  'Play the test tone, then confirm players hear it.',
];

const KEYBOARD = [
  '1–9 play tracks in board order',
  'D duck / unduck ambience',
  'Escape stop audio',
];

export function DiscordSetupHelp(): JSX.Element {
  return (
    <div className="space-y-3 text-sm" style={{ color: 'var(--app-text-secondary)' }}>
      <p>Voice stays in Discord. World View is the single share target for plates and ambience.</p>
      <ul className="list-disc pl-4 space-y-1">
        {CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div>
        <p className="text-xs uppercase font-semibold mb-1">Keyboard</p>
        <ul className="list-disc pl-4 space-y-1">
          {KEYBOARD.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
