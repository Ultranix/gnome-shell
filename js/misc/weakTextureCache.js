// Share live textures and in-flight loads without keeping historical images
// alive. Callers must retain the returned entry for as long as they use it.
export class WeakTextureCache {
    constructor() {
        this._entries = new Map();
        this._pending = new Map();
    }

    async load(key, load) {
        for (const [uri, ref] of this._entries) {
            if (!ref.deref())
                this._entries.delete(uri);
        }

        const entry = this._entries.get(key)?.deref();
        if (entry)
            return entry;

        if (this._pending.has(key))
            return this._pending.get(key);

        // Defer invoking load until the pending entry has been installed.
        const pending = Promise.resolve().then(load);
        this._pending.set(key, pending);
        try {
            const result = await pending;
            // A file change may have invalidated this load in the meantime.
            if (this._pending.get(key) === pending)
                this._entries.set(key, new WeakRef(result));
            return result;
        } finally {
            if (this._pending.get(key) === pending)
                this._pending.delete(key);
        }
    }

    purge(key) {
        this._entries.delete(key);
        this._pending.delete(key);
    }
}
