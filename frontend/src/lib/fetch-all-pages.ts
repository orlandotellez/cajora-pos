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
