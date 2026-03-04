export function useState(initialValue: unknown): [unknown, (value: unknown) => void] {
  // TODO: implement hook dispatcher for function components.
  return [initialValue, () => {}];
}
