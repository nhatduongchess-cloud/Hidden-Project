/**
 * Offer a generated file to the user.
 * Inside a claude.ai Artifact the page uses the platform `downloads` capability (the viewer confirms each save).
 * Run locally, it falls back to a normal browser download.
 */
type DownloadsNs = { save(r: { filename: string; data: string | Blob }): Promise<{ status: string }> };
type ClaudeWin = { claude?: { use?: (n: string) => Promise<unknown> } };

export function inArtifactFrame(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as ClaudeWin).claude?.use === 'function';
}

export async function saveFile(filename: string, data: string, mime: string): Promise<'saved' | 'declined' | 'unavailable'> {
  const w = window as unknown as ClaudeWin;
  if (w.claude?.use) {
    try {
      const dl = (await w.claude.use('downloads')) as DownloadsNs | null;
      if (!dl) return 'unavailable';
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return code === 'declined' ? 'declined' : 'unavailable';
    }
  }
  try {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

/** window.print() is ignored inside an artifact frame, so the UI only offers it when run as a normal site. */
export function canPrint(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function' && !inArtifactFrame();
}
