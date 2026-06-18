// ─── Provider abstraction ─────────────────────────────────────────────────────
// To add a new provider (e.g. remove.bg API):
// 1. Implement RemovalProvider
// 2. Export it and swap `activeProvider` below
// ─────────────────────────────────────────────────────────────────────────────

export interface RemovalProvider {
  readonly name: string;
  /** Returns a PNG Blob with the background removed (transparent). */
  remove(
    image: File | Blob,
    onProgress: (pct: number, stage: string) => void,
  ): Promise<Blob>;
}

// ─── IMG.LY provider (client-side WASM, no API key) ──────────────────────────

const imglyProvider: RemovalProvider = {
  name: "@imgly/background-removal",

  async remove(image, onProgress) {
    // Dynamic import keeps this out of the SSR bundle
    const { removeBackground } = await import("@imgly/background-removal");

    return removeBackground(image, {
      model: "isnet",
      output: { format: "image/png" },
      progress(key: string, current: number, total: number) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        const stage = key.includes("fetch") ? "Downloading model…" : "Processing image…";
        onProgress(pct, stage);
      },
    });
  },
};

// ─── Active provider ──────────────────────────────────────────────────────────
// Swap this export to change the provider globally.
export const activeProvider: RemovalProvider = imglyProvider;
