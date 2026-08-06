import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { DOCUMENT_ENGINE_FONT_FAMILY } from './fonts.js';

const styles = StyleSheet.create({
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', paddingVertical: 2 },
  cell: { flexGrow: 1, flexBasis: 0, fontFamily: DOCUMENT_ENGINE_FONT_FAMILY, fontSize: 10 },
  headerCell: {
    flexGrow: 1,
    flexBasis: 0,
    fontFamily: DOCUMENT_ENGINE_FONT_FAMILY,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export type PaginatedTableColumn<TRow> = {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
  /** Fixed width in points; omitted columns share remaining space equally (flexGrow: 1). */
  width?: number;
};

export type PaginatedTableProps<TRow> = {
  columns: PaginatedTableColumn<TRow>[];
  rows: TRow[];
};

/**
 * Generic, reusable paginated-table helper (ADR-012 Decision item 4) -
 * closes the header-repeat gap the PDF-rendering comparison spike
 * identified. The header row is declared once and marked `fixed`; React PDF
 * re-renders it at the same position on every physical page the table body
 * wraps onto (verified by `PaginatedTable.test.tsx`'s multi-page regression
 * test, extracting text per page). Any future module rendering a
 * multi-page table (Invoices, Purchase Orders, ...) must use this component
 * through the Document Engine rather than re-solving pagination ad hoc.
 */
export function PaginatedTable<TRow>({ columns, rows }: PaginatedTableProps<TRow>) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow} fixed>
        {columns.map(column => (
          <Text
            key={column.key}
            style={
              column.width
                ? [styles.headerCell, { flexGrow: 0, flexBasis: column.width }]
                : styles.headerCell
            }
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={styles.row} wrap={false}>
          {columns.map(column => (
            <Text
              key={column.key}
              style={
                column.width ? [styles.cell, { flexGrow: 0, flexBasis: column.width }] : styles.cell
              }
            >
              {column.render(row)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
