import { render, screen, fireEvent } from '@testing-library/react';
import Page from './page';

describe('Goal Setting UI', () => {
  it('should allow user to set a goal', () => {
    render(<Page />);
    const input = screen.getByPlaceholderText(/e.g., find healthy cereal/i);
    const button = screen.getByRole('button', { name: /Set Goal/i });

    fireEvent.change(input, { target: { value: 'find gluten free options' } });
    fireEvent.click(button);

    expect(screen.getByText(/Goal: find gluten free options/i)).toBeInTheDocument();
  });
});
