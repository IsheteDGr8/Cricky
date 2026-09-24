import type { BallRecord } from '@/domain';
import type { BallTone } from '@/ui';

export function ballTone(ball: BallRecord): BallTone {
  if (ball.wicket) return 'wicket';
  if (ball.extra) return 'extra';
  if (ball.runs === 4 || ball.runs === 6) return 'boundary';
  return ball.runs === 0 ? 'dot' : 'runs';
}
