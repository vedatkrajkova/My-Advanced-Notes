import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthGate, type AuthApi } from '../../src/auth/AuthGate';
import { getCurrentUser } from '../../src/db/repo';

function fakeAuth(session: { userId: string } | null): AuthApi & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    getSession: async () => session,
    onChange: () => () => {},
    signIn: async (email) => { sent.push(email); },
  };
}

beforeEach(() => localStorage.clear());

test('without session shows the email form', async () => {
  render(<AuthGate auth={fakeAuth(null)}><p>brenda</p></AuthGate>);
  expect(await screen.findByRole('button', { name: 'Dërgo lidhjen e hyrjes' })).toBeInTheDocument();
  expect(screen.queryByText('brenda')).not.toBeInTheDocument();
});

test('with session renders children and sets current user', async () => {
  render(<AuthGate auth={fakeAuth({ userId: 'u-1' })}><p>brenda</p></AuthGate>);
  expect(await screen.findByText('brenda')).toBeInTheDocument();
  expect(getCurrentUser()).toBe('u-1');
});

test('submitting the email calls signIn and confirms', async () => {
  const auth = fakeAuth(null);
  render(<AuthGate auth={auth}><p>brenda</p></AuthGate>);
  await userEvent.type(await screen.findByLabelText('Email'), 'une@shembull.com');
  await userEvent.click(screen.getByRole('button', { name: 'Dërgo lidhjen e hyrjes' }));
  expect(auth.sent).toEqual(['une@shembull.com']);
  expect(await screen.findByText(/Kontrollo email-in/)).toBeInTheDocument();
});

test('empty email shows an error and does not send', async () => {
  const auth = fakeAuth(null);
  render(<AuthGate auth={auth}><p>brenda</p></AuthGate>);
  await userEvent.click(await screen.findByRole('button', { name: 'Dërgo lidhjen e hyrjes' }));
  expect(screen.getByText('Shkruaj email-in')).toBeInTheDocument();
  expect(auth.sent).toEqual([]);
});

test('offline with a remembered user opens the app without a session', async () => {
  localStorage.setItem('last_user_id', 'u-9');
  const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  render(<AuthGate auth={fakeAuth(null)}><p>brenda</p></AuthGate>);
  expect(await screen.findByText('brenda')).toBeInTheDocument();
  await waitFor(() => expect(getCurrentUser()).toBe('u-9'));
  spy.mockRestore();
});
