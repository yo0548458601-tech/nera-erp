const NERA_ID_PREFIX = 'NERA-';
const NERA_ID_DIGITS = 8;

/**
 * Formats a sequence number into the permanent, human-visible Nera ID
 * (e.g. 154 -> "NERA-00000154"). The sequence is expected to come from a
 * database-generated, gap-tolerant counter in the future (never reused,
 * never derived from a name/ID-number/registration-number). In demo mode
 * the sequence is just a deterministic in-memory counter - see
 * createDemoNeraIdSequence.
 */
export function formatNeraId(sequence: number): string {
  return `${NERA_ID_PREFIX}${String(sequence).padStart(NERA_ID_DIGITS, '0')}`;
}

/**
 * A small deterministic sequence generator for demo data and the in-memory
 * demo session. Starting at a non-trivial offset so demo IDs don't read as
 * obviously synthetic (NERA-00000001, 2, 3, ...) - this has no bearing on
 * the real future sequencing, which will be database-generated.
 */
export function createDemoNeraIdSequence(startAt = 100) {
  let current = startAt;
  return {
    next(): string {
      const id = formatNeraId(current);
      current += 1;
      return id;
    },
  };
}

/**
 * Extracts the numeric sequence from a full permanent Nera ID (e.g.
 * "NERA-00000108" -> 108), for use ONLY by export resolvers (e.g. the
 * XLSX "מזהה Nera" numeric column) that need a plain number for correct
 * spreadsheet sorting/filtering. This never mutates or replaces the stored
 * id - the full "NERA-00000108" form remains the only identifier used
 * anywhere inside the application itself.
 */
export function getNeraIdSequenceNumber(neraId: string): number {
  const digits = neraId.replace(/^\D+/, '');
  return Number(digits);
}
