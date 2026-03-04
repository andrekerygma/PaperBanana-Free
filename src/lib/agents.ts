import { GoogleGenAI } from "@google/genai";

// Helper to get a fresh AI client instance
// This ensures we pick up any API key changes (e.g. after user selection)
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

export type AgentStep = "idle" | "retriever" | "planner" | "stylist" | "visualizer" | "critic" | "complete";

export interface AgentState {
  step: AgentStep;
  sourceContext: string;
  communicativeIntent: string;
  retrievedReferences: string[];
  plan: string;
  stylePrompt: string;
  generatedImage: string | null; // Base64
  critique: string | null;
  iteration: number;
  logs: string[];
  isProcessing: boolean;
  history: {
    image: string;
    prompt: string;
    critique?: string;
    iteration: number;
  }[];
}

export const INITIAL_STATE: AgentState = {
  step: "idle",
  sourceContext: "",
  communicativeIntent: "",
  retrievedReferences: [],
  plan: "",
  stylePrompt: "",
  generatedImage: null,
  critique: null,
  iteration: 0,
  logs: [],
  isProcessing: false,
  history: [],
};

// 1. Retriever Agent
// Simulates retrieving relevant visual metaphors and academic styles.
export async function runRetrieverAgent(context: string, intent: string, pdfBase64?: string): Promise<string[]> {
  const ai = getAiClient();
  const model = "gemini-2.5-flash-preview"; // Fast model for retrieval/brainstorming
  
  const promptText = `
    Atue como um Especialista em Recuperação de Referências Visuais para ilustrações acadêmicas.
    
    Contexto da Pesquisa: "${context}" ${pdfBase64 ? "(Considere também o documento PDF anexo)" : ""}
    Intenção Comunicativa: "${intent}"
    
    Sua tarefa é identificar 3 estilos visuais ou metáforas acadêmicas que melhor se adaptam a este conteúdo.
    Considere estilos como: Diagramas de Processo, Gráficos de Dados, Ilustrações Anatômicas, Mapas Conceituais, etc.
    
    Retorne APENAS uma lista JSON de strings, exemplo: ["Diagrama de Fluxo Minimalista", "Ilustração 3D Isométrica", "Esquema de Cores Suaves"].
  `;

  const parts: any[] = [{ text: promptText }];
  
  if (pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      }
    });
    
    const text = response.text;
    if (!text) return ["Estilo Acadêmico Padrão"];
    return JSON.parse(text);
  } catch (error) {
    console.error("Retriever Error:", error);
    return ["Diagrama Técnico", "Ilustração Científica", "Esquema Minimalista"];
  }
}

// 2. Planner Agent
// Creates a structured plan for the image.
export async function runPlannerAgent(context: string, intent: string, references: string[], pdfBase64?: string): Promise<string> {
  const ai = getAiClient();
  const model = "gemini-3.1-pro-preview"; // Smarter model for planning
  
  const promptText = `
    Atue como um Planejador de Conteúdo Visual Acadêmico.
    
    Contexto: "${context}" ${pdfBase64 ? "(Considere também o documento PDF anexo)" : ""}
    Intenção: "${intent}"
    Referências Sugeridas: ${references.join(", ")}
    
    Crie um plano detalhado para a ilustração. O plano deve descrever:
    1. Os elementos principais a serem mostrados.
    2. A disposição espacial (layout).
    3. As anotações ou rótulos textuais necessários (se houver).
    4. O fluxo de informação visual.
    
    Seja conciso e direto.
  `;

  const parts: any[] = [{ text: promptText }];
  
  if (pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
  });
  
  return response.text || "Falha ao gerar o plano.";
}
// Refines the plan into a specific image generation prompt.
export async function runStylistAgent(plan: string, references: string[]): Promise<string> {
  const ai = getAiClient();
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Atue como um Especialista em Estilo Visual (Prompt Engineer).
    
    Plano Visual: "${plan}"
    Estilos de Referência: ${references.join(", ")}
    
    Transforme este plano em um prompt de geração de imagem altamente detalhado e otimizado para o modelo Gemini Image Generation.
    
    Diretrizes de Estilo:
    - Alta qualidade, renderização acadêmica profissional.
    - Fundo limpo (branco ou cinza claro).
    - Iluminação suave e uniforme.
    - Cores distintas mas profissionais (paleta acadêmica).
    - Estilo vetorial ou renderização 3D limpa (dependendo do plano).
    - INCLUA TEXTO E RÓTULOS: A ilustração deve conter texto legível, rótulos e anotações conforme o plano. Use fontes claras e acadêmicas (sans-serif).
    
    Retorne APENAS o prompt em inglês (para melhor compatibilidade com modelos de imagem).
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  
  return response.text || "";
}

