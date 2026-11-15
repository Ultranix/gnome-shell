import GLib from 'gi://GLib';
import System from 'system';

import {WeakTextureCache} from 'resource:///org/gnome/shell/misc/weakTextureCache.js';

function nextTurn() {
    return new Promise(resolve => GLib.idle_add_once(GLib.PRIORITY_DEFAULT, resolve));
}

describe('Weak texture cache', () => {
    it('shares simultaneous loads and entries retained by consumers', async () => {
        const cache = new WeakTextureCache();
        let calls = 0;
        const load = async () => {
            calls++;
            await nextTurn();
            return {texture: {}};
        };
        const [a, b] = await Promise.all([cache.load('a', load), cache.load('a', load)]);
        expect(a).toBe(b);
        expect(await cache.load('a', load)).toBe(a);
        expect(calls).toBe(1);
    });

    it('allows a failed load to be retried', async () => {
        const cache = new WeakTextureCache();
        await expectAsync(cache.load('a', () => {
            throw new Error('decode failed');
        })).toBeRejected();
        const entry = {texture: {}};
        expect(await cache.load('a', () => entry)).toBe(entry);
    });

    it('does not let an invalidated in-flight load replace its successor', async () => {
        const cache = new WeakTextureCache();
        let finishOld;
        const oldEntry = {texture: {}};
        const newEntry = {texture: {}};
        const oldLoad = cache.load('a', () => new Promise(resolve => {
            finishOld = resolve;
        }));
        await nextTurn();
        cache.purge('a');
        expect(await cache.load('a', () => newEntry)).toBe(newEntry);
        finishOld(oldEntry);
        expect(await oldLoad).toBe(oldEntry);
        expect(await cache.load('a', () => fail('unexpected load'))).toBe(newEntry);
    });

    it('does not retain unused texture entries after garbage collection', async () => {
        const cache = new WeakTextureCache();
        let entry = await cache.load('a', () => ({texture: {}}));
        const ref = new WeakRef(entry);
        entry = null;
        // WeakRef targets are kept alive until the end of the current job.
        await nextTurn();
        System.gc();
        await nextTurn();
        System.gc();
        expect(ref.deref()).toBeUndefined();
        let loaded = false;
        await cache.load('a', () => {
            loaded = true;
            return {texture: {}};
        });
        expect(loaded).toBeTrue();
    });
});
