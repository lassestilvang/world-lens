import { playEarcon, resetSharedContext } from './earconService';

describe('EarconService', () => {
  let mockAudioContext: any;
  let mockOscillator: any;
  let mockGain: any;

  beforeEach(() => {
    resetSharedContext();
    mockOscillator = {
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      start: jest.fn(),
      stop: jest.fn(),
    };

    mockGain = {
      connect: jest.fn(),
      gain: { 
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn()
      },
    };

    mockAudioContext = {
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => mockGain),
      destination: {},
      currentTime: 100,
    };

    (window as any).AudioContext = jest.fn(() => mockAudioContext);
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete (window as any).AudioContext;
  });

  it('plays a chime for proactive observation', () => {
    playEarcon('chime');
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalledWith(100);
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('plays a click when frame is processed', () => {
    playEarcon('click');
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalledWith(100);
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('plays a listening tone when AI detects speech', () => {
    playEarcon('listen');
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalledWith(100);
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('does nothing gracefully if AudioContext is not supported', () => {
    delete (window as any).AudioContext;
    expect(() => playEarcon('chime')).not.toThrow();
  });
});
