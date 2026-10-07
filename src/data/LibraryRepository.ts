import JSZip from 'jszip';
import { getDb } from './db';
import { Manga, MangaPage } from '../types';
import { naturalCompare } from './naturalCompare';
import { createSampleMangaPages } from './sampleManga';

const SUPPORTED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXT.has(ext);
}

function getImageAspectRatio(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth > 0 && img.naturalHeight > 0
        ? img.naturalWidth / img.naturalHeight
        : 0.7;
      URL.revokeObjectURL(url);
      resolve(ratio);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0.7);
    };
    img.src = url;
  });
}

export class LibraryRepository {
  private static instance: LibraryRepository;

  public static getInstance(): LibraryRepository {
    if (!LibraryRepository.instance) {
      LibraryRepository.instance = new LibraryRepository();
    }
    return LibraryRepository.instance;
  }

  public async list(): Promise<Manga[]> {
    const db = await getDb();
    const all = await db.getAll('mangas');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async get(id: string): Promise<Manga | undefined> {
    const db = await getDb();
    return db.get('mangas', id);
  }

  public async title(id: string): Promise<string> {
    const m = await this.get(id);
    return m ? m.title : id;
  }

  public async loadPages(id: string): Promise<MangaPage[]> {
    const db = await getDb();
    const tx = db.transaction('pages', 'readonly');
    const index = tx.store.index('by-manga');
    const records = await index.getAll(id);
    await tx.done;

    records.sort((a, b) => a.index - b.index);

    return records.map((r) => ({
      index: r.index,
      name: r.name,
      url: URL.createObjectURL(r.blob),
      aspectRatio: r.aspectRatio || 0.7,
    }));
  }

  public async delete(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['mangas', 'pages'], 'readwrite');
    await tx.objectStore('mangas').delete(id);

    const pageIndex = tx.objectStore('pages').index('by-manga');
    let cursor = await pageIndex.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  public async importImages(files: File[]): Promise<Manga> {
    const filtered = files
      .filter((f) => isImageFile(f.name))
      .sort((a, b) => naturalCompare(a.name, b.name));

    if (filtered.length === 0) {
      throw new Error('No supported image files found');
    }

    const title = `Images ${new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    return this.persistManga(title, filtered.map((f) => ({ name: f.name, blob: f })));
  }

  public async importFolder(files: File[]): Promise<Manga> {
    const filtered = files
      .filter((f) => isImageFile(f.name))
      .sort((a, b) => naturalCompare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));

    if (filtered.length === 0) {
      throw new Error('No supported image files found in folder');
    }

    // Determine folder title from webkitRelativePath
    let folderName = 'Folder';
    const firstRel = files[0]?.webkitRelativePath;
    if (firstRel) {
      const parts = firstRel.split('/');
      if (parts.length > 1) {
        folderName = parts[0];
      }
    }

    return this.persistManga(folderName, filtered.map((f) => ({ name: f.name, blob: f })));
  }

  public async importCbz(file: File): Promise<Manga> {
    const title = file.name.replace(/\.[^/.]+$/, '');
    const zip = await JSZip.loadAsync(file);

    const entries: Array<{ name: string; zipEntry: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, zipEntry) => {
      const base = relativePath.split('/').pop() || '';
      if (
        !zipEntry.dir &&
        !base.startsWith('.') &&
        !relativePath.startsWith('__MACOSX') &&
        isImageFile(base)
      ) {
        entries.push({ name: relativePath, zipEntry });
      }
    });

    if (entries.length === 0) {
      throw new Error('No image files found in CBZ archive');
    }

    entries.sort((a, b) => naturalCompare(a.name, b.name));

    const pageBlobs: Array<{ name: string; blob: Blob }> = [];
    for (const item of entries) {
      const blob = await item.zipEntry.async('blob');
      pageBlobs.push({ name: item.name, blob });
    }

    return this.persistManga(title, pageBlobs);
  }

  public async importSample(): Promise<Manga> {
    const pages = await createSampleMangaPages();
    return this.persistManga('Cyber Ronin: Flow of the Void (Ch. 1)', pages);
  }

  private async persistManga(
    title: string,
    rawPages: Array<{ name: string; blob: Blob }>
  ): Promise<Manga> {
    const id = crypto.randomUUID ? crypto.randomUUID() : `manga_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const db = await getDb();

    // Generate cover thumbnail URL from first page
    const firstBlob = rawPages[0].blob;
    const coverUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(firstBlob);
    });

    const manga: Manga = {
      id,
      title,
      pageCount: rawPages.length,
      coverUrl,
      createdAt: Date.now(),
      progress: 0,
    };

    const tx = db.transaction(['mangas', 'pages'], 'readwrite');
    await tx.objectStore('mangas').put(manga);

    for (let i = 0; i < rawPages.length; i++) {
      const p = rawPages[i];
      const ratio = await getImageAspectRatio(p.blob);
      await tx.objectStore('pages').put({
        id: `${id}_${i}`,
        mangaId: id,
        index: i,
        name: p.name,
        blob: p.blob,
        aspectRatio: ratio,
      });
    }

    await tx.done;
    return manga;
  }
}

export const libraryRepository = LibraryRepository.getInstance();
