import { render } from '@testing-library/react';
import CameraStream from './CameraStream';
import { FrameSampler } from '../utils/frameSampling';
import React from 'react';

// Mock FrameSampler
jest.mock('../utils/frameSampling', () => ({
  FrameSampler: jest.fn().mockImplementation(() => ({
    shouldCapture: jest.fn(),
  })),
}));

describe('CameraStream Sampling Integration', () => {
  let mockGetUserMedia: jest.Mock;

  beforeEach(() => {
    mockGetUserMedia = jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize FrameSampler on mount', () => {
    render(<CameraStream />);
    expect(FrameSampler).toHaveBeenCalledWith({ motionThreshold: 5.0 });
  });
});
