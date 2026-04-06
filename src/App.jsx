import { useCallback, useState } from 'react';
import {
  PHASES,
  PHASE_META,
  computeRoomState,
  evaluateObjectives,
  initializeGame,
  startPhase,
  submitFinalDecision,
  submitFirstImpression,
  submitReconsideration,
  submitSuspicion,
} from './game/engine';
import Landing from './screens/Landing';
import ModeSelect from './screens/ModeSelect';
import PlayerSetup from './screens/PlayerSetup';
import RoleReveal from './screens/RoleReveal';
import PhaseCard from './screens/PhaseCard';
import PromptCard from './screens/PromptCard';
import Results from './screens/Results';
import './styles/base.css';

const SCREEN = {
  LANDING: 'landing',
  MODE_SELECT: 'mode_select',
  PLAYER_SETUP: 'player_setup',
  PRIVATE_OBJECTIVES: 'private_objectives',
  PHASE_CARD: 'phase_card',
  PROMPT_CARD: 'prompt_card',
  RESULTS: 'results',
};

const INITIAL_STATE = {
  screen: SCREEN.LANDING,
  mode: null,
  turnIndex: 0,
  gameState: null,
};

export default function App() {
  const [state, setState] = useState(INITIAL_STATE);

  const go = useCallback((updates) => {
    setState((s) => ({ ...s, ...updates }));
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const handleModeSelect = (mode) => go({ mode, screen: SCREEN.PLAYER_SETUP });

  const handlePlayersReady = (names) => {
    go({
      gameState: initializeGame(names, state.mode),
      turnIndex: 0,
      screen: SCREEN.PRIVATE_OBJECTIVES,
    });
  };

  const handleObjectivesRevealed = () => {
    go({
      gameState: startPhase(state.gameState, PHASES[0]),
      turnIndex: 0,
      screen: SCREEN.PHASE_CARD,
    });
  };

  const handlePhaseBegin = () => go({ screen: SCREEN.PROMPT_CARD });

  const handlePromptSubmit = (submission) => {
    const { gameState, turnIndex } = state;
    const currentPlayer = gameState.players[turnIndex];

    let nextGameState = gameState;

    if (gameState.phase === 'first_impression') {
      nextGameState = submitFirstImpression(gameState, { playerId: currentPlayer.id, ...submission });
    }

    if (gameState.phase === 'suspicion') {
      nextGameState = submitSuspicion(gameState, { playerId: currentPlayer.id, ...submission });
    }

    if (gameState.phase === 'reconsideration') {
      nextGameState = submitReconsideration(gameState, { playerId: currentPlayer.id, ...submission });
    }

    if (gameState.phase === 'final_decision') {
      nextGameState = submitFinalDecision(gameState, { playerId: currentPlayer.id, ...submission });
    }

    const isLastPlayerInPhase = turnIndex === gameState.players.length - 1;

    if (!isLastPlayerInPhase) {
      go({
        gameState: nextGameState,
        turnIndex: turnIndex + 1,
        screen: SCREEN.PROMPT_CARD,
      });
      return;
    }

    if (gameState.phase === 'final_decision') {
      const roomState = computeRoomState(nextGameState);
      const evaluated = {
        ...nextGameState,
        roomState,
      };

      go({
        gameState: {
          ...evaluated,
          results: evaluateObjectives(evaluated),
        },
        turnIndex: 0,
        screen: SCREEN.RESULTS,
      });
      return;
    }

    const nextPhase = PHASES[PHASES.indexOf(gameState.phase) + 1];
    go({
      gameState: startPhase(nextGameState, nextPhase),
      turnIndex: 0,
      screen: SCREEN.PHASE_CARD,
    });
  };

  const renderPhaseUI = () => {
    if (!state.gameState) {
      return null;
    }

    const phaseIndex = PHASES.indexOf(state.gameState.phase);
    const currentPlayer = state.gameState.players[state.turnIndex];

    if (state.screen === SCREEN.PHASE_CARD) {
      return (
        <PhaseCard
          phase={state.gameState.phase}
          phaseNumber={phaseIndex + 1}
          totalPhases={PHASES.length}
          roomCondition={state.gameState.roomCondition}
          currentQuestion={state.gameState.currentQuestion}
          onBegin={handlePhaseBegin}
        />
      );
    }

    if (state.screen === SCREEN.PROMPT_CARD) {
      return (
        <PromptCard
          key={`${state.gameState.phase}-${currentPlayer.id}`}
          phase={state.gameState.phase}
          phaseMeta={PHASE_META[state.gameState.phase]}
          roomCondition={state.gameState.roomCondition}
          currentQuestion={state.gameState.currentQuestion}
          currentPlayer={currentPlayer}
          players={state.gameState.players}
          turnIndex={state.turnIndex}
          totalTurns={state.gameState.players.length}
          initialSuspicion={state.gameState.initialSuspicion[currentPlayer.id] ?? null}
          initialCommitment={state.gameState.initialCommitment[currentPlayer.id] ?? 'leaning'}
          onSubmit={handlePromptSubmit}
        />
      );
    }

    if (state.screen === SCREEN.RESULTS) {
      return (
        <Results
          gameState={state.gameState}
          onPlayAgain={() => go({ screen: SCREEN.MODE_SELECT, mode: null, turnIndex: 0, gameState: null })}
          onEnd={reset}
        />
      );
    }

    return null;
  };

  if (state.screen === SCREEN.LANDING) {
    return <Landing onStart={() => go({ screen: SCREEN.MODE_SELECT })} />;
  }

  if (state.screen === SCREEN.MODE_SELECT) {
    return (
      <ModeSelect
        onSelect={handleModeSelect}
        onBack={() => go({ screen: SCREEN.LANDING })}
      />
    );
  }

  if (state.screen === SCREEN.PLAYER_SETUP) {
    return (
      <PlayerSetup
        onStart={handlePlayersReady}
        onBack={() => go({ screen: SCREEN.MODE_SELECT })}
      />
    );
  }

  if (state.screen === SCREEN.PRIVATE_OBJECTIVES && state.gameState) {
    return (
      <RoleReveal
        players={state.gameState.players}
        objectives={state.gameState.objectives}
        onComplete={handleObjectivesRevealed}
      />
    );
  }

  return renderPhaseUI();
}
