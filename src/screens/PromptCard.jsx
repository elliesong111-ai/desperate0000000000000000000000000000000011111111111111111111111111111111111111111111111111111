import { useMemo, useState } from 'react';
import { COMMITMENT_LEVELS, changeCommitment } from '../game/engine';

function getPhaseWhisper(phase, roomCondition) {
  if (phase === 'first_impression') {
    return roomCondition.pressure;
  }

  if (phase === 'suspicion') {
    if (roomCondition.id === 'notices_shifts') {
      return 'The room will remember where you begin to lean.';
    }
    if (roomCondition.id === 'punishes_certainty') {
      return 'A hard line can start turning back toward you.';
    }
    if (roomCondition.id === 'distrusts_hesitation') {
      return 'Holding back no longer feels invisible.';
    }
    return 'Do not expect the room to hold still for you.';
  }

  if (phase === 'reconsideration') {
    if (roomCondition.id === 'notices_shifts') {
      return 'If you turn now, the turn will stay visible.';
    }
    if (roomCondition.id === 'punishes_certainty') {
      return 'Pressing harder may steady you. It may also light you up.';
    }
    if (roomCondition.id === 'distrusts_hesitation') {
      return 'Easing back may read like a position of its own.';
    }
    return 'The room is already slipping apart. Any move lands differently.';
  }

  if (roomCondition.id === 'notices_shifts') {
    return 'End where you can still be carried after everything visible.';
  }
  if (roomCondition.id === 'punishes_certainty') {
    return 'End without letting certainty close too tightly around you.';
  }
  if (roomCondition.id === 'distrusts_hesitation') {
    return 'End somewhere the room cannot dismiss as softness.';
  }
  return 'End somewhere that can survive an unstable room.';
}

function getSuspicionPrompt(roomCondition) {
  if (roomCondition.id === 'notices_shifts') {
    return 'Choose the person you are least able to stay settled around.';
  }
  if (roomCondition.id === 'punishes_certainty') {
    return 'Choose the person you are willing to lean toward, even if that lean becomes visible.';
  }
  if (roomCondition.id === 'distrusts_hesitation') {
    return 'Choose the person you can no longer stay vague about.';
  }
  return 'Choose the person the room may never fully settle around.';
}

function getFinalPrompt(roomCondition) {
  if (roomCondition.id === 'notices_shifts') {
    return 'Leave the room with the read you can still carry after every visible turn.';
  }
  if (roomCondition.id === 'punishes_certainty') {
    return 'Leave the room with a read you can hold without hardening too visibly.';
  }
  if (roomCondition.id === 'distrusts_hesitation') {
    return 'Leave the room with a read the room cannot mistake for avoidance.';
  }
  return 'Leave the room with a read that can live inside ambiguity.';
}

function getSubmitLabel(phase) {
  if (phase === 'first_impression') {
    return 'Leave It There';
  }
  if (phase === 'suspicion') {
    return 'Let It Stand';
  }
  if (phase === 'reconsideration') {
    return 'Carry This Forward';
  }
  return 'End On This';
}

function getActionCards(roomCondition, canSoften, canIntensify) {
  if (roomCondition.id === 'notices_shifts') {
    return [
      { id: 'keep', title: 'Hold', note: 'Stay where you were. The stillness will show.' },
      { id: 'soften', title: 'Ease', note: 'Step back without leaving.', disabled: !canSoften },
      { id: 'intensify', title: 'Press', note: 'Make the line harder to ignore.', disabled: !canIntensify },
      { id: 'revise', title: 'Turn', note: 'Move somewhere else and let it show.' },
    ];
  }

  if (roomCondition.id === 'punishes_certainty') {
    return [
      { id: 'keep', title: 'Hold', note: 'Keep the line, knowing it may harden around you.' },
      { id: 'soften', title: 'Ease', note: 'Step back before certainty turns on you.', disabled: !canSoften },
      { id: 'intensify', title: 'Press', note: 'Lean harder and risk becoming visible.', disabled: !canIntensify },
      { id: 'revise', title: 'Turn', note: 'Move cleanly before the room fixes you in place.' },
    ];
  }

  if (roomCondition.id === 'distrusts_hesitation') {
    return [
      { id: 'keep', title: 'Hold', note: 'Stay with it. Even caution has weight now.' },
      { id: 'soften', title: 'Ease', note: 'Pull back and risk reading as avoidance.', disabled: !canSoften },
      { id: 'intensify', title: 'Press', note: 'Define the line before softness defines you.', disabled: !canIntensify },
      { id: 'revise', title: 'Turn', note: 'Move before hesitation gathers around you.' },
    ];
  }

  return [
    { id: 'keep', title: 'Hold', note: 'Stay with the line even if the room keeps drifting.' },
    { id: 'soften', title: 'Ease', note: 'Step back without expecting the room to meet you there.', disabled: !canSoften },
    { id: 'intensify', title: 'Press', note: 'Try to anchor a room that may not stay anchored.', disabled: !canIntensify },
    { id: 'revise', title: 'Turn', note: 'Move with the room before it moves without you.' },
  ];
}

