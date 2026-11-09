import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGate } from './auth/AuthGate';
import { getCurrentUser } from './db/repo';
import { startAutoSync } from './sync/engine';
import { startRealtime } from './sync/realtime';
import { supabase } from './sync/supabase';
import { Shell } from './ui/Shell';

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
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/notes/:noteId?" element={<p>Shënime</p>} />
            <Route path="/tasks" element={<p>Detyra</p>} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}
