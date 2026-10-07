import { AppSettings, DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'mangaflow_settings';
const PROGRESS_PREFIX = 'mangaflow_progress_';

export class SettingsRepository {
  private static instance: SettingsRepository;
  private currentSettings: AppSettings;
  private listeners = new Set<(settings: AppSettings) => void>();

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  private constructor() {
    this.currentSettings = this.loadFromStorage();
  }

  private loadFromStorage(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Failed to parse settings from storage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public get settings(): AppSettings {
    return this.currentSettings;
  }

  public subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentSettings);
    return () => this.listeners.delete(listener);
  }

  public update(transform: (prev: AppSettings) => AppSettings): void {
    const updated = transform(this.currentSettings);
    this.currentSettings = updated;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    this.listeners.forEach((fn) => fn(updated));
  }

  public reset(): void {
    this.update(() => ({ ...DEFAULT_SETTINGS }));
  }

  public getProgress(mangaId: string): number {
    try {
      const v = localStorage.getItem(`${PROGRESS_PREFIX}${mangaId}`);
      if (v !== null) {
        const n = parseInt(v, 10);
        return isNaN(n) ? 0 : Math.max(0, n);
      }
    } catch (e) {
      console.warn('Failed to get progress:', e);
    }
    return 0;
  }

  public setProgress(mangaId: string, page: number): void {
    try {
      localStorage.setItem(`${PROGRESS_PREFIX}${mangaId}`, String(page));
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }
}

export const settingsRepository = SettingsRepository.getInstance();
