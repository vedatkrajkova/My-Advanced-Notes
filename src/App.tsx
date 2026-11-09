import { useEffect } from 'react';
import { AuthGate } from './auth/AuthGate';
import { getCurrentUser } from './db/repo';
import { startAutoSync } from './sync/engine';
import { startRealtime } from './sync/realtime';
import { supabase } from './sync/supabase';

function SyncRunner() {
  useEffect(() => {
    if (!supabase) return;
    const stopSync = startAutoSync();
    const stopRealtime = startRealtime(getCurrentUser());
    return () => {
      stopSync();
      stopRealtime();
    };
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthGate>
      <SyncRunner />
      <h1>Shënime dhe detyra</h1>
    </AuthGate>
  );
}
