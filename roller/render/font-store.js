// Only this device stores imported font files. No server, preset export or cloud synchronization.
export function createFontStore() {
  const open = () => new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('This device does not allow saved font files.')); return; }
    const request = indexedDB.open('dice-sim:fonts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('fonts', { keyPath: 'key' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Dice tabs to open the font library.'));
    request.onsuccess = () => resolve(request.result);
  });
  const run = async (mode, operation) => {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('fonts', mode);
        const request = operation(tx.objectStore('fonts'));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error || request.error || new Error('The font could not be saved.'));
        tx.onerror = () => reject(tx.error || request.error);
      });
    } finally { db.close(); }
  };
  return {
    get: key => run('readonly', store => store.get(key)),
    list: () => run('readonly', store => store.getAll()),
    put: record => run('readwrite', store => store.put(record)),
  };
}
