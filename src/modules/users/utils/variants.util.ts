export interface VariantSelection {
  name: string;
  value: string;
}

export function variantSelectionsMatch(
  a: VariantSelection[],
  b: VariantSelection[],
): boolean {
  if (a.length !== b.length) return false;
  const normalize = (variants: VariantSelection[]) =>
    [...variants]
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((v) => `${v.name}:${v.value}`);
  const left = normalize(a);
  const right = normalize(b);
  return left.every((entry, index) => entry === right[index]);
}
