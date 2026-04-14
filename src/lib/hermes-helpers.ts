export function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = rawLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const rawValue = rawLine.slice(separatorIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (key) {
      values[key] = unquoted;
    }
  }

  return values;
}

export function applyEnvUpdates(
  content: string,
  updates: Record<string, string | null | undefined>,
): string {
  const lines = content ? content.split(/\r?\n/) : [];
  const lineIndexes = new Map<string, number>();

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (key) {
      lineIndexes.set(key, index);
    }
  });

  const nextLines = [...lines];

  for (const [key, value] of Object.entries(updates)) {
    const existingIndex = lineIndexes.get(key);
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!normalized) {
      if (existingIndex !== undefined) {
        nextLines.splice(existingIndex, 1);
        lineIndexes.delete(key);

        for (const [trackedKey, trackedIndex] of lineIndexes.entries()) {
          if (trackedIndex > existingIndex) {
            lineIndexes.set(trackedKey, trackedIndex - 1);
          }
        }
      }
      continue;
    }

    const rendered = `${key}=${normalized}`;
    if (existingIndex !== undefined) {
      nextLines[existingIndex] = rendered;
    } else {
      nextLines.push(rendered);
      lineIndexes.set(key, nextLines.length - 1);
    }
  }

  while (nextLines.length > 0 && !nextLines[nextLines.length - 1]?.trim()) {
    nextLines.pop();
  }

  return nextLines.join('\n');
}

export function splitCsv(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatAbsoluteDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? '后' : '前';

  if (absMs < 60_000) {
    return `1分钟${suffix}`;
  }

  if (absMs < 3_600_000) {
    return `${Math.round(absMs / 60_000)}分钟${suffix}`;
  }

  if (absMs < 86_400_000) {
    return `${Math.round(absMs / 3_600_000)}小时${suffix}`;
  }

  return `${Math.round(absMs / 86_400_000)}天${suffix}`;
}

export function sentenceCaseState(value: string | null | undefined): string {
  if (!value) {
    return '未知';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
