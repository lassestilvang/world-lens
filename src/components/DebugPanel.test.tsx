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

  it('should render memory JSON when provided', () => {
    const mockMemory = {
      environment: 'grocery store cereal aisle',
      objects_seen: ['Cheerios', 'Frosted Flakes'],
      user_goal: 'find healthy cereal'
    };
    render(<DebugPanel visible={true} memory={mockMemory} />);
    
    const jsonString = JSON.stringify(mockMemory, null, 2);
    expect(screen.getByText(new RegExp('grocery store cereal aisle'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp('Cheerios'))).toBeInTheDocument();
  });
});
