import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders app title', async () => {
  render(<App />);
  expect(await screen.findByText('Shënime dhe detyra')).toBeInTheDocument();
});
