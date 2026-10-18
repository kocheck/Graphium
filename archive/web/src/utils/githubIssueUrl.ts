const GITHUB_NEW_ISSUE_URL = 'https://github.com/kocheck/Graphium/issues/new';
const MAX_GITHUB_URL_LENGTH = 2000;
const MAX_ISSUE_TITLE_LENGTH = 200;
const TITLE_ELLIPSIS_MARGIN = 10;

function truncateTitle(title: string): string {
  if (title.length <= MAX_ISSUE_TITLE_LENGTH) {
    return title;
  }
  return `${title.slice(0, MAX_ISSUE_TITLE_LENGTH - TITLE_ELLIPSIS_MARGIN)}…`;
}

function truncateEncodedBody(baseWithTitle: string, bodyPrefix: string, body: string): string {
  const allowedBodyLength = MAX_GITHUB_URL_LENGTH - (baseWithTitle.length + bodyPrefix.length);
  if (allowedBodyLength <= 0) {
    return baseWithTitle;
  }

  let currentLength = 0;
  const encodedChunks: string[] = [];
  for (const char of body) {
    const encodedChar = encodeURIComponent(char);
    if (currentLength + encodedChar.length > allowedBodyLength) {
      break;
    }
    encodedChunks.push(encodedChar);
    currentLength += encodedChar.length;
  }
  return `${baseWithTitle}${bodyPrefix}${encodedChunks.join('')}`;
}

/** Builds a GitHub new-issue URL, truncating title and body to stay under browser URL limits. */
export function buildGitHubIssueUrl(title: string, body: string): string {
  const issueTitle = truncateTitle(title);
  const baseWithTitle = `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(issueTitle)}`;
  const bodyPrefix = '&body=';
  const fullUrl = `${baseWithTitle}${bodyPrefix}${encodeURIComponent(body)}`;

  if (fullUrl.length <= MAX_GITHUB_URL_LENGTH) {
    return fullUrl;
  }

  return truncateEncodedBody(baseWithTitle, bodyPrefix, body);
}
