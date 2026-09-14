import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('renders', () => {
    render(<DashboardPage />);
    expect(screen.getByText('DCMS')).toBeInTheDocument();
  });
});
