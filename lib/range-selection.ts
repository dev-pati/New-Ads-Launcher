export function getRangeToggledIds(
  prevSelected: Set<string>,
  orderedIds: string[],
  clickedId: string,
  anchorId: string | null,
  shiftKey: boolean,
  ctrlKey: boolean
): {
  nextSelected: Set<string>;
  nextAnchorId: string | null;
} {
  const nextSelected = new Set(prevSelected);

  if (shiftKey && anchorId && anchorId !== clickedId) {
    const fromIndex = orderedIds.indexOf(anchorId);
    const toIndex = orderedIds.indexOf(clickedId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const range = orderedIds.slice(start, end + 1);

      for (const id of range) {
        if (ctrlKey) {
          nextSelected.delete(id);
        } else {
          nextSelected.add(id);
        }
      }
      return { nextSelected, nextAnchorId: anchorId };
    }
  }

  if (nextSelected.has(clickedId)) {
    nextSelected.delete(clickedId);
  } else {
    nextSelected.add(clickedId);
  }
  return { nextSelected, nextAnchorId: clickedId };
}
