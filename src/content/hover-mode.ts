import { translateElement } from './translator';

let hoverModeEnabled = false;
let hoveredElement: HTMLElement | null = null;

export function toggleHoverMode(): void {
  hoverModeEnabled = !hoverModeEnabled;
  if (hoverModeEnabled) {
    enableHoverMode();
  } else {
    disableHoverMode();
  }
}

function enableHoverMode(): void {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('contextmenu', handleRightClick, true);
  document.addEventListener('keydown', handleEscKey, true);
  document.body.style.cursor = 'crosshair';
}

export function disableHoverMode(): void {
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('contextmenu', handleRightClick, true);
  document.removeEventListener('keydown', handleEscKey, true);
  document.body.style.cursor = '';

  if (hoveredElement) {
    hoveredElement.style.outline = '';
    hoveredElement = null;
  }
}

function handleEscKey(e: KeyboardEvent): void {
  if (!hoverModeEnabled) return;
  if (e.key === 'Escape') {
    hoverModeEnabled = false;
    disableHoverMode();
  }
}

function handleMouseOver(e: MouseEvent): void {
  if (!hoverModeEnabled) return;
  const element = e.target as HTMLElement;
  if (element === document.body || element === document.documentElement) return;

  hoveredElement = element;
  element.style.outline = '2px solid #0066cc';
  element.style.outlineOffset = '2px';
}

function handleMouseOut(e: MouseEvent): void {
  if (!hoverModeEnabled) return;
  const element = e.target as HTMLElement;
  if (element === hoveredElement) {
    element.style.outline = '';
  }
}

async function handleRightClick(e: MouseEvent): Promise<void> {
  if (!hoverModeEnabled) return;
  e.preventDefault();
  e.stopPropagation();

  const shouldContinue = await translateElement(e.target as HTMLElement);
  if (!shouldContinue) {
    disableHoverMode();
  }
}
