from __future__ import annotations

import time

import cv2

from .acquisition import VideoStream
from .config import PipelineConfig
from .preprocessing import Preprocessor
from .recognition import Detector
from .rendering import Renderer
from .segmentation import Segmenter
from .tracking import SimpleTracker


class FpsCounter:
    def __init__(self, smoothing: float = 0.9):
        self.smoothing = smoothing
        self.last_time: float | None = None
        self.fps = 0.0

    def tick(self) -> float:
        now = time.perf_counter()
        if self.last_time is not None:
            delta = now - self.last_time
            if delta > 0:
                current = 1.0 / delta
                if self.fps == 0:
                    self.fps = current
                else:
                    self.fps = self.fps * self.smoothing + current * (1 - self.smoothing)
        self.last_time = now
        return self.fps


def run(config: PipelineConfig) -> None:
    cv2.setUseOptimized(True)
    if config.opencv_threads:
        cv2.setNumThreads(config.opencv_threads)

    stream = VideoStream(config)
    if not stream.is_opened():
        raise RuntimeError(f"Impossibile aprire la sorgente video: {config.source}")

    preprocessor = Preprocessor(config)
    segmenter = Segmenter(config)
    detector = Detector(config)
    tracker = SimpleTracker(config)
    renderer = Renderer(config)
    fps_counter = FpsCounter()

    window_name = "Eco-Mon OpenCV"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    try:
        while True:
            ret, frame = stream.read()
            if not ret:
                break

            loop_start = time.perf_counter()
            pre = preprocessor.process(frame)
            seg = segmenter.segment(pre)
            detections = detector.detect(seg.mask)
            tracks = tracker.update(detections)

            render_scale = config.display_scale / pre.scale
            display_frame = pre.frame
            if render_scale != 1.0:
                display_frame = cv2.resize(
                    display_frame,
                    None,
                    fx=render_scale,
                    fy=render_scale,
                    interpolation=cv2.INTER_LINEAR
                )

            fps = fps_counter.tick()
            output = renderer.render(display_frame, tracks, fps, scale=render_scale)
            cv2.imshow(window_name, output)

            if config.show_mask:
                mask_display = seg.mask
                if render_scale != 1.0:
                    mask_display = cv2.resize(
                        mask_display,
                        None,
                        fx=render_scale,
                        fy=render_scale,
                        interpolation=cv2.INTER_NEAREST
                    )
                cv2.imshow("Mask", mask_display)

            if config.show_debug:
                combined_display = seg.combined
                if render_scale != 1.0:
                    combined_display = cv2.resize(
                        combined_display,
                        None,
                        fx=render_scale,
                        fy=render_scale,
                        interpolation=cv2.INTER_NEAREST
                    )
                cv2.imshow("Combined", combined_display)

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break

            if config.max_fps > 0:
                elapsed = time.perf_counter() - loop_start
                delay = max(0.0, (1.0 / config.max_fps) - elapsed)
                if delay:
                    time.sleep(delay)
    finally:
        stream.release()
        cv2.destroyAllWindows()
