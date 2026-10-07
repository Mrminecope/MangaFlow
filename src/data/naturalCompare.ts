/**
 * Compares strings treating digit runs as numbers: "p2" < "p10".
 * Faithful port of com.mangaflow.data.LibraryRepository.naturalCompare.
 */
export function naturalCompare(a: string, b: string): number {
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const ca = a[i];
    const cb = b[j];

    const isDigitA = ca >= '0' && ca <= '9';
    const isDigitB = cb >= '0' && cb <= '9';

    if (isDigitA && isDigitB) {
      let ei = i;
      while (ei < a.length && a[ei] >= '0' && a[ei] <= '9') ei++;
      let ej = j;
      while (ej < b.length && b[ej] >= '0' && b[ej] <= '9') ej++;

      const na = a.substring(i, ei).replace(/^0+/, '') || '0';
      const nb = b.substring(j, ej).replace(/^0+/, '') || '0';

      if (na.length !== nb.length) {
        return na.length - nb.length;
      }
      if (na !== nb) {
        return na.localeCompare(nb);
      }
      i = ei;
      j = ej;
    } else {
      const diff = ca.toLowerCase().localeCompare(cb.toLowerCase());
      if (diff !== 0) return diff;
      i++;
      j++;
    }
  }

  return (a.length - i) - (b.length - j);
}
