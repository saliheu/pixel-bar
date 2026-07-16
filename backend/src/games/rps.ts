import type { Choice } from '../protocol.js';
import { RPS_WIN_SCORE } from '../config.js';

export interface RpsGame {
  playerIds: [string, string];
  choices: Partial<Record<string, Choice>>;
  scores: Record<string, number>;
  round: number;
  ended: boolean;
}

export function initRps(playerIds: [string, string]): RpsGame {
  return {
    playerIds,
    choices: {},
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    round: 1,
    ended: false,
  };
}

export function resetRps(game: RpsGame): void {
  const [a, b] = game.playerIds;
  game.choices = {};
  game.scores = { [a]: 0, [b]: 0 };
  game.round = 1;
  game.ended = false;
}

// İlk RPS_WIN_SCORE galibiyete ulaşan oyuncu maçı kazanır; yoksa null.
export function rpsMatchWinner(game: RpsGame): string | null {
  const [a, b] = game.playerIds;
  if (game.scores[a] >= RPS_WIN_SCORE) return a;
  if (game.scores[b] >= RPS_WIN_SCORE) return b;
  return null;
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
