"use client";

import ModalOverlay from "./ModalOverlay";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Moving around",
    items: [
      ["J  ↓", "Next alert in the feed"],
      ["K  ↑", "Previous alert"],
      ["Enter", "Open the highlighted alert"],
      ["Esc", "Close whatever is open"],
    ],
  },
  {
    title: "Doing things",
    items: [
      ["N", "Report an alert at the centre of the map"],
      ["/", "Search the feed"],
      ["C", "Clear all filters"],
      ["?", "Show this list"],
    ],
  },
];

export default function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay label="Keyboard shortcuts" onClose={onClose}>
      <div className="panel">
        <div className="panel__header">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {GROUPS.map((group) => (
          <div key={group.title} className="shortcuts__group">
            <h3 className="shortcuts__title">{group.title}</h3>
            <dl className="shortcuts">
              {group.items.map(([keys, description]) => (
                <div className="shortcuts__row" key={keys}>
                  <dt>
                    {keys.split("  ").map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </ModalOverlay>
  );
}
