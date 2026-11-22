import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';
import { MemoryRouter } from 'react-router-dom';

describe('App shell', () => {
  it('renders the login page when not authenticated', () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('NexusFlow')).toBeInTheDocument();
  });
});
