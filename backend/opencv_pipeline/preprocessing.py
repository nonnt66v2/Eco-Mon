from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .config import PipelineConfig


@dataclass
class PreprocessResult:
    original_frame: np.ndarray
    frame: np.ndarray
    gray: np.ndarray
    normalized: np.ndarray
    brightness: float
    scale: float


class Preprocessor:
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.clahe = cv2.createCLAHE(
            clipLimit=config.clahe_clip_limit,
            tileGridSize=(config.clahe_grid_size, config.clahe_grid_size)
        )
        self.cuda_enabled = bool(
            config.use_cuda
            and hasattr(cv2, "cuda")
            and cv2.cuda.getCudaEnabledDeviceCount() > 0
        )
        self.cuda_gaussian = None
        if self.cuda_enabled and hasattr(cv2.cuda, "createGaussianFilter"):
            self.cuda_gaussian = cv2.cuda.createGaussianFilter(
                cv2.CV_8UC1,
                cv2.CV_8UC1,
                (config.gaussian_kernel, config.gaussian_kernel),
                0
            )

    def _resize(self, frame: np.ndarray) -> np.ndarray:
        if self.config.processing_scale == 1.0:
            return frame
        return cv2.resize(
            frame,
            None,
            fx=self.config.processing_scale,
            fy=self.config.processing_scale,
            interpolation=cv2.INTER_AREA
        )

    def _to_gray(self, frame: np.ndarray) -> np.ndarray:
        if not self.cuda_enabled:
            return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        gpu_frame = cv2.cuda_GpuMat()
        gpu_frame.upload(frame)
        gpu_gray = cv2.cuda.cvtColor(gpu_frame, cv2.COLOR_BGR2GRAY)
        if self.cuda_gaussian:
            gpu_gray = self.cuda_gaussian.apply(gpu_gray)
        return gpu_gray.download()

    def process(self, frame: np.ndarray) -> PreprocessResult:
        original = frame
        frame = self._resize(frame)

        if self.config.flip_horizontal:
            frame = cv2.flip(frame, 1)

        gray = self._to_gray(frame)

        if not self.cuda_gaussian:
            gray = cv2.GaussianBlur(gray, (self.config.gaussian_kernel, self.config.gaussian_kernel), 0)

        gray = self.clahe.apply(gray)
        gray = cv2.medianBlur(gray, self.config.median_kernel)

        normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        brightness = float(np.mean(normalized))

        return PreprocessResult(
            original_frame=original,
            frame=frame,
            gray=gray,
            normalized=normalized,
            brightness=brightness,
            scale=self.config.processing_scale
        )
