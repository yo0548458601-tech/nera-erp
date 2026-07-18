/**
 * Shared Excel import/export column contract. There is exactly one such
 * contract shape for the whole platform - built-in fields (e.g. a
 * person's Hebrew birth date) and administrator-defined custom fields both
 * produce ExcelColumnContract values, so no module ever grows its own
 * separate Excel system. The contract itself is environment/library
 * agnostic (`format` always produces a plain string, e.g. for CSV or a
 * text fallback); a real typed-cell writer (see apps/web's xlsx writer)
 * additionally reads `cellType`/`numberFormat` to produce a real Excel
 * date/number cell instead of a formatted string, without needing a
 * second, parallel column definition.
 */
export type ExcelCellType = 'string' | 'number' | 'date';

export type ExcelColumnContract<TRecord> = {
  /** Stable English column identifier (matches a CustomFieldDefinition.key for custom-field columns). */
  columnKey: string;
  /** Hebrew column header shown in the exported file. */
  hebrewHeader: string;
  /** Reads the raw value for this column off one record. */
  resolveValue: (record: TRecord) => unknown;
  /** Formats the raw value into the exact string written to the Excel cell (used for CSV/plain-text export and as a display fallback). */
  format: (rawValue: unknown) => string;
  /** What kind of real Excel cell this column should become in a typed-cell writer. Defaults to 'string' when omitted. */
  cellType?: ExcelCellType;
  /** Excel number/date format string (e.g. 'DD/MM/YYYY') applied when cellType is 'date' or 'number'. */
  numberFormat?: string;
  /** Parses one imported cell's text back into a value; absent if the column is export-only. */
  parseImport?: (cellText: string) => { value: unknown; error?: string };
  /** Validates a parsed import value beyond basic parsing (e.g. required-ness, range); absent if not needed. */
  validateImport?: (value: unknown) => string[];
  /** Permission id required to use this column at all (view for export, edit for import). */
  requiredPermission?: string;
  exportEnabled: boolean;
  importEnabled: boolean;
};

/** Runs export column resolution + formatting across a list of records - the shared pipeline every module reuses instead of writing its own. */
export function buildExcelExportRows<TRecord>(records: TRecord[], columns: ExcelColumnContract<TRecord>[]): string[][] {
  const enabledColumns = columns.filter((column) => column.exportEnabled);
  const header = enabledColumns.map((column) => column.hebrewHeader);
  const rows = records.map((record) => enabledColumns.map((column) => column.format(column.resolveValue(record))));
  return [header, ...rows];
}
