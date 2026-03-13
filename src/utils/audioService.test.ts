import { playMedicationEarcon } from './audioService';

describe('Audio Utilities - playMedicationEarcon', () => {
  let mockAudioContext: any;
  let mockOscillator: any;

  beforeEach(() => {
    mockOscillator = {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      onended: null
    };

    mockAudioContext = {
      createOscillator: jest.fn().mockReturnValue(mockOscillator),
      createGain: jest.fn().mockReturnValue({
        connect: jest.fn(),
        gain: { exponentialRampToValueAtTime: jest.fn(), setValueAtTime: jest.fn() }
      }),
      currentTime: 0,
      destination: {}
    };

    (window as any).AudioContext = jest.fn().mockReturnValue(mockAudioContext);
  });

  it('should attempt to play a sound using the Web Audio API', () => {
    playMedicationEarcon('success');
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
  });
});
