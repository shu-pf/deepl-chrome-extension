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
    clearHighlight(hoveredElement);
    hoveredElement = null;
  }
}

function clearHighlight(element: HTMLElement): void {
  element.style.outline = '';
  element.style.outlineOffset = '';
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
  // 明るいページでも暗いページでも見える中間の灰色にする。
  element.style.outline = '2px solid #71717a';
  element.style.outlineOffset = '3px';
}

function handleMouseOut(e: MouseEvent): void {
  if (!hoverModeEnabled) return;
  const element = e.target as HTMLElement;
  if (element === hoveredElement) {
    clearHighlight(element);
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
