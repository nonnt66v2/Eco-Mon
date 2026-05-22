from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .config import PipelineConfig


@dataclass
class DetectedObject:
    contour: np.ndarray
    hull: np.ndarray
    approx: np.ndarray
    bbox: tuple[int, int, int, int]
    centroid: tuple[int, int]
    area: float
    extent: float
    solidity: float


class Detector:
    def __init__(self, config: PipelineConfig):
        self.config = config

    def _filter_components(self, mask: np.ndarray) -> np.ndarray:
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        if num_labels <= 1:
            return mask

        cleaned = np.zeros_like(mask)
        for idx in range(1, num_labels):
            area = stats[idx, cv2.CC_STAT_AREA]
            if area >= self.config.min_area:
                cleaned[labels == idx] = 255
        return cleaned

    def detect(self, mask: np.ndarray) -> list[DetectedObject]:
        filtered = self._filter_components(mask)
        contours, _ = cv2.findContours(filtered, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results: list[DetectedObject] = []

        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for contour in contours:
            area = float(cv2.contourArea(contour))
            if area < self.config.min_area:
                continue
            if self.config.max_area and area > self.config.max_area:
                continue

            bbox = cv2.boundingRect(contour)
            x, y, w, h = bbox
            hull = cv2.convexHull(contour)
            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, self.config.approx_epsilon * perimeter, True)

            moments = cv2.moments(contour)
            if moments["m00"] != 0:
                cx = int(moments["m10"] / moments["m00"])
                cy = int(moments["m01"] / moments["m00"])
            else:
                cx = x + w // 2
                cy = y + h // 2

            extent = area / float(w * h) if w and h else 0.0
            hull_area = float(cv2.contourArea(hull))
            solidity = area / hull_area if hull_area > 0 else 0.0

            results.append(
                DetectedObject(
                    contour=contour,
                    hull=hull,
                    approx=approx,
                    bbox=bbox,
                    centroid=(cx, cy),
                    area=area,
                    extent=extent,
                    solidity=solidity
                )
            )

            if self.config.max_objects and len(results) >= self.config.max_objects:
                break

        return results
