import questionData from '../data/prompts.json';
import objectiveData from '../data/roles.json';

export const PHASES = [
  'first_impression',
  'suspicion',
  'reconsideration',
  'final_decision',
];

export const COMMITMENT_LEVELS = ['uncertain', 'leaning', 'convinced'];

export const ROOM_CONDITIONS = [
  {
    id: 'notices_shifts',
    label: 'The room remembers movement',
    subtitle: 'Once someone turns, the turn stays in the air.',
    pressure: 'A visible adjustment does not disappear.',
    resultLine: 'The room began to remember movement.',
  },
  {
    id: 'punishes_certainty',
    label: 'The room leans against certainty',
    subtitle: 'A hard line can steady you, then turn back toward you.',
    pressure: 'A line drawn too hard starts to gather attention.',
    resultLine: 'Certainty became easier to read than intended.',
  },
  {
    id: 'distrusts_hesitation',
    label: 'The room does not forgive hesitation',
    subtitle: 'Holding back begins to look like a position of its own.',
    pressure: 'Softness stops looking neutral here.',
    resultLine: 'Hesitation stopped looking neutral.',
  },
  {
    id: 'fragments_easily',
    label: 'The room slips apart easily',
    subtitle: 'Any center that forms tends to loosen again.',
    pressure: 'You cannot rely on one stable center for long.',
    resultLine: 'The room kept breaking away from itself.',
  },
];

export const PHASE_META = {
  first_impression: {
    label: 'OPENING',
    mood: 'Take A Stance',
    subtitle: 'Answer the forced choice. Give the room a reason.',
    instruction: 'Take a stance.',
    color: '#1B2A41',
    textColor: '#DCE8F7',
  },
  suspicion: {
    label: 'FIRST LEAN',
    mood: 'Name The Uncertainty',
    subtitle: 'Choose who feels hardest to settle around.',
    instruction: 'Choose who feels most uncertain.',
    color: '#5B3A29',
    textColor: '#F7D9C4',
  },
  reconsideration: {
    label: 'TURN',
    mood: 'Shift Or Hold',
    subtitle: 'Keeping still costs something. Moving does too.',
    instruction: 'Hold, soften, intensify, or revise your judgment.',
    color: '#4A2545',
    textColor: '#F2D7EE',
  },
  final_decision: {
    label: 'LAST POSITION',
    mood: 'Commit Under Pressure',
    subtitle: 'Finish with a judgment that can survive scrutiny.',
    instruction: 'Make your final decision under pressure.',
    color: '#101820',
    textColor: '#D9E2EC',
  },
};

export const MODE_META = {
  quick: {
    label: 'Quick Pressure',
    description: 'A tight room with one opening question and one pressure lens.',
  },
  mini: {
    label: 'Full Pressure',
    description: 'The same four phases, but with a denser pressure profile.',
  },
};

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createPlayer(name, index) {
  return {
    id: `player_${index + 1}`,
    name,
    seat: index + 1,
  };
}

function createBlankRoomState() {
  return {
    fragmented: false,
    consensusTarget: null,
    changesCount: 0,
    escalationsCount: 0,
    softenedCount: 0,
    exposedPlayers: [],
    stablePlayers: [],
    unreadablePlayers: [],
  };
}

function normalizeQuestion(question) {
  return {
    ...question,
    options: question.options.map((label, index) => ({
      id: `${question.id}_${index + 1}`,
      label,
    })),
  };
}

function getQuestionPool(archetype) {
  return (questionData[archetype] || []).map((question) => ({
    ...normalizeQuestion(question),
    archetype,
  }));
}

function pickUniqueQuestion(archetypes, usedQuestionIds) {
  const archetype = sample(archetypes);
  const pool = getQuestionPool(archetype).filter((question) => !usedQuestionIds.has(question.id));
  const chosen = sample(pool.length > 0 ? pool : getQuestionPool(archetype));
  usedQuestionIds.add(chosen.id);
  return chosen;
}

export function pickRoomCondition() {
  return sample(ROOM_CONDITIONS);
}

