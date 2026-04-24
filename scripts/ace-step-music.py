import argparse
import os
import sys
import time


def log(message: str) -> None:
    print(f"[music:ace-step] {time.strftime('%H:%M:%S')} {message}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=float, default=60)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ace_root = os.path.join(repo_root, "models", "ACE-Step")
    sys.path.insert(0, ace_root)

    log("importing ACE-Step pipeline")
    from acestep.pipeline_ace_step import ACEStepPipeline

    log(f"loading checkpoints: {args.checkpoint}")
    pipeline = ACEStepPipeline(
        checkpoint_dir=args.checkpoint,
        dtype="float32",
        torch_compile=False,
        cpu_offload=True,
        overlapped_decode=False,
    )

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    log(f"generating {args.duration:.0f}s audio")
    pipeline(
        audio_duration=args.duration,
        prompt=args.prompt,
        lyrics="",
        infer_step=27,
        guidance_scale=15,
        scheduler_type="euler",
        cfg_type="apg",
        omega_scale=10,
        manual_seeds="1234",
        guidance_interval=0.5,
        guidance_interval_decay=0,
        min_guidance_scale=3,
        use_erg_tag=True,
        use_erg_lyric=False,
        use_erg_diffusion=True,
        oss_steps="",
        guidance_scale_text=0,
        guidance_scale_lyric=0,
        save_path=args.out,
    )
    log(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
