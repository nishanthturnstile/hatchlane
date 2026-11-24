export function archiveRange(size: number, header?: string) {
  const common = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };
  if (!header)
    return {
      status: 200,
      start: 0,
      end: size - 1,
      headers: {
        ...common,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
      },
    } as const;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  const first = match?.[1];
  const last = match?.[2];
  const start = first ? Number(first) : Math.max(0, size - Number(last));
  const end = first && last ? Math.min(Number(last), size - 1) : size - 1;
  if (
    !match ||
    (!first && !last) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    start > end
  ) {
    return {
      status: 416,
      headers: { ...common, "Content-Range": `bytes */${size}` },
    } as const;
  }

  return {
    status: 206,
    start,
    end,
    headers: {
      ...common,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  } as const;
}