export function pickQuestionByArchetype(archetypes, usedQuestionIds = new Set()) {
  const resolved = Array.isArray(archetypes) ? archetypes : [archetypes];
  return pickUniqueQuestion(resolved, usedQuestionIds);
}

function assignObjectives(players) {
  const selected = shuffle(objectiveData).slice(0, players.length);
  return players.reduce((accumulator, player, index) => {
    accumulator[player.id] = selected[index];
    return accumulator;
  }, {});
}

function getOpeningArchetypes(roomConditionId) {
  if (roomConditionId === 'punishes_certainty') {
    return ['value_questions', 'commitment_pressure', 'people_reading'];
  }
  if (roomConditionId === 'distrusts_hesitation') {
    return ['self_revealing', 'value_questions', 'people_reading'];
  }
  if (roomConditionId === 'fragments_easily') {
    return ['room_dynamics', 'people_reading', 'self_revealing'];
  }
  return ['self_revealing', 'people_reading', 'room_dynamics'];
}

function getPressureArchetypes(roomConditionId, mode) {
  if (roomConditionId === 'notices_shifts') {
    return mode === 'mini'
      ? ['commitment_pressure', 'people_reading', 'room_dynamics']
      : ['commitment_pressure', 'people_reading'];
  }
  if (roomConditionId === 'punishes_certainty') {
    return mode === 'mini'
      ? ['commitment_pressure', 'value_questions', 'room_dynamics']
      : ['commitment_pressure', 'value_questions'];
  }
  if (roomConditionId === 'distrusts_hesitation') {
    return mode === 'mini'
      ? ['self_revealing', 'commitment_pressure', 'people_reading']
      : ['self_revealing', 'commitment_pressure'];
  }
  return mode === 'mini'
    ? ['room_dynamics', 'people_reading', 'commitment_pressure']
    : ['room_dynamics', 'people_reading'];
}

function buildQuestionPlan(mode, roomCondition) {
  const usedQuestionIds = new Set();
  const openingArchetypes = getOpeningArchetypes(roomCondition.id);
  const pressureArchetypes = getPressureArchetypes(roomCondition.id, mode);

  return {
    first_impression: pickQuestionByArchetype(openingArchetypes, usedQuestionIds),
    reconsideration: pickQuestionByArchetype(pressureArchetypes, usedQuestionIds),
  };
}

export function initializeGame(playerNames, mode) {
  const players = playerNames.map((name, index) => createPlayer(name, index));
  const roomCondition = pickRoomCondition();

  return {
    mode,
    phase: 'first_impression',
    players,
    roomCondition,
    questionPlan: buildQuestionPlan(mode, roomCondition),
    currentQuestion: null,
    currentQuestionType: null,
    objectives: assignObjectives(players),
    answers: {},
    answerReasons: {},
    initialSuspicion: {},
    initialSuspicionReasons: {},
    initialCommitment: {},
    reconsideredSuspicion: {},
    reconsideredSuspicionReasons: {},
    reconsiderationActions: {},
    reconsideredCommitment: {},
    finalVotes: {},
    finalVoteReasons: {},
    finalCommitment: {},
    roomState: createBlankRoomState(),
    results: null,
  };
}

export function startPhase(gameState, phase) {
  const currentQuestion = gameState.questionPlan[phase] ?? null;

  return {
    ...gameState,
    phase,
    currentQuestion,
    currentQuestionType: currentQuestion?.archetype ?? null,
  };
}

export function submitFirstImpression(gameState, submission) {
  const { playerId, answer, reason } = submission;
  return {
    ...gameState,
    answers: {
      ...gameState.answers,
      [playerId]: answer,
    },
    answerReasons: {
      ...gameState.answerReasons,
      [playerId]: reason,
    },
  };
}

export function submitSuspicion(gameState, submission) {
  const { playerId, targetId, reason, commitment } = submission;
  return {
    ...gameState,
    initialSuspicion: {
      ...gameState.initialSuspicion,
      [playerId]: targetId,
    },
    initialSuspicionReasons: {
      ...gameState.initialSuspicionReasons,
      [playerId]: reason,
    },
    initialCommitment: {
      ...gameState.initialCommitment,
      [playerId]: commitment,
    },
  };
}

