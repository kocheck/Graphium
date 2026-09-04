import type { Token } from '../store/gameStore';

export function buildTokenIndex(tokens: Token[]): Record<string, Token> {
  const tokensById: Record<string, Token> = {};
  for (const token of tokens) {
    tokensById[token.id] = token;
  }
  return tokensById;
}

export function withTokenIndex(tokens: Token[]): {
  tokens: Token[];
  tokensById: Record<string, Token>;
  tokenIds: string[];
} {
  return {
    tokens,
    tokensById: buildTokenIndex(tokens),
    tokenIds: tokens.map((token) => token.id),
  };
}

export function patchTokenInIndex(
  tokens: Token[],
  tokensById: Record<string, Token>,
  id: string,
  changes: Partial<Token>,
): { tokens: Token[]; tokensById: Record<string, Token> } | null {
  const previous = tokensById[id];
  if (!previous) {
    return null;
  }
  const next = { ...previous, ...changes };
  return {
    tokens: tokens.map((token) => (token.id === id ? next : token)),
    tokensById: { ...tokensById, [id]: next },
  };
}

export function patchTokenPositions(
  tokens: Token[],
  tokensById: Record<string, Token>,
  updates: Array<{ id: string; x: number; y: number }>,
): { tokens: Token[]; tokensById: Record<string, Token> } | null {
  if (updates.length === 0) {
    return null;
  }
  if (updates.length === 1) {
    const update = updates[0];
    return update
      ? patchTokenInIndex(tokens, tokensById, update.id, { x: update.x, y: update.y })
      : null;
  }

  const byId = new Map(updates.map((update) => [update.id, update]));
  let changed = false;
  const nextById = { ...tokensById };
  const nextTokens = tokens.map((token) => {
    const update = byId.get(token.id);
    if (!update || (token.x === update.x && token.y === update.y)) {
      return token;
    }
    changed = true;
    const next = { ...token, x: update.x, y: update.y };
    nextById[token.id] = next;
    return next;
  });
  return changed ? { tokens: nextTokens, tokensById: nextById } : null;
}
