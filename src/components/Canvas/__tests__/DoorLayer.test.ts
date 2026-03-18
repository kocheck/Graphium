import { describe, it, expect } from 'vitest';
import { doorStateKey } from '../DoorLayer';
import type { Door } from '../../../types/domain';

const makeDoor = (overrides: Partial<Door> = {}): Door => ({
  id: 'door-1',
  x: 100,
  y: 200,
  orientation: 'horizontal',
  isOpen: false,
  isLocked: false,
  size: 50,
  ...overrides,
});

describe('doorStateKey', () => {
  it('returns the same key for identical state', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).toBe(doorStateKey(door, false, false));
  });

  it('returns different keys when isOpen changes', () => {
    const closed = makeDoor({ isOpen: false });
    const open = makeDoor({ isOpen: true });
    expect(doorStateKey(closed, false, false)).not.toBe(doorStateKey(open, false, false));
  });

  it('returns different keys when isLocked changes', () => {
    const unlocked = makeDoor({ isLocked: false });
    const locked = makeDoor({ isLocked: true });
    expect(doorStateKey(unlocked, false, false)).not.toBe(doorStateKey(locked, false, false));
  });

  it('returns different keys when isSelected changes', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).not.toBe(doorStateKey(door, false, true));
  });

  it('returns different keys when isWorldView changes', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).not.toBe(doorStateKey(door, true, false));
  });

  it('returns different keys when position changes', () => {
    const a = makeDoor({ x: 100 });
    const b = makeDoor({ x: 200 });
    expect(doorStateKey(a, false, false)).not.toBe(doorStateKey(b, false, false));
  });

  it('returns different keys when orientation changes', () => {
    const horiz = makeDoor({ orientation: 'horizontal' });
    const vert = makeDoor({ orientation: 'vertical' });
    expect(doorStateKey(horiz, false, false)).not.toBe(doorStateKey(vert, false, false));
  });

  it('returns different keys when swingDirection changes', () => {
    const left = makeDoor({ swingDirection: 'left' });
    const right = makeDoor({ swingDirection: 'right' });
    expect(doorStateKey(left, false, false)).not.toBe(doorStateKey(right, false, false));
  });
});
