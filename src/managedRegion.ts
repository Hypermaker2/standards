const BEGIN_RE = /<!-- standards:begin ([^\s]+) ([^\s]+) -->/;
const END_MARKER = '<!-- standards:end -->';

export type ManagedRegion = {
  version: string;
  profile: string;
  body: string;
  start: number;
  end: number;
};

export function beginMarker(version: string, profile: string): string {
  return `<!-- standards:begin ${version} ${profile} -->`;
}

export function endMarker(): string {
  return END_MARKER;
}

export function findManagedRegion(text: string): ManagedRegion | null {
  const beginMatch = BEGIN_RE.exec(text);
  if (!beginMatch) return null;
  const beginIndex = beginMatch.index;
  const afterBegin = beginIndex + beginMatch[0].length;
  const endIndex = text.indexOf(END_MARKER, afterBegin);
  if (endIndex === -1) {
    throw new Error('standards:begin found without standards:end');
  }
  const body = text.slice(afterBegin, endIndex).replace(/^\n/, '').replace(/\n$/, '');
  return {
    version: beginMatch[1],
    profile: beginMatch[2],
    body,
    start: beginIndex,
    end: endIndex + END_MARKER.length,
  };
}

export function buildManagedBlock(version: string, profile: string, body: string): string {
  const normalized = body.replace(/\n$/, '');
  return `${beginMarker(version, profile)}\n${normalized}\n${endMarker()}`;
}

export function applyManagedRegion(
  text: string,
  version: string,
  profile: string,
  body: string
): string {
  const block = buildManagedBlock(version, profile, body);
  const existing = findManagedRegion(text);
  if (existing) {
    return text.slice(0, existing.start) + block + text.slice(existing.end);
  }
  const titleMatch = /^# .+\n/.exec(text);
  if (titleMatch) {
    const insertAt = titleMatch[0].length;
    const afterTitle = text.slice(insertAt);
    const spacer = afterTitle.startsWith('\n') ? '' : '\n';
    return text.slice(0, insertAt) + spacer + block + '\n' + afterTitle.replace(/^\n*/, '');
  }
  return block + (text.length > 0 ? `\n${text}` : '\n');
}

export function expectedAgentsBody(baseMd: string, profileMd: string): string {
  return `${baseMd.replace(/\n$/, '')}\n\n${profileMd.replace(/\n$/, '')}`;
}
