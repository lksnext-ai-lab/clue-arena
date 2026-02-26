/**
 * Genkit instance and model configuration.
 * Server-side only. Never import this in client components.
 *
 * To activate Ollama: uncomment the ollama import/plugin below
 * and set GENKIT_MODEL=ollama/llama3.2 in .env.local.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// import { ollama } from 'genkitx-ollama';

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    // ollama({ serverAddress: process.env.OLLAMA_SERVER_URL ?? 'http://localhost:11434' }),
  ],
});

/** Default model. Override with GENKIT_MODEL env var. */
export const DEFAULT_MODEL = process.env.GENKIT_MODEL ?? 'googleai/gemini-2.0-flash-exp';
