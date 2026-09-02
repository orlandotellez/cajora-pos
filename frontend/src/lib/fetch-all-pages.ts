export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let total = Infinity;
  while ((page - 1) * pageSize < total) {
    const res = await fetchPage(page, pageSize);
    all.push(...res.items);
    total = res.total;
    if (res.items.length === 0) break;
    page += 1;
  }
  return all;
}

export async function fetchFirstPage<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 50,
): Promise<{ items: T[]; total: number }> {
  return fetchPage(1, pageSize);
}

export async function fetchPageFrom<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  alreadyLoaded: number,
  pageSize = 50,
): Promise<{ items: T[]; total: number }> {
  const page = Math.floor(alreadyLoaded / pageSize) + 1;
  const res = await fetchPage(page, pageSize);
  return { items: res.items, total: res.total };
}
