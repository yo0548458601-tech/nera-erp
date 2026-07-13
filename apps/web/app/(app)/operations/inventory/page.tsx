import { ModulePlaceholderPage } from '@/src/components/shell/ModulePlaceholderPage';

export default function InventoryPage() {
  return (
    <ModulePlaceholderPage
      description="ניהול מלאי, מוצרים ומעקב זמינות."
      capabilities={['כרטיס מוצר', 'מעקב כמות זמינה', 'התראות מלאי נמוך', 'תנועות מלאי']}
    />
  );
}
