import type { Choice } from '../protocol.js';

export interface RpsGame {
  choices: Partial<Record<string, Choice>>;
  scores: Record<string, number>;
  round: number;
}

export function initRps(playerIds: [string, string]): RpsGame {
  return {
    choices: {},
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    round: 1,
  };
}

const BEATS: Record<Choice, Choice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export function resolveRps(
  game: RpsGame,
  playerIds: [string, string],
): { winner: string | 'draw'; choices: Record<string, Choice> } | null {
  const [a, b] = playerIds;
  const choiceA = game.choices[a];
  const choiceB = game.choices[b];
  if (!choiceA || !choiceB) return null;

  let winner: string | 'draw';
  if (choiceA === choiceB) {
    winner = 'draw';
  } else if (BEATS[choiceA] === choiceB) {
    winner = a;
    game.scores[a]++;
  } else {
    winner = b;
    game.scores[b]++;
  }

  const choices: Record<string, Choice> = { [a]: choiceA, [b]: choiceB };
  game.choices = {};
  game.round++;
  return { winner, choices };
}
