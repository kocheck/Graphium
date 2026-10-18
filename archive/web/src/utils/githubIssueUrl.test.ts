import { describe, it, expect } from 'vitest';

import { buildGitHubIssueUrl } from './githubIssueUrl';

describe('buildGitHubIssueUrl', () => {
  it('builds a GitHub new-issue URL with title and body', () => {
    const url = buildGitHubIssueUrl('Bug Report: Error', 'details here');
    expect(url).toContain('https://github.com/kocheck/Graphium/issues/new');
    expect(url).toContain('title=Bug%20Report%3A%20Error');
    expect(url).toContain('body=details%20here');
  });

  it('truncates long titles', () => {
    const longTitle = `Bug Report: ${'x'.repeat(300)}`;
    const url = buildGitHubIssueUrl(longTitle, 'body');
    const titleParam = new URL(url).searchParams.get('title') ?? '';
    expect(titleParam.length).toBeLessThanOrEqual(200);
    expect(titleParam.endsWith('…')).toBe(true);
  });

  it('keeps the URL under the browser length limit', () => {
    const hugeBody = 'a'.repeat(5000);
    const url = buildGitHubIssueUrl('Bug Report: Error', hugeBody);
    expect(url.length).toBeLessThanOrEqual(2000);
  });
});
