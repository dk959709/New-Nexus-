import { env, pipeline, TextStreamer } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/LFM2.5-350M-ONNX";

// Use browser cache and avoid failing silently on HF fetch errors
// Transformers.js v4: keep the model in the browser cache so that
// after the first successful download it can run without downloading again.
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = true;

const MODEL_OPTIONS = {
  dtype: "q4",
  use_external_data_format: true,
};

type Generator = Awaited<ReturnType<typeof pipeline>>;

let generator: Generator | null = null;
let loadingPromise: Promise<Generator> | null = null;

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function getDevice(): Promise<"webgpu" | "wasm"> {
  try {
    if (
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      navigator.gpu
    ) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    // Fall through to WASM.
  }

  return "wasm";
}

export async function loadOfflineAI(
  onProgress?: (progress: number) => void,
): Promise<Generator> {
  if (generator) return generator;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const device = await getDevice();

    onProgress?.(2);

    try {
      const model = await pipeline(
        "text-generation",
        MODEL_ID,
        {
          ...MODEL_OPTIONS,
          device,
          progress_callback: (data: { progress?: number }) => {
            if (typeof data.progress === "number") {
              onProgress?.(
                Math.max(2, Math.min(99, Math.round(data.progress))),
              );
            }
          },
        } as never,
      );

      onProgress?.(100);
      return model;
    } catch (error) {
      // If WebGPU fails, retry once using CPU/WASM.
      if (device === "webgpu") {
        onProgress?.(5);

        const model = await pipeline(
          "text-generation",
          MODEL_ID,
          {
            ...MODEL_OPTIONS,
            device: "wasm",
            progress_callback: (data: { progress?: number }) => {
              if (typeof data.progress === "number") {
                onProgress?.(
                  Math.max(5, Math.min(99, Math.round(data.progress))),
                );
              }
            },
          } as never,
        );

        onProgress?.(100);
        return model;
      }

      const detail =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Offline model could not load. WebGPU=${device === "webgpu"}. ${detail}`,
      );
    }
  })();

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
    max_new_tokens: 256,
    do_sample: false,
    streamer,
  });

  const generated = output?.[0]?.generated_text;

  if (Array.isArray(generated)) {
    return generated.at(-1)?.content ?? "";
  }

  return String(generated ?? "");
}
