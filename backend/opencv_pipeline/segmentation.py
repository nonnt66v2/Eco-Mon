from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .config import PipelineConfig
from .preprocessing import PreprocessResult


@dataclass
class SegmentationResult:
    mask: np.ndarray
    edges: np.ndarray
    combined: np.ndarray
    bg_mask: np.ndarray | None


class Segmenter:
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (config.morph_open, config.morph_open))
        self.kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (config.morph_close, config.morph_close))
        self.kernel_edge = cv2.getStructuringElement(cv2.MORPH_RECT, (config.edge_dilate, config.edge_dilate))
        self.cuda_enabled = bool(
            config.use_cuda
            and hasattr(cv2, "cuda")
            and cv2.cuda.getCudaEnabledDeviceCount() > 0
        )
        self.bg_subtractor = None
        if config.use_background:
            if self.cuda_enabled and hasattr(cv2.cuda, "createBackgroundSubtractorMOG2"):
                self.bg_subtractor = cv2.cuda.createBackgroundSubtractorMOG2(
                    history=config.bg_history,
                    varThreshold=config.bg_var_threshold,
                    detectShadows=config.bg_detect_shadows
                )
            else:
                self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                    history=config.bg_history,
                    varThreshold=config.bg_var_threshold,
                    detectShadows=config.bg_detect_shadows
                )
        self._last_hist_threshold: float | None = None
        self._last_brightness: float | None = None
        self._frame_index = 0

    def _get_adaptive_c_value(self, brightness: float) -> int:
        delta = (self.config.brightness_target - brightness) * self.config.brightness_correction
        return int(round(self.config.adaptive_c + delta))

    def _get_hist_threshold(self, gray: np.ndarray, brightness: float) -> float:
        self._frame_index += 1
        if self._last_hist_threshold is None:
            recompute = True
        else:
            brightness_delta = abs(brightness - (self._last_brightness or brightness))
            recompute = (
                brightness_delta >= self.config.hist_brightness_delta
                or self._frame_index % self.config.hist_refresh_frames == 0
            )

        if recompute:
            sample = gray
            if gray.size > 300_000:
                sample = gray[::2, ::2]
            self._last_hist_threshold = float(np.percentile(sample, self.config.hist_percentile))
            self._last_brightness = brightness

        return self._last_hist_threshold or 0.0

    def _apply_background(self, frame: np.ndarray) -> np.ndarray | None:
        if not self.bg_subtractor:
            return None

        if self.cuda_enabled and hasattr(self.bg_subtractor, "apply"):
            gpu_frame = cv2.cuda_GpuMat()
            gpu_frame.upload(frame)
            gpu_mask = self.bg_subtractor.apply(gpu_frame, learningRate=self.config.bg_learning_rate)
            bg_mask = gpu_mask.download()
        else:
            bg_mask = self.bg_subtractor.apply(frame, learningRate=self.config.bg_learning_rate)

        _, bg_mask = cv2.threshold(bg_mask, 200, 255, cv2.THRESH_BINARY)
        return bg_mask

    def segment(self, pre: PreprocessResult) -> SegmentationResult:
        gray = pre.normalized
        adaptive_c = self._get_adaptive_c_value(pre.brightness)
        adaptive_block = self.config.adaptive_block_size

        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            adaptive_block,
            adaptive_c
        )

        hist_thresh = self._get_hist_threshold(gray, pre.brightness)
        _, hist_mask = cv2.threshold(gray, hist_thresh, 255, cv2.THRESH_BINARY)

        combined = cv2.bitwise_or(otsu, adaptive)
        combined = cv2.bitwise_or(combined, hist_mask)

        bg_mask = self._apply_background(pre.frame)
        if bg_mask is not None:
            combined = cv2.bitwise_and(combined, bg_mask)

        median = float(np.median(gray))
        low = int(max(0, (1.0 - self.config.canny_sigma) * median))
        high = int(min(255, (1.0 + self.config.canny_sigma) * median))
        edges = cv2.Canny(gray, low, high)
        edges = cv2.dilate(edges, self.kernel_edge, iterations=1)
        combined = cv2.bitwise_or(combined, edges)

        mask = cv2.morphologyEx(combined, cv2.MORPH_OPEN, self.kernel_open, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel_close, iterations=self.config.morph_iterations)

        return SegmentationResult(mask=mask, edges=edges, combined=combined, bg_mask=bg_mask)
