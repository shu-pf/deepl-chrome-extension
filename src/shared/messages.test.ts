import { describe, expect, it, vi } from 'vitest';
import { requestLocalTranslation } from './messages';

describe('requestLocalTranslation', () => {
  it('sends a translate-local message and returns the response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: true,
      segments: ['訳1', '訳2'],
    });

    const response = await requestLocalTranslation(['s1', 's2']);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'translate-local',
      segments: ['s1', 's2'],
    });
    expect(response).toEqual({ success: true, segments: ['訳1', '訳2'] });
  });

  it('throws when there is no response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    await expect(requestLocalTranslation(['s1'])).rejects.toThrow(
      '翻訳サービスからの応答がありません',
    );
  });
});
