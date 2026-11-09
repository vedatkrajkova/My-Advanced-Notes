import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders app title', () => {
  render(<App />);
  expect(screen.getByText('Shënime dhe detyra')).toBeInTheDocument();
});