export function submitReconsideration(gameState, submission) {
  const { playerId, action, targetId, reason, commitment } = submission;
  return {
    ...gameState,
    reconsideredSuspicion: {
      ...gameState.reconsideredSuspicion,
      [playerId]: targetId,
    },
    reconsideredSuspicionReasons: {
      ...gameState.reconsideredSuspicionReasons,
      [playerId]: reason,
    },
    reconsiderationActions: {
      ...gameState.reconsiderationActions,
      [playerId]: action,
    },
    reconsideredCommitment: {
      ...gameState.reconsideredCommitment,
      [playerId]: commitment,
    },
  };
}

export function submitFinalDecision(gameState, submission) {
  const { playerId, targetId, reason, commitment } = submission;
  return {
    ...gameState,
    finalVotes: {
      ...gameState.finalVotes,
      [playerId]: targetId,
    },
    finalVoteReasons: {
      ...gameState.finalVoteReasons,
      [playerId]: reason,
    },
    finalCommitment: {
      ...gameState.finalCommitment,
      [playerId]: commitment,
    },
  };
}

export function getPlayerById(players, playerId) {
  return players.find((player) => player.id === playerId) ?? null;
}

export function getCommitmentIndex(level) {
  return COMMITMENT_LEVELS.indexOf(level);
}

export function changeCommitment(level, direction) {
  const currentIndex = getCommitmentIndex(level);
  const delta = direction === 'up' ? 1 : -1;
  const nextIndex = Math.max(0, Math.min(COMMITMENT_LEVELS.length - 1, currentIndex + delta));
  return COMMITMENT_LEVELS[nextIndex];
}

function buildTally(record) {
  return Object.values(record).reduce((accumulator, playerId) => {
    accumulator[playerId] = (accumulator[playerId] || 0) + 1;
    return accumulator;
  }, {});
}

function getPlayerSnapshot(gameState, playerId) {
  return {
    initialTarget: gameState.initialSuspicion[playerId] ?? null,
    reconsideredTarget: gameState.reconsideredSuspicion[playerId] ?? null,
    finalTarget: gameState.finalVotes[playerId] ?? null,
    initialCommitment: gameState.initialCommitment[playerId] ?? 'leaning',
    reconsideredCommitment: gameState.reconsideredCommitment[playerId] ?? gameState.initialCommitment[playerId] ?? 'leaning',
    finalCommitment: gameState.finalCommitment[playerId] ?? gameState.reconsideredCommitment[playerId] ?? gameState.initialCommitment[playerId] ?? 'leaning',
    action: gameState.reconsiderationActions[playerId] ?? 'keep',
  };
}

function joinPlayerNames(players, ids) {
  return ids.map((playerId) => getPlayerById(players, playerId)?.name).filter(Boolean).join(', ');
}

function getTopTallyEntry(tally) {
  const entries = Object.entries(tally).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) {
    return null;
  }

  const [playerId, count] = entries[0];
  const tied = entries.filter(([, entryCount]) => entryCount === count).length > 1;
  return { playerId, count, tied };
}

function hasMeaningfulChange(gameState, playerId) {
  return (
    gameState.initialSuspicion[playerId] !== gameState.reconsideredSuspicion[playerId]
    || gameState.initialCommitment[playerId] !== gameState.reconsideredCommitment[playerId]
    || gameState.reconsiderationActions[playerId] !== 'keep'
  );
}

