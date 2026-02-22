import type { UpdateNodeInput } from '../../shared/types';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  z?: number;
}

export function positionsToUpdateInputs(positions: NodePosition[]): UpdateNodeInput[] {
  return positions.map((pos) => ({
    id: pos.id,
    x: pos.x,
    y: pos.y,
    z: pos.z,
  }));
}
