from __future__ import annotations

from dataclasses import dataclass
from math import hypot

import numpy as np

from .config import PipelineConfig
from .recognition import DetectedObject


@dataclass
class Track:
    track_id: int
    contour: np.ndarray
    hull: np.ndarray
    approx: np.ndarray
    bbox: tuple[int, int, int, int]
    centroid: tuple[int, int]
    area: float
    hits: int = 1
    missing: int = 0


class SimpleTracker:
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.tracks: list[Track] = []
        self.next_id = 1

    def _distance(self, a: tuple[int, int], b: tuple[int, int]) -> float:
        return hypot(a[0] - b[0], a[1] - b[1])

    def _smooth(self, old: float, new: float) -> float:
        alpha = self.config.tracker_smoothing
        return (1 - alpha) * old + alpha * new

    def _smooth_bbox(
        self,
        old: tuple[int, int, int, int],
        new: tuple[int, int, int, int]
    ) -> tuple[int, int, int, int]:
        return (
            int(self._smooth(old[0], new[0])),
            int(self._smooth(old[1], new[1])),
            int(self._smooth(old[2], new[2])),
            int(self._smooth(old[3], new[3]))
        )

    def update(self, detections: list[DetectedObject]) -> list[Track]:
        unmatched_tracks = set(range(len(self.tracks)))

        for detection in detections:
            best_idx = None
            best_distance = None
            for idx in unmatched_tracks:
                track = self.tracks[idx]
                distance = self._distance(track.centroid, detection.centroid)
                is_better_match = best_distance is None or distance < best_distance
                if distance <= self.config.tracker_max_distance and is_better_match:
                    best_distance = distance
                    best_idx = idx

            if best_idx is None:
                self.tracks.append(
                    Track(
                        track_id=self.next_id,
                        contour=detection.contour,
                        hull=detection.hull,
                        approx=detection.approx,
                        bbox=detection.bbox,
                        centroid=detection.centroid,
                        area=detection.area
                    )
                )
                self.next_id += 1
                continue

            track = self.tracks[best_idx]
            track.bbox = self._smooth_bbox(track.bbox, detection.bbox)
            track.centroid = (
                int(self._smooth(track.centroid[0], detection.centroid[0])),
                int(self._smooth(track.centroid[1], detection.centroid[1]))
            )
            track.area = self._smooth(track.area, detection.area)
            track.contour = detection.contour
            track.hull = detection.hull
            track.approx = detection.approx
            track.hits += 1
            track.missing = 0
            unmatched_tracks.discard(best_idx)

        for idx in unmatched_tracks:
            self.tracks[idx].missing += 1

        self.tracks = [track for track in self.tracks if track.missing <= self.config.tracker_max_missing]

        return [
            track
            for track in self.tracks
            if track.hits >= self.config.tracker_min_hits
        ]
