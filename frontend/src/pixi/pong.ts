import { Container, Graphics, Text } from 'pixi.js';
import { PONG_COURT_W, PONG_COURT_H, PONG_PADDLE_H, PONG_PADDLE_W } from '../config.js';

export interface PongVisual {
  container: Container;
  ball: Graphics;
  trail: Graphics[];
  trailPositions: { x: number; y: number }[];
  paddleLeft: Graphics;
  paddleRight: Graphics;
  scoreText: Text;
  winnerBanner: Container;
  winnerText: Text;
}

export function createPongVisual(): PongVisual {
  const container = new Container();
  container.visible = false;

  const court = new Graphics();
  court.roundRect(-6, -6, PONG_COURT_W + 12, PONG_COURT_H + 12, 14).fill(0x1c1730);
  court.roundRect(0, 0, PONG_COURT_W, PONG_COURT_H, 10).fill(0x0b1220);
  for (let i = 0; i < 4; i++) {
    court.roundRect(0, 0, PONG_COURT_W, PONG_COURT_H, 10).stroke({ width: 1, color: 0x38bdf8, alpha: 0.05 * (4 - i) });
  }
  court.roundRect(0, 0, PONG_COURT_W, PONG_COURT_H, 10).stroke({ width: 2.5, color: 0x334155 });
  for (let y = 0; y < PONG_COURT_H; y += 20) {
    court.roundRect(PONG_COURT_W / 2 - 1.5, y, 3, 10, 1.5).fill({ color: 0x475569, alpha: 0.8 });
  }
  container.addChild(court);

  // top izi: solan hayalet daireler (topun altına çizilir)
  const trail: Graphics[] = [];
  const trailPositions: { x: number; y: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const ghost = new Graphics();
    ghost.circle(0, 0, 5.5 - i * 1.2).fill({ color: 0x7dd3fc, alpha: 0.22 - i * 0.06 });
    ghost.visible = false;
    container.addChild(ghost);
    trail.push(ghost);
  }

  const ball = new Graphics();
  ball.circle(0, 0, 9).fill({ color: 0x38bdf8, alpha: 0.18 });
  ball.circle(0, 0, 6.5).fill(0xffffff);
  container.addChild(ball);

  const paddleLeft = new Graphics();
  paddleLeft.roundRect(0, 0, PONG_PADDLE_W, PONG_PADDLE_H, 5).fill(0x38bdf8);
  paddleLeft.roundRect(0, 0, PONG_PADDLE_W, PONG_PADDLE_H, 5).stroke({ width: 1, color: 0xbae6fd, alpha: 0.6 });
  container.addChild(paddleLeft);

  const paddleRight = new Graphics();
  paddleRight.roundRect(0, 0, PONG_PADDLE_W, PONG_PADDLE_H, 5).fill(0xf48fb1);
  paddleRight.roundRect(0, 0, PONG_PADDLE_W, PONG_PADDLE_H, 5).stroke({ width: 1, color: 0xfce7f3, alpha: 0.6 });
  container.addChild(paddleRight);

  const scoreText = new Text({
    text: '0 - 0',
    style: { fill: 0xffffff, fontSize: 22, fontFamily: '"Press Start 2P", monospace' },
  });
  scoreText.anchor.set(0.5, 0);
  scoreText.x = PONG_COURT_W / 2;
  scoreText.y = 12;
  container.addChild(scoreText);

  const winnerBanner = new Container();
  winnerBanner.visible = false;
  const bannerBg = new Graphics();
  bannerBg.roundRect(-190, -34, 380, 68, 14).fill({ color: 0x0d0a18, alpha: 0.92 });
  bannerBg.roundRect(-190, -34, 380, 68, 14).stroke({ width: 2, color: 0xfbbf24, alpha: 0.8 });
  winnerBanner.addChild(bannerBg);
  const winnerText = new Text({
    text: '',
    style: { fill: 0xfbbf24, fontSize: 16, fontFamily: '"Press Start 2P", monospace', align: 'center' },
  });
  winnerText.anchor.set(0.5, 0.5);
  winnerBanner.addChild(winnerText);
  winnerBanner.x = PONG_COURT_W / 2;
  winnerBanner.y = PONG_COURT_H / 2;
  container.addChild(winnerBanner);

  return { container, ball, trail, trailPositions, paddleLeft, paddleRight, scoreText, winnerBanner, winnerText };
}

export function showPongWinner(v: PongVisual, text: string): void {
  v.winnerText.text = text;
  v.winnerBanner.visible = true;
}

export function hidePongWinner(v: PongVisual): void {
  v.winnerBanner.visible = false;
  v.trailPositions.length = 0;
  for (const ghost of v.trail) ghost.visible = false;
}

const PADDLE_MARGIN = 30;

export function updatePongVisual(
  v: PongVisual,
  ball: { x: number; y: number },
  leftY: number,
  rightY: number,
  score: [number, number],
): void {
  // iz: son konumlar hayalet dairelere aktarılır
  v.trailPositions.unshift({ x: v.ball.x, y: v.ball.y });
  if (v.trailPositions.length > 9) v.trailPositions.length = 9;
  v.trail.forEach((ghost, i) => {
    const pos = v.trailPositions[(i + 1) * 3 - 1];
    if (pos) {
      ghost.x = pos.x;
      ghost.y = pos.y;
      ghost.visible = true;
    } else {
      ghost.visible = false;
    }
  });

  v.ball.x = ball.x;
  v.ball.y = ball.y;
  v.paddleLeft.x = PADDLE_MARGIN - PONG_PADDLE_W / 2;
  v.paddleLeft.y = leftY;
  v.paddleRight.x = PONG_COURT_W - PADDLE_MARGIN - PONG_PADDLE_W / 2;
  v.paddleRight.y = rightY;
  v.scoreText.text = `${score[0]} - ${score[1]}`;
}
