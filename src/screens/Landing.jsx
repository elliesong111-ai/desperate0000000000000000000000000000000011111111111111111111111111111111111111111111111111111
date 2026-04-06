export default function Landing({ onStart }) {
  return (
    <div className="screen screen--landing">
      <div className="landing-content">
        <div className="landing-eyebrow">a judgment game</div>
        <h1 className="landing-title">CENTER<br />HOLD</h1>
        <p className="landing-tagline">
          Take a stance.<br />
          Stay believable when the room shifts.
        </p>
      </div>
      <div className="landing-footer">
        <p className="landing-note">4 players · in-person · one device</p>
        <button className="btn btn--primary" onClick={onStart}>
          Enter The Room
        </button>
      </div>
    </div>
  );
}
