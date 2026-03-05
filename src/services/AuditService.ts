import { GoogleGenAI } from "@google/genai";

// 1. تعريف الأنواع (Types & Interfaces)
export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'ollama' | 'local-python';

export interface AIModel {
    id: string;
    name: string;
}

export interface AuditConfig {
    provider: AIProvider;
    modelId?: string; // مثل: 'llama3:latest' أو 'gpt-4o'
    apiKey?: string;
    baseUrl?: string; // مخصص لـ Ollama أو خوادمك الخاصة
}

export interface AuditResult {
    similarity: number;
    verdict: 'GUILTY' | 'SUSPICIOUS' | 'NOT_GUILTY';
    details: string;
    engine: string;
    findings: {
        fileName: string;
        sourceRepo: string;
        targetRepo: string;
        similarity: number;
        originalCode: string;
        suspectCode: string;
        explanation: string;
        lineRange: string;
    }[];
}

export const AuditService = {

    // ==========================================
    // القسم الأول: جلب النماذج ديناميكياً (Dynamic Model Fetching)
    // ==========================================

    async getAvailableModels(provider: AIProvider, apiKey?: string, baseUrl?: string): Promise<AIModel[]> {
        try {
            switch (provider) {

                case 'ollama':
                    // جلب جميع النماذج المحملة محلياً على جهازك
                    const ollamaUrl = baseUrl || "http://localhost:11434";
                    const ollamaRes = await fetch(`${ollamaUrl}/api/tags`);
                    const ollamaData = await ollamaRes.json();
                    return ollamaData.models.map((m: any) => ({ id: m.name, name: m.name }));

                case 'openrouter':
                    // جلب كل نماذج OpenRouter (Claude, Llama, OpenAI, إلخ)
                    const orRes = await fetch("https://openrouter.ai/api/v1/models");
                    const orData = await orRes.json();
                    return orData.data.map((m: any) => ({ id: m.id, name: m.name }));

                case 'openai':
                    // جلب نماذج OpenAI
                    if (!apiKey) return [];
                    const oaRes = await fetch("https://api.openai.com/v1/models", {
                        headers: { "Authorization": `Bearer ${apiKey}` }
                    });
                    const oaData = await oaRes.json();
                    return oaData.data.map((m: any) => ({ id: m.id, name: m.id }));

                case 'gemini':
                    // جلب نماذج Gemini المتاحة
                    if (!apiKey) return [];
                    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    const geminiData = await geminiRes.json();
                    return geminiData.models
                        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
                        .map((m: any) => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name }));

                case 'local-python':
                    return [{ id: 'difflib-v3', name: 'Python Local Engine (No API needed)' }];

                default:
                    return [];
            }
        } catch (error) {
            console.error(`Failed to fetch models for ${provider}:`, error);
            return [];
        }
    },

    // ==========================================
    // القسم الثاني: تنفيذ الفحص (Audit Execution)
    // ==========================================

    async performAudit(code1: string, code2: string, config: AuditConfig): Promise<AuditResult> {
        const prompt = `You are a Senior Forensic Code Auditor known as 'The Just Judge'. 
    Your mission: Perform a deep, unbiased logic comparison between two sets of source code.
    
    CRITICAL INSTRUCTIONS:
    1. IGNORE NAMES: Do NOT base your verdict on similar project names, file names, or variable names. Similarity in names is NOT evidence of theft.
    2. LOGIC OVER STACK: If Source 1 is Python and Source 2 is JavaScript/Electron, they are inherently DIFFERENT unless they implement a highly specific, non-obvious algorithm identically.
    3. PATTERN DETECTION: Focus on unique algorithmic structures, custom data transformations, or non-standard logic flows.
    4. BOILERPLATE: Ignore common framework boilerplate (React hooks, Express setups, standard Python imports).
    
    Analyses Targets:
    Source 1 (Original):
    ${code1.substring(0, 30000)} // Safe limit
    
    Source 2 (Suspect):
    ${code2.substring(0, 30000)} // Safe limit
    
    Return ONLY a valid JSON object strictly matching this format: 
    { 
      "similarity": <number 0-100 indicating ACTUAL logic overlap, not name overlap>, 
      "verdict": "GUILTY" | "SUSPICIOUS" | "NOT_GUILTY", 
      "details": "<comprehensive forensic explanation justifying your verdict based on LOGIC>",
      "findings": [
        {
          "fileName": "string",
          "sourceRepo": "string",
          "targetRepo": "string",
          "similarity": <number 0-100>,
          "originalCode": "string (relevant logic snippet)",
          "suspectCode": "string (relevant logic snippet)",
          "explanation": "Technical proof of why this logic is identical or different",
          "lineRange": "string"
        }
      ]
    }`;

        try {
            switch (config.provider) {
                case 'gemini':
                    return await this.runGemini(prompt, config);
                case 'openrouter':
                case 'openai':
                    return await this.runOpenAICompatible(prompt, config);
                case 'ollama':
                    return await this.runOllama(prompt, config);
                case 'local-python':
                    return await this.runLocalPython(code1, code2);
                default:
                    throw new Error("Unsupported Provider");
            }
        } catch (error) {
            console.error(`[Audit Error - ${config.provider}]:`, error);
            // Fallback: الانتقال للمحرك المحلي في حال انقطاع الإنترنت أو نفاذ الكوتا
            console.warn("Switching to Local Python Engine as fallback...");
            try {
                return await this.runLocalPython(code1, code2);
            } catch (fallbackError) {
                // If the fallback also fails, throw the original error so the user knows why the primary engine failed
                throw new Error(`${config.provider} Error: ${(error as any).message || 'API Error'}. Local Fallback also unavailable.`);
            }
        }
    },

    // --- محرك Gemini ---
    async runGemini(prompt: string, config: AuditConfig) {
        const genAI = new GoogleGenAI({ apiKey: config.apiKey! });
        const result = await genAI.models.generateContent({
            model: config.modelId || "gemini-1.5-flash",
            contents: prompt,
            config: {
                temperature: 0,
                responseMimeType: "application/json"
            }
        });
        let text = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return { ...JSON.parse(text), engine: `Gemini (${config.modelId})` };
    },

    // --- محرك OpenAI & OpenRouter (متوافقان في نفس البنية) ---
    async runOpenAICompatible(prompt: string, config: AuditConfig) {
        const baseUrl = config.provider === 'openrouter'
            ? "https://openrouter.ai/api/v1/chat/completions"
            : "https://api.openai.com/v1/chat/completions";

        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
                ...(config.provider === 'openrouter' && { "HTTP-Referer": "http://localhost:3000", "X-Title": "Code Auditor Pro" })
            },
            body: JSON.stringify({
                model: config.modelId || (config.provider === 'openrouter' ? 'anthropic/claude-3-haiku' : 'gpt-3.5-turbo'),
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                response_format: { type: "json_object" } // إجبار النموذج على إرجاع JSON
            })
        });

        const data = await response.json();
        return { ...JSON.parse(data.choices[0].message.content), engine: `${config.provider} (${config.modelId})` };
    },

    // --- محرك Ollama (الذكاء المحلي) ---
    async runOllama(prompt: string, config: AuditConfig) {
        const baseUrl = config.baseUrl || "http://localhost:11434";
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: config.modelId || "llama3",
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0
                },
                format: "json" // Ollama يدعم إرجاع JSON مباشرة
            })
        });

        const data = await response.json();
        return { ...JSON.parse(data.response), engine: `Ollama (${config.modelId})` };
    },

    // --- محرك Python (الجسر) ---
    async runLocalPython(c1: string, c2: string) {
        const res = await fetch("http://localhost:8000/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original_code: c1, suspect_code: c2 })
        });
        const data = await res.json();
        return { ...data, engine: "Local Python Engine" };
    }
};