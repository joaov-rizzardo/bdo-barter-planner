import { isTauri } from '@tauri-apps/api/core';

/** Armazenamento chave-valor assíncrono usado para config e progresso. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

const ARQUIVO = 'bdo-barter.json';

/** tauri-plugin-store quando o app roda no Tauri. */
async function tauriStore(): Promise<KeyValueStore> {
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load(ARQUIVO, { autoSave: true });
  return {
    async get<T>(key: string) {
      return (await store.get<T>(key)) ?? null;
    },
    async set(key, value) {
      await store.set(key, value);
      await store.save();
    },
    async remove(key) {
      await store.delete(key);
      await store.save();
    },
  };
}

/** localStorage: usado no `npm run dev` fora do Tauri. */
function browserStore(): KeyValueStore {
  const chave = (key: string) => `bdo-barter:${key}`;
  return {
    async get<T>(key: string) {
      const bruto = localStorage.getItem(chave(key));
      return bruto === null ? null : (JSON.parse(bruto) as T);
    },
    async set(key, value) {
      localStorage.setItem(chave(key), JSON.stringify(value));
    },
    async remove(key) {
      localStorage.removeItem(chave(key));
    },
  };
}

let instancia: Promise<KeyValueStore> | null = null;

export function getStore(): Promise<KeyValueStore> {
  instancia ??= (async () => {
    if (isTauri()) {
      try {
        return await tauriStore();
      } catch (erro) {
        console.warn('tauri-plugin-store indisponível, usando localStorage:', erro);
      }
    }
    return browserStore();
  })();
  return instancia;
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return String(erro);
}