export default function PromptCard({
  phase,
  phaseMeta,
  roomCondition,
  currentQuestion,
  currentPlayer,
  players,
  turnIndex,
  totalTurns,
  initialSuspicion,
  initialCommitment,
  onSubmit,
}) {
  const [step, setStep] = useState('pass');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(initialSuspicion ?? '');
  const [selectedCommitment, setSelectedCommitment] = useState(
    phase === 'suspicion' ? 'leaning' : initialCommitment ?? 'leaning',
  );
  const [selectedAction, setSelectedAction] = useState('keep');
  const [reason, setReason] = useState('');

  const availableTargets = useMemo(
    () => players.filter((player) => player.id !== currentPlayer.id),
    [players, currentPlayer.id],
  );

  const resolvedCommitment = phase === 'reconsideration' && selectedAction !== 'revise'
    ? (
      selectedAction === 'soften'
        ? changeCommitment(initialCommitment, 'down')
        : selectedAction === 'intensify'
          ? changeCommitment(initialCommitment, 'up')
          : initialCommitment
    )
    : selectedCommitment;

  const resolvedTarget = phase === 'reconsideration' && selectedAction !== 'revise'
    ? initialSuspicion
    : selectedTarget;

  const canSubmit = (
    reason.trim().length >= 3
    && (
      (phase === 'first_impression' && selectedAnswer)
      || ((phase === 'suspicion' || phase === 'final_decision') && resolvedTarget && resolvedCommitment)
      || (
        phase === 'reconsideration'
        && selectedAction
        && resolvedTarget
        && resolvedCommitment
        && (selectedAction !== 'revise' || resolvedTarget !== initialSuspicion)
      )
    )
  );

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    if (phase === 'first_impression') {
      onSubmit({ answer: selectedAnswer, reason: reason.trim() });
      return;
    }

    if (phase === 'suspicion') {
      onSubmit({ targetId: resolvedTarget, commitment: resolvedCommitment, reason: reason.trim() });
      return;
    }

    if (phase === 'reconsideration') {
      onSubmit({
        action: selectedAction,
        targetId: resolvedTarget,
        commitment: resolvedCommitment,
        reason: reason.trim(),
      });
      return;
    }

    onSubmit({ targetId: resolvedTarget, commitment: resolvedCommitment, reason: reason.trim() });
  };

  const renderTargetChoices = (excludedIds = []) => (
    <div className="choice-grid choice-grid--players">
      {availableTargets.filter((player) => !excludedIds.includes(player.id)).map((player) => (
        <button
          key={player.id}
          className={`choice-card ${resolvedTarget === player.id ? 'selected' : ''}`}
          onClick={() => setSelectedTarget(player.id)}
        >
          {player.name}
        </button>
      ))}
    </div>
  );

  const renderCommitmentChoices = (disabled = false) => (
    <div className="commitment-row">
      {COMMITMENT_LEVELS.map((level) => (
        <button
          key={level}
          className={`commitment-chip ${resolvedCommitment === level ? 'selected' : ''}`}
          onClick={() => !disabled && setSelectedCommitment(level)}
          disabled={disabled}
        >
          {level}
        </button>
      ))}
    </div>
  );

  const renderFirstImpression = () => (
    <>
      <div className="prompt-question-panel">
        <p className="prompt-text">{currentQuestion.prompt}</p>
      </div>
      <div className="choice-grid">
        {currentQuestion.options.map((option) => (
          <button
            key={option.id}
            className={`choice-card ${selectedAnswer === option.label ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(option.label)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="field-block">
        <label className="field-label">Leave a line</label>
        <textarea
          className="text-input text-input--area"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="A short reason is enough."
          maxLength={180}
        />
      </div>
    </>
  );

  const renderSuspicion = () => (
    <>
      <p className="prompt-text">{getSuspicionPrompt(roomCondition)}</p>
      {renderTargetChoices()}
      <div className="field-block">
        <label className="field-label">How far will you lean?</label>
        {renderCommitmentChoices()}
      </div>
      <div className="field-block">
        <label className="field-label">Leave a line</label>
        <textarea
          className="text-input text-input--area"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What made this person impossible to ignore?"
          maxLength={180}
        />
      </div>
    </>
  );

  const renderReconsideration = () => {
    const canSoften = initialCommitment !== 'uncertain';
    const canIntensify = initialCommitment !== 'convinced';
    const initialName = availableTargets.find((player) => player.id === initialSuspicion)?.name;
    const actionCards = getActionCards(roomCondition, canSoften, canIntensify);

    return (
      <>
        <div className="prompt-question-panel">
          <p className="prompt-text">{currentQuestion.prompt}</p>
        </div>
        <div className="status-panel status-panel--preview">
          <div className="status-label">You are currently holding</div>
          <div className="status-value">{initialName} · {initialCommitment}</div>
        </div>
        <div className="choice-grid">
          {actionCards.map((actionCard) => (
            <button
              key={actionCard.id}
              className={`choice-card choice-card--stacked ${selectedAction === actionCard.id ? 'selected' : ''}`}
              onClick={() => !actionCard.disabled && setSelectedAction(actionCard.id)}
              disabled={actionCard.disabled}
            >
              <span className="choice-card-title">{actionCard.title}</span>
              <span className="choice-card-note">{actionCard.note}</span>
            </button>
          ))}
        </div>
        {selectedAction === 'revise' ? (
          <>
            <div className="field-block">
              <label className="field-label">Turn toward</label>
              {renderTargetChoices([initialSuspicion])}
            </div>
            <div className="field-block">
              <label className="field-label">How far now?</label>
              {renderCommitmentChoices()}
            </div>
          </>
        ) : (
          <div className="status-panel status-panel--preview">
            <div className="status-label">If you leave it there</div>
            <div className="status-value">{initialName} · {resolvedCommitment}</div>
          </div>
        )}
        <div className="field-block">
          <label className="field-label">What will this look like from the outside?</label>
          <textarea
            className="text-input text-input--area"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What changed, or what became too costly to keep?"
            maxLength={180}
          />
        </div>
      </>
    );
  };

  const renderFinalDecision = () => (
    <>
      <p className="prompt-text">{getFinalPrompt(roomCondition)}</p>
      {renderTargetChoices()}
      <div className="field-block">
        <label className="field-label">How far will you stay with it?</label>
        {renderCommitmentChoices()}
      </div>
      <div className="field-block">
        <label className="field-label">Leave a final line</label>
        <textarea
          className="text-input text-input--area"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why can this position survive the room?"
          maxLength={180}
        />
      </div>
    </>
  );

  const renderForm = () => {
    if (phase === 'first_impression') {
      return renderFirstImpression();
    }
    if (phase === 'suspicion') {
      return renderSuspicion();
    }
    if (phase === 'reconsideration') {
      return renderReconsideration();
    }
    return renderFinalDecision();
  };

  if (step === 'pass') {
    return (
      <div
        className="screen screen--vote-pass"
        style={{ '--phase-color': phaseMeta.color, '--phase-text': phaseMeta.textColor }}
      >
        <div className="vote-pass-content">
          <div className="vote-eyebrow">{phaseMeta.label}</div>
          <h2 className="vote-pass-title">Hand it to</h2>
          <div className="vote-pass-name">{currentPlayer.name}</div>
          <p className="vote-pass-note">{getPhaseWhisper(phase, roomCondition)}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setStep('form')}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div
      className="screen screen--prompt"
      style={{ '--phase-color': phaseMeta.color, '--phase-text': phaseMeta.textColor }}
    >
      <div className="prompt-top">
        <div className="prompt-phase-dot" />
        <div className="prompt-meta">
          <span className="prompt-type">{phaseMeta.label}</span>
          <span className="prompt-progress">{turnIndex + 1} / {totalTurns}</span>
        </div>
      </div>

      <div className="status-panel status-panel--subtle">
        <p className="status-copy">{getPhaseWhisper(phase, roomCondition)}</p>
      </div>

      <div className="prompt-body">
        {renderForm()}
      </div>

      <div className="prompt-footer">
        <div className="prompt-players">
          {players.map((player) => (
            <div
              key={player.id}
              className={`prompt-player-chip ${player.id === currentPlayer.id ? 'active' : ''}`}
            >
              {player.name}
            </div>
          ))}
        </div>
        <button className="btn btn--primary" disabled={!canSubmit} onClick={submit}>
          {getSubmitLabel(phase)}
        </button>
      </div>
    </div>
  );
}
