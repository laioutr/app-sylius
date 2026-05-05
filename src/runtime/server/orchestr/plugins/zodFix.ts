import { defineNitroPlugin } from 'nitropack/runtime';
import { applyZodFix } from '@laioutr-core/core-types/utils';

export default defineNitroPlugin(() => {
  applyZodFix();
});
