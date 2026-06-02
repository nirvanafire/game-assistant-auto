export interface MatchResult {
  matched: boolean;
  confidence: number;
  location?: { x: number; y: number; width: number; height: number };
  center?: { x: number; y: number };
  duration: number;
  templatePath?: string;
  error?: string;
}

export interface GroupMatchResult {
  matched: boolean;
  matchedTemplateId?: string;
  results: Array<{
    templateId: string;
    result: MatchResult;
  }>;
  duration: number;
}
