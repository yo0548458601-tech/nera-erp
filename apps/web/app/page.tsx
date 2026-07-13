import { AuthGate } from '../src/components/AuthGate';
import { isDemoModeEnabled } from '../src/lib/auth/demoAuth';

export default function HomePage() {
  return <AuthGate demoModeEnabled={isDemoModeEnabled()} />;
}
