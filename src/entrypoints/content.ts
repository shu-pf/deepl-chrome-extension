import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerContentScript } from '../content';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main: registerContentScript,
});
