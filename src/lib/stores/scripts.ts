import { writable, get } from 'svelte/store';
import type { TourScript } from '$lib/types/script';
import { dbPut, dbDelete, dbGetAll } from '$lib/stores/db';

type ScriptsByTrip = Record<string, TourScript[]>;

function idbKey(tripId: string, scriptId: string): string {
	return `${tripId}:${scriptId}`;
}

function createScriptsStore() {
	const { subscribe, update } = writable<ScriptsByTrip>({});

	function getScripts(tripId: string): TourScript[] {
		return get({ subscribe })[tripId] ?? [];
	}

	function persistAndSync(tripId: string, script: TourScript) {
		const { version, ...body } = script;
		dbPut('scripts', idbKey(tripId, script.id), script).catch(() => {});
		pushToServer(tripId, script).catch(() => {});
	}

	async function pushToServer(tripId: string, script: TourScript) {
		try {
			const { saveScriptEntry } = await import('$lib/services/trips-api');
			const { version, ...body } = script;
			const result = await saveScriptEntry(tripId, script.id, body as TourScript, version ?? null);
			if (result.ok) {
				update((state) => {
					const scripts = state[tripId] ?? [];
					const idx = scripts.findIndex((s) => s.id === script.id);
					if (idx !== -1) {
						const next = [...scripts];
						next[idx] = { ...next[idx], version: result.version };
						dbPut('scripts', idbKey(tripId, next[idx].id), next[idx]).catch(() => {});
						return { ...state, [tripId]: next };
					}
					return state;
				});
			}
		} catch (err) {
			console.error('[scripts] Failed to push to server:', err);
		}
	}

	return {
		subscribe,

		async init(tripId: string) {
			// Load from IndexedDB
			const allRows = await dbGetAll<TourScript>('scripts');
			const prefix = `${tripId}:`;
			const local = allRows
				.filter((r) => r.key.startsWith(prefix))
				.map((r) => r.value);

			update((state) => ({ ...state, [tripId]: local }));

			// Pull from server and merge
			try {
				const { fetchScriptEntries } = await import('$lib/services/trips-api');
				const { entries } = await fetchScriptEntries(tripId);
				if (entries.length === 0 && local.length === 0) return;

				const merged = new Map<string, TourScript>();
				for (const s of local) merged.set(s.id, s);
				for (const raw of entries) {
					const serverVersion = (raw as unknown as Record<string, unknown>)._version as number;
					const script: TourScript = {
						id: raw.id,
						tripId: raw.tripId ?? tripId,
						dayIndex: raw.dayIndex,
						title: raw.title,
						content: raw.content,
						createdAt: raw.createdAt,
						updatedAt: raw.updatedAt,
						version: serverVersion
					};
					const existing = merged.get(script.id);
					if (!existing || (existing.version ?? 0) < serverVersion) {
						merged.set(script.id, script);
						dbPut('scripts', idbKey(tripId, script.id), script).catch(() => {});
					}
				}

				const mergedList = Array.from(merged.values());
				update((state) => ({ ...state, [tripId]: mergedList }));
			} catch (err) {
				console.error('[scripts] Failed to pull from server:', err);
			}
		},

		addScript(tripId: string, script: TourScript) {
			update((state) => {
				const scripts = state[tripId] ?? [];
				return { ...state, [tripId]: [...scripts, script] };
			});
			persistAndSync(tripId, script);
		},

		async deleteScript(tripId: string, scriptId: string) {
			const scripts = getScripts(tripId);
			const script = scripts.find((s) => s.id === scriptId);
			const version = script?.version ?? 1;

			update((state) => {
				const filtered = (state[tripId] ?? []).filter((s) => s.id !== scriptId);
				return { ...state, [tripId]: filtered };
			});

			dbDelete('scripts', idbKey(tripId, scriptId)).catch(() => {});

			try {
				const { deleteScriptEntry } = await import('$lib/services/trips-api');
				await deleteScriptEntry(tripId, scriptId, version);
			} catch (err) {
				console.error('[scripts] Failed to delete on server:', err);
			}
		},

		getScriptsForDay(tripId: string, dayIndex: number): TourScript[] {
			return getScripts(tripId).filter((s) => s.dayIndex === dayIndex);
		}
	};
}

export const scriptsStore = createScriptsStore();