// 4. Visualizer Agent
// Generates the image.
export async function runVisualizerAgent(prompt: string): Promise<string | null> {
  const ai = getAiClient();
  // Switched to gemini-2.5-flash-image (free tier compatible) as per user request
  const model = "gemini-2.5-flash-image"; 
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        // gemini-2.5-flash-image supports aspectRatio but NOT imageSize
        imageConfig: {
          aspectRatio: "4:3",
        }
      }
    });

    // Extract image
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    // If we got here, maybe there's text output explaining why image wasn't generated (e.g. safety)
    const textOutput = response.text;
    if (textOutput) {
      throw new Error(`O modelo retornou texto em vez de imagem: ${textOutput}`);
    }
    
    throw new Error("Nenhuma imagem retornada pelo modelo.");
    
  } catch (error: any) {
    console.error("Visualizer Error:", error);
    // Re-throw with a user-friendly message if possible, or the original error
    throw new Error(`Erro na geração da imagem: ${error.message || error}`);
  }
}

// 5. Critic Agent
// Critiques the generated image against the intent.
export async function runCriticAgent(
  originalIntent: string, 
  plan: string, 
  imageBase64: string
): Promise<{ critique: string; score: number; refinedPromptSuggestion: string }> {
  const ai = getAiClient();
  const model = "gemini-2.5-flash-preview"; // VLM for critique
  
  const base64Data = imageBase64.split(",")[1];
  const mimeType = imageBase64.split(";")[0].split(":")[1];

  const prompt = `
    Atue como um Crítico de Arte Acadêmica Sênior.
    
    Intenção Original: "${originalIntent}"
    Plano Original: "${plan}"
    
    Analise a imagem fornecida.
    1. Ela atende à intenção comunicativa?
    2. O estilo é apropriado para uma publicação acadêmica?
    3. Há alucinações visuais ou erros estruturais graves?
    
    Forneça:
    - Uma crítica construtiva curta.
    - Uma pontuação de 0 a 10 (onde 10 é perfeito).
    - Uma sugestão de como melhorar o prompt para a próxima iteração (em inglês).
    
    Retorne a resposta em formato JSON:
    {
      "critique": "string",
      "score": number,
      "refinedPromptSuggestion": "string"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No critique generated");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Critic Error:", error);
    return {
      critique: "Erro ao gerar crítica. Assumindo qualidade aceitável para prosseguir.",
      score: 5,
      refinedPromptSuggestion: ""
    };
  }
}

// 6. Refiner Agent
// Rewrites the prompt based on the critique.
export async function runRefinerAgent(originalPrompt: string, critique: string, suggestion: string): Promise<string> {
  const ai = getAiClient();
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Atue como um Especialista em Engenharia de Prompt para Geração de Imagens.
    
    Prompt Original: "${originalPrompt}"
    
    Crítica da Imagem Gerada Anteriormente: "${critique}"
    Sugestão de Melhoria: "${suggestion}"
    
    Sua tarefa é REESCREVER o prompt original para corrigir os problemas apontados e incorporar as sugestões.
    Mantenha o estilo acadêmico e a estrutura principal, mas ajuste a descrição para evitar os erros mencionados.
    
    Retorne APENAS o novo prompt em inglês.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  
  return response.text || originalPrompt;
}
