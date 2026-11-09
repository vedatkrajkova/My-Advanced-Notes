import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { setCurrentUser } from '../db/repo';
import { supabase } from '../sync/supabase';

export interface AuthApi {
  getSession(): Promise<{ userId: string } | null>;
  onChange(cb: (s: { userId: string } | null) => void): () => void;
  signIn(email: string): Promise<void>;
}

const LAST_USER_KEY = 'last_user_id';
export const LOCAL_USER_ID = 'local';

export const supabaseAuth: AuthApi = {
  async getSession() {
    // Pa Supabase të konfiguruar aplikacioni punon vetëm lokalisht, pa sinkronizim.
    if (!supabase) return { userId: LOCAL_USER_ID };
    const { data } = await supabase.auth.getSession();
    return data.session ? { userId: data.session.user.id } : null;
  },
  onChange(cb) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s ? { userId: s.user.id } : null));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email) {
    if (!supabase) throw new Error('Supabase nuk është konfiguruar');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  },
};

function rememberedUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function AuthGate({ children, auth = supabaseAuth }: { children: ReactNode; auth?: AuthApi }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const apply = (s: { userId: string } | null) => {
      let id = s?.userId ?? null;
      if (!id && !navigator.onLine) id = rememberedUser();
      if (id) {
        setCurrentUser(id);
        try {
          localStorage.setItem(LAST_USER_KEY, id);
        } catch {
          /* ruajtja lokale mund të mungojë */
        }
      }
      setUserId(id);
    };
    auth.getSession().then(apply, () => apply(null));
    return auth.onChange(apply);
  }, [auth]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Shkruaj email-in');
      return;
    }
    setError('');
    try {
      await auth.signIn(value);
      setSent(true);
    } catch {
      setError('Lidhja nuk u dërgua. Provo përsëri.');
    }
  }

  if (userId === undefined) return null;
  if (userId) return <>{children}</>;

  return (
    <main className="auth">
      <h1>Shënime dhe detyra</h1>
      {sent ? (
        <p>Kontrollo email-in dhe hap lidhjen për të hyrë.</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            placeholder="emri@shembull.com"
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Dërgo lidhjen e hyrjes</button>
        </form>
      )}
    </main>
  );
}
