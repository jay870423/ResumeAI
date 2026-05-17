from abc import ABC, abstractmethod


class BaseOCR(ABC):
    """OCR基类"""

    @abstractmethod
    def extract_text(self, image_path: str) -> str:
        """从图片中提取文字"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """OCR方案名称"""
        pass
