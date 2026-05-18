import { linearToolDefinitions } from '../src/tools/index.js';

describe('linear tool prompt metadata', () => {
  it('includes promptSnippet and promptGuidelines on every registered tool', () => {
    const missingSnippet = linearToolDefinitions.filter(
      (tool) => typeof tool.promptSnippet !== 'string' || tool.promptSnippet.trim().length === 0,
    );
    expect(missingSnippet.map((tool) => tool.name)).toEqual([]);

    const missingGuidelines = linearToolDefinitions.filter(
      (tool) =>
        !Array.isArray(tool.promptGuidelines)
        || tool.promptGuidelines.length === 0
        || tool.promptGuidelines.some(
          (guideline) => typeof guideline !== 'string' || guideline.trim().length === 0,
        ),
    );
    expect(missingGuidelines.map((tool) => tool.name)).toEqual([]);

    const missingSelfReference = linearToolDefinitions.filter(
      (tool) => !tool.promptGuidelines?.some((guideline) => guideline.includes(tool.name)),
    );
    expect(missingSelfReference.map((tool) => tool.name)).toEqual([]);
  });
});