export function computeRoomState(gameState) {
  const initialTally = buildTally(gameState.initialSuspicion);
  const reconsideredTally = buildTally(gameState.reconsideredSuspicion);
  const finalTally = buildTally(gameState.finalVotes);
  const topFinal = getTopTallyEntry(finalTally);
  const changesCount = gameState.players.filter((player) => hasMeaningfulChange(gameState, player.id)).length;
  const escalationsCount = gameState.players.filter((player) => {
    const initial = gameState.initialCommitment[player.id];
    const revised = gameState.reconsideredCommitment[player.id];
    return getCommitmentIndex(revised) > getCommitmentIndex(initial);
  }).length;
  const softenedCount = gameState.players.filter((player) => {
    const initial = gameState.initialCommitment[player.id];
    const revised = gameState.reconsideredCommitment[player.id];
    return getCommitmentIndex(revised) < getCommitmentIndex(initial);
  }).length;

  const fragmentationThreshold = gameState.roomCondition.id === 'fragments_easily'
    ? 2
    : Math.max(3, gameState.players.length - 1);

  const fragmented = (
    Object.keys(finalTally).length >= fragmentationThreshold
    || !topFinal
    || topFinal.tied
    || topFinal.count <= (gameState.roomCondition.id === 'fragments_easily' ? 3 : 2)
  );

  const exposedPlayers = gameState.players.filter((player) => {
    const playerId = player.id;
    const snapshot = getPlayerSnapshot(gameState, playerId);
    const revisedTarget = snapshot.initialTarget !== snapshot.reconsideredTarget;
    const changedLate = snapshot.initialTarget !== snapshot.finalTarget;
    const commitmentMoved = snapshot.initialCommitment !== snapshot.reconsideredCommitment;
    const stayedStill = !revisedTarget && !commitmentMoved && snapshot.action === 'keep';
    const targetAttention = finalTally[playerId] || 0;

    if (gameState.roomCondition.id === 'notices_shifts') {
      return revisedTarget || changedLate || commitmentMoved;
    }
    if (gameState.roomCondition.id === 'punishes_certainty') {
      return (
        snapshot.finalCommitment === 'convinced'
        || (snapshot.initialCommitment === 'convinced' && snapshot.action !== 'soften')
        || (snapshot.action === 'intensify' && targetAttention >= 1)
      );
    }
    if (gameState.roomCondition.id === 'distrusts_hesitation') {
      return (
        snapshot.finalCommitment === 'uncertain'
        || snapshot.action === 'soften'
        || (stayedStill && snapshot.initialCommitment === 'uncertain')
      );
    }
    if (gameState.roomCondition.id === 'fragments_easily') {
      return (
        (targetAttention >= 2 && fragmented)
        || (!changedLate && snapshot.finalCommitment === 'convinced')
        || (stayedStill && reconsideredTally[snapshot.finalTarget] <= 1)
      );
    }
    return false;
  }).map((player) => player.id);

  const stablePlayers = gameState.players.filter((player) => (
    gameState.initialSuspicion[player.id] === gameState.reconsideredSuspicion[player.id]
    && gameState.initialCommitment[player.id] === gameState.reconsideredCommitment[player.id]
  )).map((player) => player.id);

  const unreadablePlayers = gameState.players.filter((player) => (
    ((initialTally[player.id] || 0) + (reconsideredTally[player.id] || 0) + (finalTally[player.id] || 0)) <= 1
  )).map((player) => player.id);

  return {
    fragmented,
    consensusTarget: fragmented ? null : topFinal?.playerId ?? null,
    changesCount,
    escalationsCount,
    softenedCount,
    exposedPlayers,
    stablePlayers,
    unreadablePlayers,
  };
}

function objectiveOutcome(status, successLine, strainLine, missLine) {
  if (status === 'aligned') {
    return successLine;
  }
  if (status === 'strained') {
    return strainLine;
  }
  return missLine;
}

