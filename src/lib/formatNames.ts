/** How a format is shown to people; the ratio stays the value stored and sent to the server. */
const FORMAT_NAMES: Record<string, string> = { '1.91:1': '1200×628' };

export const formatName = (format: string) => FORMAT_NAMES[format] ?? format;
