import { PHASE_META } from '../game/engine';

function getQuestionLead(phase) {
  if (phase === 'first_impression') {
    return 'What opens the room';
  }
  if (phase === 'reconsideration') {
    return 'What tightens it';
  }
  if (phase === 'suspicion') {
    return 'Where the room begins to lean';
  }
  return 'What remains when the room narrows';
}

export default function PhaseCard({ phase, phaseNumber, totalPhases, roomCondition, currentQuestion, onBegin }) {
  const meta = PHASE_META[phase];

  return (
    <div
      className="screen screen--phase"
      style={{ '--phase-color': meta.color, '--phase-text': meta.textColor }}
    >
      <div className="phase-card-content">
        <div className="phase-number">
          {phaseNumber} / {totalPhases}
        </div>
        <div className="phase-label">{meta.label}</div>
        <div className="phase-mood">{meta.mood}</div>
        <p className="phase-subtitle">{meta.subtitle}</p>
        <div className="phase-instruction">{meta.instruction}</div>
        <div className="phase-room-condition">
          <div className="phase-room-label">Tonight</div>
          <div className="phase-room-name">{roomCondition.label}</div>
          <p className="phase-room-text">{roomCondition.pressure}</p>
        </div>
        {currentQuestion && (
          <div className="phase-question-preview">
            <div className="phase-question-label">{getQuestionLead(phase)}</div>
            <p className="phase-question-text">{currentQuestion.prompt}</p>
          </div>
        )}
      </div>
      <button className="btn btn--phase" onClick={onBegin}>
        Enter
      </button>
    </div>
  );
}
