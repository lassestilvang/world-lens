import { render, screen } from '@testing-library/react';
import DebugPanel from './DebugPanel';

describe('DebugPanel', () => {
  it('should render the panel when visible', () => {
    render(<DebugPanel visible={true} />);
    expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
  });

  it('should show "Grounded" badge when grounded property is true', () => {
    render(<DebugPanel visible={true} grounded={true} />);
    expect(screen.getByText(/Grounded/i)).toBeInTheDocument();
    expect(screen.getByText(/Grounded/i)).toHaveClass('bg-green-500/20');
  });

  it('should show "Not Grounded" badge when grounded property is false', () => {
    render(<DebugPanel visible={true} grounded={false} />);
    expect(screen.getByText(/Not Grounded/i)).toBeInTheDocument();
    expect(screen.getByText(/Not Grounded/i)).toHaveClass('bg-amber-500/20');
  });
});
