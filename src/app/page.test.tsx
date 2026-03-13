import { render, screen } from '@testing-library/react'
import Page from './page'

describe('UI Shell', () => {
  it('renders the WorldLens main container', () => {
    render(<Page />)
    const heading = screen.getByRole('heading', { name: /WorldLens/i })
    expect(heading).toBeInTheDocument()
    
    // There should be a container for camera stream
    const cameraContainer = screen.getByTestId('camera-container')
    expect(cameraContainer).toBeInTheDocument()

    // There should be a status indicator
    const statusIndicator = screen.getByTestId('status-indicator')
    expect(statusIndicator).toBeInTheDocument()
  })
})