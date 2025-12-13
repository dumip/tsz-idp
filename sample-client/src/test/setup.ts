import '@testing-library/jest-dom';

// Mock crypto.subtle for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - Node.js crypto module
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto as Crypto;
}
