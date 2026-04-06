export default function Results({ gameState, onPlayAgain, onEnd }) {
  const { players, roomCondition, questionPlan, results } = gameState;

  return (
    <div className="screen screen--results">
      <div className="results-header">
        <h2 className="results-title">After The Room</h2>
        <p className="results-subtitle">Nothing was proven. Something still settled.</p>
      </div>

      <div className="results-section">
        <div className="results-section-label">Still In The Room</div>
        <div className="results-room-card">
          <div className="results-room-name">{roomCondition.label}</div>
          <p className="results-room-text">{roomCondition.subtitle}</p>
        </div>
      </div>

      <div className="results-section">
        <div className="results-section-label">What Stayed With It</div>
        <div className="results-prompt-pair">
          <div className="results-prompt-card">
            <div className="results-soft-label">At the start</div>
            <p className="results-room-text">{questionPlan.first_impression.prompt}</p>
          </div>
          <div className="results-prompt-card">
            <div className="results-soft-label">When it tightened</div>
            <p className="results-room-text">{questionPlan.reconsideration.prompt}</p>
          </div>
        </div>
      </div>

      <div className="results-section">
        <div className="results-section-label">How It Held</div>
        {results.roomLines.map((line) => (
          <div key={line} className="results-read-line">
            {line}
          </div>
        ))}
      </div>

      <div className="results-section">
        <div className="results-section-label">Where People Landed</div>
        {players.map((player) => {
          const read = results.playerResults.find((entry) => entry.playerId === player.id);

          return (
            <div key={player.id} className="results-player-card">
              <div className="results-player-row">
                <span className="results-player-name">{player.name}</span>
              </div>
              <p className="results-player-summary">{read.summary}</p>
              <p className="results-player-note">{read.trajectory}</p>
              <p className="results-player-note">{read.openingEcho}</p>
            </div>
          );
        })}
      </div>

      <div className="results-footer">
        <button className="btn btn--ghost" onClick={onPlayAgain}>Play Again</button>
        <button className="btn btn--text" onClick={onEnd}>End Session</button>
      </div>
    </div>
  );
}
