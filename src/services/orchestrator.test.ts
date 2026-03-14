/**
 * @jest-environment node
 */
import { evaluateProactiveSuggestion } from './orchestrator'
import { SceneAnalysis } from './novaVision'
import { playEarcon } from './earconService'

jest.mock('./earconService', () => ({
  playEarcon: jest.fn(),
}));

describe('Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers a proactive suggestion if a new object matches the user goal and plays click and chime', async () => {
    const memory = {
      environment: 'grocery store',
      objects_seen: ['Cheerios'],
      user_goal: 'find healthy cereal'
    }
    const currentFrameAnalysis: SceneAnalysis = {
      objects: ['Oatmeal'],
      text: 'Healthy',
      environment: 'grocery store'
    }
    
    const result = await evaluateProactiveSuggestion(memory, currentFrameAnalysis)
    
    expect(result.shouldSuggest).toBe(true)
    expect(result.suggestionPrompt).toContain('Oatmeal')
    expect(playEarcon).toHaveBeenCalledWith('click');
    expect(playEarcon).toHaveBeenCalledWith('chime');
  })

  it('does not trigger if nothing new is relevant but plays click for processed frame', async () => {
    const memory = {
      environment: 'grocery store',
      objects_seen: ['Cheerios'],
      user_goal: 'find fruit'
    }
    const currentFrameAnalysis: SceneAnalysis = {
      objects: ['Frosted Flakes'],
      text: '',
      environment: 'grocery store'
    }
    
    const result = await evaluateProactiveSuggestion(memory, currentFrameAnalysis)
    
    expect(result.shouldSuggest).toBe(false)
    expect(playEarcon).toHaveBeenCalledWith('click');
    expect(playEarcon).not.toHaveBeenCalledWith('chime');
  })
})