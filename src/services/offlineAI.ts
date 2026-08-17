import { pipeline, TextStreamer } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/LFM2.5-350M-ONNX";

type Generator = Awaited<ReturnType<typeof pipeline>>;

let generator: Generator | null = null;
let loadingPromise: Promise<Generator> | null = null;

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function loadOfflineAI(
  onProgress?: (progress: number) => void,
): Promise<Generator> {
  if (generator) return generator;
  if (loadingPromise) return loadingPromise;

  if (!isWebGPUAvailable()) {
    throw new Error(
      "WebGPU is not available on this device/browser. Offline AI requires WebGPU.",
    );
  }

  loadingPromise = pipeline(
    "text-generation",
    MODEL_ID,
    {
      dtype: "q4",
      device: "webgpu",
      progress_callback: (data: { progress?: number }) => {
        if (typeof data.progress === "number") {
          onProgress?.(Math.round(data.progress));
        }
      },
    } as never,
  ) as Promise<Generator>;

  try {
    generator = await loadingPromise;
    return generator;
  } finally {
    loadingPromise = null;
  }
}

export async function askOfflineAI(
  message: string,
  onToken?: (text: string) => void,
): Promise<string> {
  const model = await loadOfflineAI();

  const messages = [
    {
      role: "system",
      content:
        "You are NEXUS Offline AI. You are a concise, helpful assistant running locally on the user's device. You do not have access to the internet or current information.",
    },
    {
      role: "user",
      content: message,
    },
  ];

  const streamer = onToken
    ? new TextStreamer((model as any).tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: onToken,
      })
    : undefined;

  const output = await (model as any)(messages, {
    max_new_tokens: 512,
    do_sample: false,
    streamer,
  });

  const generated = output?.[0]?.generated_text;

  if (Array.isArray(generated)) {
    return generated.at(-1)?.content ?? "";
  }

  return String(generated ?? "");
}
