import cv2

from .config import PipelineConfig


def parse_source(value: str):
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return value


class VideoStream:
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.source = parse_source(config.source)
        self.capture = cv2.VideoCapture(self.source)

        if config.capture_buffer:
            self.capture.set(cv2.CAP_PROP_BUFFERSIZE, config.capture_buffer)
        if config.capture_width:
            self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, config.capture_width)
        if config.capture_height:
            self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, config.capture_height)
        if config.capture_fps:
            self.capture.set(cv2.CAP_PROP_FPS, config.capture_fps)

    def is_opened(self) -> bool:
        return bool(self.capture.isOpened())

    def read(self):
        return self.capture.read()

    def release(self):
        self.capture.release()
