import type { Container } from 'pixi.js';

/**
 * Removes and destroys all children of a PixiJS Container.
 * Equivalent to container.removeChildren().forEach(c => c.destroy({ children: true }))
 * but ensures { children: true } is never accidentally omitted.
 */
export function clearContainer(container: Container): void {
  container.removeChildren().forEach((c) => c.destroy({ children: true }));
}
