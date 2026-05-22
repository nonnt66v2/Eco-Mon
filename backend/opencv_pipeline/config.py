from __future__ import annotations

import argparse
from dataclasses import dataclass


def ensure_odd_minimum(value: int, minimum: int = 3) -> int:
    if value < minimum:
        value = minimum
    if value % 2 == 0:
        value += 1
    return value


@dataclass
class PipelineConfig:
    source: str = "0"
    window_name: str = "OpenCV Realtime"
    processing_scale: float = 0.6
    display_scale: float = 1.0
    flip_horizontal: bool = False
    max_fps: int = 0
    opencv_threads: int = 0
    use_cuda: bool = False

    capture_width: int | None = None
    capture_height: int | None = None
    capture_fps: int | None = None
    capture_buffer: int = 1

    gaussian_kernel: int = 5
    median_kernel: int = 5
    clahe_clip_limit: float = 2.0
    clahe_grid_size: int = 8

    adaptive_block_size: int = 31
    adaptive_c: int = 2
    hist_percentile: float = 70.0
    hist_refresh_frames: int = 5
    hist_brightness_delta: float = 8.0
    brightness_target: float = 120.0
    brightness_correction: float = 0.03
    canny_sigma: float = 0.33

    morph_open: int = 3
    morph_close: int = 7
    morph_iterations: int = 2
    edge_dilate: int = 3

    use_background: bool = True
    bg_history: int = 200
    bg_var_threshold: int = 16
    bg_detect_shadows: bool = True
    bg_learning_rate: float = -1.0

    min_area: int = 500
    max_area: int = 0
    max_objects: int = 0
    approx_epsilon: float = 0.02

    tracker_max_distance: int = 60
    tracker_max_missing: int = 8
    tracker_min_hits: int = 2
    tracker_smoothing: float = 0.6

    show_mask: bool = False
    show_debug: bool = False


def parse_args(argv: list[str] | None = None) -> PipelineConfig:
    parser = argparse.ArgumentParser(
        description="Realtime OpenCV segmentation pipeline"
    )
    parser.add_argument("--source", default="0", help="Camera index, file path, or RTSP/HTTP URL")
    parser.add_argument("--window-name", default="OpenCV Realtime")
    parser.add_argument("--processing-scale", type=float, default=0.6, help="Scale for processing frames")
    parser.add_argument("--display-scale", type=float, default=1.0, help="Scale for display output")
    parser.add_argument("--flip", action="store_true", help="Flip frames horizontally")
    parser.add_argument("--max-fps", type=int, default=0, help="Limit FPS (0 = unlimited)")
    parser.add_argument("--opencv-threads", type=int, default=0, help="Force OpenCV thread count (0 = default)")
    parser.add_argument("--use-cuda", action="store_true", help="Attempt to use CUDA when available")

    parser.add_argument("--capture-width", type=int, default=None)
    parser.add_argument("--capture-height", type=int, default=None)
    parser.add_argument("--capture-fps", type=int, default=None)
    parser.add_argument("--capture-buffer", type=int, default=1)

    parser.add_argument("--gaussian-kernel", type=int, default=5)
    parser.add_argument("--median-kernel", type=int, default=5)
    parser.add_argument("--clahe-clip", type=float, default=2.0)
    parser.add_argument("--clahe-grid", type=int, default=8)

    parser.add_argument("--adaptive-block", type=int, default=31)
    parser.add_argument("--adaptive-c", type=int, default=2)
    parser.add_argument("--hist-percentile", type=float, default=70.0)
    parser.add_argument("--hist-refresh", type=int, default=5)
    parser.add_argument("--hist-delta", type=float, default=8.0)
    parser.add_argument("--brightness-target", type=float, default=120.0)
    parser.add_argument("--brightness-correction", type=float, default=0.03)
    parser.add_argument("--canny-sigma", type=float, default=0.33)

    parser.add_argument("--morph-open", type=int, default=3)
    parser.add_argument("--morph-close", type=int, default=7)
    parser.add_argument("--morph-iterations", type=int, default=2)
    parser.add_argument("--edge-dilate", type=int, default=3)

    parser.add_argument("--disable-bg", action="store_true", help="Disable background subtraction")
    parser.add_argument("--bg-history", type=int, default=200)
    parser.add_argument("--bg-var-threshold", type=int, default=16)
    parser.add_argument("--bg-learning-rate", type=float, default=-1.0)
    parser.add_argument("--no-bg-shadows", action="store_true", help="Disable shadow detection")

    parser.add_argument("--min-area", type=int, default=500)
    parser.add_argument("--max-area", type=int, default=0)
    parser.add_argument("--max-objects", type=int, default=0)
    parser.add_argument("--approx-epsilon", type=float, default=0.02)

    parser.add_argument("--tracker-distance", type=int, default=60)
    parser.add_argument("--tracker-missing", type=int, default=8)
    parser.add_argument("--tracker-hits", type=int, default=2)
    parser.add_argument("--tracker-smoothing", type=float, default=0.6)

    parser.add_argument("--show-mask", action="store_true")
    parser.add_argument("--show-debug", action="store_true")

    args = parser.parse_args(argv)

    processing_scale = max(0.1, args.processing_scale)
    display_scale = max(0.1, args.display_scale)

    return PipelineConfig(
        source=args.source,
        window_name=args.window_name,
        processing_scale=processing_scale,
        display_scale=display_scale,
        flip_horizontal=args.flip,
        max_fps=max(0, args.max_fps),
        opencv_threads=max(0, args.opencv_threads),
        use_cuda=args.use_cuda,
        capture_width=args.capture_width,
        capture_height=args.capture_height,
        capture_fps=args.capture_fps,
        capture_buffer=max(0, args.capture_buffer),
        gaussian_kernel=ensure_odd_minimum(args.gaussian_kernel),
        median_kernel=ensure_odd_minimum(args.median_kernel),
        clahe_clip_limit=max(0.1, args.clahe_clip),
        clahe_grid_size=max(2, args.clahe_grid),
        adaptive_block_size=ensure_odd_minimum(args.adaptive_block),
        adaptive_c=args.adaptive_c,
        hist_percentile=min(max(args.hist_percentile, 1.0), 99.0),
        hist_refresh_frames=max(1, args.hist_refresh),
        hist_brightness_delta=max(0.0, args.hist_delta),
        brightness_target=min(max(args.brightness_target, 10.0), 245.0),
        brightness_correction=max(0.0, args.brightness_correction),
        canny_sigma=min(max(args.canny_sigma, 0.05), 0.9),
        morph_open=ensure_odd_minimum(args.morph_open),
        morph_close=ensure_odd_minimum(args.morph_close),
        morph_iterations=max(1, args.morph_iterations),
        edge_dilate=ensure_odd_minimum(args.edge_dilate),
        use_background=not args.disable_bg,
        bg_history=max(10, args.bg_history),
        bg_var_threshold=max(4, args.bg_var_threshold),
        bg_detect_shadows=not args.no_bg_shadows,
        bg_learning_rate=args.bg_learning_rate,
        min_area=max(1, args.min_area),
        max_area=max(0, args.max_area),
        max_objects=max(0, args.max_objects),
        approx_epsilon=max(0.001, args.approx_epsilon),
        tracker_max_distance=max(10, args.tracker_distance),
        tracker_max_missing=max(1, args.tracker_missing),
        tracker_min_hits=max(1, args.tracker_hits),
        tracker_smoothing=min(max(args.tracker_smoothing, 0.0), 0.95),
        show_mask=args.show_mask,
        show_debug=args.show_debug
    )
