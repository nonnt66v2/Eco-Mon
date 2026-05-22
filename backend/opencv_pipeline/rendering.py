from __future__ import annotations

import cv2
import numpy as np

from .config import PipelineConfig
from .tracking import Track


class Renderer:
    def __init__(self, config: PipelineConfig):
        self.config = config

    def _scale_contour(self, contour: np.ndarray, scale: float) -> np.ndarray:
        if scale == 1.0:
            return contour
        return np.round(contour.astype("float32") * scale).astype("int32")

    def render(self, frame: np.ndarray, tracks: list[Track], fps: float, scale: float = 1.0) -> np.ndarray:
        output = frame.copy()

        for track in tracks:
            contour = self._scale_contour(track.contour, scale)
            hull = self._scale_contour(track.hull, scale)
            x, y, w, h = track.bbox
            x, y, w, h = (
                int(round(x * scale)),
                int(round(y * scale)),
                int(round(w * scale)),
                int(round(h * scale))
            )
            cx, cy = track.centroid
            cx = int(round(cx * scale))
            cy = int(round(cy * scale))

            cv2.drawContours(output, [contour], -1, (0, 200, 0), 2)
            cv2.drawContours(output, [hull], -1, (0, 255, 120), 1)
            cv2.rectangle(output, (x, y), (x + w, y + h), (255, 180, 0), 2)
            cv2.circle(output, (cx, cy), 4, (0, 0, 255), -1)

            label = f"ID {track.track_id} | A:{int(track.area)}"
            cv2.putText(
                output,
                label,
                (x, max(15, y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                3,
                cv2.LINE_AA
            )
            cv2.putText(
                output,
                label,
                (x, max(15, y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1,
                cv2.LINE_AA
            )

        cv2.putText(
            output,
            f"FPS: {fps:.1f}",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (20, 20, 20),
            3,
            cv2.LINE_AA
        )
        cv2.putText(
            output,
            f"FPS: {fps:.1f}",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 255),
            1,
            cv2.LINE_AA
        )

        return output
