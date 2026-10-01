export function createId(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return Array.from(bytes, (byte, index) => {
      const value = byte.toString(16).padStart(2, "0");
      return [4, 6, 8, 10].includes(index) ? "-" + value : value;
    }).join("");
  }

  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
