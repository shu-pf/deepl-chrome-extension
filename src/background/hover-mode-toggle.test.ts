import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleHoverModeInTab } from './hover-mode-toggle';

const sendMessage = vi.fn();
const executeScript = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  executeScript.mockReset();
  const c = chrome as unknown as Record<string, unknown>;
  c.tabs = { sendMessage };
  c.scripting = { executeScript };
  (chrome.runtime as unknown as Record<string, unknown>).getManifest = () => ({
    content_scripts: [{ js: ['content-scripts/content.js'] }],
  });
});

describe('toggleHoverModeInTab', () => {
  it('sends the toggle message when the content script is alive', async () => {
    sendMessage.mockResolvedValue(undefined);

    await toggleHoverModeInTab(1);

    expect(sendMessage).toHaveBeenCalledWith(1, {
      action: 'toggle-hover-mode',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('injects the content script and retries when the tab has none', async () => {
    sendMessage
      .mockRejectedValueOnce(
        new Error(
          'Could not establish connection. Receiving end does not exist.',
        ),
      )
      .mockResolvedValueOnce(undefined);
    executeScript.mockResolvedValue([]);

    await toggleHoverModeInTab(1);

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: ['content-scripts/content.js'],
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not throw on pages where scripts cannot run', async () => {
    sendMessage.mockRejectedValue(new Error('Receiving end does not exist.'));
    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));

    await expect(toggleHoverModeInTab(1)).resolves.toBeUndefined();
  });
});
