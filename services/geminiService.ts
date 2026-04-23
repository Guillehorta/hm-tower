
import { GoogleGenAI, Type } from "@google/genai";
import { Employee, RecognitionResult } from '../types';

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const geminiService = {
  verifyFace: async (capturedImageBase64: string, employees: Employee[]): Promise<RecognitionResult> => {
    if (!apiKey) {
      return { match: false, confidence: 0, message: "Erro: Chave de API não configurada. Por favor, verifique as configurações." };
    }
    if (employees.length === 0) {
      return { match: false, confidence: 0, message: "Nenhum funcionário cadastrado no sistema." };
    }

    // We send the captured image and the gallery of employees to Gemini to find a match
    // For efficiency in this demo, we'll ask Gemini to compare the captured image against the list of profiles.
    
    const imageParts = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: capturedImageBase64.split(',')[1] // Remove data:image/jpeg;base64,
        }
      }
    ];

    // Adding references of employees to the prompt
    // In a real high-scale scenario, we might use a vector DB, but for a standalone demo, 
    // Gemini's multi-modal context is powerful enough for small teams.
    const employeeReferences = employees.map(e => ({
      id: e.id,
      name: e.name,
      photo: e.photoBase64.split(',')[1]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            ...imageParts,
            { text: `Você é um sistema de reconhecimento facial de alta precisão. 
              Analise a imagem capturada e compare-a com as fotos de referência dos funcionários abaixo.
              
              Funcionários Cadastrados:
              ${JSON.stringify(employeeReferences.map(e => ({ id: e.id, name: e.name })))}
              
              Instruções:
              1. Identifique se a pessoa na imagem capturada é um dos funcionários listados.
              2. Retorne o ID do funcionário se houver um "match" claro (confiança > 0.8).
              3. Se não houver certeza ou a pessoa não estiver na lista, retorne match: false.
              4. Seja rigoroso para evitar fraudes.
            `}
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.BOOLEAN },
            employeeId: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            message: { type: Type.STRING }
          },
          required: ["match", "confidence", "message"]
        }
      }
    });

    try {
      const result = JSON.parse(response.text || '{}');
      return result as RecognitionResult;
    } catch (e) {
      console.error("Erro ao processar resposta do Gemini", e);
      return { match: false, confidence: 0, message: "Erro técnico no reconhecimento." };
    }
  }
};
