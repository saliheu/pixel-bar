import {
  PONG_COURT_W,
  PONG_COURT_H,
  PONG_PADDLE_H,
  PONG_PADDLE_SPEED,
  PONG_BALL_SPEED,
  PONG_BALL_MAX_SPEED,
  PONG_WIN_SCORE,
} from '../config.js';

export interface PongGame {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: Record<string, number>; // paddle üst-kenar y pozisyonu
  inputDir: Record<string, -1 | 0 | 1>;
  score: Record<string, number>;
  sides: Record<string, 'left' | 'right'>;
  tickInterval: NodeJS.Timeout | null;
  ended: boolean; // maç bitti, "yeniden başla" bekleniyor
}

const PADDLE_MARGIN = 30;

function resetBall(vxSign: number): PongGame['ball'] {
  const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // hafif rastgele açı
  return {
    x: PONG_COURT_W / 2,
    y: PONG_COURT_H / 2,
    vx: PONG_BALL_SPEED * vxSign * Math.cos(angle),
    vy: PONG_BALL_SPEED * Math.sin(angle),
  };
}

export function initPong(playerIds: [string, string]): PongGame {
  const [a, b] = playerIds;
  const sides: PongGame['sides'] = Math.random() < 0.5
    ? { [a]: 'left', [b]: 'right' }
    : { [a]: 'right', [b]: 'left' };
  return {
    ball: resetBall(Math.random() < 0.5 ? 1 : -1),
    paddles: { [a]: PONG_COURT_H / 2 - PONG_PADDLE_H / 2, [b]: PONG_COURT_H / 2 - PONG_PADDLE_H / 2 },
    inputDir: { [a]: 0, [b]: 0 },
    score: { [a]: 0, [b]: 0 },
    sides,
    tickInterval: null,
    ended: false,
  };
}

// Maç bittikten sonra aynı taraflarla yeni maç başlatır.
export function resetPong(game: PongGame, playerIds: string[]): void {
  game.ball = resetBall(Math.random() < 0.5 ? 1 : -1);
  for (const pid of playerIds) {
    game.paddles[pid] = PONG_COURT_H / 2 - PONG_PADDLE_H / 2;
    game.inputDir[pid] = 0;
    game.score[pid] = 0;
  }
  game.ended = false;
}

export interface PongTickResult {
  goalScorer?: string;
  matchWinner?: string;
}

function paddleXFor(side: 'left' | 'right'): number {
  return side === 'left' ? PADDLE_MARGIN : PONG_COURT_W - PADDLE_MARGIN;
}

export function stepPong(game: PongGame, playerIds: [string, string]): PongTickResult {
  for (const pid of playerIds) {
    const dir = game.inputDir[pid] ?? 0;
    game.paddles[pid] = clamp(
      game.paddles[pid] + dir * PONG_PADDLE_SPEED,
      0,
      PONG_COURT_H - PONG_PADDLE_H,
    );
  }

  game.ball.x += game.ball.vx;
  game.ball.y += game.ball.vy;

  if (game.ball.y <= 0 || game.ball.y >= PONG_COURT_H) {
    game.ball.vy *= -1;
    game.ball.y = clamp(game.ball.y, 0, PONG_COURT_H);
  }

  for (const pid of playerIds) {
    const side = game.sides[pid];
    const paddleX = paddleXFor(side);
    const paddleY = game.paddles[pid];
    const ballNearPaddleX = side === 'left'
      ? game.ball.x <= paddleX + 10 && game.ball.x >= paddleX - 5 && game.ball.vx < 0
      : game.ball.x >= paddleX - 10 && game.ball.x <= paddleX + 5 && game.ball.vx > 0;
    if (ballNearPaddleX && game.ball.y >= paddleY && game.ball.y <= paddleY + PONG_PADDLE_H) {
      // her sekişte hızlanır; çok hızlanınca raketi "tünelleyip" geçmesin diye sınırlanır
      const sped = clamp(Math.abs(game.ball.vx) * 1.08, PONG_BALL_SPEED, PONG_BALL_MAX_SPEED);
      game.ball.vx = game.ball.vx < 0 ? sped : -sped;
      const hitOffset = (game.ball.y - (paddleY + PONG_PADDLE_H / 2)) / (PONG_PADDLE_H / 2);
      game.ball.vy = hitOffset * sped * 0.9; // raket kenarına vurunca daha keskin açı
    }
  }

  let goalScorer: string | undefined;
  if (game.ball.x < 0) {
    goalScorer = playerIds.find((pid) => game.sides[pid] === 'right');
  } else if (game.ball.x > PONG_COURT_W) {
    goalScorer = playerIds.find((pid) => game.sides[pid] === 'left');
  }

  let matchWinner: string | undefined;
  if (goalScorer) {
    game.score[goalScorer]++;
    game.ball = resetBall(game.sides[goalScorer] === 'left' ? -1 : 1);
    if (game.score[goalScorer] >= PONG_WIN_SCORE) {
      matchWinner = goalScorer;
    }
  }

  return { goalScorer, matchWinner };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
