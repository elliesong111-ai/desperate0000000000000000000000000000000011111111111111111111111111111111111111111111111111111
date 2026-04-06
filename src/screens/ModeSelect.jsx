export default function ModeSelect({ onSelect, onBack }) {
  return (
    <div className="screen screen--mode">
      <button className="btn-back" onClick={onBack}>← Back</button>
      <div className="screen-header">
        <h2 className="screen-title">Choose Your Session</h2>
        <p className="screen-subtitle">Both modes keep the same four phases. The pressure changes.</p>
      </div>

      <div className="mode-cards">
        <button className="mode-card" onClick={() => onSelect('quick')}>
          <div className="mode-card-time">~ 10 min</div>
          <div className="mode-card-name">Quick Pressure</div>
          <div className="mode-card-desc">
            One opening question, one pressure lens, and a clean room read at the end.
          </div>
          <div className="mode-card-arrow">→</div>
        </button>

        <button className="mode-card" onClick={() => onSelect('mini')}>
          <div className="mode-card-time">~ 18 min</div>
          <div className="mode-card-name">Full Pressure</div>
          <div className="mode-card-desc">
            The same structure, but with a denser question mix and a harsher pressure profile.
          </div>
          <div className="mode-card-arrow">→</div>
        </button>
      </div>

      <p className="mode-note">The screen only records judgment. The room does the rest.</p>
    </div>
  );
}
