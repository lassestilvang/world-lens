import { render, screen, waitFor } from '@testing-library/react'
import CameraStream from './CameraStream'

describe('CameraStream', () => {
  let mockGetUserMedia: jest.Mock

  beforeEach(() => {
    mockGetUserMedia = jest.fn().mockResolvedValue({
      getTracks: () => [
        { stop: jest.fn() }
      ]
    } as unknown as MediaStream)

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('requests camera and audio access on mount', async () => {
    render(<CameraStream />)
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
        audio: true
      })
    })
  })

  it('displays a video element', () => {
    render(<CameraStream />)
    const videoElement = screen.getByTestId('video-stream')
    expect(videoElement).toBeInTheDocument()
    expect(videoElement.tagName).toBe('VIDEO')
  })

  it('renders a fallback message overlay when provided', () => {
    render(<CameraStream fallbackMessage="I cannot read this clearly" />)
    expect(screen.getByText(/I cannot read this clearly/i)).toBeInTheDocument()
  })
})