export default function isArrayWithAtLeastOneElement<T>(
  something: T[],
): something is [T, ...T[]] {
  return something.length > 0;
}
