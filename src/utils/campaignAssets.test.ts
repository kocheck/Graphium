import { describe, it, expect } from 'vitest';

import { rewriteCampaignAssetSrcs } from './campaignAssets';

describe('rewriteCampaignAssetSrcs', () => {
  it('rewrites map, token, and thumbnail srcs in parallel', async () => {
    const campaign = {
      maps: {
        m1: {
          map: { src: 'file://map.webp' },
          tokens: [{ src: 'file://token.webp' }],
        },
      },
      tokenLibrary: [{ src: 'file://lib.webp', thumbnailSrc: 'file://thumb.webp' }],
    };

    await rewriteCampaignAssetSrcs(campaign, async (src) => src.replace('file://', 'assets/'));

    expect(campaign.maps.m1?.map?.src).toBe('assets/map.webp');
    expect(campaign.maps.m1?.tokens?.[0]?.src).toBe('assets/token.webp');
    expect(campaign.tokenLibrary[0]?.src).toBe('assets/lib.webp');
    expect(campaign.tokenLibrary[0]?.thumbnailSrc).toBe('assets/thumb.webp');
  });

  it('dedupes identical srcs so rewrite runs once', async () => {
    let calls = 0;
    const campaign = {
      maps: {
        m1: {
          tokens: [{ src: 'file://shared.webp' }, { src: 'file://shared.webp' }],
        },
      },
    };

    await rewriteCampaignAssetSrcs(campaign, async (src) => {
      calls += 1;
      return src.replace('file://', 'assets/');
    });

    expect(calls).toBe(1);
    expect(campaign.maps.m1?.tokens?.[0]?.src).toBe('assets/shared.webp');
    expect(campaign.maps.m1?.tokens?.[1]?.src).toBe('assets/shared.webp');
  });
});
