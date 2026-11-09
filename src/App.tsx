import { AuthGate } from './auth/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <h1>Shënime dhe detyra</h1>
    </AuthGate>
  );
}
