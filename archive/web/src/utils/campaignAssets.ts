type QueueRewrite = (current: string, set: (next: string) => void) => void;

function queueCampaignMapAssets(campaign: CampaignAssetHost, queueRewrite: QueueRewrite): void {
  if (!campaign.maps) {
    return;
  }
  for (const map of Object.values(campaign.maps)) {
    if (!map) {
      continue;
    }
    const background = map.map;
    const backgroundSrc = background?.src;
    if (background && backgroundSrc) {
      queueRewrite(backgroundSrc, (next) => {
        background.src = next;
      });
    }
    if (map.tokens) {
      for (const token of map.tokens) {
        queueRewrite(token.src, (next) => {
          token.src = next;
        });
      }
    }
  }
}

function queueTokenLibraryAssets(
  campaign: CampaignAssetHost,
  includeThumbnails: boolean,
  queueRewrite: QueueRewrite,
): void {
  if (!campaign.tokenLibrary) {
    return;
  }
  for (const item of campaign.tokenLibrary) {
    queueRewrite(item.src, (next) => {
      item.src = next;
    });
    if (includeThumbnails && item.thumbnailSrc) {
      queueRewrite(item.thumbnailSrc, (next) => {
        item.thumbnailSrc = next;
      });
    }
  }
}

function queueSessionConsoleAssets(
  campaign: CampaignAssetHost,
  includeThumbnails: boolean,
  queueRewrite: QueueRewrite,
): void {
  const sessionConsole = campaign.sessionConsole;
  if (!sessionConsole) {
    return;
  }
  queueSessionConsolePlates(sessionConsole, includeThumbnails, queueRewrite);
  queueSessionConsoleAudio(sessionConsole, queueRewrite);
}

function queueSessionConsolePlates(
  sessionConsole: NonNullable<CampaignAssetHost['sessionConsole']>,
  includeThumbnails: boolean,
  queueRewrite: QueueRewrite,
): void {
  for (const imageSet of sessionConsole.imageSets ?? []) {
    for (const image of imageSet.images ?? []) {
      if (image.src) {
        queueRewrite(image.src, (next) => {
          image.src = next;
        });
      }
      if (includeThumbnails && image.thumbnailSrc) {
        queueRewrite(image.thumbnailSrc, (next) => {
          image.thumbnailSrc = next;
        });
      }
    }
  }
}

function queueSessionConsoleAudio(
  sessionConsole: NonNullable<CampaignAssetHost['sessionConsole']>,
  queueRewrite: QueueRewrite,
): void {
  for (const group of sessionConsole.trackGroups ?? []) {
    for (const track of group.tracks ?? []) {
      if (track.source === 'local' && track.src) {
        queueRewrite(track.src, (next) => {
          track.src = next;
        });
      }
    }
  }
  for (const sfx of sessionConsole.sfx ?? []) {
    if (sfx.kind === 'local' && sfx.src) {
      queueRewrite(sfx.src, (next) => {
        sfx.src = next;
      });
    }
  }
}

const DEFAULT_ASSET_IO_CONCURRENCY = 8;

interface CampaignAssetHost {
  maps?: Record<
    string,
    {
      map?: { src?: string | null } | null;
      tokens?: Array<{ src: string }>;
    }
  >;
  tokenLibrary?: Array<{ src: string; thumbnailSrc?: string }>;
  sessionConsole?: {
    imageSets?: Array<{
      images?: Array<{ src?: string; thumbnailSrc?: string }>;
    }>;
    trackGroups?: Array<{
      tracks?: Array<{ source: 'youtube' | 'local'; src?: string }>;
    }>;
    sfx?: Array<{ kind: 'synth' | 'local'; src?: string }>;
  };
}

export async function runWithConcurrency(
  jobs: Array<() => Promise<void>>,
  concurrency = DEFAULT_ASSET_IO_CONCURRENCY,
): Promise<void> {
  if (jobs.length === 0) {
    return;
  }

  let nextIndex = 0;
  const workerCount = Math.min(concurrency, jobs.length);

  const worker = async (): Promise<void> => {
    while (nextIndex < jobs.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const job = jobs[currentIndex];
      if (job) {
        await job();
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * Rewrites every campaign asset `src` (and optional thumbnails) via `rewrite`.
 * Jobs run in parallel with a concurrency limit, and identical srcs share one rewrite.
 */
export async function rewriteCampaignAssetSrcs(
  campaign: CampaignAssetHost,
  rewrite: (src: string) => Promise<string>,
  options: { includeThumbnails?: boolean } = {},
): Promise<void> {
  const includeThumbnails = options.includeThumbnails ?? true;
  const jobs: Array<() => Promise<void>> = [];
  const inflight = new Map<string, Promise<string>>();

  const rewriteOnce = (src: string): Promise<string> => {
    const existing = inflight.get(src);
    if (existing) {
      return existing;
    }
    const promise = rewrite(src);
    inflight.set(src, promise);
    return promise;
  };

  const queueRewrite = (current: string, set: (next: string) => void): void => {
    jobs.push(async () => {
      set(await rewriteOnce(current));
    });
  };

  queueCampaignMapAssets(campaign, queueRewrite);
  queueTokenLibraryAssets(campaign, includeThumbnails, queueRewrite);
  queueSessionConsoleAssets(campaign, includeThumbnails, queueRewrite);

  await runWithConcurrency(jobs);
}
