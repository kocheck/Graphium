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
} {
  return { tokens, tokensById: buildTokenIndex(tokens) };
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
