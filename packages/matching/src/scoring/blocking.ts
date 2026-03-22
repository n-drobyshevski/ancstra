/**
 * Normalise a surname for blocking keys: lowercase, strip non-alpha
 * characters, remove diacritics.
 */
function normaliseSurname(surname: string): string {
  return surname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // keep only alpha
}

/**
 * Extract the birth decade string (first 3 digits of the year) from
 * a YYYYMMDD dateSort integer.
 */
function birthDecade(dateSort: number): string {
  const year = Math.floor(dateSort / 10000);
  return String(year).slice(0, 3);
}

/**
 * Generate a blocking key from surname + birth decade.
 *
 * Format: `{normalisedSurname}_{decade}`
 * e.g. "smith_185" for Smith born in the 1850s.
 * Null birth date uses "???" as the decade placeholder.
 */
export function generateBlockingKey(
  surname: string,
  birthDateSort: number | null,
): string {
  const normSurname = normaliseSurname(surname);
  const decade = birthDateSort != null ? birthDecade(birthDateSort) : '???';
  return `${normSurname}_${decade}`;
}

/**
 * Find all candidate blocking keys that should be searched for a
 * given person. Returns the primary key plus adjacent decades
 * (decade-1, decade+1) to catch boundary cases.
 *
 * Null birth date returns a single wildcard block.
 */
export function findCandidateBlocks(
  surname: string,
  birthDateSort: number | null,
): string[] {
  const normSurname = normaliseSurname(surname);

  if (birthDateSort == null) {
    return [`${normSurname}_???`];
  }

  const decade = Number(birthDecade(birthDateSort));
  return [
    `${normSurname}_${decade - 1}`,
    `${normSurname}_${decade}`,
    `${normSurname}_${decade + 1}`,
  ];
}