function evaluateObjective(gameState, player) {
  const objective = gameState.objectives[player.id];
  const roomState = gameState.roomState;
  const initialTally = buildTally(gameState.initialSuspicion);
  const finalTally = buildTally(gameState.finalVotes);
  const wasEarlyCenter = (initialTally[player.id] || 0) >= 2;
  const isFinalCenter = (finalTally[player.id] || 0) >= 2;
  const changedLate = gameState.initialSuspicion[player.id] !== gameState.finalVotes[player.id];
  const action = gameState.reconsiderationActions[player.id];
  const snapshot = getPlayerSnapshot(gameState, player.id);

  switch (objective.evaluator) {
    case 'remainBelievable': {
      const status = isFinalCenter ? 'missed' : roomState.exposedPlayers.includes(player.id) ? 'strained' : 'aligned';
      return objectiveOutcome(
        status,
        `${player.name} stayed believable while the room tightened.`,
        `${player.name} held together, but their position started to show.`,
        `${player.name} became too easy for the room to place.`,
      );
    }
    case 'avoidEarlyCenter': {
      const status = wasEarlyCenter ? 'missed' : isFinalCenter ? 'strained' : 'aligned';
      return objectiveOutcome(
        status,
        `${player.name} stayed outside the center until late.`,
        `${player.name} stayed clear early, then the room began to turn toward them.`,
        `${player.name} drew the room in too early.`,
      );
    }
    case 'keepFragmented': {
      const status = roomState.fragmented ? 'aligned' : roomState.changesCount >= 2 ? 'strained' : 'missed';
      return objectiveOutcome(
        status,
        `${player.name} kept value in a room that refused to settle.`,
        `${player.name} helped loosen the room, but not enough to keep it open.`,
        `${player.name} needed more instability than the room allowed.`,
      );
    }
    case 'inviteRevisions': {
      const status = roomState.changesCount >= 2 ? 'aligned' : roomState.changesCount === 1 ? 'strained' : 'missed';
      return objectiveOutcome(
        status,
        `${player.name} drew value from a room that kept changing shape.`,
        `${player.name} got one visible turn, but the room mostly held.`,
        `${player.name} needed the room to move more than it did.`,
      );
    }
    case 'stayUnreadable': {
      const status = roomState.unreadablePlayers.includes(player.id) ? 'aligned' : isFinalCenter ? 'missed' : 'strained';
      return objectiveOutcome(
        status,
        `${player.name} stayed hard to place.`,
        `${player.name} stayed partly unreadable, though not fully outside the room's focus.`,
        `${player.name} became easier to read than they needed to be.`,
      );
    }
    case 'surviveScrutiny': {
      const status = isFinalCenter && (action === 'soften' || action === 'revise')
        ? 'aligned'
        : isFinalCenter
          ? 'strained'
          : 'missed';
      return objectiveOutcome(
        status,
        `${player.name} took scrutiny without locking up around it.`,
        `${player.name} carried scrutiny, but the strain stayed visible.`,
        `${player.name} never became exposed enough for this pull to matter.`,
      );
    }
    case 'letRoomShiftAroundYou': {
      const status = roomState.changesCount >= 2 && !isFinalCenter ? 'aligned' : changedLate ? 'strained' : 'missed';
      return objectiveOutcome(
        status,
        `${player.name} let the room move first.`,
        `${player.name} moved with the room instead of staying just outside it.`,
        `${player.name} needed more motion around them than the room produced.`,
      );
    }
    case 'believableAfterShift': {
      const status = changedLate && !isFinalCenter && snapshot.finalCommitment !== 'uncertain'
        ? 'aligned'
        : changedLate
          ? 'strained'
          : 'missed';
      return objectiveOutcome(
        status,
        `${player.name} turned and still held together.`,
        `${player.name} turned, but the turn stayed visible.`,
        `${player.name} never found a late move they could carry convincingly.`,
      );
    }
    default:
      return `${player.name} held their line inside the room.`;
  }
}

function buildOpeningEcho(gameState, player) {
  const snapshot = getPlayerSnapshot(gameState, player.id);
  const archetype = gameState.questionPlan.first_impression.archetype;
  const changedLate = snapshot.initialTarget !== snapshot.finalTarget;

  if (archetype === 'value_questions') {
    if (snapshot.finalCommitment === 'convinced') {
      return 'What they said at the start hardened into a visible edge.';
    }
    if (changedLate) {
      return 'What they said at the start later sounded more strategic than settled.';
    }
    return 'Their opening answer kept coloring how the room read them.';
  }

  if (archetype === 'self_revealing') {
    if (changedLate) {
      return 'Their opening answer began to feel more self-revealing once the room tightened.';
    }
    return 'Their opening answer stayed close to the way they carried pressure.';
  }

  if (archetype === 'people_reading') {
    if (changedLate) {
      return 'Their early read of others started to sound like a read of themselves.';
    }
    return 'Their first read of the room kept echoing back toward them.';
  }

  if (archetype === 'room_dynamics') {
    if (gameState.roomState.fragmented) {
      return 'Their opening sense of the room stayed alive as the room split apart.';
    }
    return 'Their first answer quietly shaped how the room settled.';
  }

  if (changedLate) {
    return 'Their opening stance made the later shift easier to notice.';
  }

  return 'Their opening stance held its shape longer than the room expected.';
}

