import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Manga, MangaPage } from '../types';

interface MangaDB extends DBSchema {
  mangas: {
    key: string;
    value: Manga;
    indexes: { 'by-created': number };
  };
  pages: {
    key: string; // `${mangaId}_${index}`
    value: {
      id: string;
      mangaId: string;
      index: number;
      name: string;
      blob: Blob;
      aspectRatio: number;
    };
    indexes: { 'by-manga': string };
  };
}

const DB_NAME = 'mangaflow_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MangaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MangaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MangaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('mangas')) {
          const mangaStore = db.createObjectStore('mangas', { keyPath: 'id' });
          mangaStore.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('pages')) {
          const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
          pageStore.createIndex('by-manga', 'mangaId');
        }
      },
    });
  }
  return dbPromise;
}
