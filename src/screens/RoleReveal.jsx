import { useState } from 'react';

export default function RoleReveal({ players, objectives, onComplete }) {
  const [step, setStep] = useState(0);

  const totalSteps = players.length * 2;
  const isPassScreen = step % 2 === 0;
  const playerIndex = Math.floor(step / 2);
  const player = players[playerIndex];

  const handleNext = () => {
    if (step + 1 >= totalSteps) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  if (isPassScreen) {
    return (
      <div className="screen screen--role-pass">
        <div className="role-pass-content">
          <div className="role-pass-label">Private Pull</div>
          <h2 className="role-pass-title">Hand the phone to</h2>
          <div className="role-pass-name">{player.name}</div>
          <p className="role-pass-note">No one else needs this yet.</p>
        </div>
        <button className="btn btn--primary" onClick={handleNext}>
          Ready
        </button>
      </div>
    );
  }

  const objective = objectives[player.id];

  return (
    <div className="screen screen--role-reveal">
      <div className="role-reveal-content">
        <div className="role-badge">PRIVATE PULL</div>
        <div className="role-goal-label">{objective.name}</div>
        <p className="role-description">{objective.description}</p>
        <div className="role-divider" />
        <p className="role-goal">{objective.goal}</p>
        <div className="role-hint-label">Keep This Quietly</div>
        <p className="role-hint">{objective.hint}</p>
      </div>
      <button className="btn btn--ghost" onClick={handleNext}>
        Keep It →
      </button>
    </div>
  );
}