function buildPlayerPressureLine(gameState, player) {
  const snapshot = getPlayerSnapshot(gameState, player.id);
  const revisedTarget = snapshot.initialTarget !== snapshot.reconsideredTarget;
  const changedLate = snapshot.initialTarget !== snapshot.finalTarget;

  if (gameState.roomCondition.id === 'notices_shifts') {
    if (revisedTarget || changedLate) {
      return 'When they moved, the room kept that movement in view.';
    }
    if (snapshot.initialCommitment !== snapshot.reconsideredCommitment) {
      return 'Even a smaller adjustment stayed visible around them.';
    }
    return 'Holding still kept them legible in a room watching for movement.';
  }

  if (gameState.roomCondition.id === 'punishes_certainty') {
    if (snapshot.finalCommitment === 'convinced') {
      return 'Their certainty began pulling attention back toward them.';
    }
    if (snapshot.action === 'soften') {
      return 'They stepped back before their line hardened too visibly.';
    }
    return 'They stayed close to a hard line without fully letting it close around them.';
  }

  if (gameState.roomCondition.id === 'distrusts_hesitation') {
    if (snapshot.finalCommitment === 'uncertain' || snapshot.action === 'soften') {
      return 'Their hesitation started to read like a decision of its own.';
    }
    if (snapshot.action === 'intensify') {
      return 'They chose definition before the room could hold doubt against them.';
    }
    return 'They avoided full hesitation, but never escaped its pressure completely.';
  }

  if (changedLate) {
    return 'They moved with a room that would not stay still.';
  }
  if (snapshot.finalCommitment === 'convinced') {
    return 'They tried to anchor a room that kept slipping apart.';
  }
  return 'They stayed difficult to place while the room split around them.';
}

export function evaluateObjectives(gameState) {
  const roomLines = [];
  const exposedNames = joinPlayerNames(gameState.players, gameState.roomState.exposedPlayers);
  const unreadableNames = joinPlayerNames(gameState.players, gameState.roomState.unreadablePlayers);

  if (gameState.roomState.fragmented) {
    roomLines.push('The room never settled.');
  } else {
    roomLines.push('A center formed, but only under pressure.');
  }

  if (gameState.roomCondition.id === 'notices_shifts') {
    roomLines.push(
      gameState.roomState.changesCount >= 2
        ? 'Movement stayed in the room longer than anyone wanted.'
        : 'Even the smaller turns felt hard to hide.',
    );
  }

  if (gameState.roomCondition.id === 'punishes_certainty') {
    roomLines.push(
      gameState.roomState.escalationsCount >= 1
        ? 'Firm lines became easier to notice as the room tightened.'
        : 'No one could lean too hard without consequence.',
    );
  }

  if (gameState.roomCondition.id === 'distrusts_hesitation') {
    roomLines.push(
      gameState.roomState.softenedCount >= 1
        ? 'Softness stopped reading as safety.'
        : 'The room kept waiting for someone to stop holding back.',
    );
  }

  if (gameState.roomCondition.id === 'fragments_easily') {
    roomLines.push(
      gameState.roomState.fragmented
        ? 'Any center that appeared kept loosening again.'
        : 'Even when a center formed, it never felt fully settled.',
    );
  }

  if (exposedNames) {
    roomLines.push(`${exposedNames} became easier to read than intended.`);
  }

  if (unreadableNames) {
    roomLines.push(`${unreadableNames} stayed hard to place while others became clearer.`);
  }

  const playerResults = gameState.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    openingEcho: buildOpeningEcho(gameState, player),
    trajectory: buildPlayerPressureLine(gameState, player),
    summary: evaluateObjective(gameState, player),
  }));

  return {
    roomLines,
    playerResults,
  };
}
