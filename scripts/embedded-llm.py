import argparse
import base64
import json
import sys
import time

from llama_cpp import Llama


def log(message: str) -> None:
    print(f"[embedded-llm] {time.strftime('%H:%M:%S')} {message}", flush=True)


def run_chat_completion(llm: Llama, prompt: str, tokens: int) -> str:
    instruction = "You are a concise JSON writer. Return exactly one JSON object and no markdown."
    result = llm.create_chat_completion(
        messages=[
            {
                "role": "user",
                "content": f"{instruction}\n\n{prompt}",
            },
        ],
        max_tokens=tokens,
        temperature=0.2,
        top_p=0.9,
        stop=["</s>", "<|im_end|>"],
    )
    return result["choices"][0]["message"]["content"]


def run_text_completion(llm: Llama, prompt: str, tokens: int) -> str:
    instruction = "Return exactly one JSON object and no markdown."
    result = llm(
        f"{instruction}\n\n{prompt}\n\nJSON:",
        max_tokens=tokens,
        temperature=0.2,
        top_p=0.9,
        stop=["</s>", "<|im_end|>"],
    )
    return result["choices"][0]["text"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--ctx", type=int, default=2048)
    parser.add_argument("--tokens", type=int, default=600)
    args = parser.parse_args()

    log(f"loading model: {args.model}")
    started = time.time()
    llm = Llama(
        model_path=args.model,
        n_ctx=args.ctx,
        n_threads=6,
        n_gpu_layers=0,
        verbose=False,
    )
    log(f"model loaded in {time.time() - started:.1f}s")
    log(f"prompt chars: {len(args.prompt)}")
    log("starting chat inference")
    infer_started = time.time()
    try:
        text = run_chat_completion(llm, args.prompt, args.tokens)
    except Exception as error:
        log(f"chat inference failed, retrying text completion: {error}")
        text = run_text_completion(llm, args.prompt, args.tokens)
    log(f"inference finished in {time.time() - infer_started:.1f}s")
    log(f"response chars: {len(text)}")
    encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
    print(f"PRESENTLY_EMBEDDED_RESPONSE {encoded}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        log(f"error: {error}")
        raise
