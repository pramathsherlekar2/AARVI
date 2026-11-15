import Dexie, {type Table} from 'dexie';
import type {SyncQueueItem} from '../types/aarvi';

export interface OfflineWorkspaceRecord {
  ownerKey: string;
  updatedAt: string;
  payloadJson: string;
}

class AarviOfflineDatabase extends Dexie {
  workspaceSnapshots!: Table<OfflineWorkspaceRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('aarvi_offline_db_v1');
    this.version(1).stores({
      workspaceSnapshots: 'ownerKey, updatedAt',
      syncQueue: 'operationId, ownerKey, syncStatus, timestampLabel',
    });
  }
}

export const aarviOfflineDb = new AarviOfflineDatabase();

export async function saveWorkspaceSnapshotToDexie(
  ownerKey: string,
  payload: unknown,
): Promise<void> {
  try {
    await aarviOfflineDb.workspaceSnapshots.put({
      ownerKey,
      updatedAt: new Date().toISOString(),
      payloadJson: JSON.stringify(payload),
    });
  } catch {
    // IndexedDB unavailable in restricted environments
  }
}

export async function enqueueSyncOperationInDexie(item: SyncQueueItem): Promise<void> {
  try {
    const existing = await aarviOfflineDb.syncQueue.get(item.operationId);
    if (existing) {
      return; // Deduplicate by unique operationId
    }
    await aarviOfflineDb.syncQueue.put(item);
  } catch {
    // Ignore IndexedDB quota errors
  }
}

export async function getSyncOperationsForOwner(ownerKey: string): Promise<SyncQueueItem[]> {
  try {
    return await aarviOfflineDb.syncQueue.where('ownerKey').equals(ownerKey).toArray();
  } catch {
    return [];
  }
}

export async function clearOfflineDataForOwner(ownerKey: string): Promise<void> {
  try {
    await aarviOfflineDb.workspaceSnapshots.where('ownerKey').equals(ownerKey).delete();
    await aarviOfflineDb.syncQueue.where('ownerKey').equals(ownerKey).delete();
  } catch {
    // Ignore cleanup errors
  }
}

export async function clearAllOfflineData(): Promise<void> {
  try {
    await aarviOfflineDb.workspaceSnapshots.clear();
    await aarviOfflineDb.syncQueue.clear();
  } catch {
    // Ignore cleanup errors
  }
}
