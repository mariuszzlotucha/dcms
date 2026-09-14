import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from './providers';

describe('Providers', () => {
  it('renders its children', () => {
    render(
      <Providers>
        <span>child content</span>
      </Providers>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
