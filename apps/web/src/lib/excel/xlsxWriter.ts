import { toCalendarDateUTC } from '@nera/calendar-engine';
import { type ExcelColumnContract } from '@nera/customization-engine';

/**
 * The one reusable workbook-export implementation for the whole platform -
 * every module's export (Contacts today, Suppliers/Donors/... tomorrow)
 * calls buildXlsxWorkbookBuffer with its own ExcelColumnContract[] and
 * records; nothing here is contacts-specific. exceljs is dynamically
 * imported so it only loads into the client bundle when an export is
 * actually triggered.
 */
export type XlsxExportOptions<TRecord> = {
  sheetName: string;
  columns: ExcelColumnContract<TRecord>[];
  records: TRecord[];
};

/** Excel worksheet names: max 31 chars, and none of \ / ? * [ ] : may appear. */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'גיליון1').slice(0, 31);
}

/** Windows-invalid filename characters removed; the extension is always .xlsx. */
export function buildExportFileName(organizationName: string, categoryLabel: string): string {
  const raw = `${organizationName} - ${categoryLabel}`;
  const sanitized = raw.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${sanitized || 'ייצוא'}.xlsx`;
}

function resolveCellValue<TRecord>(record: TRecord, column: ExcelColumnContract<TRecord>): unknown {
  const raw = column.resolveValue(record);

  if (column.cellType === 'date') {
    return typeof raw === 'string' && raw ? toCalendarDateUTC(raw) : null;
  }
  if (column.cellType === 'number') {
    if (typeof raw === 'number') {
      return raw;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return column.format(raw);
}

/**
 * Builds a real .xlsx workbook (as an ArrayBuffer, ready for a Blob
 * download) from an ExcelColumnContract[] + records - real worksheets,
 * typed cells (string/number/date), a bold header row, an autofilter on
 * the header row, a frozen header row, sensible column widths, and
 * DD/MM/YYYY date number formats. RTL sheet orientation is applied where
 * the exceljs/Excel view model supports it.
 */
export async function buildXlsxWorkbookBuffer<TRecord>(
  options: XlsxExportOptions<TRecord>
): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeSheetName(options.sheetName), {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });

  const enabledColumns = options.columns.filter(column => column.exportEnabled);

  sheet.columns = enabledColumns.map(column => ({
    header: column.hebrewHeader,
    key: column.columnKey,
    width: Math.max(column.hebrewHeader.length + 4, 14),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'right' };

  for (const record of options.records) {
    const rowValues: Record<string, unknown> = {};
    for (const column of enabledColumns) {
      rowValues[column.columnKey] = resolveCellValue(record, column);
    }
    sheet.addRow(rowValues);
  }

  enabledColumns.forEach((column, index) => {
    if (column.cellType === 'date') {
      sheet.getColumn(index + 1).numFmt = column.numberFormat ?? 'DD/MM/YYYY';
    }
    if (column.cellType === 'number') {
      sheet.getColumn(index + 1).numFmt = column.numberFormat ?? '0';
    }
    sheet.getColumn(index + 1).alignment = { horizontal: 'right' };
  });

  if (enabledColumns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: enabledColumns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
