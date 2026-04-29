import { revalidateTag } from 'next/cache';

export function invalidateTags(tags: ReadonlyArray<string>): void {
  for (const tag of tags) revalidateTag(tag, 'max');
}
