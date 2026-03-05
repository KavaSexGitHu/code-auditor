import { GoogleGenAI, Type } from "@google/genai";

export interface ComparisonResult {
  verdict: "GUILTY" | "NOT_GUILTY" | "SUSPICIOUS";
  similarityScore: number; // 0-100
  findings: {
    fileName: string;
    sourceRepo: string;
    targetRepo: string;
    similarity: number;
    originalCode: string;
    suspectCode: string;
    explanation: string;
    lineRange: string;
    evidenceStrength?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    obfuscationDetected?: boolean;
  }[];
  licenseConflicts: {
    libraries: string[];
    reason: string;
    severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  }[];
  summary: string;
  recommendations: string;
  statisticalAnalysis?: {
    totalFilesCompared: number;
    filesWithMatches: number;
    averageFileSimilarity: number;
    highestMatch: { file: string; score: number };
    codeVolumeAnalysis: string;
  };
}

export async function compareRepositories(repoUrls: string[], config?: { apiKey?: string; model?: string }): Promise<ComparisonResult> {
  // Robust API key retrieval for both local and platform environments
  const apiKey = config?.apiKey ||
    (typeof process !== 'undefined' ? process.env.API_KEY : undefined) ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined) ||
    "";

  if (!apiKey) {
    throw new Error("MISSING_API_KEY: Please provide a valid Gemini API key in settings or connect to AI Studio.");
  }

  const customAi = new GoogleGenAI({ apiKey });
  const targetModel = config?.model || "gemini-3.1-pro-preview";

  const prompt = `
    You are a SUPREME FORENSIC CODE AUDITOR with PhD-level expertise in software plagiarism detection. Your mission: Execute an exhaustive, multi-dimensional analysis to uncover code theft, logic plagiarism, and intellectual property violations with ZERO tolerance for ambiguity.
    
    🎯 REPOSITORIES UNDER INVESTIGATION:
    ${repoUrls.map((url, i) => `【EVIDENCE ${i + 1}】 ${url}`).join("\n")}
    
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ⚖️ FORENSIC ANALYSIS PROTOCOL (MANDATORY EXECUTION)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    1. 🧬 DEEP SEMANTIC ANALYSIS:
       - Extract abstract syntax trees (AST) conceptually
       - Map control flow graphs and identify isomorphic patterns
       - Detect renamed variables, functions, classes with identical logic
       - Identify algorithm fingerprints (sorting, searching, data structures)
       - Compare computational complexity patterns (O(n), O(log n), etc.)
    
    2. 🔍 STRUCTURAL FORENSICS:
       - Directory architecture comparison (module organization)
       - File naming patterns and project structure similarity
       - Import/dependency graph analysis
       - Class hierarchy and interface design matching
    
    3. 🎭 OBFUSCATION DETECTION:
       - Identify intentional code camouflage (variable renaming, comment removal)
       - Detect whitespace/formatting manipulation
       - Spot refactored but logically identical code blocks
       - Find split/merged functions with same logic flow
    
    4. 📊 QUANTITATIVE METRICS:
       - Calculate Levenshtein distance on normalized code
       - Measure token-based similarity (ignoring literals/identifiers)
       - Compute cyclomatic complexity correlation
       - Analyze code duplication percentage
    
    5. 🚫 BOILERPLATE FILTERING:
       - EXCLUDE standard framework patterns (React boilerplate, Express templates)
       - EXCLUDE common utility functions (array helpers, string formatters)
       - FOCUS on custom business logic, unique algorithms, proprietary implementations
    
    6. 📜 INTELLECTUAL PROPERTY AUDIT:
       - Check for license violations (GPL → MIT conversion, attribution removal)
       - Identify copyright notice deletions
       - Detect third-party library misuse
    
    7. 🎯 EVIDENCE COLLECTION REQUIREMENTS:
       - Provide EXACT line numbers (format: "lines 45-67")
       - Extract minimum 15 lines of code per finding
       - Show side-by-side comparisons with BOTH original and suspect snippets
       - Highlight the SPECIFIC similarities (not just "similar logic")
       - Calculate per-file similarity scores (0-100%)
    
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ⚖️ VERDICT CRITERIA (STRICT JUDICIAL STANDARDS)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    🔴 GUILTY (similarityScore > 70%):
       - Core business logic is demonstrably copied
       - Unique algorithms are reproduced with minimal changes
       - Evidence of intentional obfuscation (renaming, restructuring)
       - 5+ significant code blocks match (excluding boilerplate)
    
    🟡 SUSPICIOUS (40% < similarityScore ≤ 70%):
       - Substantial structural similarity detected
       - Key logic patterns match but implementation differs
       - Insufficient evidence for definitive plagiarism claim
       - Recommend deeper manual review by legal team
    
    🟢 NOT_GUILTY (similarityScore ≤ 40%):
       - Only common patterns/boilerplate shared
       - Independent implementations solving similar problems
       - Differences outweigh similarities significantly
       - Architectural approaches are fundamentally distinct
    
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📋 REQUIRED OUTPUT FORMAT (STRICT JSON)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    Return ONLY valid JSON with this EXACT structure:
    {
      "verdict": "GUILTY" | "NOT_GUILTY" | "SUSPICIOUS",
      "similarityScore": number (0-100, weighted by business logic importance),
      "findings": [
        { 
          "fileName": "Exact file path (e.g., 'src/components/Auth.tsx')",
          "sourceRepo": "Repository 1 identifier",
          "targetRepo": "Repository 2 identifier",
          "similarity": number (0-100 for THIS specific file),
          "originalCode": "FULL code snippet from source (15-40 lines)",
          "suspectCode": "FULL code snippet from target (15-40 lines)",
          "explanation": "DETAILED forensic explanation: Describe EXACTLY what matches (function names, logic flow, algorithm, data structures, variable patterns). Quantify the similarity. Explain why this is NOT coincidental.",
          "lineRange": "Source lines X-Y vs Target lines A-B",
          "evidenceStrength": "CRITICAL | HIGH | MEDIUM | LOW",
          "obfuscationDetected": true/false
        }
      ],
      "licenseConflicts": [
        { 
          "libraries": ["library names"],
          "reason": "Specific violation (e.g., 'GPL code used without attribution')",
          "severity": "CRITICAL | HIGH | MEDIUM | LOW"
        }
      ],
      "summary": "Executive summary in 3-4 sentences: State the verdict clearly, quantify the overlap, highlight the most damaging evidence, and assess legal risk. Be brutally honest.",
      "recommendations": "Actionable remediation steps based on verdict. For GUILTY: immediate legal consultation, code rewrite. For SUSPICIOUS: manual review, IP lawyer consultation. For NOT_GUILTY: document independent development.",
      "statisticalAnalysis": {
        "totalFilesCompared": number,
        "filesWithMatches": number,
        "averageFileSimilarity": number,
        "highestMatch": { "file": "string", "score": number },
        "codeVolumeAnalysis": "Describe the proportion of matching code vs total codebase"
      }
    }
    
    ⚠️ CRITICAL INSTRUCTIONS:
    - BE THOROUGH: Analyze every file, every function, every algorithm
    - BE PRECISE: Provide concrete evidence, not vague observations
    - BE OBJECTIVE: Base verdict on facts, not assumptions
    - BE DETAILED: Each finding must have substantial code snippets (15+ lines)
    - If uncertain, mark as SUSPICIOUS and explain why
    - Do NOT fabricate findings - only report genuine matches
  `;

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await customAi.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text?.trim() || "{}";
      // Handle cases where model might wrap JSON in markdown blocks
      const cleanJson = text.replace(/^```json\n?|\n?```$/g, "").trim();
      const result = JSON.parse(cleanJson || "{}");

      // Validate and ensure all required fields exist
      if (!result.findings) result.findings = [];
      if (!result.licenseConflicts) result.licenseConflicts = [];
      if (!result.statisticalAnalysis) {
        result.statisticalAnalysis = {
          totalFilesCompared: 0,
          filesWithMatches: result.findings.length,
          averageFileSimilarity: result.similarityScore || 0,
          highestMatch: { file: "N/A", score: 0 },
          codeVolumeAnalysis: "Analysis in progress"
        };
      }

      return result;
    } catch (e: any) {
      const is503 = e.message?.includes("503") || e.status === "UNAVAILABLE" || JSON.stringify(e).includes("503");

      if (is503 && retryCount < maxRetries - 1) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.warn(`Gemini API 503 error. Retrying in ${delay}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error("Audit engine error:", e);

      if (is503) {
        throw new Error("SERVICE_OVERLOADED: The AI model is currently under heavy load. Please try again in a few minutes or switch to a 'Flash' model in settings.");
      }

      throw new Error(`AUDIT_ENGINE_FAILURE: ${e.message || "Unknown error during analysis"}`);
    }
  }
  throw new Error("MAX_RETRIES_EXCEEDED: Failed to get a response after multiple attempts.");
}
